const { fetchFromAPI, fetchFromClassicWeb } = require("../services/scraper");
const supabase = require("../services/supabase");
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

  console.log(
    `[INFO] [DB] Successfully upserted ${dataArray.length} record(s) for ${source}`,
  );
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

    console.log(
      `[INFO] [API_EXTERNAL] Payload posted to G99PawnPay successfully: ${JSON.stringify(payload)}`,
    );
  } catch (error) {
    console.error(
      `[ERROR] [API_EXTERNAL] Failed to post to G99PawnPay: ${error.message}`,
    );
  }
}

async function processAPI() {
  const apiDataList = await fetchFromAPI();
  if (!apiDataList || apiDataList.length === 0) {
    console.log(`[WARN] [SCRAPER] No data retrieved from API source`);
    return;
  }

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
  } else {
    console.log(`[INFO] [SYNC] API source is already up-to-date`);
  }
}

async function processClassicWeb() {
  const classicData = await fetchFromClassicWeb();
  if (!classicData) {
    console.log(`[WARN] [SCRAPER] No data retrieved from ClassicWeb source`);
    return;
  }

  const dbLastTime = await getLastUpdateTimeDB("ClassicWeb");

  if (String(classicData.updateTime).trim() !== String(dbLastTime).trim()) {
    await saveBulkToDB("ClassicWeb", [classicData]);
  } else {
    console.log(`[INFO] [SYNC] ClassicWeb source is already up-to-date`);
  }
}

module.exports = async function handler(req, res) {
  try {
    console.log(`[INFO] [SYSTEM] Initiating synchronization sequence...`);
    await Promise.all([processAPI(), processClassicWeb()]);
    console.log(`[INFO] [SYSTEM] Synchronization sequence completed`);

    return res.status(200).json({
      status: "success",
      response: goldData,
    });
  } catch (error) {
    console.error(
      `[FATAL] [SYSTEM] Synchronization sequence terminated: ${error.message}`,
    );
    return res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Internal Server Error",
    });
  }
};
module.exports = handler;
