const goldConfig = {
  API_URL:
    "https://www.goldtraders.or.th/api/GoldPrices/details?readjson=false",
  CLASSIC_WEB_URL: "https://classic.goldtraders.or.th/",

  SELECTOR: {
    UPDATE_DATETIME: "#DetailPlace_uc_goldprices1_lblAsTime",
    GOLD_BAR_BUY: "#DetailPlace_uc_goldprices1_lblBLBuy",
    GOLD_BAR_SELL: "#DetailPlace_uc_goldprices1_lblBLSell",
    GOLD_ORNAMENT_BUY: "#DetailPlace_uc_goldprices1_lblOMBuy",
    GOLD_ORNAMENT_SELL: "#DetailPlace_uc_goldprices1_lblOMSell",
  },
};
module.exports = goldConfig;
