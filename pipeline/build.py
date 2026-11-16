"""
Build the styleit catalogue:
  1. pull products from every store in config/stores.json
  2. embed each product photo with a fashion image model (cached between runs)
  3. embed style references (config/seeds.json) and vibes (config/vibes.json)
  4. project to a compact fixed basis, quantise, and write site/data/

Usage:  python pipeline/build.py [--stores bronzesnake,vrggrl] [--max-products 200] [--max-new 8000]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import shopify  # noqa: E402
from embed import EmbeddingCache, Embedder, embed_sources, image_key  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config"
OUT = ROOT / "site" / "data"
CACHE = ROOT / ".cache" / "embeddings.npz"
BASIS = Path(__file__).parent / "basis.npz"
DIM = 256

# zero-shot labels for products whose title/type didn't say what they are
ZS_LABELS = {
    "Dresses": "a photo of a woman wearing a dress",
    "Tops": "a photo of a woman wearing a top",
    "Skirts": "a photo of a woman wearing a skirt",
    "Shorts": "a photo of a woman wearing shorts",
    "Pants": "a photo of a woman wearing pants or jeans",
    "Sets": "a photo of a woman wearing a matching two piece set",
    "Knitwear": "a photo of a woman wearing a knit jumper or cardigan",
    "Outerwear": "a photo of a woman wearing a jacket or coat",
    "Jumpsuits": "a photo of a woman wearing a jumpsuit",
    "Swim": "a photo of a woman wearing swimwear",
    None: "a product photo of shoes, a bag, jewellery, a hat or an accessory",
}


def log(*a):
    print(*a, flush=True)


def load_json(p: Path):
    return json.loads(p.read_text())


def fetch_all(stores: list[dict], max_override: int | None) -> tuple[list[dict], dict]:
    defaults = load_json(CONFIG / "stores.json").get("defaults", {})
    stats = {}

    def work(store):
        cap = max_override or store.get("max_products") or defaults.get("max_products", 750)
        try:
            cur = shopify.store_currency(store["domain"])
            raw = shopify.fetch_store(store["domain"], cap)
        except Exception as e:
            log(f"  ! {store['name']}: {e}")
            return store, [], f"error: {e}"
        items = [x for x in (shopify.normalise(store, p, cur) for p in raw) if x]
        return store, items, f"{len(raw)} fetched, {len(items)} clothing in stock"

    items: list[dict] = []
    with ThreadPoolExecutor(6) as pool:
        for store, got, msg in pool.map(work, stores):
            log(f"  {store['name']:<20} {msg}")
            stats[store["key"]] = len(got)
            items.extend(got)
    seen, unique = set(), []
    for it in items:
        if it["id"] not in seen:
            seen.add(it["id"])
            unique.append(it)
    return unique, stats


def seed_sources(seeds: dict) -> list[tuple[str, str, str]]:
    """-> [(label, link, image_src)] ; two photos per seed product."""
    out = []
    for url in seeds.get("products", []):
        try:
            p = shopify.fetch_product_by_url(url)
        except Exception as e:
            log(f"  ! seed {url}: {e}")
            continue
        if not p or not p.get("images"):
            log(f"  ! seed {url}: no product/images")
            continue
        for img in p["images"][:2]:
            out.append((p["title"], url, img["src"]))
    for src in seeds.get("images", []):
        path = src if src.startswith("http") else str(CONFIG / "seed-images" / src)
        out.append((Path(src).name, src if src.startswith("http") else "", path))
    folder = CONFIG / "seed-images"
    if folder.exists():
        listed = set(seeds.get("images", []))
        for f in sorted(folder.iterdir()):
            if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} and f.name not in listed:
                out.append((f.stem, "", str(f)))
    return out


def get_basis(item_vecs: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Fixed PCA basis so vectors stay comparable across runs (saved hearts keep working)."""
    if BASIS.exists():
        z = np.load(BASIS)
        return z["mean"], z["W"].astype(np.float32)
    log(f"  fitting new {DIM}-d basis on {len(item_vecs)} items -> {BASIS.name} (commit this file!)")
    mean = item_vecs.mean(0)
    _, _, vt = np.linalg.svd(item_vecs - mean, full_matrices=False)
    W = vt[:DIM].T.astype(np.float32)
    np.savez(BASIS, mean=mean.astype(np.float32), W=W.astype(np.float16))
    return mean, W


def quantise(v: np.ndarray) -> np.ndarray:
    v = v / (np.linalg.norm(v, axis=1, keepdims=True) + 1e-8)
    scale = np.abs(v).max(axis=1, keepdims=True) + 1e-8
    return np.round(v / scale * 127).astype(np.int8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--stores", help="comma-separated store keys (default: all enabled)")
    ap.add_argument("--max-products", type=int, help="override per-store product cap")
    ap.add_argument("--max-new", type=int, default=8000, help="max new images to embed this run")
    args = ap.parse_args()
    t0 = time.time()

    stores = [s for s in load_json(CONFIG / "stores.json")["stores"] if s.get("enabled", True)]
    if args.stores:
        keys = set(args.stores.split(","))
        stores = [s for s in stores if s["key"] in keys]
    seeds = load_json(CONFIG / "seeds.json")
    vibes = load_json(CONFIG / "vibes.json")["vibes"]

    log(f"[1/4] fetching {len(stores)} stores")
    items, stats = fetch_all(stores, args.max_products)
    log(f"  total: {len(items)} items")

    log("[2/4] loading model")
    embedder = Embedder()
    cache = EmbeddingCache(CACHE)

    log("[3/4] embedding style references + products")
    seed_list = seed_sources(seeds)
    seed_vecs_map = embed_sources(embedder, cache, [s for _, _, s in seed_list], log=log)
    seed_list = [s for s in seed_list if image_key(s[2]) in seed_vecs_map]
    vec_map = embed_sources(embedder, cache, [it["img"] for it in items], max_new=args.max_new, log=log)
    cache.save()
    items = [it for it in items if image_key(it["img"]) in vec_map]
    X = np.stack([vec_map[image_key(it["img"])] for it in items]).astype(np.float32)

    # zero-shot category for unlabelled items; drop non-clothing
    unknown = [i for i, it in enumerate(items) if not it["cat"]]
    if unknown:
        labels = list(ZS_LABELS.keys())
        T = embedder.text(list(ZS_LABELS.values()))
        pred = (X[unknown] @ T.T).argmax(1)
        for i, k in zip(unknown, pred):
            items[i]["cat"] = labels[k]
        keep = [i for i, it in enumerate(items) if it["cat"]]
        log(f"  zero-shot labelled {len(unknown)} items; dropped {len(items) - len(keep)} non-clothing")
        items = [items[i] for i in keep]
        X = X[keep]

    V = embedder.text([v["prompt"] for v in vibes])
    S = np.stack([seed_vecs_map[image_key(s)] for _, _, s in seed_list]) if seed_list else np.zeros((0, X.shape[1]))

    log("[4/4] writing site data")
    mean, W = get_basis(X)
    rows = np.concatenate([(X - mean) @ W, (S - mean) @ W, V @ W])  # text: no centring (keeps ranking)
    Q = quantise(rows)

    # newest first is a nice default tie-break order
    order = sorted(range(len(items)), key=lambda i: -items[i]["published"])
    items = [items[i] for i in order]
    Q = np.concatenate([Q[: len(order)][order], Q[len(order) :]])

    store_idx = {s["key"]: i for i, s in enumerate(stores)}
    cats = shopify.CATEGORIES
    OUT.mkdir(parents=True, exist_ok=True)
    catalog = {
        "generated": int(time.time()),
        "dim": int(Q.shape[1]),
        "stores": [{"key": s["key"], "name": s["name"], "domain": s["domain"], "count": stats.get(s["key"], 0)} for s in stores],
        "categories": cats,
        "fields": ["id", "store", "title", "url", "img", "price", "compare", "cat", "sizes", "published"],
        "items": [
            [it["id"], store_idx[it["store"]], it["title"], it["url"], it["img"], it["price"], it["compare"],
             cats.index(it["cat"]), " ".join(it["sizes"]), it["published"]]
            for it in items
        ],
        "currency": sorted({it["currency"] for it in items}),
        "seeds": [{"title": t, "url": u, "img": s if s.startswith("http") else ""} for t, u, s in seed_list],
        "vibes": [v["name"] for v in vibes],
    }
    (OUT / "catalog.json").write_text(json.dumps(catalog, separators=(",", ":"), ensure_ascii=False))
    (OUT / "vectors.bin").write_bytes(Q.tobytes())
    log(f"  {len(items)} items, {len(seed_list)} reference photos, {len(vibes)} vibes")
    log(f"  catalog.json {(OUT / 'catalog.json').stat().st_size / 1e6:.1f} MB, vectors.bin {(OUT / 'vectors.bin').stat().st_size / 1e6:.1f} MB")
    log(f"done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
