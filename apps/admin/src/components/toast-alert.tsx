'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastAlertProps {
  show: boolean;
  type?: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
  duration?: number;
}

export function ToastAlert({
  show,
  type = 'success',
  message,
  onClose,
  duration = 4000,
}: ToastAlertProps) {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [show, duration, onClose]);

  if (!show) return null;

  const styles = {
    success: {
      bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
    },
    error: {
      bg: 'bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-400',
      icon: <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />,
    },
    info: {
      bg: 'bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400',
      icon: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
    },
  }[type];

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
      <div
        className={`px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-md flex items-center gap-3 text-sm font-semibold max-w-md ${styles.bg}`}
      >
        {styles.icon}
        <span className="flex-1 leading-snug">{message}</span>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Close alert"
        >
          <X className="w-4 h-4 opacity-70 hover:opacity-100" />
        </button>
      </div>
    </div>
  );
}
