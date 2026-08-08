// Authentication-only gate (not authorization/RBAC - shared/rbac.json stays
// the single source of truth, enforced server-side by each FastAPI service
// via user.require(...)). Mirrors services/*/app/core/security.py's
// decode_access_token + get_current_user: verify RS256 against the public
// key, check the Redis blacklist for revoked tokens (jwt:blacklist:{jti}).
const fs = require("fs");
const jwt = require("jsonwebtoken");
const config = require("../config");
const { ensureConnected } = require("../redisClient");

let publicKey = null;
function getPublicKey() {
  if (!publicKey) {
    publicKey = fs.readFileSync(config.jwtPublicKeyPath, "utf8");
  }
  return publicKey;
}

function authError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return authError(res, 401, "UNAUTHENTICATED", "Missing or malformed Authorization header");
  }

  let payload;
  try {
    payload = jwt.verify(token, getPublicKey(), { algorithms: [config.jwtAlgorithm] });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return authError(res, 401, "TOKEN_EXPIRED", "Access token has expired");
    }
    return authError(res, 401, "TOKEN_INVALID", "Access token is invalid");
  }

  try {
    const redis = await ensureConnected();
    const blacklisted = await redis.exists(`jwt:blacklist:${payload.jti}`);
    if (blacklisted) {
      return authError(res, 401, "TOKEN_REVOKED", "Token has been revoked");
    }
  } catch (err) {
    // Redis being briefly unavailable shouldn't hard-fail every request;
    // log and let the request through - each downstream service performs
    // this same blacklist check itself as the authoritative gate.
    req.log?.warn({ err }, "Redis blacklist check failed, proceeding without it");
  }

  req.user = { sub: payload.sub, roles: payload.roles || [], jti: payload.jti };
  next();
}

module.exports = { requireAuth, getPublicKey, authError };
