// GET /health reports only the gateway's own status - NOT aggregated
// downstream health. Render's healthCheckPath decides whether to keep
// routing to *this* instance; if it reflected a cold-starting (but fine)
// downstream, the gateway would falsely look unhealthy and risk an
// unnecessary restart. GET /health/dependencies is a separate manual-
// debugging endpoint only (pings each downstream in parallel), not what
// Render's blueprint points at.
const express = require("express");
const client = require("prom-client");
const config = require("./config");

const router = express.Router();

client.collectDefaultMetrics();
const requestCounter = new client.Counter({
  name: "api_gateway_requests_total",
  help: "Total requests handled by the gateway",
  labelNames: ["method", "path", "status_code"],
});

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

router.get("/metrics", async (_req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

router.get("/health/dependencies", async (_req, res) => {
  const targets = {
    "patient-service": config.patientServiceUrl,
    "lab-service": config.labServiceUrl,
    "audit-service": config.auditServiceUrl,
  };
  const results = await Promise.all(
    Object.entries(targets).map(async ([name, base]) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      try {
        const resp = await fetch(`${base}/health`, { signal: controller.signal });
        return [name, resp.ok ? "ok" : `http_${resp.status}`];
      } catch (err) {
        return [name, `unreachable: ${err.message}`];
      } finally {
        clearTimeout(timeout);
      }
    })
  );
  res.json({ gateway: "ok", dependencies: Object.fromEntries(results) });
});

module.exports = { router, requestCounter };
