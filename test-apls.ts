import { config } from "dotenv";
config({ path: ".env.local" });
import { fmpFetch } from "./src/lib/fmp-fetch";
async function main() {
  const profile = await fmpFetch<any[]>("/profile", { symbol: "APLS" });
  console.log(profile);
  process.exit(0);
}
main();
