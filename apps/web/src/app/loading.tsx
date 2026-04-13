export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      {/* Spinning logo */}
      <div className="w-14 h-14 rounded-xl bg-primary-500 flex items-center justify-center text-white font-extrabold text-lg animate-pulse">
        TB
      </div>

      {/* Loading text */}
      <p className="mt-4 text-muted-foreground text-sm font-medium animate-pulse">
        Loading...
      </p>
    </div>
  );
}
