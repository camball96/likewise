// Every outbound product click goes through here so we can count clicks per store.
import { auth } from "@/server/auth";
import { db } from "@/server/db";

export async function GET(req: Request, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) return new Response("Not found", { status: 404 });

  const session = await auth.api.getSession({ headers: req.headers });
  const outfitId = new URL(req.url).searchParams.get("outfit");
  await db.click.create({ data: { productId, userId: session?.user.id, outfitId } });

  return Response.redirect(product.url, 302);
}
