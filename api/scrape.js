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
}

async function processAPI() {
  const apiDataList = await fetchFromAPI();
  if (!apiDataList || apiDataList.length === 0) return;

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
  }
}

async function processClassicWeb() {
  const classicData = await fetchFromClassicWeb();
  if (!classicData) return;

  const dbLastTime = await getLastUpdateTimeDB("ClassicWeb");

  if (String(classicData.updateTime).trim() !== String(dbLastTime).trim()) {
    await saveBulkToDB("ClassicWeb", [classicData]);
  }
}

module.exports = async function handler(req, res) {
  try {
    await Promise.all([processAPI(), processClassicWeb()]);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(
      `[CRITICAL ERROR] Failed to sync gold prices: ${error.message}`,
    );
    return res.status(500).json({ success: false, error: error.message });
  }
};
