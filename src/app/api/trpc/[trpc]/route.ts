import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/router";
import { createContext } from "@/server/trpc";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    // unexpected errors (not "not found" or bad input) are printed to the server log (terminal locally, Logs on Render)
    onError: ({ path, error }) => {
      if (error.code === "INTERNAL_SERVER_ERROR") console.error(`tRPC ${path}:`, error.cause ?? error);
    },
  });

export { handler as GET, handler as POST };
