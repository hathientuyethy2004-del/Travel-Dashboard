import { type Request, type Response, type NextFunction } from "express";

/**
 * Replit Auth middleware.
 * Checks for the X-Replit-User-Id header injected by Replit's proxy
 * when authentication is enabled on the deployment.
 *
 * Auth is disabled unless REQUIRE_AUTH=true is explicitly set.
 * This keeps local Docker deployments usable while allowing hosted
 * deployments to opt into Replit header-based write protection.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authRequired = process.env["REQUIRE_AUTH"] === "true";

  if (!authRequired) {
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
