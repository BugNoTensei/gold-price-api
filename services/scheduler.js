const cron = require("node-cron");
const { fetchFromAPI, fetchFromClassicWeb } = require("./scraper");
const supabase = require("./supabase");
const axios = require("axios");

async function getLastUpdateTimeDB(source) {
  const { data, error } = await supabase
    .from("gold_prices")
    .select("update_time")
    .eq("source", source)
    .order("id", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0].update_time;
}

async function saveBulkToDB(source, dataArray) {
  const formattedData = dataArray.map((item) => ({
    source,
    date: item.date,
    time: item.time,
    bar_buy: item.barBuy,
    bar_sell: item.barSell,
    ornament_buy: item.ornamentBuy,
    ornament_sell: item.ornamentSell,
    change_last: item.changeLast,
    daily_change: item.dailyChange,
    update_time: item.updateTime,
    unique_key: item.uniqueKey || `Price-${source}-${item.updateTime}`,
  }));

  const { error } = await supabase
    .from("gold_prices")
    .upsert(formattedData, { onConflict: "unique_key" });

  if (error) throw error;
}

async function updateG99PawnPay(latestData) {
  try {
    const payload = {
      barSale: parseFloat(latestData.barSell),
      barBuy: parseFloat(latestData.barBuy),
      priceAt: latestData.updateTime,
    };

    const targetUrl =
      process.env.G99_API_URL || "https://g99pawnpay.golden99.co.th/gold-price";
    await axios.post(targetUrl, payload);
  } catch (error) {
    console.error(`[SCHEDULER] G99PawnPay error: ${error.message}`);
  }
}

async function syncPriceData() {
  const timestamp = new Date().toISOString();
  console.log(`[SCHEDULER] Starting sync at ${timestamp}`);

  try {
    const apiDataList = await fetchFromAPI();
    if (apiDataList && apiDataList.length > 0) {
      const lastTimeStr = await getLastUpdateTimeDB("API");
      let lastDate = 0;

      if (lastTimeStr && lastTimeStr !== "null") {
        const parsedTime = new Date(lastTimeStr).getTime();
        if (!isNaN(parsedTime)) lastDate = parsedTime;
      }

      const newItems = apiDataList
        .filter((item) => new Date(item.updateTime).getTime() > lastDate)
        .sort(
          (a, b) =>
            new Date(a.updateTime).getTime() - new Date(b.updateTime).getTime(),
        );

      if (newItems.length > 0) {
        await saveBulkToDB("API", newItems);
        const latestItem = newItems[newItems.length - 1];
        await updateG99PawnPay(latestItem);
        console.log(`[SCHEDULER] API: Saved ${newItems.length} new items`);
      }
    }

    const classicData = await fetchFromClassicWeb();
    if (classicData) {
      const dbLastTime = await getLastUpdateTimeDB("ClassicWeb");

      if (String(classicData.updateTime).trim() !== String(dbLastTime).trim()) {
        await saveBulkToDB("ClassicWeb", [classicData]);
        console.log(`[SCHEDULER] ClassicWeb: Data updated`);
      }
    }

    console.log(`[SCHEDULER] Sync completed at ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`[SCHEDULER] Sync failed: ${error.message}`);
  }
}

module.exports = {
  start: () => {
    const scheduleTime = process.env.CRON_SCHEDULE || "*/15 * * * *";
    console.log(`[SCHEDULER] Started with schedule: ${scheduleTime}`);

    cron.schedule(scheduleTime, syncPriceData, {
      runOnInit: false,
      timezone: "Asia/Bangkok",
    });
  },
};
