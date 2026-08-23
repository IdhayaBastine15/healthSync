// Env var reads, mirrors the pydantic-settings Settings pattern used by the
// FastAPI services (services/*/app/core/config.py) - defaults for local dev,
// overridden by env vars in docker-compose.yml / render.yaml.
const path = require("path");

function required(name, fallback) {
  return process.env[name] || fallback;
}

module.exports = {
  port: process.env.PORT || 8000,
  patientServiceUrl: required("PATIENT_SERVICE_URL", "http://localhost:8001"),
  labServiceUrl: required("LAB_SERVICE_URL", "http://localhost:8002"),
  auditServiceUrl: required("AUDIT_SERVICE_URL", "http://localhost:8004"),
  analyticsServiceUrl: required("ANALYTICS_SERVICE_URL", "http://localhost:8005"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  jwtPublicKeyPath: required(
    "JWT_PUBLIC_KEY_PATH",
    path.join(__dirname, "..", "..", "..", "..", "shared", "keys", "jwt_public.pem")
  ),
  jwtAlgorithm: "RS256",
  corsOrigins: required("CORS_ORIGINS", "*"),
  rateLimitWindowMs: parseInt(required("RATE_LIMIT_WINDOW_MS", "60000"), 10),
  rateLimitMax: parseInt(required("RATE_LIMIT_MAX", "100"), 10),
  proxyTimeoutMs: 60000,
};
