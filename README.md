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

**Style references from any link.** A link to one of our stores' products is added instantly. Any other link (another store, Pinterest, Instagram) is saved with the page's main image (`og:image`) as a pending `Reference`, and the app sends the photo to the fingerprint service on Modal (`pipeline/modal_app.py`), which usually returns within seconds. If that service isn't configured or fails, the app starts the ingest workflow with `references_only` instead, which takes a few minutes. Instagram often hides images from servers, in which case the user sees an error and can try another link.

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

## Fingerprint service (Modal)

`pipeline/modal_app.py` runs the same model as the ingest job behind a small web endpoint on [Modal](https://modal.com), so pasted links are fingerprinted in seconds. It shuts down 15 seconds after the last request (Modal bills every second a container is up) and starts again from a memory snapshot in a few seconds. A photo that was pasted before reuses its fingerprint without calling Modal.

1. `pip install modal` (in the pipeline's virtualenv) and `modal setup` to sign in.
2. From the repo root: `modal deploy pipeline/modal_app.py`. It prints the endpoint URL (ending in `-image.modal.run`).
3. Modal dashboard → Settings → **Proxy Auth Tokens** → create one. The endpoint rejects requests without it.
4. On Render (and in `.env` for local dev), set `MODAL_EMBED_URL` to the URL, and `MODAL_KEY` / `MODAL_SECRET` to the token's ID and secret.

After that, `.github/workflows/modal.yml` redeploys automatically whenever `pipeline/embed.py` or `pipeline/modal_app.py` changes on `production` (or run it by hand from the Actions tab). It needs two repository secrets, `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET`: create an API token in Modal → Settings → API Tokens.

## Photo uploads (Cloudflare R2)

Users can upload their own inspiration photos as well as pasting links. The browser shrinks each photo to a JPEG of at most 1024px (`src/lib/photo.ts`), the server stores it in a Cloudflare R2 bucket (`src/server/r2.ts`) and fingerprints it like a pasted link. Photos stay in the bucket after their reference is removed (deleted only on request, below).

Each user's uploads are stored under `uploads/<user id>/`. To delete everything someone uploaded: find their id (`SELECT id FROM "user" WHERE email = '…'`), then delete that folder in the bucket (Objects → `uploads/<id>/`).

`Reference.personal` flags uploads that are likely personal photos: taken on a phone or camera (the file names the device, checked in the browser before the photo is shrunk) or judged a selfie by the fingerprint service. It's a best guess, so treat every upload as potentially personal; the flag is for finding likely selfies in bulk (`SELECT "imageUrl" FROM "Reference" WHERE personal`).

1. Cloudflare dashboard → **R2** → create a bucket (e.g. `likewise-uploads`).
2. Bucket → **Settings → Public access**: connect a custom domain (e.g. `images.lkws.au`, if the domain's DNS is on Cloudflare) or enable the `r2.dev` URL. That's `R2_PUBLIC_URL` (no trailing slash).
3. R2 → **Manage API tokens** → create a token with **Object Read & Write** on that bucket. It gives an Access Key ID and Secret Access Key.
4. Set `R2_ACCOUNT_ID` (shown on the R2 overview page), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` and `R2_PUBLIC_URL` on Render and in `.env`.

## Contact page and email

`/contact` saves each message (general enquiry or feature request) in the `ContactMessage` table and, when `RESEND_API_KEY` is set, emails it to `CONTACT_EMAIL` with the sender as reply-to (`src/server/email.ts`).

1. **Receiving (hello@lkws.au):** Cloudflare → lkws.au → **Email → Email Routing** → enable, then add a custom address `hello` that forwards to your inbox (confirm the verification email).
2. **Sending (Resend):** create an account at resend.com → **Domains → Add domain** `lkws.au` → add the DNS records it shows in Cloudflare (DNS → Records) and wait for "Verified". Then **API Keys → Create** (sending access).
3. Set `RESEND_API_KEY` (and optionally `CONTACT_EMAIL` / `EMAIL_FROM`) on Render and in `.env`.

**Spam check (Cloudflare Turnstile):** Cloudflare → **Turnstile → Add widget** for `lkws.au` (and `localhost` for testing), then set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. The site key is built into the page, so on Render set it before the deploy builds. Without the keys the check is skipped.

`/privacy` is the privacy policy (`src/app/privacy/page.tsx`); update its date when it changes.

## Stores: crawling etiquette and removals

The ingest identifies itself as `likewise` (user agent links to `/for-stores`), follows each store's robots.txt (`robots_rules` in `pipeline/shopify.py`; if `?limit=` is disallowed it falls back to Shopify's default page size, and a store that disallows `/products.json` is skipped and its products stop showing), and makes at most about one request per second per store.

To remove a store on request (promised within one business day on `/for-stores`): set `"enabled": false` for it in `config/stores.json`, and hide it immediately with `UPDATE "Store" SET active = false WHERE id = '<key>';`. Store enquiries arrive through `/contact?type=store`.
