"use client";

import type { FormEvent } from "react";
import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { Eye, EyeOff, Lock, User, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabaseClient";
import PWAInstall from "@/components/ui/PWAInstall";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConcurrentLoginModal, setShowConcurrentLoginModal] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'concurrent_login') {
      // Show modal instead of inline error
      setShowConcurrentLoginModal(true);
      // Clear any existing auth state to prevent auto-login
      supabase.auth.signOut().catch(() => {
        // Ignore errors during cleanup
      });
      
      // Also clear the user's sessions from database
      clearUserSessions();
    }
  }, [searchParams]);

  // Function to clear user sessions
  const clearUserSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('Clearing all sessions for user due to concurrent login error:', user.id);
        const response = await fetch('/api/logout', { method: 'POST' });
        if (response.ok) {
          console.log('Sessions cleared successfully');
        }
      }
    } catch (error) {
      console.error('Error clearing sessions:', error);
    }
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: identifier,
        password: password,
      });

      if (authError) {
        throw authError;
      }

      if (!data.user) {
        throw new Error("Login failed - no user returned");
      }

      // Get user role from profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        throw new Error("Failed to fetch user profile");
      }

      console.log(`[Login] User role: ${profile?.role}, redirecting...`);

      // Redirect based on role using window.location for full page reload
      if (profile?.role === "admin" || profile?.role === "registrar") {
        console.log(`[Login] Redirecting to /registrar/dashboard`);
        window.location.href = "/registrar/dashboard";
      } else {
        console.log(`[Login] Redirecting to /student/home`);
        window.location.href = "/student/home";
      }

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 transition-colors duration-300">
      {/* SorSU Logo */}
      <div className="mb-8 text-center">
        <Image
          src="/images/sorsu-logo.png"
          alt="SorSU Logo"
          width={128}
          height={128}
          className="w-32 h-32 mx-auto drop-shadow-md object-contain"
        />
        <h1 className="mt-4 text-2xl font-bold text-sorsuMaroon">
          SorSU Document Request System
        </h1>
        <p className="text-gray-600 text-sm">Sorsogon State University</p>
      </div>

      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden border-t-8 border-sorsuMaroon transition-colors duration-300">
        <div className="p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Login to your account</h2>

          {error && !error.includes('another device') && (
            <div className="mb-4 p-3 border-l-4 text-sm bg-maroon-100 border-maroon-500 text-maroon-700">
              <div className="flex items-start">
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Identifier Input (Email or ID) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student ID or Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  name="identifier-field"
                  data-form-type="login"
                  data-lp-ignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-kwimpalastatus="ignore"
                  formNoValidate
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-sorsuMaroon focus:border-sorsuMaroon text-sm transition"
                  placeholder="2021-0000-X or email@sorsu.edu.ph"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  name="password-field"
                  data-form-type="password"
                  data-lp-ignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-kwimpalastatus="ignore"
                  formNoValidate
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-sorsuMaroon focus:border-sorsuMaroon text-sm transition"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-sorsuMaroon transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sorsuMaroon hover:bg-maroon-900 text-white font-bold py-3 rounded-lg shadow-lg transition-all transform hover:scale-[1.01] hover:ring-2 hover:ring-maroon-500/50 active:scale-[0.98] flex items-center justify-center space-x-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-sorsuMaroon font-bold hover:text-maroon-900 hover:underline transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-400 uppercase tracking-widest">
        Official Document Request Portal
      </p>
      
      <div className="mt-4 flex justify-center">
        <PWAInstall />
      </div>

      {/* Concurrent Login Modal */}
      {showConcurrentLoginModal && (
        <div className="fixed inset-0 bg-white bg-opacity-95 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border-t-8 border-sorsuMaroon transform transition-all">
            {/* SorSU Logo and Branding */}
            <div className="p-6 text-center border-b border-gray-100">
              <Image
                src="/images/sorsu-logo.png"
                alt="SorSU Logo"
                width={96}
                height={96}
                className="w-24 h-24 mx-auto drop-shadow-md object-contain"
              />
              <h1 className="mt-3 text-xl font-bold text-sorsuMaroon">
                SorSU Document Request System
              </h1>
              <p className="text-gray-600 text-sm">Sorsogon State University</p>
              <div className="mt-2 inline-flex items-center px-3 py-1 bg-red-100 border border-red-300 rounded-full">
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-xs font-semibold text-red-700 uppercase tracking-wider animate-pulse">
                  WARNING
                </span>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Login Blocked</h3>
                  <p className="text-sm text-gray-600">Concurrent Login Detected</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 leading-relaxed">
                  Your account is logged in to another device. Please logout first before logging in again. If the other device isn&apos;t yours, please report it to the registrar to change your password.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowConcurrentLoginModal(false);
                    router.push('/login');
                  }}
                  className="px-6 py-2 bg-sorsuMaroon text-white font-medium rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-sorsuMaroon focus:ring-offset-2"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
