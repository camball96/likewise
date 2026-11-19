# likewise

Sign in, create outfits ("Formal dresses", "PJs"), add a few pieces you love, and scroll a feed of clothes from curated Australian stores ranked by how alike they look. Tapping a product opens it on the brand's site.

This repo holds two things:

- **The web app** (repo root): Next.js, TypeScript, Tailwind + shadcn/ui, tRPC + zod, Better Auth, Prisma on Postgres + pgvector. Hosted on Render.
- **The catalogue pipeline** (`pipeline/`, `config/stores.json`): `pipeline/ingest.py` fetches products from each store, makes an image fingerprint for every new photo with [Marqo FashionSigLIP](https://huggingface.co/Marqo/marqo-fashionSigLIP), and writes them into the app's Postgres. Runs daily in GitHub Actions (`.github/workflows/ingest.yml`).

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

1. Start the local database (Postgres 18 with pgvector, in Docker):
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
   docker compose exec -T db psql -U postgres likewise -c 'TRUNCATE "Store" CASCADE'
   docker compose exec -T db pg_dump "$PROD_DATABASE_URL" --data-only --table='"Store"' --table='"Product"' \
     | docker compose exec -T db psql -U postgres likewise
   ```
   Re-run step 3 whenever you want fresh products. It also clears local outfits, which point at products.

   Or load products yourself by running the pipeline locally (runs the image model on your machine):
   ```bash
   python3 -m venv .venv && source .venv/bin/activate
   pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
   pip install -r pipeline/requirements.txt
   set -a; source .env; set +a
   python pipeline/ingest.py --max-new 500   # drop the flag to fingerprint everything
   ```

   **Pasted inspiration links locally:** these are fingerprinted by the pipeline, which normally runs in GitHub Actions against the Render database. Locally, run it yourself after pasting links (same Python setup as above): `python pipeline/ingest.py --references-only`.

Schema changes: edit `prisma/schema.prisma`, then `npx prisma migrate dev --name what-changed` creates the migration and applies it locally. Commit it; Render applies it on the next deploy.

## Deploy on Render

1. **Postgres:** create a Render Postgres database (newest Postgres version).
2. **Web service** from this repo:
   - Build command: `npm ci && npm run db:migrate && npm run build`
   - Start command: `npm start`
   - Environment variables: `DATABASE_URL` (the database's Internal URL), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the service's public URL), `GITHUB_DISPATCH_TOKEN`, and optionally `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (see `.env.example`)
3. **GitHub:** add a repository secret `DATABASE_URL` = the database's **External** URL (Settings → Secrets and variables → Actions), then run *Ingest catalogue into Postgres* once from the Actions tab. The first run fingerprints up to 8,000 photos (about 20–30 minutes); daily runs after that only process new products.
4. `GITHUB_DISPATCH_TOKEN`: a fine-grained personal access token limited to this repo with **Actions: Read and write**.

**Google sign-in:** in Google Cloud Console, create an OAuth client (Web application) with redirect URI `<BETTER_AUTH_URL>/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for local dev).
