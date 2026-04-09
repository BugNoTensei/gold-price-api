const axios = require("axios");
const cheerio = require("cheerio");
const { HEADERS } = require("../config");
const goldConfig = require("../config/goldConfig");

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  httpsAgent: httpsAgent,
  keepAlive: true,
});

async function fetchFromAPI() {
  try {
    const res = await axios.get(goldConfig.API_URL, {
      headers: HEADERS,
      httpsAgent: httpsAgent,
      timeout: 5000,
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
    const res = await axios.get(goldConfig.CLASSIC_WEB_URL, {
      headers: HEADERS,
      httpsAgent: httpsAgent,
      timeout: 5000,
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
