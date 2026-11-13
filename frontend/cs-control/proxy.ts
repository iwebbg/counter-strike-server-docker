import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const cookieName = process.env.AUTH_COOKIE_NAME || "cs_control_session";
  if (!request.cookies.has(cookieName)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    url.searchParams.set("redirect", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/app/:path*"] };
