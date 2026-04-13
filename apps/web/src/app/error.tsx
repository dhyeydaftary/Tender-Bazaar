'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorId = useMemo(
    () => error.digest || Math.random().toString(36).substring(2, 10).toUpperCase(),
    [error.digest],
  );

  useEffect(() => {
    console.error('[TenderBazaar] Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Error icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-destructive/20 flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        {/* Messaging */}
        <h1 className="text-3xl font-bold text-foreground">Something went wrong</h1>
        <p className="text-muted-foreground mt-3 text-lg">
          We&apos;re working on fixing this. Please try again.
        </p>

        {/* Action buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={reset}
            className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors w-full sm:w-auto"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl text-sm font-semibold transition-colors border border-border w-full sm:w-auto"
          >
            Go Home
          </Link>
        </div>

        {/* Error ID */}
        <p className="mt-8 text-xs text-muted-foreground/60">
          Error ID: {errorId} &mdash; Share this with support if the issue persists.
        </p>
      </div>
    </div>
  );
}
