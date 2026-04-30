import { createClient } from "@supabase/supabase-js";

// Simple session manager without complex types
export class SessionManager {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    );
  }

  async hasActiveSession(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .limit(1);

      if (error) {
        console.error('Error checking active session:', error);
        return false;
      }

      return (data && data.length > 0) || false;
    } catch (error) {
      console.error('Error in hasActiveSession:', error);
      return false;
    }
  }

  async createSession(
    userId: string,
    sessionToken: string,
    deviceInfo?: string,
    ipAddress?: string,
    userAgent?: string,
    expiresInHours: number = 24
  ): Promise<string | null> {
    try {
      // First, deactivate all existing sessions for this user
      const { error: deactivateError } = await this.supabase
        .from('user_sessions')
        .update({ 
          is_active: false,
          last_activity: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (deactivateError) {
        console.error('Error deactivating existing sessions:', deactivateError);
      }

      // Create new session
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);

      const { data, error } = await this.supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_token: sessionToken,
          device_info: deviceInfo || null,
          ip_address: ipAddress || null,
          user_agent: userAgent || null,
          expires_at: expiresAt.toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error creating session:', error);
        return null;
      }

      console.log('Session created successfully:', data);
      return data?.id || null;
    } catch (error) {
      console.error('Error in createSession:', error);
      return null;
    }
  }

  async updateSessionActivity(sessionToken: string): Promise<boolean> {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { data, error } = await this.supabase
        .from('user_sessions')
        .update({ 
          last_activity: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        })
        .eq('session_token', sessionToken)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .select('id')
        .limit(1);

      if (error) {
        console.error('Error updating session activity:', error);
        return false;
      }

      return (data && data.length > 0) || false;
    } catch (error) {
      console.error('Error in updateSessionActivity:', error);
      return false;
    }
  }

  async deactivateSession(sessionToken: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('user_sessions')
        .update({ 
          is_active: false,
          last_activity: new Date().toISOString()
        })
        .eq('session_token', sessionToken)
        .eq('is_active', true)
        .select('id')
        .limit(1);

      if (error) {
        console.error('Error deactivating session:', error);
        return false;
      }

      return (data && data.length > 0) || false;
    } catch (error) {
      console.error('Error in deactivateSession:', error);
      return false;
    }
  }

  generateSessionToken(): string {
    // Generate a cryptographically secure random session token
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  extractDeviceInfo(userAgent: string): string {
    // Simple device info extraction from user agent
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      if (userAgent.includes('iPhone')) return 'iPhone';
      if (userAgent.includes('Android')) return 'Android';
      return 'Mobile Device';
    }
    if (userAgent.includes('Tablet') || userAgent.includes('iPad')) return 'Tablet';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Mac')) return 'Mac';
    if (userAgent.includes('Linux')) return 'Linux PC';
    return 'Unknown Device';
  }
}

// Helper function to get client IP address from request
export function getClientIP(request: Request): string {
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
