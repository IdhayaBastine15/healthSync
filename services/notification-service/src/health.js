const express = require("express");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok", service: "notification-service" });
});

module.exports = router;
