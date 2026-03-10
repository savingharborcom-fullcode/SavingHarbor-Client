// scripts/generate-sitemaps.js
import "dotenv/config";
import fs from "fs";
import path from "path";
import { SitemapStream, streamToPromise } from "sitemap";
import { createClient } from "@supabase/supabase-js";
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

const OUT_DIR = path.join(__dirname, "..", "public", "sitemaps");
const INDEX_OUT = path.join(__dirname, "..", "public", "sitemap-index.xml");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------------- Fetchers ----------------

async function fetchStores_supabase() {
  const pageSize = 1000;
  let page = 0;
  let all = [];
  while (true) {
    const { data, error } = await supabase
      .from("merchants")
      .select("slug, updated_at")
      .eq("active", true)
      .order("id", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw new Error(`Supabase fetchStores error: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return all.map((r) => ({
    url: `/stores/${r.slug}`,
    lastmod: r.updated_at
      ? new Date(r.updated_at).toISOString().slice(0, 10)
      : undefined,
    changefreq: "daily",
    priority: 1.0,
  }));
}

async function fetchBlog_supabase() {
  const pageSize = 1000;
  let page = 0;
  let all = [];
  while (true) {
    const { data, error } = await supabase
      .from("blogs")
      .select("slug, updated_at")
      .eq("is_publish", true)
      .order("id", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw new Error(`Supabase fetchBlog error: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  return all.map((r) => ({
    url: `/blogs/${r.slug}`,
    lastmod: r.updated_at
      ? new Date(r.updated_at).toISOString().slice(0, 10)
      : undefined,
    changefreq: "monthly",
    priority: 0.6,
  }));
}

async function fetchCategories_supabase() {
  const pageSize = 1000;
  let page = 0;
  let all = [];

  // Fetch all published categories with id + parent_id for URL construction
  while (true) {
    const { data, error } = await supabase
      .from("merchant_categories_v2")
      .select("id, slug, parent_id, updated_at")
      .eq("is_publish", true)
      .order("id", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error)
      throw new Error(`Supabase fetchCategories error: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  // Build id -> slug lookup for parent resolution
  const idToSlug = {};
  for (const r of all) idToSlug[r.id] = r.slug;

  return all.map((r) => {
    const url =
      r.parent_id && idToSlug[r.parent_id]
        ? `/categories/${idToSlug[r.parent_id]}/${r.slug}`
        : `/categories/${r.slug}`;
    return {
      url,
      lastmod: r.updated_at
        ? new Date(r.updated_at).toISOString().slice(0, 10)
        : undefined,
      changefreq: "weekly",
      priority: r.parent_id ? 0.7 : 0.8,
    };
  });
}

// ---------------- Helpers ----------------

async function writeSitemap(filename, items) {
  const finalPath = path.join(OUT_DIR, filename);
  const tmpPath = finalPath + ".tmp";
  const smStream = new SitemapStream({ hostname: HOSTNAME });
  items.forEach((i) => smStream.write(i));
  smStream.end();
  const buffer = await streamToPromise(smStream);
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, finalPath);
  console.log("Wrote (atomic)", finalPath);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------------- Main ----------------

(async function main() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // 1) Static pages
    const pages = [
      { url: "/", lastmod: today, changefreq: "daily", priority: 1.0 },
      { url: "/stores", lastmod: today, changefreq: "daily", priority: 1.0 },
      { url: "/coupons", lastmod: today, changefreq: "daily", priority: 1.0 },
      { url: "/blogs", lastmod: today, changefreq: "daily", priority: 0.6 },
      {
        url: "/categories",
        lastmod: today,
        changefreq: "daily",
        priority: 0.8,
      },
      { url: "/about", lastmod: today, changefreq: "yearly", priority: 0.5 },
      { url: "/contact", lastmod: today, changefreq: "yearly", priority: 0.5 },
      { url: "/careers", lastmod: today, changefreq: "yearly", priority: 0.5 },
      { url: "/press", lastmod: today, changefreq: "yearly", priority: 0.5 },
      { url: "/privacy", lastmod: today, changefreq: "yearly", priority: 0.5 },
      { url: "/terms", lastmod: today, changefreq: "yearly", priority: 0.5 },
      {
        url: "/how-it-works",
        lastmod: today,
        changefreq: "yearly",
        priority: 0.5,
      },
      { url: "/faq", lastmod: today, changefreq: "yearly", priority: 0.5 },
    ];
    await writeSitemap("sitemap-pages.xml", pages);

    // 2) Stores
    const stores = await fetchStores_supabase();
    const storeChunks = chunk(stores, 40000);
    for (let i = 0; i < storeChunks.length; i++) {
      const name =
        storeChunks.length === 1
          ? "sitemap-stores.xml"
          : `sitemap-stores-${i + 1}.xml`;
      await writeSitemap(name, storeChunks[i]);
    }

    // 3) Blogs
    const posts = await fetchBlog_supabase();
    const postChunks = chunk(posts, 40000);
    for (let i = 0; i < postChunks.length; i++) {
      const name =
        postChunks.length === 1
          ? "sitemap-blog.xml"
          : `sitemap-blog-${i + 1}.xml`;
      await writeSitemap(name, postChunks[i]);
    }

    // 4) Categories (parent: /categories/[slug], child: /categories/[parent_slug]/[slug])
    const categories = await fetchCategories_supabase();
    const categoryChunks = chunk(categories, 40000);
    for (let i = 0; i < categoryChunks.length; i++) {
      const name =
        categoryChunks.length === 1
          ? "sitemap-categories.xml"
          : `sitemap-categories-${i + 1}.xml`;
      await writeSitemap(name, categoryChunks[i]);
    }

    // 5) Store listing pages (A-Z)
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const storeListPages = [
      { url: "/stores", lastmod: today, changefreq: "daily", priority: 1.0 },
      ...letters.map((l) => ({
        url: `/stores/${l}`,
        lastmod: today,
        changefreq: "daily",
        priority: 1.0,
      })),
    ];
    await writeSitemap("sitemap-stores-list.xml", storeListPages);

    // 6) Sitemap index — picks up all .xml files written above
    const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith(".xml"));
    const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${files
  .map(
    (f) =>
      `  <sitemap>\n    <loc>${HOSTNAME}/sitemaps/${f}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`,
  )
  .join("\n")}
</sitemapindex>`;
    const tmpIndex = INDEX_OUT + ".tmp";
    fs.writeFileSync(tmpIndex, indexXml, "utf8");
    fs.renameSync(tmpIndex, INDEX_OUT);
    console.log("Wrote", INDEX_OUT);

    console.log("Sitemap generation complete.");
    process.exit(0);
  } catch (err) {
    console.error("Error generating sitemaps:", err);
    process.exit(1);
  }
})();
