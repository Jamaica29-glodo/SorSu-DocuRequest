"use client";

import { useState, useEffect } from "react";
import { Download, X, Share2, Plus, Monitor, Chrome } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showiOSModal, setShowiOSModal] = useState(false);
  const [showDesktopModal, setShowDesktopModal] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Set client-side flag
    setIsClient(true);
    
    // Check if app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    // Detect device type
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isDesktop = !/Mobi|Android/i.test(navigator.userAgent) && !isIOS;
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    
    // Show iOS modal after a delay for iOS users
    if (isIOS && !isInstalled) {
      const timer = setTimeout(() => {
        // Check if user hasn't dismissed the modal recently
        const lastDismissed = localStorage.getItem('ios-install-dismissed');
        if (!lastDismissed || (Date.now() - parseInt(lastDismissed)) > 7 * 24 * 60 * 60 * 1000) {
          setShowiOSModal(true);
        }
      }, 3000); // Show after 3 seconds

      return () => clearTimeout(timer);
    }
    
    // Show desktop modal for desktop users without install prompt
    if (isDesktop && !isInstalled && !deferredPrompt && (isChrome || isEdge)) {
      const timer = setTimeout(() => {
        // Check if user hasn't dismissed the modal recently
        const lastDismissed = localStorage.getItem('desktop-install-dismissed');
        if (!lastDismissed || (Date.now() - parseInt(lastDismissed)) > 7 * 24 * 60 * 60 * 1000) {
          setShowDesktopModal(true);
        }
      }, 5000); // Show after 5 seconds for desktop

      return () => clearTimeout(timer);
    }
  }, [isClient, isInstalled, deferredPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    setIsLoading(true);
    
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } catch (error) {
      console.error("Installation failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleiOSInstallClick = () => {
    setShowiOSModal(true);
  };

  const handleDesktopInstallClick = () => {
    setShowDesktopModal(true);
  };

  const dismissiOSModal = () => {
    setShowiOSModal(false);
    localStorage.setItem('ios-install-dismissed', Date.now().toString());
  };

  const dismissDesktopModal = () => {
    setShowDesktopModal(false);
    localStorage.setItem('desktop-install-dismissed', Date.now().toString());
  };

  // Don't render anything on server-side or if already installed
  if (!isClient || isInstalled) {
    return null;
  }

  // Only show install button on client-side after hydration
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isDesktop = !/Mobi|Android/i.test(navigator.userAgent) && !isIOS;
  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
  const isEdge = /Edg/.test(navigator.userAgent);
  const canInstall = deferredPrompt || isIOS || (isDesktop && (isChrome || isEdge));

  if (!canInstall) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => {
          if (deferredPrompt) {
            handleInstallClick();
          } else if (isIOS) {
            handleiOSInstallClick();
          } else if (isDesktop) {
            handleDesktopInstallClick();
          }
        }}
        disabled={isLoading}
        className="bg-sorsuMaroon text-white px-4 py-2 rounded-lg hover:bg-sorsuMaroon/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 font-medium flex items-center gap-2 text-sm"
      >
        {isLoading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Installing...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Install App
          </>
        )}
      </button>

      {/* iOS Install Instructions Modal */}
      {showiOSModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl transform transition-all duration-300 scale-100">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-sorsuMaroon rounded-xl flex items-center justify-center">
                  <Download className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Install SorSU Docs</h3>
                  <p className="text-sm text-gray-500">Add to Home Screen</p>
                </div>
              </div>
              <button
                onClick={dismissiOSModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">How to install on iOS:</h4>
                <ol className="space-y-3 text-sm text-blue-800">
                  <li className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 bg-blue-200 text-blue-900 rounded-full flex items-center justify-center text-xs font-medium">1</span>
                    <span>Tap the <strong>Share</strong> button <Share2 className="inline w-4 h-4 mx-1" /> at the bottom of Safari</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 bg-blue-200 text-blue-900 rounded-full flex items-center justify-center text-xs font-medium">2</span>
                    <span>Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong> <Plus className="inline w-4 h-4 mx-1" /></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 bg-blue-200 text-blue-900 rounded-full flex items-center justify-center text-xs font-medium">3</span>
                    <span>Tap <strong>&quot;Add&quot;</strong> to confirm and install the app</span>
                  </li>
                </ol>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Benefits of installing:</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-sorsuMaroon rounded-full"></div>
                    <span>Fast access from your home screen</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-sorsuMaroon rounded-full"></div>
                    <span>Works offline for basic features</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-sorsuMaroon rounded-full"></div>
                    <span>No browser distractions</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={dismissiOSModal}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Maybe Later
              </button>
              <button
                onClick={dismissiOSModal}
                className="flex-1 px-4 py-2 bg-sorsuMaroon text-white rounded-lg hover:bg-sorsuMaroon/90 transition-colors font-medium"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Install Instructions Modal */}
      {showDesktopModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl transform transition-all duration-300 scale-100">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-sorsuMaroon rounded-xl flex items-center justify-center">
                  <Monitor className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Install SorSU Docs</h3>
                  <p className="text-sm text-gray-500">Desktop App Installation</p>
                </div>
              </div>
              <button
                onClick={dismissDesktopModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">How to install on Desktop:</h4>
                <ol className="space-y-3 text-sm text-green-800">
                  <li className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 bg-green-200 text-green-900 rounded-full flex items-center justify-center text-xs font-medium">1</span>
                    <span>Look for the <strong>Install Icon</strong> in your browser&apos;s address bar <Chrome className="inline w-4 h-4 mx-1" /></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 bg-green-200 text-green-900 rounded-full flex items-center justify-center text-xs font-medium">2</span>
                    <span>Click the <strong>Install</strong> button when it appears</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 bg-green-200 text-green-900 rounded-full flex items-center justify-center text-xs font-medium">3</span>
                    <span>Confirm installation to add the app to your desktop</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 bg-green-200 text-green-900 rounded-full flex items-center justify-center text-xs font-medium">4</span>
                    <span>Launch from Start Menu/Applications or desktop shortcut</span>
                  </li>
                </ol>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-900 mb-2">Browser Support:</h4>
                <ul className="space-y-2 text-sm text-yellow-800">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-600 rounded-full"></div>
                    <span><strong>Chrome</strong> - Full support with install prompt</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-600 rounded-full"></div>
                    <span><strong>Edge</strong> - Full support with install prompt</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span><strong>Firefox</strong> - Limited support (manual install)</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Benefits of installing:</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-sorsuMaroon rounded-full"></div>
                    <span>Desktop app experience with window controls</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-sorsuMaroon rounded-full"></div>
                    <span>Offline access to essential features</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-sorsuMaroon rounded-full"></div>
                    <span>System notifications and integrations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-sorsuMaroon rounded-full"></div>
                    <span>Faster startup and dedicated app window</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={dismissDesktopModal}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Maybe Later
              </button>
              <button
                onClick={dismissDesktopModal}
                className="flex-1 px-4 py-2 bg-sorsuMaroon text-white rounded-lg hover:bg-sorsuMaroon/90 transition-colors font-medium"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
