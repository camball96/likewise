"""Image/text embeddings with Marqo FashionSigLIP, plus an on-disk cache so each image is only embedded once."""
from __future__ import annotations

import io
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

MODEL_ID = "hf-hub:Marqo/marqo-fashionSigLIP"
UA = "Mozilla/5.0 (compatible; styleit/1.0)"
DOWNLOAD_WIDTH = 360  # Shopify CDN resizes on the fly; the model only needs 224px


def image_key(url: str) -> str:
    return url.split("?")[0]


def sized_url(url: str, width: int) -> str:
    if "cdn.shopify.com" in url or "/cdn/shop/" in url:
        return url + ("&" if "?" in url else "?") + f"width={width}"
    return url


class EmbeddingCache:
    """keys -> float16 vectors, with a last-seen day so stale entries can be pruned."""

    def __init__(self, path: Path):
        self.path = path
        self.vecs: dict[str, np.ndarray] = {}
        self.seen: dict[str, int] = {}
        if path.exists():
            z = np.load(path, allow_pickle=False)
            for k, v, s in zip(z["keys"], z["vecs"], z["seen"]):
                self.vecs[str(k)] = v
                self.seen[str(k)] = int(s)
        self.today = int(time.time() // 86400)

    def get(self, key: str):
        v = self.vecs.get(key)
        if v is not None:
            self.seen[key] = self.today
        return v

    def put(self, key: str, vec: np.ndarray):
        self.vecs[key] = vec.astype(np.float16)
        self.seen[key] = self.today

    def save(self, keep_days: int = 30):
        keys = [k for k in self.vecs if self.today - self.seen.get(k, 0) <= keep_days]
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp.npz")
        np.savez_compressed(
            tmp,
            keys=np.array(keys),
            vecs=np.stack([self.vecs[k] for k in keys]) if keys else np.zeros((0, 768), np.float16),
            seen=np.array([self.seen[k] for k in keys], dtype=np.int32),
        )
        os.replace(tmp, self.path)


class Embedder:
    def __init__(self):
        import open_clip
        import torch

        torch.set_num_threads(max(1, os.cpu_count() or 1))
        self.torch = torch
        self.model, _, self.preprocess = open_clip.create_model_and_transforms(MODEL_ID)
        self.tokenizer = open_clip.get_tokenizer(MODEL_ID)
        self.model.eval()

    def text(self, prompts: list[str]) -> np.ndarray:
        with self.torch.no_grad():
            e = self.model.encode_text(self.tokenizer(prompts), normalize=True)
        return e.float().numpy()

    def images(self, pil_images) -> np.ndarray:
        with self.torch.no_grad():
            x = self.torch.stack([self.preprocess(im) for im in pil_images])
            e = self.model.encode_image(x, normalize=True)
        return e.float().numpy()


def load_image(src: str):
    from PIL import Image

    if src.startswith("http"):
        req = urllib.request.Request(sized_url(src, DOWNLOAD_WIDTH), headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        im = Image.open(io.BytesIO(data))
    else:
        im = Image.open(src)
    return im.convert("RGB")


def embed_sources(
    embedder: Embedder,
    cache: EmbeddingCache,
    sources: list[str],
    max_new: int | None = None,
    batch: int = 32,
    log=print,
) -> dict[str, np.ndarray]:
    """Return {image_key: vector} for every source we could embed (cached or new)."""
    out: dict[str, np.ndarray] = {}
    todo: list[str] = []
    for s in dict.fromkeys(sources):
        k = image_key(s)
        v = cache.get(k)
        if v is not None:
            out[k] = v.astype(np.float32)
        else:
            todo.append(s)
    if max_new is not None and len(todo) > max_new:
        log(f"  {len(todo)} new images; embedding {max_new} this run (rest next run)")
        todo = todo[:max_new]
    log(f"  cached: {len(out)}, to embed: {len(todo)}")

    t0 = time.time()
    done = failed = 0
    with ThreadPoolExecutor(16) as pool:
        for i in range(0, len(todo), batch):
            chunk = todo[i : i + batch]
            results = list(pool.map(_safe_load, chunk))
            ok = [(s, im) for s, im in zip(chunk, results) if im is not None]
            failed += len(chunk) - len(ok)
            if ok:
                vecs = embedder.images([im for _, im in ok])
                for (s, _), v in zip(ok, vecs):
                    cache.put(image_key(s), v)
                    out[image_key(s)] = v
            done += len(chunk)
            if (i // batch) % 10 == 0 or done == len(todo):
                rate = done / max(1e-6, time.time() - t0)
                log(f"  embedded {done}/{len(todo)} ({rate:.1f} img/s, {failed} failed)")
            if (i // batch) % 50 == 49:
                cache.save()  # checkpoint long first runs
    return out


def _safe_load(src: str):
    try:
        return load_image(src)
    except Exception:
        return None
