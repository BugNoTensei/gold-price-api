require("dotenv").config();
const express = require("express");
const scrapeRoutes = require("./api/scrape");
const scheduler = require("./services/scheduler");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/api", scrapeRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[SERVER] Running on port ${PORT}`);
  scheduler.start();
});
