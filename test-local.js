/**
 * Test script to simulate Vercel environment locally
 * Run: node test-local.js
 */

require("dotenv").config();
process.env.NODE_ENV = "production";

const handler = require("./api/scrape");

const req = {
  url: "/api/scrape",
  method: "GET",
  headers: {
    host: "localhost:3000",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  },
};

const res = {
  statusCode: 200,
  status: (code) => {
    res.statusCode = code;
    return {
      json: (data) => {
        console.log(`\n[Response Status: ${code}]`);
        console.log(JSON.stringify(data, null, 2));
        process.exit(res.statusCode === 200 ? 0 : 1);
      },
    };
  },
};

console.log("[TEST] Starting Vercel-like environment test...\n");
handler(req, res).catch((err) => {
  console.error("[ERROR]", err.message);
  process.exit(1);
});
