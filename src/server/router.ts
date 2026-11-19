import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./trpc";

const PAGE_SIZE = 24;

type FeedProduct = {
  id: string;
  title: string;
  url: string;
  imageUrl: string;
  price: number;
  compareAt: number | null;
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
      .input(z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(40), storeIds: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
        const stores = input.storeIds.map((id) => ({ id }));
        if (!input.id) {
          return ctx.db.outfit.create({ data: { userId: ctx.user.id, name: input.name, stores: { connect: stores } } });
        }
        await ownOutfit(ctx, input.id);
        return ctx.db.outfit.update({ where: { id: input.id }, data: { name: input.name, stores: { set: stores } } });
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
    // (another store, Pinterest, Instagram...) is saved with its main image and fingerprinted by the next ingest run.
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
        await startEmbeddingRun();
        return reference;
      }),

    removeReference: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      await ctx.db.reference.deleteMany({ where: { id: input.id, outfit: { userId: ctx.user.id } } });
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

  // Products ranked by closeness to the outfit's examples, link references and hearts (hearts count double).
  // With no examples yet, newest first.
  feed: protectedProcedure
    .input(z.object({ outfitId: z.string(), exclude: z.array(z.string()).max(2000) }))
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
        SELECT p.id, p.title, p.url, p."imageUrl", p.price, p."compareAt", s.name AS store
        FROM "Product" p JOIN "Store" s ON s.id = p."storeId" CROSS JOIN taste
        WHERE p."inStock" AND s.active AND p.embedding IS NOT NULL
          AND (cardinality(${storeIds}::text[]) = 0 OR p."storeId" = ANY(${storeIds}::text[]))
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

// The main photo of a page: its og:image / twitter:image tag, or the URL itself if it's an image.
async function findImage(url: string): Promise<string | null> {
  const { protocol, hostname } = new URL(url);
  if (!protocol.startsWith("http") || hostname === "localhost" || /^[\d.:[\]]+$/.test(hostname)) return null;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; styleit/1.0)", accept: "text/html,image/*" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    if (res.headers.get("content-type")?.startsWith("image/")) return res.url;
    const html = (await res.text()).slice(0, 2_000_000);
    for (const tag of html.match(/<meta[^>]+>/gi) ?? []) {
      if (!/(property|name)=["'](og:image|og:image:url|og:image:secure_url|twitter:image)["']/i.test(tag)) continue;
      const content = tag.match(/content=["']([^"']+)["']/i)?.[1];
      if (content) return new URL(content.replaceAll("&amp;", "&"), res.url).toString().replace(/^http:/, "https:");
    }
  } catch {
    // unreachable page, timeout, bad markup
  }
  return null;
}

// Ask GitHub Actions to fingerprint pending references now (instead of waiting for the daily run).
async function startEmbeddingRun() {
  const { GITHUB_DISPATCH_TOKEN, GITHUB_REPO, GITHUB_BRANCH = "production" } = process.env;
  if (!GITHUB_DISPATCH_TOKEN || !GITHUB_REPO) return;
  await fetch(`https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/ingest.yml/dispatches`, {
    method: "POST",
    headers: { authorization: `Bearer ${GITHUB_DISPATCH_TOKEN}`, accept: "application/vnd.github+json" },
    body: JSON.stringify({ ref: GITHUB_BRANCH, inputs: { references_only: "true" } }),
  }).catch(() => {});
}
