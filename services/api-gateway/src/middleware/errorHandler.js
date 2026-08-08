// Final error handler - emits the same {"error":{"code":...,"message":...}}
// shape the FastAPI services use, including proxy timeouts to a
// cold-starting free-tier downstream (60s proxyTimeout covers the ~30-60s
// Render cold start; anything slower than that is a genuine problem).
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  req.log?.error({ err }, "Unhandled gateway error");
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` } });
}

module.exports = { errorHandler, notFoundHandler };
