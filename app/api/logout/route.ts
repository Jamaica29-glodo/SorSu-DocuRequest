import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  console.log('=== LOGOUT API STARTED ===');
  console.log('Logout API called at:', new Date().toISOString());
  
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    
    // Debug: Show all cookies
    const allCookies = cookieStore.getAll();
    console.log('Logout attempt - all cookies:', allCookies.map(c => ({ name: c.name, value: c.value ? 'exists' : 'missing' })));
    console.log('Logout attempt with session token:', sessionToken ? sessionToken.substring(0, 8) + '...' : 'null');
    console.log('Session token length:', sessionToken?.length || 0);

    // Create Supabase client with service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Delete session if session token exists
    if (sessionToken) {
      try {
        console.log('=== ATTEMPTING TO DELETE SESSION ===');
        console.log('Session token to delete:', sessionToken);
        
        // First, try to get the session to verify it exists
        const { data: existingSession, error: fetchError } = await supabase
          .from('user_sessions')
          .select('*')
          .eq('session_token', sessionToken)
          .single();

        console.log('Fetch session result:', { existingSession, fetchError });

        if (fetchError) {
          console.error('Error fetching session:', fetchError);
          // Try to delete directly even if fetch fails
        } else if (existingSession) {
          console.log('Found session to delete:', existingSession.id);
        } else {
          console.log('No session found with token:', sessionToken);
        }
        
        // Now delete it using RPC to bypass any issues
        console.log('Trying RPC delete...');
        const { data, error } = await supabase
          .rpc('delete_user_session', {
            p_session_token: sessionToken
          });

        console.log('RPC delete result:', { data, error });

        if (error) {
          console.error('Error deleting session via RPC:', error);
          
          // Fallback: try direct delete
          console.log('Trying direct delete...');
          const { data: deleteData, error: deleteError } = await supabase
            .from('user_sessions')
            .delete()
            .eq('session_token', sessionToken);

          console.log('Direct delete result:', { deleteData, deleteError });

          if (deleteError) {
            console.error('Error deleting session directly:', deleteError);
          } else {
            console.log('Session deleted successfully via direct delete:', deleteData);
          }
        } else {
          console.log('Session deleted successfully via RPC:', data);
        }
      } catch (sessionError) {
        console.error('Session table might not exist yet:', sessionError);
        // Continue with logout even if session table doesn't exist yet
      }
    } else {
      console.log('=== NO SESSION TOKEN FOUND ===');
      console.log('No session token found in cookies');
    }

    // Session deletion already completed successfully via RPC above
    console.log('✅ Session deletion completed via RPC - no additional cleanup needed');

    // Clear session token cookie AND sign out from Supabase Auth first
    const { error: signOutError } = await supabase.auth.signOut();
    
    if (signOutError) {
      console.error('Error signing out from Supabase:', signOutError);
    } else {
      console.log('Supabase auth sign out successful');
    }

    const response = NextResponse.json({ success: true });
    
    // Clear session token cookie
    response.cookies.set('session_token', '', {
      httpOnly: true,
      secure: false, // Match the cookie settings
      sameSite: 'lax',
      maxAge: 0,
      expires: new Date(0),
      path: '/' // Match the cookie path
    });

    // Also clear all Supabase auth cookies
    response.cookies.set('sb-hqgoolflpjslxkdgxrxm-auth-token', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 0,
      expires: new Date(0),
      path: '/'
    });

    response.cookies.set('sb-hqgoolflpjslxkdgxrxm-auth-token.0', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 0,
      expires: new Date(0),
      path: '/'
    });

    response.cookies.set('sb-hqgoolflpjslxkdgxrxm-auth-token.1', '', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 0,
      expires: new Date(0),
      path: '/'
    });

    console.log('=== LOGOUT API COMPLETED ===');
    console.log('Returning success response at:', new Date().toISOString());
    return response;

  } catch (error) {
    console.error('Logout error:', error);
    console.log('=== LOGOUT API FAILED ===');
    return NextResponse.json(
      { error: 'Failed to logout' },
      { status: 500 }
    );
  }
}
