// One createProxyMiddleware() per downstream service. pathRewrite uses
// req.originalUrl (not the `path` arg, which is Express's already-mutated
// req.url once mounted under a sub-path) so stripping "/api/v1" works
// correctly regardless of where the middleware is mounted.
const { createProxyMiddleware } = require("http-proxy-middleware");
const config = require("../config");

function stripApiPrefix(_path, req) {
  return req.originalUrl.replace(/^\/api\/v1/, "");
}

function makeProxy(target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: stripApiPrefix,
    proxyTimeout: config.proxyTimeoutMs,
    timeout: config.proxyTimeoutMs,
    on: {
      error: (err, req, res) => {
        req.log?.error({ err, target }, "Proxy error reaching downstream service");
        if (!res.headersSent) {
          res.writeHead(504, { "Content-Type": "application/json" });
        }
        res.end(JSON.stringify({ error: { code: "UPSTREAM_TIMEOUT", message: "Downstream service did not respond in time" } }));
      },
    },
  });
}

module.exports = {
  patientProxy: makeProxy(config.patientServiceUrl),
  labProxy: makeProxy(config.labServiceUrl),
  auditProxy: makeProxy(config.auditServiceUrl),
};
