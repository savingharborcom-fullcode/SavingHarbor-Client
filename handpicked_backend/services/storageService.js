import sharp from "sharp";
import { supabase } from "../dbhelper/dbclient.js";

// Logos are never displayed larger than this anywhere in the client.
// Resizing here (once, at upload) is what actually cuts egress -
// Supabase's paid Image Transformations add-on isn't in use, so raw
// bytes are what gets served on every page load.
const MAX_LOGO_DIMENSION = 300;

/**
 * Upload a file buffer to any bucket/folder
 * @param {string} bucket - Supabase bucket name
 * @param {string} folder - Folder inside bucket
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original file name
 * @param {string} mimetype - MIME type
 */
export async function uploadImageBuffer(bucket, folder, buffer, filename, mimetype) {
  const now = new Date();
  const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const baseName = String(filename || "file").toLowerCase().replace(/\s+/g, "-").replace(/\.[^.]+$/, "");

  let outBuffer = buffer;
  let outMimetype = mimetype;
  let outExt = (String(filename || "").match(/\.[^.]+$/)?.[0]) || "";
  const isImage = /^image\/(png|jpe?g|webp|gif)$/.test(mimetype || "");
  if (isImage) {
    try {
      outBuffer = await sharp(buffer)
        .resize({ width: MAX_LOGO_DIMENSION, height: MAX_LOGO_DIMENSION, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      outMimetype = "image/webp";
      outExt = ".webp";
    } catch {
      // Fall back to original buffer/mimetype/ext if sharp fails (e.g. corrupt input)
    }
  }
  const path = `${folder}/${datePath}/${Date.now()}-${baseName}${outExt}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, outBuffer, {
      contentType: outMimetype || mimetype || "application/octet-stream",
      cacheControl: "31536000", // path is timestamped -> content is immutable, safe to cache 1yr
      upsert: false,
    });

  if (uploadError) return { url: null, error: uploadError };

  const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: pubData?.publicUrl || null, error: null, path };
}

/**
 * Delete by public URL from a given bucket
 * @param {string} bucket - Supabase bucket name
 * @param {string} publicUrl - Full public URL
 */
export async function deleteImageByPublicUrl(bucket, publicUrl) {
  if (!publicUrl) return { error: null };
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return { error: null };
    const objectPath = decodeURIComponent(url.pathname.slice(idx + marker.length));

    const { error } = await supabase.storage.from(bucket).remove([objectPath]);
    return { error };
  } catch {
    return { error: null };
  }
}