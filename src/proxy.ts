// Send signed-out visitors to /sign-in. A quick cookie check only;
// the API checks the real session on every request.
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) return NextResponse.redirect(new URL("/sign-in", request.url));
}

export const config = { matcher: ["/welcome", "/outfits/:path*", "/account", "/wishlist"] };
