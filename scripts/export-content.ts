// Writes the website's built-in content to server/seed/content.json, which the API loads
// into an empty database on first start. Run with: npm run export-content
import { writeFileSync } from "node:fs";
import { getBundledContent } from "../src/data/content";

const out = new URL("../server/seed/content.json", import.meta.url);
const bundle = getBundledContent();
writeFileSync(out, JSON.stringify(bundle, null, 2) + "\n");
const counts = Object.entries(bundle.collections).map(([k, v]) => `${k}: ${v.length}`).join(", ");
console.log(`Wrote ${out.pathname} (${counts})`);
