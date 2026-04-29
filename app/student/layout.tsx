"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Home, Bell, FileText, Menu, X, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import LogoutConfirmationModal from "@/components/ui/LogoutConfirmationModal";
import PWAInstall from "@/components/ui/PWAInstall";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const navItems = [
    { href: "/student/home", label: "Home", icon: Home },
    { href: "/student/requirements", label: "Requirements", icon: FileText },
    { href: "/student/notifications", label: "Updates", icon: Bell },
  ];

  const handleSignOut = async () => {
    setShowLogoutConfirmation(true);
  };

  const confirmSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Fetch unread notifications count
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const fetchUnreadCount = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Fetch initial unread count
      const { data, error } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (!error) {
        setUnreadCount(data?.length || 0);
      }

      // Setup real-time subscription for new notifications
      channel = supabase
        .channel("unread-count")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT" && !payload.new.is_read) {
              setUnreadCount((prev) => prev + 1);
            } else if (payload.eventType === "UPDATE") {
              if (payload.old.is_read && !payload.new.is_read) {
                setUnreadCount((prev) => prev + 1);
              } else if (!payload.old.is_read && payload.new.is_read) {
                setUnreadCount((prev) => Math.max(0, prev - 1));
              }
            } else if (payload.eventType === "DELETE" && !payload.old.is_read) {
              setUnreadCount((prev) => Math.max(0, prev - 1));
            }
          }
        )
        .subscribe();
    };

    fetchUnreadCount();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50 transition-colors duration-300">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex flex-col grow bg-white border-r border-gray-200 pt-5 pb-4 overflow-y-auto transition-colors duration-300">
          {/* Logo */}
          <div className="flex items-center shrink-0 px-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 shrink-0">
                <Image
                  src="/images/sorsu-logo.png"
                  alt="SorSU Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 transition-colors">SorSU</h2>
                <p className="text-xs text-gray-500 transition-colors">Student Portal</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-1">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              const isNotificationsPage = href === "/student/notifications";
              const hasUnread = isNotificationsPage && unreadCount > 0;
              
              return (
                <Link
                  key={href}
                  href={href}
                  className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive
                      ? "bg-sorsuMaroon text-white shadow-md shadow-maroon-900/20"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <div className="relative mr-3">
                    <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-gray-400 group-hover:text-gray-500"}`} />
                    {hasUnread && (
                      <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {label}
                    {hasUnread && (
                      <span className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full ${
                        isActive 
                          ? "bg-white text-sorsuMaroon" 
                          : "bg-red-500 text-white"
                      }`}>
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
            
            {/* PWA Install Button */}
            <div className="pt-4 border-t border-gray-200">
              <PWAInstall />
            </div>
          </nav>

          {/* Sign Out Button */}
          <div className="px-4 mt-auto">
            <button
              onClick={handleSignOut}
              className="group flex items-center px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-maroon-50 hover:text-sorsuMaroon transition-all w-full"
            >
              <LogOut className="mr-3 h-5 w-5 text-gray-400 group-hover:text-maroon-500 transition-colors" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-200 transition-colors duration-300">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8 shrink-0">
                  <Image
                    src="/images/sorsu-logo.png"
                    alt="SorSU Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-gray-900">SorSU</h1>
                  <p className="text-[10px] text-gray-500">Student Portal</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Slide-out Menu */}
        <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white transform transition-transform duration-300 ease-in-out lg:hidden border-r border-gray-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex flex-col h-full">
            {/* Mobile Menu Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 transition-colors">
              <div className="flex items-center gap-3">
                <div className="relative w-9 h-9 shrink-0">
                  <Image
                    src="/images/sorsu-logo.png"
                    alt="SorSU Logo"
                    fill
                    className="object-contain"
                    priority
                  />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">SorSU</h2>
                  <p className="text-xs text-gray-500">Student Portal</p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                const isNotificationsPage = href === "/student/notifications";
                const hasUnread = isNotificationsPage && unreadCount > 0;
                
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive
                        ? "bg-sorsuMaroon text-white shadow-md shadow-maroon-900/20"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                  >
                    <div className="relative mr-3">
                      <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-gray-400 group-hover:text-gray-500"}`} />
                      {hasUnread && (
                        <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {label}
                      {hasUnread && (
                        <span className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full ${
                          isActive 
                            ? "bg-white text-sorsuMaroon" 
                            : "bg-red-500 text-white"
                        }`}>
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
              
              {/* Mobile PWA Install Button */}
              <div className="pt-4 border-t border-gray-200">
                <PWAInstall />
              </div>
            </nav>

            {/* Mobile Sign Out */}
            <div className="px-4 py-4 border-t border-gray-200 transition-colors">
              <button
                onClick={handleSignOut}
                className="group flex items-center px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-maroon-50 hover:text-sorsuMaroon transition-all w-full"
              >
                <LogOut className="mr-3 h-5 w-5 text-gray-400 group-hover:text-maroon-500 transition-colors" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 transition-colors duration-300 pb-safe">
          <div className="grid grid-cols-4 py-2">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              const isNotificationsPage = href === "/student/notifications";
              const hasUnread = isNotificationsPage && unreadCount > 0;
              
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center justify-center py-2 px-1 text-[10px] font-medium transition-colors duration-200 ${
                    isActive
                      ? "text-sorsuMaroon"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  <div className="relative mb-1">
                    <Icon className={`h-5 w-5 ${isActive ? "fill-current" : ""}`} />
                    {hasUnread && (
                      <div className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-500 rounded-full border border-white animate-pulse" />
                    )}
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="truncate max-w-full">{label}</span>
                    {hasUnread && (
                      <span className={`ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full ${
                        isActive 
                          ? "bg-sorsuMaroon text-white" 
                          : "bg-red-500 text-white"
                      }`}>
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmationModal
        isOpen={showLogoutConfirmation}
        onConfirm={confirmSignOut}
        onCancel={() => setShowLogoutConfirmation(false)}
      />
    </div>
  );
}
