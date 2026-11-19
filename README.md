# styleit

Sign in, create outfits ("Formal dresses", "PJs"), add a few pieces you love, and scroll a feed of clothes from curated Australian stores ranked by how alike they look. Tapping a product opens it on the brand's site.

This repo holds two things:

- **The web app** (repo root): Next.js, TypeScript, Tailwind + shadcn/ui, tRPC + zod, Better Auth, Prisma on Postgres + pgvector. Hosted on Render.
- **The catalogue pipeline** (`pipeline/`, `config/`): Python job that fetches products from each store in `config/stores.json` and makes an image fingerprint for every photo. `pipeline/ingest.py` writes them into the app's Postgres daily (`.github/workflows/ingest.yml`); `pipeline/build.py` still publishes the original static MVP in `site/`.

## App structure

```
prisma/schema.prisma       all tables (stores, products, outfits, auth)
prisma/migrations/         SQL migrations (first one enables pgvector)
src/server/                db client, Better Auth, tRPC setup, router.ts (every API procedure)
src/app/                   pages: sign-in, outfits/[id]; routes: api/auth, api/trpc, go/[productId]
src/components/            product card, outfit dialog, shadcn ui/
src/proxy.ts               sends signed-out visitors to /sign-in
```

The feed is one SQL query in `src/server/router.ts`: it averages the fingerprints of the outfit's style references and hearts (hearts count double) and returns the nearest in-stock products from the outfit's stores, skipping anything already shown or reacted to. With no references yet it shows the newest products.

**Style references from any link.** A link to one of our stores' products is added instantly. Any other link (another store, Pinterest, Instagram) is saved with the page's main image (`og:image`) as a pending `Reference`; the app then starts the ingest workflow with `references_only`, which fingerprints it within a couple of minutes. Instagram often hides images from servers, in which case the user sees an error and can try another link.

## Run locally

1. Start the local database (Postgres 17 with pgvector, in Docker):
   ```bash
   docker compose up -d
   ```
2. Point the app at it and create the tables:
   ```bash
   cp .env.example .env    # DATABASE_URL is already set for Docker; add BETTER_AUTH_SECRET
   npm install             # also generates the Prisma client
   npm run db:migrate
   npm run dev             # http://localhost:3000
   ```
3. Copy the stores and products from the Render database (after its first ingest run), so you don't need Python locally (the commands run inside the container, so no Postgres tools are needed on your Mac). Set `PROD_DATABASE_URL` in `.env` to Render's **External** URL, then:
   ```bash
   set -a; source .env; set +a
   docker compose exec -T db psql -U postgres styleit -c 'TRUNCATE "Store" CASCADE'
   docker compose exec -T db pg_dump "$PROD_DATABASE_URL" --data-only --table='"Store"' --table='"Product"' \
     | docker compose exec -T db psql -U postgres styleit
   ```
   Re-run step 3 whenever you want fresh products. It also clears local outfits, which point at products.

Schema changes: edit `prisma/schema.prisma`, then `npx prisma migrate dev --name what-changed` creates the migration and applies it locally. Commit it; Render applies it on the next deploy.

## Deploy on Render

1. **Postgres:** create a Render Postgres database (newest Postgres version).
2. **Web service** from this repo:
   - Build command: `npm ci && npm run db:migrate && npm run build`
   - Start command: `npm start`
   - Environment variables: `DATABASE_URL` (the database's Internal URL), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the service's public URL), `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPO`, `GITHUB_BRANCH`, and optionally `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (see `.env.example`)
3. **GitHub:** add a repository secret `DATABASE_URL` = the database's **External** URL (Settings → Secrets and variables → Actions), then run *Ingest catalogue into Postgres* once from the Actions tab. The first run fingerprints up to 8,000 photos (about 20–30 minutes); daily runs after that only process new products.
4. `GITHUB_DISPATCH_TOKEN`: a fine-grained personal access token limited to this repo with **Actions: Read and write**.

**Google sign-in:** in Google Cloud Console, create an OAuth client (Web application) with redirect URI `<BETTER_AUTH_URL>/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for local dev).

---

# Static MVP (`site/`, `pipeline/`)

The original single-user version: a static site on GitHub Pages, rebuilt daily by `.github/workflows/build.yml`.

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

### Deploy (one-time setup)

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

### Tuning it

| Want to…                           | Edit                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Add style references               | `config/seeds.json` → add product URLs to `products`, or drop photos/screenshots into `config/seed-images/` |
| Add a store                        | `config/stores.json` (any Shopify store — check `https://<domain>/products.json` loads)                     |
| Pause a store                      | add `"enabled": false` to its entry                                                                         |
| Add a "vibe" filter chip           | `config/vibes.json` — a name plus a plain-English description                                               |
| Pull more/fewer products per store | `defaults.max_products` in `config/stores.json`                                                             |

Every store in the list was checked as Australian-based (Shopify `meta.json` reports country AU, currency AUD).

### Run locally

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r pipeline/requirements.txt

python pipeline/build.py --max-products 100         # quick build; full: no flags
python -m http.server 8000 -d site                  # open http://localhost:8000
```

Useful flags: `--stores bronzesnake,vrggrl` (subset), `--max-new 500` (cap new embeddings).

### How the ranking works

- Each photo becomes a 256-number "style fingerprint" from a fashion-specific image model ([Marqo FashionSigLIP](https://huggingface.co/Marqo/marqo-fashionSigLIP)), projected through a fixed basis (`pipeline/basis.npz` — keep it committed so saved hearts stay comparable across builds).
- A product's score blends similarity to the _average_ of her taste with similarity to her _closest few_ individual favourites (so several distinct looks can coexist), and is pushed down if it closely resembles things she ✕'d.
- Hearts count double compared with reference photos. Hearted items keep their fingerprint even after they sell out.
- The feed hides near-identical pieces (same style, other colour), avoids long runs from one store, and slips in an occasional wildcard so it doesn't collapse onto one look.
- **Similar** re-ranks everything around one piece; **vibes** steer by a text description.

Her hearts and skips live in her browser's local storage, so they're per-device.

### Files

```
config/        stores, style references, vibes
pipeline/      build.py (orchestration), shopify.py (fetch + clean), embed.py (model + cache), basis.npz
site/          index.html, app.js, style.css  (+ data/ generated at build time)
.github/       daily build + Pages deploy
```

Be a polite guest: the fetcher reads only public product listings, about one request per second per store, once a day.
