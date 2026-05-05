const express = require("express");
const router = express.Router();
const { fetchFromAPI, fetchFromClassicWeb } = require("../services/scraper");
const supabase = require("../services/supabase");

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
    `[DB] Successfully upserted ${dataArray.length} record(s) for ${source}`,
  );
}

async function processAPI() {
  const apiDataList = await fetchFromAPI();
  if (!apiDataList || apiDataList.length === 0) {
    console.log(`[SCRAPER] No data retrieved from API source`);
    return { updated: false, data: [] };
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
    return { updated: true, data: newItems };
  } else {
    console.log(`[SYNC] API source is already up-to-date`);
    return { updated: false, data: apiDataList };
  }
}

async function processClassicWeb() {
  const classicData = await fetchFromClassicWeb();
  if (!classicData) {
    console.log(`[SCRAPER] No data retrieved from ClassicWeb source`);
    return { updated: false, data: null };
  }

  const dbLastTime = await getLastUpdateTimeDB("ClassicWeb");

  if (String(classicData.updateTime).trim() !== String(dbLastTime).trim()) {
    await saveBulkToDB("ClassicWeb", [classicData]);
    return { updated: true, data: classicData };
  } else {
    console.log(`[SYNC] ClassicWeb source is already up-to-date`);
    return { updated: false, data: classicData };
  }
}

router.get("/scrape", async (req, res) => {
  try {
    console.log(`[SYSTEM] Initiating synchronization sequence...`);
    const [apiResult, classicResult] = await Promise.all([
      processAPI(),
      processClassicWeb(),
    ]);
    console.log(`[SYSTEM] Synchronization sequence completed`);

    return res.status(200).json({
      status: "success",
      response: {
        apiSource: apiResult,
        classicWebSource: classicResult,
      },
    });
  } catch (err) {
    console.error(
      `[SYSTEM] Synchronization sequence terminated: ${err.message}`,
    );
    return res.status(500).json({
      status: "error",
      error: err instanceof Error ? err.message : "Internal Server Error",
    });
  }
});

module.exports = router;
