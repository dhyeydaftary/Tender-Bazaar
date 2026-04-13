import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HttpClientConfig {
  /** Base URL for the portal */
  baseURL: string;

  /** Request timeout in ms (default 30000) */
  timeout?: number;

  /** Default headers to send with every request */
  headers?: Record<string, string>;

  /** Proxy URLs to rotate through */
  proxies?: string[];

  /** Initial cookies to set */
  cookies?: Record<string, string>;

  /** Enable request/response logging (default true) */
  logging?: boolean;

  /** Portal name for log prefixes */
  portalName?: string;

  /** Max redirects to follow (default 5) */
  maxRedirects?: number;
}

interface ProxyConfig {
  host: string;
  port: number;
  protocol: string;
}

// ---------------------------------------------------------------------------
// Cookie Jar (simple in-memory implementation)
// ---------------------------------------------------------------------------

class CookieJar {
  private cookies: Map<string, string> = new Map();

  /**
   * Parse Set-Cookie headers and store cookies.
   */
  setCookies(setCookieHeaders: string | string[] | undefined): void {
    if (!setCookieHeaders) return;

    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const header of headers) {
      const parts = header.split(';')[0]; // Take only name=value part
      if (parts) {
        const [name, ...valueParts] = parts.split('=');
        if (name && valueParts.length > 0) {
          this.cookies.set(name.trim(), valueParts.join('=').trim());
        }
      }
    }
  }

  /**
   * Get the Cookie header string.
   */
  getCookieString(): string {
    const parts: string[] = [];
    this.cookies.forEach((value, name) => {
      parts.push(`${name}=${value}`);
    });
    return parts.join('; ');
  }

  /**
   * Set a single cookie.
   */
  set(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  /**
   * Get a single cookie value.
   */
  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  /**
   * Clear all cookies.
   */
  clear(): void {
    this.cookies.clear();
  }
}

// ---------------------------------------------------------------------------
// Proxy rotator
// ---------------------------------------------------------------------------

class ProxyRotator {
  private proxies: ProxyConfig[];
  private index: number = 0;

  constructor(proxyUrls: string[]) {
    this.proxies = proxyUrls.map((url) => {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port, 10) || 8080,
        protocol: parsed.protocol.replace(':', ''),
      };
    });
  }

  /**
   * Get the next proxy in the rotation.
   */
  next(): ProxyConfig | undefined {
    if (this.proxies.length === 0) return undefined;
    const proxy = this.proxies[this.index % this.proxies.length];
    this.index++;
    return proxy;
  }

  /**
   * Check if proxies are configured.
   */
  hasProxies(): boolean {
    return this.proxies.length > 0;
  }
}

// ---------------------------------------------------------------------------
// HTTP Client Factory
// ---------------------------------------------------------------------------

/**
 * Create a configured axios instance for a specific portal.
 * Includes cookie jar support, proxy rotation, and request/response logging.
 */
export function createHttpClient(config: HttpClientConfig): AxiosInstance {
  const cookieJar = new CookieJar();
  const proxyRotator = new ProxyRotator(config.proxies ?? []);
  const enableLogging = config.logging ?? true;
  const prefix = config.portalName ? `[${config.portalName}]` : '[HTTP]';

  // Set initial cookies if provided
  if (config.cookies) {
    for (const [name, value] of Object.entries(config.cookies)) {
      cookieJar.set(name, value);
    }
  }

  const instance = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout ?? 30_000,
    maxRedirects: config.maxRedirects ?? 5,
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Connection: 'keep-alive',
      ...config.headers,
    },
    // Don't throw on non-2xx status codes — let the scraper handle them
    validateStatus: (status) => status >= 200 && status < 500,
  });

  // -----------------------------------------------------------------------
  // Request interceptor
  // -----------------------------------------------------------------------

  instance.interceptors.request.use(
    (reqConfig: InternalAxiosRequestConfig) => {
      // Attach cookies
      const cookieString = cookieJar.getCookieString();
      if (cookieString) {
        reqConfig.headers.set('Cookie', cookieString);
      }

      // Rotate proxy if available
      if (proxyRotator.hasProxies()) {
        const proxy = proxyRotator.next();
        if (proxy) {
          (reqConfig as AxiosRequestConfig).proxy = {
            host: proxy.host,
            port: proxy.port,
            protocol: proxy.protocol,
          };
        }
      }

      // Log request
      if (enableLogging) {
        console.log(
          `${prefix} REQUEST: ${reqConfig.method?.toUpperCase()} ${reqConfig.baseURL ?? ''}${reqConfig.url ?? ''}`,
        );
      }

      return reqConfig;
    },
    (error) => {
      if (enableLogging) {
        console.error(`${prefix} REQUEST ERROR:`, error.message);
      }
      return Promise.reject(error);
    },
  );

  // -----------------------------------------------------------------------
  // Response interceptor
  // -----------------------------------------------------------------------

  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // Store cookies from response
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        cookieJar.setCookies(setCookie);
      }

      // Log response
      if (enableLogging) {
        const contentLength = response.headers['content-length'] ?? 'unknown';
        console.log(
          `${prefix} RESPONSE: ${response.status} ${response.statusText} | ${contentLength} bytes`,
        );
      }

      return response;
    },
    (error) => {
      if (enableLogging) {
        const status = error.response?.status ?? 'NO_RESPONSE';
        const url = error.config?.url ?? 'unknown';
        console.error(`${prefix} RESPONSE ERROR: ${status} for ${url} — ${error.message}`);
      }
      return Promise.reject(error);
    },
  );

  return instance;
}

/**
 * Convenience function to create an HTTP client with common defaults for
 * Indian government portals.
 */
export function createGovPortalClient(
  portalName: string,
  baseURL: string,
  extraHeaders?: Record<string, string>,
): AxiosInstance {
  return createHttpClient({
    baseURL,
    portalName,
    timeout: 45_000, // Government portals can be slow
    maxRedirects: 10,
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...extraHeaders,
    },
  });
}
