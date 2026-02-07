import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// TEMPORARILY DISABLED - Allow all requests for testing
export async function middleware(req: NextRequest) {
  console.log('Middleware: Allowing access to:', req.nextUrl.pathname);
  return NextResponse.next();
}

export const config = {
  matcher: ["/student/:path*", "/registrar/:path*"],
};
