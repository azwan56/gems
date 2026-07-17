import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

// Load environment variables from .env
const envContent = fs.readFileSync(".env", "utf-8");
envContent.split("\n").forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
});

const FIREBASE_KEY = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

async function run() {
  if (!FIREBASE_KEY) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is missing");

  if (getApps().length === 0) {
    initializeApp({ credential: cert(JSON.parse(FIREBASE_KEY)) });
  }
  const db = getFirestore();
  
  const doc = await db.collection("stock_pools").doc("latest").get();
  const stocks = doc.data()?.stocks || [];
  
  const targets = ["ANF", "SEZL", "PACS", "COP"];
  for (const t of targets) {
    const s = stocks.find((x: any) => x.symbol.toUpperCase() === t);
    if (s) {
      console.log(`Found ${t}: price=${s.price}, sector=${s.sector}, industry=${s.industry}`);
    } else {
      console.log(`${t} NOT found in stock pool!`);
    }
  }
}

run().catch(console.error);
