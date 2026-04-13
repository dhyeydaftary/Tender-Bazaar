'use client';

import { useState, useEffect } from 'react';

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

const STORAGE_KEY = 'cookie_consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Small delay for smooth entrance
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  function saveConsent(prefs: CookiePreferences) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setVisible(false);
  }

  function handleAcceptAll() {
    saveConsent({ essential: true, analytics: true, marketing: true });
  }

  function handleRejectNonEssential() {
    saveConsent({ essential: true, analytics: false, marketing: false });
  }

  function handleSavePreferences() {
    saveConsent(preferences);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100] transition-transform duration-500 ease-out"
      style={{ transform: visible ? 'translateY(0)' : 'translateY(100%)' }}
    >
      <div className="bg-secondary-900 border-t border-white/10 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Main banner */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
            <p className="text-sm text-gray-300 flex-1">
              We use cookies to improve your experience. By continuing to use TenderBazaar,
              you agree to our use of cookies.{' '}
              <a
                href="/privacy"
                className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors"
              >
                Learn more
              </a>
            </p>

            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={handleAcceptAll}
                className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Accept All
              </button>
              <button
                onClick={() => setShowPreferences((prev) => !prev)}
                className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors border border-white/10"
              >
                Manage Preferences
              </button>
              <button
                onClick={handleRejectNonEssential}
                className="text-gray-400 hover:text-white text-sm transition-colors underline underline-offset-2"
              >
                Reject Non-Essential
              </button>
            </div>
          </div>

          {/* Preferences panel */}
          {showPreferences && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="grid sm:grid-cols-3 gap-4">
                {/* Essential */}
                <label className="flex items-start gap-3 p-3 rounded-lg bg-white/5">
                  <input
                    type="checkbox"
                    checked
                    disabled
                    className="mt-0.5 rounded border-gray-600 text-primary-500 cursor-not-allowed"
                  />
                  <div>
                    <span className="text-sm font-medium text-white">Essential Cookies</span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Required for the website to function. Cannot be disabled.
                    </p>
                  </div>
                </label>

                {/* Analytics */}
                <label className="flex items-start gap-3 p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) =>
                      setPreferences((prev) => ({ ...prev, analytics: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-gray-600 text-primary-500 focus:ring-primary-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-medium text-white">Analytics Cookies</span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Help us understand how you use our platform to improve it.
                    </p>
                  </div>
                </label>

                {/* Marketing */}
                <label className="flex items-start gap-3 p-3 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={preferences.marketing}
                    onChange={(e) =>
                      setPreferences((prev) => ({ ...prev, marketing: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-gray-600 text-primary-500 focus:ring-primary-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-medium text-white">Marketing Cookies</span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Used to deliver relevant advertisements and track campaigns.
                    </p>
                  </div>
                </label>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSavePreferences}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
