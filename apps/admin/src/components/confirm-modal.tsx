'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, Info, CheckCircle2, X, Loader2 } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemName,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Focus confirm button when opened & handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => confirmBtnRef.current?.focus(), 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const iconConfig = {
    danger: {
      icon: <Trash2 className="w-6 h-6 text-red-500" />,
      bg: 'bg-red-500/10 dark:bg-red-500/20',
      ring: 'ring-red-500/15',
      glow: 'from-red-500/15 via-transparent to-red-500/5',
      btn: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-red-600/25',
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-amber-500" />,
      bg: 'bg-amber-500/10 dark:bg-amber-500/20',
      ring: 'ring-amber-500/15',
      glow: 'from-amber-500/15 via-transparent to-amber-500/5',
      btn: 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-amber-600/25',
    },
    info: {
      icon: <Info className="w-6 h-6 text-blue-500" />,
      bg: 'bg-blue-500/10 dark:bg-blue-500/20',
      ring: 'ring-blue-500/15',
      glow: 'from-blue-500/15 via-transparent to-blue-500/5',
      btn: 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white shadow-primary-500/25',
    },
    success: {
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      ring: 'ring-emerald-500/15',
      glow: 'from-emerald-500/15 via-transparent to-emerald-500/5',
      btn: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/25',
    },
  }[variant];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-md bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Subtle Ambient Glow */}
        <div className={`absolute -top-16 inset-x-0 h-32 bg-gradient-to-b ${iconConfig.glow} blur-2xl pointer-events-none`} />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Header with Icon */}
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center ${iconConfig.bg} ring-8 ${iconConfig.ring}`}
            >
              {iconConfig.icon}
            </div>

            <div className="flex-1 pr-6">
              <h3 className="text-lg font-bold text-foreground leading-snug">
                {title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Please confirm your action to proceed.
              </p>
            </div>
          </div>

          {/* Target Item Name (if provided) */}
          {itemName && (
            <div className="mt-4 p-3 rounded-xl bg-muted/60 border border-border/80 flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Target:
              </span>
              <span className="text-xs font-semibold text-foreground truncate max-w-[280px]">
                {itemName}
              </span>
            </div>
          )}

          {/* Description Message */}
          <div className="mt-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {message}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
            >
              {cancelText}
            </button>

            <button
              ref={confirmBtnRef}
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md active:scale-[0.98] flex items-center gap-2 disabled:opacity-50 ${iconConfig.btn}`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {variant === 'danger' && <Trash2 className="w-4 h-4" />}
                  <span>{confirmText}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
