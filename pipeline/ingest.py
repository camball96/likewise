"""
Load the catalogue into the app's Postgres database.

  python pipeline/ingest.py                    # daily: stores + products + fingerprints, then pending references
  python pipeline/ingest.py --references-only  # just fingerprint style references users pasted as links

Needs DATABASE_URL. Only photos without a fingerprint (new products, changed images) go through the model.
"""
from __future__ import annotations

import argparse
import functools
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import psycopg

sys.path.insert(0, str(Path(__file__).parent))
import shopify  # noqa: E402
from embed import Embedder, embed_sources, image_key  # noqa: E402

CONFIG = Path(__file__).resolve().parent.parent / "config" / "stores.json"

# labels for products whose title doesn't say what they are (matched against the photo)
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
    "Sleepwear": "a photo of a woman wearing pyjamas or sleepwear",
    None: "a product photo of shoes, a bag, jewellery, a hat or an accessory",
}


def vec(v: np.ndarray) -> str:
    v = v.astype(np.float32)
    v = v / (np.linalg.norm(v) + 1e-8)
    return "[" + ",".join(f"{x:.5f}" for x in v) + "]"


@functools.cache
def get_embedder() -> Embedder:
    return Embedder()  # loads the model (a few seconds), only when there's something to fingerprint


def ingest_products(conn, max_new: int):
    cfg = json.loads(CONFIG.read_text())
    stores = [s for s in cfg["stores"] if s.get("enabled", True)]
    cap = cfg.get("defaults", {}).get("max_products", 750)

    with conn.cursor() as cur:
        for s in cfg["stores"]:
            cur.execute(
                'INSERT INTO "Store" (id, name, domain, active) VALUES (%s, %s, %s, %s) '
                "ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, domain = EXCLUDED.domain, active = EXCLUDED.active",
                (s["key"], s["name"], s["domain"], s.get("enabled", True)),
            )
        # what we already have: image per product, and whether it has a fingerprint
        cur.execute('SELECT "storeId", "externalId", "imageUrl", embedding IS NOT NULL, category FROM "Product"')
        known = {(r[0], r[1]): r[2:] for r in cur.fetchall()}
    conn.commit()

    def fetch(store):
        try:
            raw = shopify.fetch_store(store["domain"], store.get("max_products", cap))
            return store, [x for x in (shopify.normalise(store, p) for p in raw) if x], None
        except Exception as e:
            return store, [], e

    with ThreadPoolExecutor(6) as pool:
        results = list(pool.map(fetch, stores))

    items, ok_stores = [], []
    for store, got, err in results:
        print(f"  {store['name']:<20} {'error: ' + str(err) if err else f'{len(got)} in stock'}", flush=True)
        if not err:
            ok_stores.append((store["key"], got))
            items.extend(got)

    # fingerprint only new or changed photos
    def needs(it):
        image, has, category = known.get((it["store"], it["id"].split(":", 1)[1]), (None, False, None))
        it["cat"] = it["cat"] or category  # keep an earlier label
        return not has or image_key(image) != image_key(it["img"])

    todo = [it for it in items if needs(it)]
    print(f"  {len(items)} products, {len(todo)} need a fingerprint", flush=True)
    vecs = embed_sources(get_embedder(), [it["img"] for it in todo], max_new=max_new)

    # label products whose title didn't say what they are; drop non-clothing
    unknown = [it for it in todo if not it["cat"] and image_key(it["img"]) in vecs]
    if unknown:
        labels = list(ZS_LABELS)
        T = get_embedder().text(list(ZS_LABELS.values()))
        X = np.stack([vecs[image_key(it["img"])] for it in unknown])
        for it, k in zip(unknown, (X @ T.T).argmax(1)):
            it["cat"] = labels[k]

    rows = []
    for it in items:
        v = vecs.get(image_key(it["img"]))
        if not it["cat"]:
            continue  # not labelled yet (no fingerprint this run) or not clothing
        rows.append((
            it["store"], it["id"].split(":", 1)[1], it["title"], it["url"], it["img"], it["price"],
            it["compare"] or None, it["cat"], it["sizes"], it["published"], vec(v) if v is not None else None,
        ))

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO "Product" (id, "storeId", "externalId", title, url, "imageUrl", price, "compareAt",
                                   category, sizes, "inStock", "publishedAt", embedding, "updatedAt")
            VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s, %s, %s, true, to_timestamp(%s), %s::vector, now())
            ON CONFLICT ("storeId", "externalId") DO UPDATE SET
              title = EXCLUDED.title, url = EXCLUDED.url, "imageUrl" = EXCLUDED."imageUrl", price = EXCLUDED.price,
              "compareAt" = EXCLUDED."compareAt", category = EXCLUDED.category, sizes = EXCLUDED.sizes,
              "inStock" = true, embedding = COALESCE(EXCLUDED.embedding, "Product".embedding), "updatedAt" = now()
            """,
            rows,
        )
        # anything a store no longer lists as in-stock clothing
        for store_key, got in ok_stores:
            ids = [it["id"].split(":", 1)[1] for it in got]
            cur.execute(
                'UPDATE "Product" SET "inStock" = false, "updatedAt" = now() '
                'WHERE "storeId" = %s AND "inStock" AND NOT ("externalId" = ANY(%s))',
                (store_key, ids),
            )
            cur.execute('UPDATE "Store" SET "lastSyncedAt" = now() WHERE id = %s', (store_key,))
    conn.commit()
    print(f"  upserted {len(rows)} products", flush=True)


def ingest_references(conn):
    with conn.cursor() as cur:
        cur.execute('SELECT id, "imageUrl" FROM "Reference" WHERE status = \'PENDING\'')
        pending = cur.fetchall()
    if not pending:
        print("  no pending references", flush=True)
        return
    vecs = embed_sources(get_embedder(), [url for _, url in pending])
    ready = 0
    with conn.cursor() as cur:
        for ref_id, url in pending:
            v = vecs.get(image_key(url))
            if v is None:
                cur.execute('UPDATE "Reference" SET status = \'FAILED\' WHERE id = %s', (ref_id,))
            else:
                cur.execute('UPDATE "Reference" SET status = \'READY\', embedding = %s::vector WHERE id = %s', (vec(v), ref_id))
                ready += 1
    conn.commit()
    print(f"  {ready}/{len(pending)} references ready", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--references-only", action="store_true")
    ap.add_argument("--max-new", type=int, default=8000, help="max new product photos to fingerprint this run")
    args = ap.parse_args()
    t0 = time.time()

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        if not args.references_only:
            print("[products]", flush=True)
            ingest_products(conn, args.max_new)
        print("[references]", flush=True)
        ingest_references(conn)
    print(f"done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
