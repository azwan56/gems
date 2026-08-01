import { GET } from "./src/app/api/cron/calculate-metrics/route";
import { NextRequest } from "next/server";

async function run() {
  const req = new NextRequest("http://localhost/api/cron/calculate-metrics", {
    headers: { "authorization": "Bearer " + (process.env.CRON_SECRET || "") }
  });
  const res = await GET(req);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}

run().catch(console.error);
