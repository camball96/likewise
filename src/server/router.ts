import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { deleteImage, uploadImage } from "./r2";
import { protectedProcedure, router } from "./trpc";

const PAGE_SIZE = 24;

type FeedProduct = {
  id: string;
  title: string;
  url: string;
  imageUrl: string;
  hoverImageUrl: string | null;
  price: number;
  compareAt: number | null;
  isNew: boolean;
  store: string;
};

export const appRouter = router({
  stores: protectedProcedure.query(({ ctx }) =>
    ctx.db.store.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ),

  outfits: router({
    list: protectedProcedure.query(({ ctx }) =>
      ctx.db.outfit.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: "asc" },
        include: { stores: { select: { id: true } } },
      }),
    ),

    save: protectedProcedure
      .input(
        z.object({
          id: z.string().optional(),
          name: z.string().trim().min(1).max(40),
          categories: z.array(z.string()),
          storeIds: z.array(z.string()),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const stores = input.storeIds.map((id) => ({ id }));
        const data = { name: input.name, categories: input.categories };
        if (!input.id) {
          return ctx.db.outfit.create({ data: { ...data, userId: ctx.user.id, stores: { connect: stores } } });
        }
        await ownOutfit(ctx, input.id);
        return ctx.db.outfit.update({ where: { id: input.id }, data: { ...data, stores: { set: stores } } });
      }),

    delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      await ownOutfit(ctx, input.id);
      await ctx.db.outfit.delete({ where: { id: input.id } });
    }),
  }),

  items: router({
    // examples, link references and hearts for an outfit
    saved: protectedProcedure.input(z.object({ outfitId: z.string() })).query(async ({ ctx, input }) => {
      await ownOutfit(ctx, input.outfitId);
      const [items, references] = await Promise.all([
        ctx.db.outfitItem.findMany({
          where: { outfitId: input.outfitId, kind: { in: ["EXAMPLE", "LIKE"] } },
          orderBy: { createdAt: "desc" },
          include: { product: { include: { store: true } } },
        }),
        ctx.db.reference.findMany({ where: { outfitId: input.outfitId }, orderBy: { createdAt: "desc" } }),
      ]);
      return { items, references };
    }),

    // Add a style example from a link. Products from our stores are added instantly; any other page
    // (another store, Pinterest, Instagram...) is saved with its main image and fingerprinted in the background.
    addExample: protectedProcedure
      .input(z.object({ outfitId: z.string(), url: z.url() }))
      .mutation(async ({ ctx, input }) => {
        await ownOutfit(ctx, input.outfitId);
        const product = await findCatalogueProduct(ctx, input.url);
        if (product) return setItem(ctx, input.outfitId, product.id, "EXAMPLE");

        const imageUrl = await findImage(input.url);
        if (!imageUrl) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Couldn't find a photo on that page. Try a different link." });
        }
        const reference = await ctx.db.reference.create({ data: { outfitId: input.outfitId, sourceUrl: input.url, imageUrl } });
        void fingerprintReference(ctx, reference.id, imageUrl); // not awaited: the feed polls until it's ready
        return reference;
      }),

    // Add a style example from a photo on the user's device. The browser shrinks it to a JPEG first (src/lib/photo.ts).
    uploadExample: protectedProcedure
      .input(z.object({ outfitId: z.string(), jpeg: z.base64().max(4_000_000) }))
      .mutation(async ({ ctx, input }) => {
        await ownOutfit(ctx, input.outfitId);
        const bytes = Buffer.from(input.jpeg, "base64");
        if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new TRPCError({ code: "BAD_REQUEST", message: "That file isn't a photo." });
        const imageUrl = await uploadImage(bytes);
        const reference = await ctx.db.reference.create({ data: { outfitId: input.outfitId, imageUrl } });
        void fingerprintReference(ctx, reference.id, imageUrl);
        return reference;
      }),

    removeReference: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      const reference = await ctx.db.reference.findFirst({ where: { id: input.id, outfit: { userId: ctx.user.id } } });
      if (!reference) return;
      await ctx.db.reference.delete({ where: { id: reference.id } });
      await deleteImage(reference.imageUrl);
    }),

    set: protectedProcedure
      .input(z.object({ outfitId: z.string(), productId: z.string(), kind: z.enum(["LIKE", "SKIP"]).nullable() }))
      .mutation(async ({ ctx, input }) => {
        await ownOutfit(ctx, input.outfitId);
        if (input.kind === null) {
          await ctx.db.outfitItem.deleteMany({ where: { outfitId: input.outfitId, productId: input.productId } });
          return;
        }
        return setItem(ctx, input.outfitId, input.productId, input.kind);
      }),
  }),

  // Named wishlists ("Sarah's wedding"). They belong to the user, so one list can hold pieces from any outfit.
  lists: router({
    all: protectedProcedure.query(({ ctx }) =>
      ctx.db.list.findMany({
        where: { userId: ctx.user.id },
        orderBy: { createdAt: "asc" },
        include: {
          items: {
            orderBy: { createdAt: "desc" },
            include: { product: { include: { store: true } } },
          },
        },
      }),
    ),

    create: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1).max(40) }))
      .mutation(({ ctx, input }) => ctx.db.list.create({ data: { name: input.name, userId: ctx.user.id } })),

    rename: protectedProcedure
      .input(z.object({ id: z.string(), name: z.string().trim().min(1).max(40) }))
      .mutation(({ ctx, input }) =>
        ctx.db.list.updateMany({
          where: { id: input.id, userId: ctx.user.id },
          data: { name: input.name },
        }),
      ),

    delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) =>
      ctx.db.list.deleteMany({
        where: { id: input.id, userId: ctx.user.id },
      }),
    ),

    // Adding a piece to a list also hearts it in the outfit it was saved from (an existing example stays an example).
    toggle: protectedProcedure
      .input(
        z.object({
          listId: z.string(),
          productId: z.string(),
          outfitId: z.string(),
          add: z.boolean(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const list = await ctx.db.list.findFirst({
          where: { id: input.listId, userId: ctx.user.id },
        });
        if (!list) throw new TRPCError({ code: "NOT_FOUND" });
        const key = { listId: input.listId, productId: input.productId };
        if (!input.add) {
          await ctx.db.listItem.deleteMany({ where: key });
          return;
        }
        await ownOutfit(ctx, input.outfitId);
        await ctx.db.listItem.upsert({
          where: { listId_productId: key },
          create: key,
          update: {},
        });
        await ctx.db.outfitItem.upsert({
          where: {
            outfitId_productId: {
              outfitId: input.outfitId,
              productId: input.productId,
            },
          },
          create: {
            outfitId: input.outfitId,
            productId: input.productId,
            kind: "LIKE",
          },
          update: {},
        });
      }),
  }),

  // Products ranked by closeness to the outfit's examples, link references and hearts (hearts count double).
  // With no examples yet, newest first.
  feed: protectedProcedure
    .input(
      z.object({
        outfitId: z.string(),
        exclude: z.array(z.string()).max(2000),
        // quick filters from the feed's Filters button
        sizes: z.array(z.string()).default([]),
        colours: z.array(z.string()).default([]),
        maxPrice: z.number().positive().nullable().default(null),
        sale: z.boolean().default(false),
        fresh: z.boolean().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const outfit = await ownOutfit(ctx, input.outfitId);
      const storeIds = outfit.stores.map((s) => s.id);
      return ctx.db.$queryRaw<FeedProduct[]>`
        WITH pos AS (
          SELECT p.embedding FROM "OutfitItem" i JOIN "Product" p ON p.id = i."productId"
          WHERE i."outfitId" = ${outfit.id} AND i.kind IN ('EXAMPLE', 'LIKE') AND p.embedding IS NOT NULL
          UNION ALL
          SELECT p.embedding FROM "OutfitItem" i JOIN "Product" p ON p.id = i."productId"
          WHERE i."outfitId" = ${outfit.id} AND i.kind = 'LIKE' AND p.embedding IS NOT NULL
          UNION ALL
          SELECT r.embedding FROM "Reference" r WHERE r."outfitId" = ${outfit.id} AND r.status = 'READY'
        ), taste AS (SELECT avg(embedding) AS v FROM pos)
        SELECT p.id, p.title, p.url, p."imageUrl", p."hoverImageUrl", p.price, p."compareAt",
               p."publishedAt" > now() - interval '7 days' AS "isNew", s.name AS store
        FROM "Product" p JOIN "Store" s ON s.id = p."storeId" CROSS JOIN taste
        WHERE p."inStock" AND s.active AND p.embedding IS NOT NULL
          AND (cardinality(${storeIds}::text[]) = 0 OR p."storeId" = ANY(${storeIds}::text[]))
          AND (cardinality(${outfit.categories}::text[]) = 0 OR p.category = ANY(${outfit.categories}::text[]))
          AND (cardinality(${input.sizes}::text[]) = 0 OR cardinality(p.sizes) = 0 OR 'OS' = ANY(p.sizes) OR p.sizes && ${input.sizes}::text[])
          AND (cardinality(${input.colours}::text[]) = 0 OR p.colour = ANY(${input.colours}::text[]))
          AND (${input.maxPrice}::float8 IS NULL OR p.price <= ${input.maxPrice}::float8)
          AND (NOT ${input.sale}::boolean OR p."compareAt" > p.price)
          AND (NOT ${input.fresh}::boolean OR p."publishedAt" > now() - interval '7 days')
          AND NOT (p.id = ANY(${input.exclude}::text[]))
          AND NOT EXISTS (SELECT 1 FROM "OutfitItem" i WHERE i."outfitId" = ${outfit.id} AND i."productId" = p.id)
        ORDER BY (p.embedding <=> taste.v) NULLS LAST, p."publishedAt" DESC
        LIMIT ${PAGE_SIZE}`;
    }),
});

export type AppRouter = typeof appRouter;

type Ctx = { db: typeof import("./db").db; user: { id: string } };

async function ownOutfit(ctx: Ctx, id: string) {
  const outfit = await ctx.db.outfit.findFirst({ where: { id, userId: ctx.user.id }, include: { stores: true } });
  if (!outfit) throw new TRPCError({ code: "NOT_FOUND" });
  return outfit;
}

function setItem(ctx: Ctx, outfitId: string, productId: string, kind: "EXAMPLE" | "LIKE" | "SKIP") {
  return ctx.db.outfitItem.upsert({
    where: { outfitId_productId: { outfitId, productId } },
    create: { outfitId, productId, kind },
    update: { kind },
  });
}

async function findCatalogueProduct(ctx: Ctx, url: string) {
  const u = new URL(url);
  const handle = u.pathname.match(/\/products\/([^/?#]+)/)?.[1];
  if (!handle) return null;
  const host = u.hostname.replace(/^www\./, "");
  const store = await ctx.db.store.findFirst({ where: { domain: { in: [host, `www.${host}`] } } });
  if (!store) return null;
  return ctx.db.product.findFirst({ where: { storeId: store.id, url: `https://${store.domain}/products/${handle}` } });
}

// The main photo of a page. Shopify product pages (most fashion stores) are read from their
// /products/<handle>.json; anything else from its og:image / twitter:image tag, or the URL itself if it's an image.
async function findImage(url: string): Promise<string | null> {
  const { protocol, hostname, origin, pathname } = new URL(url);
  if (!protocol.startsWith("http") || hostname === "localhost" || /^[\d.:[\]]+$/.test(hostname)) return null;
  const handle = pathname.match(/\/products\/([^/?#]+)/)?.[1];
  if (handle) {
    try {
      const res = await fetch(`${origin}/products/${handle}.json`, { signal: AbortSignal.timeout(10_000) });
      const src = res.ok ? (await res.json())?.product?.images?.[0]?.src : null;
      if (typeof src === "string") return src;
    } catch {
      // not a Shopify store; fall back to the page's tags
    }
  }
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; likewise/1.0)", accept: "text/html,image/*" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    if (res.headers.get("content-type")?.startsWith("image/")) return res.url;
    const html = (await res.text()).slice(0, 2_000_000);
    for (const tag of html.match(/<meta[^>]+>/gi) ?? []) {
      if (!/(property|name)=["'](og:image|og:image:url|og:image:secure_url|twitter:image)["']/i.test(tag)) continue;
      const content = tag.match(/content=["']([^"']+)["']/i)?.[1];
      if (!content) continue;
      const image = new URL(content.replaceAll("&amp;", "&"), res.url);
      if (image.hostname.includes(".")) return image.toString().replace(/^http:/, "https:"); // skip broken tags like "https:files/x.png"
    }
  } catch {
    // unreachable page, timeout, bad markup
  }
  return null;
}

// Fingerprint a pasted link's photo with the Modal service (pipeline/modal_app.py), usually within seconds.
// If that isn't set up or fails, fall back to a GitHub Actions run, which takes a few minutes.
async function fingerprintReference(ctx: Ctx, id: string, imageUrl: string) {
  // the same photo was pasted before (e.g. a popular Pinterest pin): reuse its fingerprint
  const reused = await ctx.db.$executeRaw`
    UPDATE "Reference" SET status = 'READY', embedding = (
      SELECT embedding FROM "Reference" WHERE "imageUrl" = ${imageUrl} AND status = 'READY' AND embedding IS NOT NULL LIMIT 1
    )
    WHERE id = ${id} AND EXISTS (SELECT 1 FROM "Reference" WHERE "imageUrl" = ${imageUrl} AND status = 'READY' AND embedding IS NOT NULL)`;
  if (reused) return;

  const url = process.env.MODAL_EMBED_URL;
  try {
    if (!url) throw new Error("MODAL_EMBED_URL not set");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Modal-Key": process.env.MODAL_KEY ?? "",
        "Modal-Secret": process.env.MODAL_SECRET ?? "",
      },
      body: JSON.stringify({ url: imageUrl }),
      signal: AbortSignal.timeout(90_000), // allows for a cold start
    });
    if (!res.ok) throw new Error(`fingerprint service: ${res.status}`);
    const { embedding } = (await res.json()) as { embedding: number[] };
    await ctx.db.$executeRaw`UPDATE "Reference" SET status = 'READY', embedding = ${`[${embedding.join(",")}]`}::vector WHERE id = ${id}`;
  } catch (e) {
    console.error(e);
    await startEmbeddingRun();
  }
}

// Ask GitHub Actions to fingerprint pending references now (instead of waiting for the daily run).
async function startEmbeddingRun() {
  // on Render the repo and branch come from its built-in RENDER_GIT_* variables
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO ?? process.env.RENDER_GIT_REPO_SLUG;
  const branch = process.env.GITHUB_BRANCH ?? process.env.RENDER_GIT_BRANCH ?? "production";
  if (!token || !repo) return;
  await fetch(`https://api.github.com/repos/${repo}/actions/workflows/ingest.yml/dispatches`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    body: JSON.stringify({ ref: branch, inputs: { references_only: "true" } }),
  }).catch(() => {});
}
