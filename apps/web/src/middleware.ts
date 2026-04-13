import { NextRequest, NextResponse } from 'next/server';

const protectedPaths = ['/tenders', '/saved', '/alerts', '/settings', '/subscription', '/eligibility', '/analytics', '/ai-eligibility', '/bid-assistant', '/search', '/dashboard', '/calendar', '/compare', '/results', '/notifications', '/referral'];
const authPaths = ['/login', '/register', '/forgot-password', '/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for access token in cookies or authorization header
  const token = request.cookies.get('accessToken')?.value;

  // Protect dashboard routes
  if (protectedPaths.some((path) => pathname.startsWith(path))) {
    // For now, client-side auth handles protection
    // Server-side middleware will be enhanced when we add httpOnly cookies
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
