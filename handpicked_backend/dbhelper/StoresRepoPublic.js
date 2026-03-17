// dbhelper/StoresRepoPublic.js
import { supabase } from "../dbhelper/dbclient.js";
import { sanitize } from "../utils/sanitize.js";

/**
 * list(params)
 * - params: { q, categorySlug, seasonSlug, sort, letter, cursor, limit, skipCount=false, mode="default" }
 * - returns: { rows: Array, total: number, nextCursor: string|null }
 */
export async function list({
  q = "",
  categorySlug = null,
  seasonSlug = null, // optional
  sort = "newest",
  letter = "All", // NEW: letter filter
  cursor = null, // NEW: keyset pagination cursor (base64 "name:id")
  limit = 100,
  skipCount = false,
  mode = "default",
} = {}) {
  const safeLimit = Number(limit) >= 1 ? Number(limit) : 20;

  // Resolve category name if filter present
  let categoryName = null;
  if (categorySlug) {
    try {
      const { data: cat, error: ce } = await supabase
        .from("merchant_categories")
        .select("name")
        .eq("slug", String(categorySlug).trim())
        .maybeSingle();
      if (ce) throw ce;
      categoryName = cat?.name || null;
    } catch (err) {
      console.warn("Stores.list: category lookup failed", err);
      categoryName = null;
    }
  }

  // Resolve season filter if provided
  let seasonStoreIds = null;
  if (seasonSlug) {
    try {
      const { data: seasonStores, error: sErr } = await supabase
        .from("stores_season")
        .select("store_id")
        .eq("season_slug", seasonSlug);
      if (sErr) throw sErr;
      seasonStoreIds = seasonStores.map((s) => s.store_id);
      if (!seasonStoreIds.length)
        return { rows: [], total: 0, nextCursor: null }; // no stores
    } catch (err) {
      console.warn("Stores.list: season lookup failed", err);
      seasonStoreIds = null;
    }
  }

  // HOMEPAGE mode — fallback to existing behavior
  if (mode === "homepage") {
    try {
      let query = supabase
        .from("merchants")
        .select("id, slug, name, logo_url, active_coupons_count")
        .eq("home", true) //
        .order("created_at", { ascending: false })
        .range(0, safeLimit - 1);

      if (q) query = query.ilike("name", `%${q}%`);
      if (categoryName)
        query = query.contains("category_names", [categoryName]);
      if (seasonStoreIds) query = query.in("id", seasonStoreIds);

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data || []).map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        logo_url: r.logo_url,
        stats: { active_coupons: r.active_coupons_count || 0 },
      }));

      return { rows, total: rows.length, nextCursor: null };
    } catch (e) {
      console.error("Stores.list(homepage) error:", e);
      return { rows: [], total: 0, nextCursor: null };
    }
  }

  // DEFAULT mode — alphabetical + keyset pagination
  try {
    // Build base query
    let query = supabase
      .from("merchants")
      .select("id, slug, name, logo_url, active_coupons_count")
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .limit(safeLimit + 1);

    // Apply filters
    if (q) query = query.ilike("name", `%${q}%`);
    if (categoryName) query = query.contains("category_names", [categoryName]);
    if (seasonStoreIds) query = query.in("id", seasonStoreIds);

    // Alphabetical filtering
    if (letter && letter !== "All") {
      if (letter === "0-9") {
        query = query.gte("name", "0").lt("name", "9\uffff");
      } else {
        query = query.ilike("name", `${letter}%`);
      }
    }

    // Keyset pagination
    if (cursor) {
      try {
        const [name, id] = Buffer.from(cursor, "base64")
          .toString("utf8")
          .split(":");
        if (name && id) {
          query = query.or(`name.gt.${name},and(name.eq.${name},id.gt.${id})`);
        }
      } catch (e) {
        console.warn("Stores.list: invalid cursor:", cursor);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    const hasMore = data.length > safeLimit;
    const pageRows = data.slice(0, safeLimit);

    const rows = pageRows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      logo_url: r.logo_url,
      stats: { active_coupons: r.active_coupons_count || 0 },
    }));

    // Compute next cursor
    let nextCursor = null;
    if (hasMore) {
      const last = pageRows[pageRows.length - 1];
      nextCursor = Buffer.from(`${last.name}:${last.id}`).toString("base64");
    }

    // Total count only if requested
    let total = null;
    if (!skipCount) {
      try {
        let countQuery = supabase
          .from("merchants")
          .select("id", { count: "exact", head: true });
        if (q) countQuery = countQuery.ilike("name", `%${q}%`);
        if (categoryName)
          countQuery = countQuery.contains("category_names", [categoryName]);
        if (seasonStoreIds) countQuery = countQuery.in("id", seasonStoreIds);
        if (letter && letter !== "All") {
          if (letter === "0-9")
            countQuery = countQuery.gte("name", "0").lt("name", "9\uffff");
          else countQuery = countQuery.ilike("name", `${letter}%`);
        }
        const { count, error: cErr } = await countQuery;
        if (cErr) throw cErr;
        total = count || 0;
      } catch (err) {
        console.warn("Stores.list: count query failed:", err);
        total = rows.length;
      }
    }

    return { rows, total: total || rows.length, nextCursor };
  } catch (e) {
    console.error("Stores.list alphabetical error:", e);
    return { rows: [], total: 0, nextCursor: null };
  }
}

/**
 * Fetch store by slug
 */
export async function getBySlug(slug) {
  if (!slug) return null;

  const normSlug = String(slug || "").trim();

  try {
    const { data, error } = await supabase
      .from("merchants")
      .select(
        `
    id,
    slug,
    name,
    logo_url,
    web_url,
    aff_url,
    category_names,
    side_description_html,
    description_html,
    meta_title,
    meta_description,
    faqs,
    h1keyword,
    meta_keywords,
    coupon_h2_blocks,
    coupon_h3_blocks,
    active_coupons_count,
    verifier_id,
    authors:verifier_id (
      id,
      name,
      slug,
      designation,
      bio_html,
      avatar_url,
      verifying_since,
      same_as,
      created_at
    )
  `,
      )
      .eq("slug", normSlug)
      .maybeSingle();

    if (error) {
      console.error("Supabase getBySlug error:", error);
      return null;
    }
    if (!data) return null;

    // Compute active coupons: use denormalized counter if present, else fallback to COUNT
    let activeCoupons = 0;
    if (typeof data.active_coupons_count === "number") {
      activeCoupons = data.active_coupons_count || 0;
    } else {
      try {
        const { count: ac, error: ce } = await supabase
          .from("coupons")
          .select("id", { count: "exact", head: true })
          .eq("merchant_id", data.id)
          .eq("is_publish", true);
        if (!ce) activeCoupons = ac || 0;
      } catch (countErr) {
        console.warn("getBySlug: coupon count fallback failed:", countErr);
        activeCoupons = 0;
      }
    }

    return {
      id: data.id,
      slug: data.slug,
      name: data.name,
      logo_url: data.logo_url,
      web_url: data.web_url,
      aff_url: data.aff_url,
      category_names: Array.isArray(data.category_names)
        ? data.category_names
        : [],
      about_html: sanitize(data.side_description_html || ""),
      description_html: sanitize(data.description_html || ""),
      meta_title: data.meta_title || "",
      meta_description: data.meta_description || "",
      faqs: data.faqs || [],
      h1keyword: data.h1keyword,
      meta_keywords: data.meta_keywords,
      coupon_h2_blocks: Array.isArray(data.coupon_h2_blocks)
        ? data.coupon_h2_blocks
        : [],
      coupon_h3_blocks: Array.isArray(data.coupon_h3_blocks)
        ? data.coupon_h3_blocks
        : [],
      active_coupons: activeCoupons,
      verifier_id: data.verifier_id,
      verifier: data.authors
        ? {
            id: data.authors.id,
            name: data.authors.name,
            slug: data.authors.slug,
            designation: data.authors.designation,
            bio_html: data.authors.bio_html,
            avatar_url: data.authors.avatar_url,
            same_as: data.authors.same_as || null,
            verifying_since: data.authors.verifying_since,
            created_at: data.authors.created_at,
          }
        : null,
    };
  } catch (e) {
    console.error("getBySlug unexpected error:", e);
    return null;
  }
}

/**
 * Build SEO metadata
 */
export function buildSeo(store, { canonical, locale } = {}) {
  return {
    meta_title: store.meta_title || `${store.name} — Coupons & Deals`,
    meta_description:
      store.meta_description ||
      `Find verified coupons and deals for ${store.name}.`,
    canonical: canonical || "",
    locale: locale || "en",
    hreflang: [locale || "en"],
  };
}

/**
 * Build breadcrumbs
 */
export function buildBreadcrumbs(store, { origin } = {}) {
  const SITE_ORIGIN = origin || "";

  const safeName = store && store.name ? String(store.name) : "Store";
  const safeSlug =
    store && store.slug ? encodeURIComponent(String(store.slug)) : "";

  const homeUrl = SITE_ORIGIN ? `${SITE_ORIGIN}/` : "/";
  const storesUrl = SITE_ORIGIN ? `${SITE_ORIGIN}/stores` : "/stores";
  const storeUrl = SITE_ORIGIN
    ? `${SITE_ORIGIN}/stores/${safeSlug}`
    : `/stores/${safeSlug}`;

  return [
    { name: "Home", url: homeUrl },
    { name: "Stores", url: storesUrl },
    { name: safeName, url: storeUrl },
  ];
}

/**
 * Related stores by overlapping categories (RPC)
 */
export async function relatedByCategories({
  merchantId,
  categoryNames,
  limit = 8,
} = {}) {
  if (!categoryNames?.length) return [];

  try {
    const { data, error } = await supabase.rpc("merchants_by_category_any", {
      cat_list: categoryNames,
      exclude_id: merchantId || null,
      limit_val: limit || 8,
    });

    if (error) {
      console.error("Supabase relatedByCategories error:", error);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error("Unexpected error in relatedByCategories:", e);
    return [];
  }
}

/**
 * Return lightweight slugs for sitemap
 */
export async function listSlugs() {
  try {
    const { data, error } = await supabase
      .from("merchants")
      .select("slug, updated_at")
      .eq("active", true);
    if (error) {
      console.error("Supabase listSlugs error:", error);
      return { slugs: [] };
    }
    return { slugs: data || [] };
  } catch (e) {
    console.error("Unexpected error in listSlugs:", e);
    return { slugs: [] };
  }
}

export async function fetchProofsByMerchantId(merchantId) {
  try {
    const { data, error } = await supabase
      .from("merchant_proofs")
      .select("id, image_url, filename, created_at")
      .eq("merchant_id", merchantId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Supabase fetchProofsByMerchantId error:", error);
      return { proofs: [] };
    }
    return { proofs: data || [] };
  } catch (e) {
    console.error("Unexpected error in fetchProofsByMerchantId:", e);
    return { proofs: [] };
  }
}

/**
 * Insert store feedback
 * @param {Object} payload
 * @param {number|string} payload.storeId
 * @param {string} payload.name
 * @param {string|null} payload.email
 * @param {string} payload.message
 */
export async function insertStoreFeedback({ storeId, name, email, message }) {
  const { data, error } = await supabase
    .from("store_feedback")
    .insert([
      {
        store_id: storeId,
        name,
        email,
        message,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Sum click_count across all published coupons for a merchant.
 * Used for aggregateRating.reviewCount in JSON-LD schema.
 *
 * @param {number} merchantId
 * @returns {Promise<number>}
 */
export async function sumClickCount(merchantId) {
  if (!merchantId) return 0;
  try {
    const { data, error } = await supabase
      .from("coupons")
      .select("click_count")
      .eq("merchant_id", merchantId)
      .eq("is_publish", true);

    if (error) {
      console.warn("sumClickCount error:", error);
      return 0;
    }

    return (data || []).reduce((acc, row) => acc + (row.click_count || 0), 0);
  } catch (e) {
    console.warn("sumClickCount unexpected error:", e);
    return 0;
  }
}
