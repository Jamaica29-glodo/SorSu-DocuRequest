import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  // Log all cookies for debugging
  const allCookies = Array.from(req.cookies.getAll()).map(c => c.name);
  console.log(`[Middleware] Checking ${pathname}, cookies: ${allCookies.join(', ') || 'none'}`);

  // Create a Supabase server client with proper cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => {
          const value = req.cookies.get(name)?.value;
          console.log(`[Middleware] Getting cookie ${name}: ${value ? 'exists' : 'missing'}`);
          return value;
        },
        set: (name, value, options) => {
          console.log(`[Middleware] Setting cookie ${name}`);
          res.cookies.set({ name, value, ...options });
        },
        remove: (name, options) => {
          console.log(`[Middleware] Removing cookie ${name}`);
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Check auth status - also try getSession as fallback
  const { data: { user: initialUser }, error: authError } = await supabase.auth.getUser();
  let user = initialUser;
  
  // If getUser fails, try getSession
  if (!user && !authError) {
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user || null;
    if (session) {
      console.log(`[Middleware] Found session via getSession`);
    }
  }
  
  const isAuthenticated = !!user;
  
  console.log(`[Middleware] Auth check: user=${user?.id || 'null'}, error=${authError?.message || 'none'}`);
  
  // Fetch user role if authenticated
  let userRole: string | null = null;
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    userRole = profile?.role || null;
    console.log(`[Middleware] Profile: role=${userRole}, error=${profileError?.message || 'none'}`);
  }

  // Protect registrar routes - only allow registrar users
  if (pathname.startsWith("/registrar")) {
    if (!isAuthenticated) {
      console.log(`[Middleware] Redirecting unauthenticated user from registrar to login`);
      return NextResponse.redirect(new URL("/login", req.url));
    }
    
    if (userRole !== "registrar") {
      console.log(`[Middleware] Redirecting non-registrar user to student home`);
      return NextResponse.redirect(new URL("/student/home", req.url));
    }
  }

  // Protect student routes - require authentication
  if (pathname.startsWith("/student")) {
    if (!isAuthenticated) {
      console.log(`[Middleware] Redirecting unauthenticated user from student to login`);
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // Redirect logged-in users away from login/register pages
  if ((pathname === "/login" || pathname === "/register") && isAuthenticated) {
    console.log(`[Middleware] Redirecting authenticated user from login to dashboard`);
    if (userRole === "registrar") {
      return NextResponse.redirect(new URL("/registrar/dashboard", req.url));
    }
    return NextResponse.redirect(new URL("/student/home", req.url));
  }

  console.log(`[Middleware] Allowing request to ${pathname}`);
  return res;
}

export const config = {
  matcher: ["/student/:path*", "/registrar/:path*", "/login", "/register"],
};
