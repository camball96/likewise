"""Image/text fingerprints with the Marqo FashionSigLIP model."""
from __future__ import annotations

import io
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import numpy as np

MODEL_ID = "hf-hub:Marqo/marqo-fashionSigLIP"
UA = "Mozilla/5.0 (compatible; likewise/1.0)"
DOWNLOAD_WIDTH = 360  # Shopify CDN resizes on the fly; the model only needs 224px


def image_key(url: str) -> str:
    return url.split("?")[0]


def sized_url(url: str, width: int) -> str:
    if "cdn.shopify.com" in url or "/cdn/shop/" in url:
        return url + ("&" if "?" in url else "?") + f"width={width}"
    return url


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

    req = urllib.request.Request(sized_url(src, DOWNLOAD_WIDTH), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGB")


def _safe_load(src: str):
    try:
        return load_image(src)
    except Exception:
        return None


def embed_sources(embedder: Embedder, sources: list[str], max_new: int | None = None, batch: int = 32) -> dict[str, np.ndarray]:
    """Download and fingerprint images. Returns {image_key: vector} for those that worked."""
    todo = list(dict.fromkeys(sources))
    if max_new is not None and len(todo) > max_new:
        print(f"  {len(todo)} images; fingerprinting {max_new} this run (rest next run)", flush=True)
        todo = todo[:max_new]

    out: dict[str, np.ndarray] = {}
    t0 = time.time()
    done = failed = 0
    with ThreadPoolExecutor(16) as pool:
        for i in range(0, len(todo), batch):
            chunk = todo[i : i + batch]
            ok = [(s, im) for s, im in zip(chunk, pool.map(_safe_load, chunk)) if im is not None]
            failed += len(chunk) - len(ok)
            if ok:
                for (s, _), v in zip(ok, embedder.images([im for _, im in ok])):
                    out[image_key(s)] = v
            done += len(chunk)
            if (i // batch) % 10 == 0 or done == len(todo):
                print(f"  fingerprinted {done}/{len(todo)} ({done / max(1e-6, time.time() - t0):.1f} img/s, {failed} failed)", flush=True)
    return out
