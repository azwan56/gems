// ============================================================
// Shared API route utilities — reduces boilerplate across routes
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, requirePremium, type AuthenticatedUser } from "./auth-middleware";

/** Standard API error response shape */
export interface ApiErrorBody {
  error: string;
  message: string;
  [key: string]: unknown;
}

/**
 * Create a standardized JSON error response.
 */
export function createErrorResponse(
  code: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: code, message, ...extra }, { status });
}

/**
 * Safely parse a JSON request body.
 * Returns the parsed body or a 400 error response.
 */
export async function parseJsonBody<T = unknown>(
  request: NextRequest
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  try {
    const data = (await request.json()) as T;
    return { data };
  } catch {
    return {
      error: createErrorResponse("INVALID_BODY", "Invalid JSON body", 400),
    };
  }
}

/**
 * Handler type for authenticated API routes.
 */
type AuthHandler = (
  request: NextRequest,
  user: AuthenticatedUser
) => Promise<NextResponse>;

/**
 * Wrap a route handler with authentication (verifyAuth).
 * Returns 401 if token is invalid.
 */
export function withAuth(handler: AuthHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await verifyAuth(request);
    if (!authResult.success) return authResult.response;
    return handler(request, authResult.user);
  };
}

/**
 * Wrap a route handler with premium auth (requirePremium).
 * Returns 401 if token is invalid, 403 if not premium.
 */
export function withPremium(handler: AuthHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const authResult = await requirePremium(request);
    if (!authResult.success) return authResult.response;
    return handler(request, authResult.user);
  };
}

/**
 * Check if FMP errors indicate a rate limit.
 * Shared between stock-pool and cron routes.
 */
export function hasRateLimitErrors(errors: string[]): boolean {
  return errors.some(
    (e) =>
      e.includes("429") ||
      e.includes("402") ||
      e.toLowerCase().includes("limit reach")
  );
}
