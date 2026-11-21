"""Fingerprint service on Modal: the app sends a photo URL, gets its fingerprint back in about a second.

Deploy (from the repo root):  modal deploy pipeline/modal_app.py
The endpoint needs a Modal proxy auth token (Modal dashboard → Settings → Proxy Auth Tokens), sent as the
Modal-Key / Modal-Secret headers. See README → "Fingerprint service (Modal)".
"""
import modal


def download_model():
    import open_clip

    # baked into the image, so containers start without downloading it (same model as embed.MODEL_ID)
    open_clip.create_model_and_transforms("hf-hub:Marqo/marqo-fashionSigLIP")


image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install("torch", "torchvision", index_url="https://download.pytorch.org/whl/cpu")
    .pip_install("open_clip_torch>=3.0", "transformers>=4.40", "sentencepiece", "protobuf", "timm", "ftfy", "numpy", "pillow", "fastapi[standard]")
    .run_function(download_model)
    .add_local_python_source("embed")
)
app = modal.App("likewise", image=image)


# Costs are per second while a container is up, so it's kept small and short-lived:
# - 1 CPU core is plenty for one photo at a time (about a second each)
# - it shuts down 15s after the last request; the next request then waits while it starts
# - a memory snapshot of the loaded model makes those starts a few seconds instead of ~30
@app.cls(cpu=1, memory=4096, scaledown_window=15, enable_memory_snapshot=True)
@modal.concurrent(max_inputs=4)
class Fingerprint:
    @modal.enter(snap=True)
    def load(self):
        from embed import Embedder

        self.embedder = Embedder()

    @modal.enter()
    def after_restore(self):
        import torch

        torch.set_num_threads(1)  # match cpu=1 (the container reports the host's cores)

    @modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
    def image(self, body: dict):
        from fastapi import HTTPException

        from embed import load_image

        try:
            photo = load_image(body["url"])
        except Exception as e:
            raise HTTPException(422, f"couldn't download the image: {e}")
        return {"embedding": self.embedder.images([photo])[0].tolist()}
