import { NextRequest } from "next/server";
import middleware from "next-auth/middleware";

export default function proxy(req: NextRequest, event: any) {
  return middleware(req, event);
}

export const config = {
  matcher: ["/diary/:path*", "/profile/:path*", "/stats/:path*"],
};
