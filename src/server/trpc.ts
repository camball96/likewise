import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "./auth";
import { db } from "./db";

export async function createContext(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  return { db, user: session?.user ?? null };
}

const t = initTRPC.context<Awaited<ReturnType<typeof createContext>>>().create();

export const router = t.router;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
