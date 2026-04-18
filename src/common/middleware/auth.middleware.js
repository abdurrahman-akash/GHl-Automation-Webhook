import {
  resolveAuthContextFromRequest,
  validateRequestAuthContext
} from "../auth/auth.service.js";

export function requireAuthHeaders(req, res, next) {
  const context = resolveAuthContextFromRequest(req, { allowBodyFallback: false });
  const authResult = validateRequestAuthContext(context);

  if (!authResult.valid) {
    return res.status(authResult.statusCode).json({ message: authResult.message });
  }

  req.authContext = context;
  return next();
}
