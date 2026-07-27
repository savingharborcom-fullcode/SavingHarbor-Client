/**
 * generateLlmsTxt.js
 * Pulls top categories (by merchant count) + site structure from Supabase
 * and writes a static llms.txt for SavingHarbor.
 *
 * Run: node generateLlmsTxt.js
 * Output: ./llms.txt — copy to your Astro public/ dir so it serves at
 *   https://savingharbor.com/llms.txt
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOSTNAME = process.env.PUBLIC_SITE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SITE_URL = "https://savingharbor.com";
const TOP_N_CATEGORIES = 10;

async function main() {
  // Merchant counts per category_id — grouped in JS since PostgREST
  // group-by needs a view/rpc, and this is a one-off script.
  const { data: merchants, error: mErr } = await supabase
    .from("merchants")
    .select("category_id")
    .eq("is_publish", true)
    .not("category_id", "is", null);

  if (mErr) throw mErr;

  const countsByCategory = {};
  for (const m of merchants || []) {
    countsByCategory[m.category_id] = (countsByCategory[m.category_id] || 0) + 1;
  }

  const categoryIds = Object.keys(countsByCategory).map(Number);
  const { data: categories, error: catErr } = await supabase
    .from("merchant_categories_v2")
    .select("id, name, slug")
    .in("id", categoryIds);

  if (catErr) throw catErr;

  const ranked = (categories || [])
    .map((c) => ({
      name: c.name,
      slug: c.slug,
      count: countsByCategory[c.id] || 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N_CATEGORIES);

  const totalMerchants = (merchants || []).length;

  const categoryLines = ranked
    .map((c) => `- [${c.name}](${SITE_URL}/category/${c.slug})`)
    .join("\n");

  const content = `# SavingHarbor

> SavingHarbor is a coupon and deals platform with ${totalMerchants || "20,000+"} verified merchant stores across ${ranked.length}+ categories. Coupons are tested by hand before publishing.

## Key Sections
- [All Stores (A-Z)](${SITE_URL}/stores): Full merchant directory
- [Categories](${SITE_URL}/categories): Deals organized by category
- [Today's Coupons](${SITE_URL}/coupons): Currently active codes and deals
- [How It Works](${SITE_URL}/how-it-works): Coupon verification process
- [Blog](${SITE_URL}/blogs): Shopping guides and savings tips

## Top Categories
${categoryLines}

## Sitemap
${SITE_URL}/sitemap.xml
`;

  fs.writeFileSync("./public/llms.txt", content, "utf-8");
  console.log(`llms.txt written — ${ranked.length} categories, ${totalMerchants} merchants`);
}

main().catch((err) => {
  console.error("generateLlmsTxt failed:", err);
  process.exit(1);
});