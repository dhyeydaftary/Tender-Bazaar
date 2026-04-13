import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* Large 404 */}
        <h1 className="text-[10rem] sm:text-[14rem] font-extrabold leading-none bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 bg-clip-text text-transparent select-none">
          404
        </h1>

        {/* Messaging */}
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground mt-2">
          Page not found
        </h2>
        <p className="text-muted-foreground mt-3 text-lg max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        {/* Search bar */}
        <form action="/dashboard/tenders" method="GET" className="mt-8 max-w-md mx-auto">
          <div className="relative">
            <input
              type="text"
              name="q"
              placeholder="Search for tenders..."
              className="w-full px-5 py-3 pl-12 rounded-xl bg-muted border border-border text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </form>

        {/* Action buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors w-full sm:w-auto"
          >
            Go Home
          </Link>
          <Link
            href="/dashboard/tenders"
            className="bg-muted hover:bg-muted/80 text-foreground px-6 py-3 rounded-xl text-sm font-semibold transition-colors border border-border w-full sm:w-auto"
          >
            Browse Tenders
          </Link>
          <Link
            href="/contact"
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors underline underline-offset-4"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
