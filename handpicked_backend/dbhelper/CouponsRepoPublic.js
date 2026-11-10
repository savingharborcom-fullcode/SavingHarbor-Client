// dbhelper/CouponsRepoPublic.js
import { supabase } from "../dbhelper/dbclient.js";

/**
 * CouponsRepo.list(params)
 *
 * Supports:
 * - cursor-based (keyset) pagination when `cursor` is provided (fast, recommended)
 * - fallback to page/limit (OFFSET) when `cursor` is not provided (keeps SSR page links working)
 *
 * Params:
 * { q, categorySlug, storeSlug, type, status, sort, page=1, limit=20, cursor=null, skipCount=false, mode="default" }
 *
 * Returns:
 * { data: [...], meta: { total, page, limit, next_cursor, prev_cursor, has_more } }
 */

export async function list({
  q,
  categorySlug,
  storeSlug,
  type,
  status,
  sort,
  limit = 20,
  cursor = null,
  mode = "default",
} = {}) {
  const _limit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const encodeCursor = (row) => {
    if (!row) return null;
    try {
      return Buffer.from(JSON.stringify({ id: row.id })).toString("base64");
    } catch (e) {
      return null;
    }
  };

  const decodeCursor = (c) => {
    if (c === null || c === undefined) return null;
    if (c === "") return { id: null };
    try {
      return JSON.parse(Buffer.from(String(c), "base64").toString());
    } catch (e) {
      return null;
    }
  };

  // Resolve category merchants if needed
  let categoryName = null;
  if (categorySlug) {
    const { data: cat, error: ce } = await supabase
      .from("merchant_categories")
      .select("name")
      .eq("slug", categorySlug)
      .maybeSingle();
    if (ce) throw ce;
    categoryName = cat?.name || null;
  }

  let merchantId = null;
  if (storeSlug) {
    const { data: store, error: se } = await supabase
      .from("merchants")
      .select("id")
      .eq("slug", storeSlug)
      .maybeSingle();
    if (se) throw se;
    merchantId = store?.id || null;
  }

  // ---------- HOMEPAGE mode ----------
  if (mode === "homepage") {
    const decoded = decodeCursor(cursor);
    let qBuilder = supabase
      .from("coupons")
      .select(
        "id, coupon_type, title, coupon_code, click_count, discount_type, discount_value, merchant_id, merchants:merchant_id ( slug, name, logo_url )",
      )
      .eq("is_publish", true)
      .order("id", { ascending: false })
      .limit(_limit);

    if (decoded?.id) qBuilder = qBuilder.lt("id", decoded.id);
    if (q) qBuilder = qBuilder.ilike("title", `%${q}%`);
    if (merchantId) qBuilder = qBuilder.eq("merchant_id", merchantId);
    if (type && type !== "all") qBuilder = qBuilder.eq("coupon_type", type);
    // if (status !== "all") {
    //   qBuilder = qBuilder.or(
    //     `ends_at.is.null,ends_at.gt.${new Date().toISOString()}`,
    //   );
    // }
    if (categoryName) {
      const { data: mids, error: mErr } = await supabase
        .from("merchants")
        .select("id")
        .eq("active", true)
        .contains("category_names", [categoryName]);
      if (!mErr && Array.isArray(mids) && mids.length) {
        qBuilder = qBuilder.in(
          "merchant_id",
          mids.map((m) => m.id),
        );
      }
    }

    const { data, error } = await qBuilder;
    if (error) throw error;

    const rows = (data || []).map((r) => ({
      id: r.id,
      title: r.title,
      code: r.coupon_type === "coupon" ? r.coupon_code || null : null,
      merchant_id: r.merchant_id || null,
      coupon_type: r.coupon_type,
      click_count: r.click_count,
      discount_type: r.discount_type || null,
      discount_value: r.discount_value || null,
      merchant: r.merchants
        ? {
            slug: r.merchants.slug,
            name: r.merchants.name,
            logo_url: r.merchants.logo_url,
          }
        : null,
      merchant_name: r.merchants?.name || null,
    }));

    const lastRow = rows.length ? rows[rows.length - 1] : null;
    const nextCursor = rows.length === _limit ? encodeCursor(lastRow) : null;

    return {
      data: rows,
      meta: {
        limit: _limit,
        next_cursor: nextCursor,
        prev_cursor: null,
        has_more: !!nextCursor,
      },
    };
  }

  // ---------- DEFAULT mode: cursor only ----------
  const decoded = decodeCursor(cursor);

  let qBuilder = supabase
    .from("coupons")
    .select(
      `id, coupon_type, title, description, coupon_code, show_proof, is_editor, click_count, discount_type, discount_value, merchant_id, merchants:merchant_id ( slug, name, logo_url )`,
    )
    .eq("is_publish", true)
    .order("id", { ascending: false })
    .limit(_limit);

  if (decoded?.id) qBuilder = qBuilder.lt("id", decoded.id);
  if (q) qBuilder = qBuilder.ilike("title", `%${q}%`);
  if (merchantId) qBuilder = qBuilder.eq("merchant_id", merchantId);
  if (type && type !== "all") qBuilder = qBuilder.eq("coupon_type", type);
  // if (status !== "all") {
  //   qBuilder = qBuilder.or(
  //     `ends_at.is.null,ends_at.gt.${new Date().toISOString()}`,
  //   );
  // }
  if (categoryName) {
    const { data: mids, error: mErr } = await supabase
      .from("merchants")
      .select("id")
      .eq("active", true)
      .contains("category_names", [categoryName]);
    if (!mErr && Array.isArray(mids) && mids.length) {
      qBuilder = qBuilder.in(
        "merchant_id",
        mids.map((m) => m.id),
      );
    }
  }

  const { data, error } = await qBuilder;
  if (error) throw error;

  const rows = (data || []).map((r) => ({
    id: r.id,
    title: r.title,
    code: r.coupon_type === "coupon" ? r.coupon_code || null : null,
    merchant_id: r.merchant_id || null,
    coupon_type: r.coupon_type,
    description: r.description,
    show_proof: !!r.show_proof,
    is_editor: !!r.is_editor,
    click_count: r.click_count || 0,
    discount_type: r.discount_type || null,
    discount_value: r.discount_value || null,
    merchant: r.merchants
      ? {
          slug: r.merchants.slug,
          name: r.merchants.name,
          logo_url: r.merchants.logo_url,
        }
      : null,
    merchant_name: r.merchants?.name || null,
  }));

  const lastRow = rows.length ? rows[rows.length - 1] : null;
  const nextCursor = rows.length === _limit ? encodeCursor(lastRow) : null;

  return {
    data: rows,
    meta: {
      limit: _limit,
      next_cursor: nextCursor,
      prev_cursor: null,
      has_more: !!nextCursor,
    },
  };
}

export async function listForStore({
  merchantId,
  type,
  page,
  limit,
  sort,
  skipCount = false,
}) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("coupons")
    .select(
      "id, coupon_type, title, description, coupon_code, show_proof, is_editor, click_count, discount_type, discount_value, merchant_id, merchants:merchant_id ( slug, name, logo_url )",
    )
    .eq("merchant_id", merchantId)
    .eq("is_publish", true)
    .range(from, to);

  if (type !== "all") query = query.eq("coupon_type", type);

  // Sorting optimizations
  if (sort === "editor") {
    query = query
      .order("is_editor", { ascending: false })
      .order("id", { ascending: false });
  } else {
    query = query.order("id", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  // Count query only if needed
  let total = null;
  if (!skipCount) {
    let cQuery = supabase
      .from("coupons")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("is_publish", true);
    if (type !== "all") cQuery = cQuery.eq("coupon_type", type);

    const { count, error: cErr } = await cQuery;
    if (cErr) throw cErr;
    total = count || 0;
  }

  const items = (data || []).map((r) => ({
    id: r.id,
    coupon_type: r.coupon_type,
    title: r.title,
    description: r.description,
    coupon_code: r.coupon_type === "coupon" ? r.coupon_code || null : null,
    show_proof: !!r.show_proof,
    is_editor: !!r.is_editor,
    click_count: r.click_count || 0,
    discount_type: r.discount_type || null,
    discount_value: r.discount_value || null,
    merchant_id: r.merchant_id || null,
    merchant: r.merchants
      ? {
          slug: r.merchants.slug,
          name: r.merchants.name,
          logo_url: r.merchants.logo_url,
        }
      : null,
    merchant_name: r.merchants?.name || null,
  }));

  return { items, total: total ?? items.length };
}

/**
 * Get an offer by id with merchant info.
 * Mirrors the shape used in controllers/islands.
 *
 * Returns null if not found.
 */
export async function getById(offerId) {
  if (!offerId) return null;

  // Use same merchant join shorthand as in your other repo methods
  const { data, error } = await supabase
    .from("coupons")
    .select(
      `id,
       coupon_type,
       title,
       description,
       coupon_code,
       click_count,
       merchant_id,
       merchants:merchant_id (
         id,
         slug,
         name,
         logo_url,
         aff_url,
         web_url
       )`,
    )
    .eq("id", offerId)
    .maybeSingle();

  if (error) {
    console.error("CouponsRepo.getById supabase error:", error);
    throw error;
  }
  if (!data) return null;

  // Shape to the expected object
  return {
    id: data.id,
    title: data.title,
    code: data.coupon_type === "coupon" ? data.coupon_code || null : null,
    type: data.coupon_type,
    description: data.description,
    click_count: data.click_count || 0,
    merchant_id: data.merchant_id,
    merchant: data.merchants
      ? {
          id: data.merchants.id,
          slug: data.merchants.slug,
          name: data.merchants.name,
          aff_url: data.merchants.aff_url,
          web_url: data.merchants.web_url,
          logo_url: data.merchants.logo_url,
        }
      : null,
  };
}

/**
 * Increment click_count for an offer (atomic, RPC only).
 * Assumes increment_coupon_click_count(p_id bigint) RETURNS TABLE(click_count bigint).
 */
export async function incrementClickCount(offerId) {
  if (!offerId) throw new Error("offerId required");

  const { data, error } = await supabase.rpc("increment_coupon_click_count", {
    p_id: Number(offerId),
  });

  if (error) {
    console.error("incrementClickCount: rpc error:", error);
    throw error;
  }

  if (
    Array.isArray(data) &&
    data.length > 0 &&
    data[0].click_count !== undefined
  ) {
    return Number(data[0].click_count);
  }

  // fallback for unexpected shapes
  return Number(Array.isArray(data) ? data[0] : data);
}

export async function listTopByClicks(merchantId, limit = 3) {
  if (!merchantId) return [];

  // Select relevant fields; avoid exposing coupon_code.
  const { data, error } = await supabase
    .from("coupons")
    .select(
      `id,
       coupon_type,
       title,
       description,
       click_count,
       merchant_id`,
    )
    .eq("merchant_id", merchantId)
    .eq("is_publish", true)
    .order("click_count", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("listTopByClicks supabase error:", error);
    return [];
  }
  if (!data) return [];

  // Map to safe shape
  return data.map((r) => ({
    id: r.id,
    title: r.title,
    coupon_type: r.coupon_type,
    short_desc: r.description,
    click_count: r.click_count || 0,
    merchant_id: r.merchant_id,
    code: null, // do not expose codes
  }));
}

export async function countRecentForStore({
  merchantId,
  days = 30,
  limit = 10,
}) {
  if (!merchantId) return { total_offers_added_last_30d: 0, recent: [] };

  // compute cutoff ISO
  const cutoff = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Total count (use exact count head)
  try {
    const cQuery = supabase
      .from("coupons")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .eq("is_publish", true)
      .or(`published_at.gte.${cutoff},created_at.gte.${cutoff}`);

    const { count, error: cErr } = await cQuery;
    if (cErr) {
      console.warn("countRecentForStore count error:", cErr);
    }

    const total = count || 0;

    // Recent items list — prefer published_at desc, fallback to created_at
    const { data: recentRows, error: rErr } = await supabase
      .from("coupons")
      .select(
        "id, coupon_type, title, description, published_at, created_at",
      )
      .eq("merchant_id", merchantId)
      .eq("is_publish", true)
      .or(`published_at.gte.${cutoff},created_at.gte.${cutoff}`)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (rErr) {
      console.warn("countRecentForStore recent fetch error:", rErr);
      return { total_offers_added_last_30d: total, recent: [] };
    }

    const recent = (recentRows || []).map((r) => ({
      id: r.id,
      title: r.title,
      type: r.coupon_type,
      short_desc: r.description,
      published_at: r.published_at || r.created_at || null,
    }));

    return { total_offers_added_last_30d: total, recent };
  } catch (e) {
    console.error("countRecentForStore exception:", e);
    return { total_offers_added_last_30d: 0, recent: [] };
  }
}
