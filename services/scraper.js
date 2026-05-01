const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");
const { HEADERS, PROXY_URL } = require("../config");
const goldConfig = require("../config/goldConfig");

// Setup global proxy agent if proxy URL is provided
if (PROXY_URL) {
  const { bootstrap } = require("global-agent");
  bootstrap();
  process.env.GLOBAL_AGENT_HTTP_PROXY = PROXY_URL;
  process.env.GLOBAL_AGENT_HTTPS_PROXY = PROXY_URL;
  console.log(`[INFO] Using proxy: ${PROXY_URL}`);
}

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

// Retry logic wrapper
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(
        `[FETCH] Attempt ${attempt}/${retries} for ${url.substring(0, 50)}...`,
      );
      const response = await axios.get(url, {
        ...options,
        timeout: 10000,
      });
      console.log(`[SUCCESS] Fetched successfully on attempt ${attempt}`);
      return response;
    } catch (err) {
      const statusCode = err.response?.status || "unknown";
      const isClientError =
        err.response && err.response.status >= 400 && err.response.status < 500;
      const isLastAttempt = attempt === retries;

      console.error(
        `[ATTEMPT ${attempt}] Status: ${statusCode}, Message: ${err.message}`,
      );

      if (isClientError && statusCode === 403) {
        // 403 might be temporary, retry with longer wait
        if (!isLastAttempt) {
          const waitTime = 2000 * attempt; // 2s, 4s, 6s
          console.log(`[RETRY] Waiting ${waitTime}ms before retry...`);
          await new Promise((r) => setTimeout(r, waitTime));
          continue;
        }
      } else if (!isClientError && !isLastAttempt) {
        // Network errors, retry
        const waitTime = 1000 * attempt;
        console.log(`[RETRY] Network error, waiting ${waitTime}ms...`);
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }

      if (isLastAttempt) {
        console.error(`[FAILED] All ${retries} attempts exhausted for ${url}`);
        throw err;
      }
    }
  }
}

async function fetchFromAPI() {
  try {
    const res = await fetchWithRetry(goldConfig.API_URL, {
      headers: HEADERS,
      httpsAgent: httpsAgent,
    });

    if (!Array.isArray(res.data)) return null;

    return res.data.map((item) => {
      const [datePart, timePart] = item.asTime.split("T");
      const [year, month, day] = datePart.split("-");

      return {
        source: "API",
        date: `${day}/${month}/${year}`,
        time: timePart,
        barBuy: item.bL_BuyPrice,
        barSell: item.bL_SellPrice,
        ornamentBuy: item.oM965_BuyPrice,
        ornamentSell: item.oM965_SellPrice,
        changeLast: item.priceChangeFromPrevRow,
        dailyChange: item.priceChangeFromPrevDayLast,
        updateTime: item.asTime,
      };
    });
  } catch (err) {
    console.error("[API Fetch Error]:", err.message);
    if (err.config && err.config.headers) {
      console.log("Headers", err.config.headers);
    }
    return null;
  }
}

async function fetchFromClassicWeb() {
  try {
    const res = await fetchWithRetry(goldConfig.CLASSIC_WEB_URL, {
      headers: HEADERS,
      httpsAgent: httpsAgent,
    });
    const $ = cheerio.load(res.data);

    const barSellText = $(goldConfig.SELECTOR.GOLD_BAR_SELL)
      .text()
      .replace(/,/g, "");
    if (!barSellText) return null;

    const barSell = parseFloat(barSellText);
    const barBuy = parseFloat(
      $(goldConfig.SELECTOR.GOLD_BAR_BUY).text().replace(/,/g, ""),
    );
    const ornamentSell = parseFloat(
      $(goldConfig.SELECTOR.GOLD_ORNAMENT_SELL).text().replace(/,/g, ""),
    );
    const ornamentBuy = parseFloat(
      $(goldConfig.SELECTOR.GOLD_ORNAMENT_BUY).text().replace(/,/g, ""),
    );

    const updateTimeText = $(goldConfig.SELECTOR.UPDATE_DATETIME).text().trim();
    let datePart = updateTimeText;
    let timePart = "";
    if (updateTimeText.includes(" เวลา ")) {
      const [d, t] = updateTimeText.split(" เวลา ");
      datePart = d.trim();
      timePart = t.trim().split(" ")[0];
    }
    return {
      source: "ClassicWeb",
      barBuy: barBuy,
      barSell: barSell,
      ornamentBuy: ornamentBuy,
      ornamentSell: ornamentSell,
      changeLast: 0,
      dailyChange: 0,
      updateTime: updateTimeText,
      date: datePart,
      time: timePart,
      uniqueKey: updateTimeText || `Manual-${Date.now()}`,
    };
  } catch (err) {
    console.error("[Scraper Error]:", err.message);
    return null;
  }
}

module.exports = { fetchFromAPI, fetchFromClassicWeb };
