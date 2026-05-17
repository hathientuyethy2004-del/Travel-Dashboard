import { type Request, type Response, type NextFunction } from "express";

/**
 * Replit Auth middleware.
 * Checks for the X-Replit-User-Id header injected by Replit's proxy
 * when authentication is enabled on the deployment.
 *
 * In development (NODE_ENV !== "production"), auth is bypassed unless
 * REQUIRE_AUTH=true is explicitly set.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const isDev = process.env["NODE_ENV"] !== "production";
  const forceAuth = process.env["REQUIRE_AUTH"] === "true";

  if (isDev && !forceAuth) {
    return next();
  }

  const userId = req.headers["x-replit-user-id"];
  if (!userId) {
    res.status(401).json({
      error: "Authentication required",
      message: "Please log in to perform this action.",
    });
    return;
  }

  next();
}
