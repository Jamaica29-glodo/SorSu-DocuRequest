import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  // Skip middleware for API routes
  if (pathname.startsWith('/api/')) {
    console.log(`[Middleware] Skipping API route: ${pathname}`);
    return res;
  }

  // Create Supabase server client with proper cookie handling
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
          req.cookies.set(name, value);
          res.cookies.set(name, value, options);
        },
        remove: (name, options) => {
          console.log(`[Middleware] Removing cookie ${name}`);
          req.cookies.delete(name);
          res.cookies.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );

  // Create service client for session operations (bypass RLS)
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Check auth status
  const { data: { user: initialUser }, error: authError } = await supabase.auth.getUser();
  let user = initialUser;
  
  // If getUser fails, try getSession
  if (!user && !authError) {
    const { data: { session } } = await supabase.auth.getSession();
    user = session?.user || null;
  }

  const isAuthenticated = !!user;
  let userRole: string | null = null;

  if (isAuthenticated && user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    userRole = profile?.role || null;
    console.log(`[Middleware] Profile: role=${userRole}, error=${profileError?.message || 'none'}`);
  }

  // Concurrent login prevention - check for ALL authenticated users
  console.log(`[Middleware] Concurrent login check: pathname=${pathname}, isAuthenticated=${isAuthenticated}, user=${!!user}`);
  if (isAuthenticated && user) {
    console.log(`[Middleware] Checking concurrent login for authenticated user ${user.id}`);
    
    // Check for active sessions in database
    const hasActiveSession = await serviceSupabase
      .from('user_sessions')
      .select('id, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log(`[Middleware] Active session query result:`, hasActiveSession);

    if (hasActiveSession.data) {
      const sessionAge = Date.now() - new Date(hasActiveSession.data.created_at).getTime();
      const sessionAgeMinutes = sessionAge / (1000 * 60);
      
      console.log(`[Middleware] Found active session for user ${user.id}, age: ${sessionAgeMinutes.toFixed(1)} minutes`);
      
      // If session is older than 30 minutes, auto-delete it and allow login
      if (sessionAgeMinutes > 30) {
        console.log(`[Middleware] Auto-deleting old session (${sessionAgeMinutes.toFixed(1)} minutes old) for user ${user.id}`);
        await serviceSupabase
          .from('user_sessions')
          .delete()
          .eq('user_id', user.id);
        
        console.log(`[Middleware] Old session deleted, allowing login for user ${user.id}`);
      } else {
        // Only block if user is trying to access login page (fresh login attempt)
        if (pathname === '/login') {
          console.log(`[Middleware] Blocked concurrent login for user ${user.id} (session is ${sessionAgeMinutes.toFixed(1)} minutes old)`);
          await supabase.auth.signOut();
          return NextResponse.redirect(new URL("/login?error=concurrent_login", req.url));
        } else {
          console.log(`[Middleware] User ${user.id} has active session but accessing ${pathname} - allowing`);
        }
      }
    } else {
      console.log(`[Middleware] No active session found for user ${user.id}`);
    }
  }

  // Session management for authenticated users (always run this)
  console.log(`[Middleware] Session management check: isAuthenticated=${isAuthenticated}, user=${!!user}`);
  if (isAuthenticated && user) {
    try {
      const sessionToken = req.cookies.get('session_token')?.value;
      console.log(`[Middleware] Session management for user ${user.id}, session token exists: ${!!sessionToken}`);
      
      if (!sessionToken) {
        // Check for concurrent login BEFORE creating new session
        console.log(`[Middleware] Checking for concurrent login before creating session for user ${user.id}`);
        
        const hasActiveSession = await serviceSupabase
          .from('user_sessions')
          .select('id, created_at')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        console.log(`[Middleware] Pre-session creation check result:`, hasActiveSession);

        if (hasActiveSession.data) {
          const sessionAge = Date.now() - new Date(hasActiveSession.data.created_at).getTime();
          const sessionAgeMinutes = sessionAge / (1000 * 60);
          
          console.log(`[Middleware] Found existing active session for user ${user.id}, age: ${sessionAgeMinutes.toFixed(1)} minutes`);
          
          // If session is older than 30 minutes, auto-delete it and allow new session
          if (sessionAgeMinutes > 30) {
            console.log(`[Middleware] Auto-deleting old session (${sessionAgeMinutes.toFixed(1)} minutes old) for user ${user.id}`);
            await serviceSupabase
              .from('user_sessions')
              .delete()
              .eq('user_id', user.id);
            
            console.log(`[Middleware] Old session deleted, allowing new session for user ${user.id}`);
          } else {
            console.log(`[Middleware] Blocking concurrent login for user ${user.id} (session is ${sessionAgeMinutes.toFixed(1)} minutes old)`);
            await supabase.auth.signOut();
            return NextResponse.redirect(new URL("/login?error=concurrent_login", req.url));
          }
        }

        // Create new session for authenticated user
        const newSessionToken = generateSessionToken();
        
        // First delete all existing sessions for this user
        const { error: deleteError } = await serviceSupabase
          .from('user_sessions')
          .delete()
          .eq('user_id', user.id);

        if (deleteError) {
          console.error('Error deleting existing sessions:', deleteError);
        } else {
          console.log('Deleted existing sessions for user:', user.id);
        }

        // Create new session using raw SQL to avoid TypeScript issues
        const userAgent = req.headers.get('user-agent') || '';
        const deviceInfo = extractDeviceInfo(userAgent);
        const ipAddress = getClientIP(req);
        
        const { data, error } = await serviceSupabase
          .rpc('create_user_session', {
            p_user_id: user.id,
            p_session_token: newSessionToken,
            p_device_info: deviceInfo,
            p_ip_address: ipAddress,
            p_user_agent: userAgent,
            p_expires_in_hours: 24
          });
        
        if (error) {
          console.error('Error creating session via RPC:', error);
        } else {
          console.log(`[Middleware] Created new session via RPC for user ${user.id}:`, data);
          
          // Set session token in response cookie
          res.cookies.set('session_token', newSessionToken, {
            httpOnly: true,
            secure: false, // Set to false for localhost development
            sameSite: 'lax',
            maxAge: 24 * 60 * 60, // 24 hours
            path: '/'
          });
        }
      }
    } catch (sessionError) {
      console.error('Session management error:', sessionError);
      // Continue without session management if table doesn't exist
    }
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

// Helper functions
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function extractDeviceInfo(userAgent: string): string {
  if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('Android')) return 'Android';
    return 'Mobile Device';
  }
  if (userAgent.includes('Tablet') || userAgent.includes('iPad')) return 'Tablet';
  if (userAgent.includes('Mac')) return 'Mac';
  if (userAgent.includes('Linux')) return 'Linux PC';
  return 'Unknown Device';
}

function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  // For local development, return a placeholder
  return '127.0.0.1';
}
