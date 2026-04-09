const handler = require("./api/scrape");

const req = {};
const res = {
  status: (code) => ({
    json: (data) => {
      if (code === 200) {
        console.log(
          `[INFO] [PROCESS] Synchronization completed successfully | Status: ${code} | Data: ${JSON.stringify(data)}`,
        );
      } else {
        console.error(
          `[ERROR] [PROCESS] Synchronization failed | Status: ${code} | Reason: ${data.error}`,
        );
      }
    },
  }),
};

async function executeSync() {
  console.log(
    `[INFO] [SYSTEM] Initializing extraction and database sync pipeline...`,
  );
  await handler(req, res);
}

executeSync();
