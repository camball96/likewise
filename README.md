# styleit

A personal clothing feed. It pulls new-in products from ~30 Australian fashion stores every day, ranks them by **how they look** compared with pieces she loves, and learns from every ♥ and ✕. Tapping a product opens it on the brand's own site.

Built as a static site on GitHub Pages: a scheduled GitHub Action does the heavy lifting, and the browser does the personalised ranking.

```
┌─────────────────────── GitHub Actions (daily) ───────────────────────┐
│ config/stores.json ─► fetch /products.json from each Shopify store   │
│                       keep in-stock women's clothing                 │
│ product photos ─────► Marqo FashionSigLIP image model ─► vectors     │
│ config/seeds.json ──► her style references ─► vectors                │
│ config/vibes.json ──► text prompts ("crochet", "off-shoulder") ─►    │
│                       vectors                                        │
│ ─► site/data/catalog.json + vectors.bin ─► deploy to GitHub Pages    │
└──────────────────────────────────────────────────────────────────────┘
┌──────────────────────────── Browser ─────────────────────────────────┐
│ score = similarity to references + hearts, minus similarity to ✕s    │
│ filters, vibes, "Similar", saved list — all stored in localStorage   │
└──────────────────────────────────────────────────────────────────────┘
```

## Deploy (one-time setup)

1. Create a GitHub repo (e.g. `styleit`) and push this folder (the workflow builds on pushes to `production` or `main`):
   ```bash
   cd ~/Documents/Code/styleit
   git init -b main && git add . && git commit -m "styleit v1"
   git remote add origin git@github.com:<you>/styleit.git
   git push -u origin main
   ```
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Actions** tab → _Build catalogue & deploy_ → **Run workflow** (the push also triggers it).
   The first run embeds up to 8,000 product photos (~20–30 min); later runs only process new products (a few minutes).
4. The site is live at `https://<you>.github.io/styleit/`. On her phone: Share → **Add to Home Screen** for an app-like icon.

It rebuilds daily at ~3am Brisbane time. Note: GitHub pauses scheduled workflows after 60 days with no commits to the repo — any commit (or re-enabling in the Actions tab) restarts it.

## Tuning it

| Want to…                           | Edit                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Add style references               | `config/seeds.json` → add product URLs to `products`, or drop photos/screenshots into `config/seed-images/` |
| Add a store                        | `config/stores.json` (any Shopify store — check `https://<domain>/products.json` loads)                     |
| Pause a store                      | add `"enabled": false` to its entry                                                                         |
| Add a "vibe" filter chip           | `config/vibes.json` — a name plus a plain-English description                                               |
| Pull more/fewer products per store | `defaults.max_products` in `config/stores.json`                                                             |

Every store in the list was checked as Australian-based (Shopify `meta.json` reports country AU, currency AUD).

## Run locally

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r pipeline/requirements.txt

python pipeline/build.py --max-products 100         # quick build; full: no flags
python -m http.server 8000 -d site                  # open http://localhost:8000
```

Useful flags: `--stores bronzesnake,vrggrl` (subset), `--max-new 500` (cap new embeddings).

## How the ranking works

- Each photo becomes a 256-number "style fingerprint" from a fashion-specific image model ([Marqo FashionSigLIP](https://huggingface.co/Marqo/marqo-fashionSigLIP)), projected through a fixed basis (`pipeline/basis.npz` — keep it committed so saved hearts stay comparable across builds).
- A product's score blends similarity to the _average_ of her taste with similarity to her _closest few_ individual favourites (so several distinct looks can coexist), and is pushed down if it closely resembles things she ✕'d.
- Hearts count double compared with reference photos. Hearted items keep their fingerprint even after they sell out.
- The feed hides near-identical pieces (same style, other colour), avoids long runs from one store, and slips in an occasional wildcard so it doesn't collapse onto one look.
- **Similar** re-ranks everything around one piece; **vibes** steer by a text description.

Her hearts and skips live in her browser's local storage, so they're per-device.

## Files

```
config/        stores, style references, vibes
pipeline/      build.py (orchestration), shopify.py (fetch + clean), embed.py (model + cache), basis.npz
site/          index.html, app.js, style.css  (+ data/ generated at build time)
.github/       daily build + Pages deploy
```

Be a polite guest: the fetcher reads only public product listings, about one request per second per store, once a day.

<!--  -->
