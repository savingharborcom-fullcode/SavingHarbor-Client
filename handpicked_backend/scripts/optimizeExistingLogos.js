/**
 * One-time batch job: fix cache-control + resize existing merchant logos.
 *
 * Root cause: objects in `merchant-images` were uploaded without cacheControl,
 * defaulting to Supabase's 3600s TTL. This re-uploads each unique object
 * in place (same path -> no DB update needed) with a 1yr cacheControl and
 * a 300px cap, so cached egress drops going forward.
 *
 * Resumable: writes processed paths to a checkpoint file. Safe to re-run;
 * already-processed paths are skipped.
 *
 * Usage: node handpicked_backend/scripts/optimizeExistingLogos.js
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { supabase } from "../dbhelper/dbclient.js";

const BUCKET = "merchant-images";
const MAX_DIMENSION = 300;
const CACHE_CONTROL = "31536000";
const CONCURRENCY = 5;
const PAGE_SIZE = 1000;
const CHECKPOINT_FILE = path.join(process.cwd(), ".logo-optimize-checkpoint.json");

function loadCheckpoint() {
  try {
    return new Set(JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8")));
  } catch {
    return new Set();
  }
}

function saveCheckpoint(doneSet) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify([...doneSet]));
}

function extractPath(publicUrl) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

async function fetchAllUniquePaths() {
  const paths = new Set();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("merchants")
      .select("logo_url")
      .not("logo_url", "is", null)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data.length) break;
    for (const row of data) {
      const p = extractPath(row.logo_url);
      if (p) paths.add(p);
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return [...paths];
}

async function processOne(objectPath, stats) {
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(objectPath);
  if (downloadError) {
    stats.errors.push({ path: objectPath, stage: "download", error: downloadError.message });
    return;
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const originalSize = buffer.length;

  let outBuffer;
  try {
    const meta = await sharp(buffer).metadata();
    if ((meta.width || 0) <= MAX_DIMENSION && (meta.height || 0) <= MAX_DIMENSION && meta.format === "webp") {
      // Already right-sized/format - just needs the cache-control re-upload below.
      outBuffer = buffer;
    } else {
      outBuffer = await sharp(buffer)
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    }
  } catch (e) {
    stats.errors.push({ path: objectPath, stage: "sharp", error: e.message });
    return;
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, outBuffer, {
      contentType: "image/webp",
      cacheControl: CACHE_CONTROL,
      upsert: true,
    });

  if (uploadError) {
    // Backoff + one retry on transient errors, matches existing Gemini 429/503 handling
    await new Promise((r) => setTimeout(r, 1500));
    const { error: retryError } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, outBuffer, {
        contentType: "image/webp",
        cacheControl: CACHE_CONTROL,
        upsert: true,
      });
    if (retryError) {
      stats.errors.push({ path: objectPath, stage: "upload", error: retryError.message });
      return;
    }
  }

  stats.processed += 1;
  stats.bytesBefore += originalSize;
  stats.bytesAfter += outBuffer.length;
}

async function runWithConcurrency(items, limit, worker) {
  let idx = 0;
  const runners = new Array(limit).fill(null).map(async () => {
    while (idx < items.length) {
      const current = items[idx++];
      await worker(current);
    }
  });
  await Promise.all(runners);
}

async function main() {
  console.log("Fetching unique logo paths from merchants table...");
  const allPaths = await fetchAllUniquePaths();
  const done = loadCheckpoint();
  const remaining = allPaths.filter((p) => !done.has(p));

  console.log(`Total unique objects: ${allPaths.length}. Already done: ${done.size}. Remaining: ${remaining.length}.`);

  const stats = { processed: 0, bytesBefore: 0, bytesAfter: 0, errors: [] };
  let sinceCheckpoint = 0;

  await runWithConcurrency(remaining, CONCURRENCY, async (objectPath) => {
    await processOne(objectPath, stats);
    done.add(objectPath);
    sinceCheckpoint += 1;
    if (sinceCheckpoint >= 50) {
      saveCheckpoint(done);
      sinceCheckpoint = 0;
      console.log(`Progress: ${done.size}/${allPaths.length} done, ${stats.errors.length} errors so far.`);
    }
  });

  saveCheckpoint(done);

  console.log("---");
  console.log(`Processed: ${stats.processed}`);
  console.log(`Bytes before: ${(stats.bytesBefore / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Bytes after:  ${(stats.bytesAfter / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Errors: ${stats.errors.length}`);
  if (stats.errors.length) {
    fs.writeFileSync("logo-optimize-errors.json", JSON.stringify(stats.errors, null, 2));
    console.log("Error details written to logo-optimize-errors.json");
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});