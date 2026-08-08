const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const config = require("./config");
const requestLogger = require("./middleware/requestLogger");
const rateLimiter = require("./middleware/rateLimiter");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const { router: healthRouter } = require("./health");
const apiRoutes = require("./routes");

function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins === "*" ? "*" : config.corsOrigins.split(","),
      credentials: true,
    })
  );
  app.use(requestLogger);
  app.use(rateLimiter);

  app.use(healthRouter);
  app.use(apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`api-gateway listening on port ${config.port}`);
  });
}

module.exports = { createApp };
