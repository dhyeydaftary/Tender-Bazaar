'use client';

import { createContext, useContext, useState, useEffect } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   APPEARANCE & THEME MANAGEMENT
   ═══════════════════════════════════════════════════════════════════════════ */

export interface AppearanceContextType {
  isDark: boolean;
  toggleTheme: () => void;
  font: string;
  setFont: (font: string) => void;
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  isCompact: boolean;
  toggleCompact: () => void;
  setIsCompact: (compact: boolean) => void;
}

export const AppearanceContext = createContext<AppearanceContextType>({
  isDark: true,
  toggleTheme: () => {},
  font: 'plus-jakarta-sans',
  setFont: () => {},
  primaryColor: '#FF6B35',
  setPrimaryColor: () => {},
  isCompact: false,
  toggleCompact: () => {},
  setIsCompact: () => {},
});

export const useAppearance = () => useContext(AppearanceContext);

export const FONT_MAP: Record<string, string> = {
  'plus-jakarta-sans': "'Plus Jakarta Sans', system-ui, sans-serif",
  'inter': "'Inter', system-ui, sans-serif",
  'poppins': "'Poppins', system-ui, sans-serif",
  'dm-sans': "'DM Sans', system-ui, sans-serif",
};

export function hexToHsl(hex: string): string {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function adjustHex(color: string, amount: number): string {
  return (
    '#' +
    color
      .replace(/^#/, '')
      .replace(/../g, (c) =>
        ('0' + Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).substr(-2),
      )
  );
}

export function applyAppearanceSettings({
  isDark,
  font,
  primaryColor,
  secondaryColor,
  accentColor,
  isCompact,
}: {
  isDark?: boolean;
  font?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  isCompact?: boolean;
}) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;

  if (isDark !== undefined) {
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('tb_admin_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('tb_admin_theme', 'light');
    }
  }

  if (isCompact !== undefined) {
    if (isCompact) {
      root.classList.add('compact');
      localStorage.setItem('tb_admin_compact', 'true');
    } else {
      root.classList.remove('compact');
      localStorage.setItem('tb_admin_compact', 'false');
    }
  }

  if (font && FONT_MAP[font]) {
    root.style.setProperty('--font-family', FONT_MAP[font]);
    document.body.style.fontFamily = FONT_MAP[font];
    localStorage.setItem('tb_admin_font', font);
  }

  if (primaryColor) {
    root.style.setProperty('--color-primary-500', primaryColor);
    root.style.setProperty('--color-primary-600', adjustHex(primaryColor, -20));
    try {
      const hsl = hexToHsl(primaryColor);
      root.style.setProperty('--primary', hsl);
      root.style.setProperty('--ring', hsl);
    } catch (e) {}
  }

  if (secondaryColor) {
    root.style.setProperty('--color-secondary-900', secondaryColor);
  }

  if (accentColor) {
    root.style.setProperty('--color-accent-500', accentColor);
    try {
      root.style.setProperty('--accent', hexToHsl(accentColor));
    } catch (e) {}
  }

  if (primaryColor || secondaryColor || accentColor) {
    try {
      const existing = JSON.parse(localStorage.getItem('tb_admin_colors') || '{}');
      localStorage.setItem(
        'tb_admin_colors',
        JSON.stringify({
          primary: primaryColor || existing.primary || '#FF6B35',
          secondary: secondaryColor || existing.secondary || '#1B2845',
          accent: accentColor || existing.accent || '#00D4AA',
        }),
      );
    } catch (e) {}
  }

  window.dispatchEvent(new CustomEvent('tb_appearance_changed'));
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);
  const [font, setFontState] = useState('plus-jakarta-sans');
  const [primaryColor, setPrimaryColorState] = useState('#FF6B35');
  const [isCompact, setIsCompactState] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('tb_admin_theme');
      const darkVal = savedTheme ? savedTheme !== 'light' : true;
      setIsDark(darkVal);

      const savedCompact = localStorage.getItem('tb_admin_compact') === 'true';
      setIsCompactState(savedCompact);

      const savedFont = localStorage.getItem('tb_admin_font') || 'plus-jakarta-sans';
      setFontState(savedFont);

      const savedColors = JSON.parse(localStorage.getItem('tb_admin_colors') || '{}');
      const pColor = savedColors.primary || '#FF6B35';
      const sColor = savedColors.secondary || '#1B2845';
      const aColor = savedColors.accent || '#00D4AA';
      setPrimaryColorState(pColor);

      applyAppearanceSettings({
        isDark: darkVal,
        isCompact: savedCompact,
        font: savedFont,
        primaryColor: pColor,
        secondaryColor: sColor,
        accentColor: aColor,
      });
    } catch (e) {}

    const handleSync = () => {
      try {
        const theme = localStorage.getItem('tb_admin_theme');
        setIsDark(theme !== 'light');
        const compact = localStorage.getItem('tb_admin_compact') === 'true';
        setIsCompactState(compact);
        const f = localStorage.getItem('tb_admin_font');
        if (f) setFontState(f);
        const c = JSON.parse(localStorage.getItem('tb_admin_colors') || '{}');
        if (c.primary) setPrimaryColorState(c.primary);
      } catch (e) {}
    };

    window.addEventListener('tb_appearance_changed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('tb_appearance_changed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    applyAppearanceSettings({ isDark: next });
  };

  const toggleCompact = () => {
    const next = !isCompact;
    setIsCompactState(next);
    applyAppearanceSettings({ isCompact: next });
  };

  const setIsCompact = (compact: boolean) => {
    setIsCompactState(compact);
    applyAppearanceSettings({ isCompact: compact });
  };

  const setFont = (newFont: string) => {
    setFontState(newFont);
    applyAppearanceSettings({ font: newFont });
  };

  const setPrimaryColor = (newColor: string) => {
    setPrimaryColorState(newColor);
    applyAppearanceSettings({ primaryColor: newColor });
  };

  return (
    <AppearanceContext.Provider
      value={{
        isDark,
        toggleTheme,
        font,
        setFont,
        primaryColor,
        setPrimaryColor,
        isCompact,
        toggleCompact,
        setIsCompact,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}
