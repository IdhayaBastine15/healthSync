// Proxy route table (plan section 1). /auth/login and /auth/refresh are the
// only unauthenticated routes (no token exists yet at that point) - every
// other route requires a valid, non-blacklisted JWT. This gateway checks
// authentication only; RBAC/permission enforcement stays server-side in
// each FastAPI service via shared/rbac.json (single source of truth).
const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { patientProxy, labProxy, auditProxy, analyticsProxy } = require("./proxyTargets");

const router = express.Router();

router.post("/api/v1/auth/login", patientProxy);
router.post("/api/v1/auth/refresh", patientProxy);
router.use("/api/v1/auth", requireAuth, patientProxy); // /logout and any future auth subpaths

router.use("/api/v1/patients", requireAuth, patientProxy);

router.use(["/api/v1/results", "/api/v1/panels", "/api/v1/reference-ranges"], requireAuth, labProxy);

router.use("/api/v1/audit", requireAuth, auditProxy);

router.use("/api/v1/analytics", requireAuth, analyticsProxy);

module.exports = router;
