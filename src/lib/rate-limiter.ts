/**
 * Rate Limiter
 *
 * Simple in-memory rate limiting for query API.
 * Prevents abuse by limiting requests per session/IP.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory storage for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_MAX = 10; // Maximum queries per window
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds

/**
 * Check if request should be rate limited
 */
export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    cleanupExpiredEntries(now);
  }

  if (!entry || now >= entry.resetTime) {
    // No entry or expired - create new entry
    const resetTime = now + RATE_LIMIT_WINDOW;
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime
    });

    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetTime
    };
  }

  // Entry exists and is valid
  if (entry.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - entry.count,
    resetTime: entry.resetTime
  };
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get rate limit identifier from request
 */
export function getRateLimitIdentifier(request: Request): string {
  // Try to get IP address from headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0] || realIP || 'unknown';

  // In development, you might want to use a session ID instead
  // For now, use IP as identifier
  return ip;
}

/**
 * Format time remaining for rate limit reset
 */
export function formatResetTime(resetTime: number): string {
  const seconds = Math.ceil((resetTime - Date.now()) / 1000);
  if (seconds < 60) {
    return `${seconds}초`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}분`;
}
