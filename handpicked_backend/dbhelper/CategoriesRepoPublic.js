// dbhelper/CategoriesRepoPublic.js
import { supabase } from "../dbhelper/dbclient.js";

/**
 * list(params) - Root categories (parent_id IS NULL) + store counts
 * returns: { rows: Array, total: number, nextCursor: string|null }
 */
export async function list({
  q = "",
  sort = "name",
  letter = "All",
  cursor = null,
  limit = 100,
  skipCount = false,
  showHome = false,
} = {}) {
  const safeLimit = Number(limit) >= 1 ? Number(limit) : 20;

  try {
    // Build base query - ROOT CATEGORIES ONLY (parent_id IS NULL)
    let query = supabase
      .from("merchant_categories_v2")
      .select(
        `
        id, name, slug, description, thumb_url, 
        meta_title, meta_description,
        is_publish, show_home, show_deals_page
      `,
      )
      .eq("is_publish", true)
      .is("parent_id", null); // ROOT only
    if (showHome)
      query = query
        .eq("show_home", true)
        .order("name", { ascending: true })
        .order("id", { ascending: true })
        .limit(safeLimit + 1);

    // Search filter
    if (q) query = query.ilike("name", `%${q}%`);

    // Alphabetical filtering
    if (letter && letter !== "All") {
      if (letter === "0-9") {
        query = query.gte("name", "0").lt("name", "9\uffff");
      } else {
        query = query.ilike("name", `${letter}%`);
      }
    }

    // Cursor pagination (name:id base64)
    if (cursor) {
      try {
        const [name, id] = Buffer.from(cursor, "base64")
          .toString("utf8")
          .split(":");
        if (name && id) {
          query = query.or(`name.gt.${name},and(name.eq.${name},id.gt.${id})`);
        }
      } catch (e) {
        console.warn("Categories.list: invalid cursor:", cursor);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    const hasMore = data.length > safeLimit;
    const pageRows = data.slice(0, safeLimit);

    //Total Count
    let total = pageRows.length;

    // Add store counts
    const rows = (
      await Promise.all(
        pageRows.map(async (row) => {
          let storeCount = 0;
          try {
            const { count } = await supabase
              .from("merchants")
              .select("id", { count: "exact", head: true })
              .eq("is_publish", true)
              .eq("category_id", row.id);
            storeCount = count || 0;
          } catch (e) {
            console.warn("Category store count failed:", row.name, e);
          }

          // Children count (subcategories)
          let childrenCount = 0;
          try {
            const { count: cc } = await supabase
              .from("merchant_categories_v2")
              .select("id", { count: "exact", head: true })
              .eq("parent_id", row.id)
              .eq("is_publish", true);
            childrenCount = cc || 0;
          } catch (e) {
            console.warn("Category children count failed:", e);
          }

          return {
            id: row.id,
            name: row.name,
            slug: row.slug,
            description: row.description || "",
            thumb_url: row.thumb_url || null,
            meta_title: row.meta_title || "",
            meta_description: row.meta_description || "",
            stats: {
              stores: storeCount,
              subcategories: childrenCount,
            },
          };
        }),
      )
    ).filter(Boolean);

    // Next cursor
    let nextCursor = null;
    if (hasMore) {
      const last = pageRows[pageRows.length - 1];
      nextCursor = Buffer.from(`${last.name}:${last.id}`).toString("base64");
    }
    return { rows, total: total || rows.length, nextCursor };
  } catch (e) {
    console.error("Categories.list error:", e);
    return { rows: [], total: 0, nextCursor: null };
  }
}

/**
 * getBySlug(slug) - Parent category + subcategories (NO merchants)
 */
export async function getBySlug(slug) {
  if (!slug) return null;

  const normSlug = String(slug || "").trim();

  try {
    const { data, error } = await supabase
      .from("merchant_categories_v2")
      .select(
        `
        id, name, slug, description, thumb_url, top_banner_url, side_banner_url,
        top_banner_link_url, side_banner_link_url,
        meta_title, meta_keywords, meta_description,
        is_publish, show_home, show_deals_page, is_header, parent_id
      `,
      )
      .eq("slug", normSlug)
      .eq("is_publish", true)
      .maybeSingle();

    if (error || !data) return null;

    // Store count for this category
    let storeCount = 0;
    try {
      const { count } = await supabase
        .from("merchants")
        .select("id", { count: "exact", head: true })
        .eq("is_publish", true)
        .eq("category_id", data.id);
      storeCount = count || 0;
    } catch (e) {
      console.warn("getBySlug: store count failed:", e);
    }

    // Subcategories with merchant counts
    let subcategories = [];
    try {
      const { data: subData } = await supabase
        .from("merchant_categories_v2")
        .select("id, name, slug, thumb_url")
        .eq("parent_id", data.id)
        .eq("is_publish", true)
        .order("name");

      // Add merchant count per subcategory
      subcategories = await Promise.all(
        (subData || []).map(async (sub) => {
          const { count } = await supabase
            .from("merchants")
            .select("id", { count: "exact", head: true })
            .eq("is_publish", true)
            .eq("subcategory_id", sub.id);
          return {
            id: sub.id,
            name: sub.name,
            slug: sub.slug,
            thumb_url: sub.thumb_url || null,
            merchant_count: count || 0,
          };
        }),
      );
    } catch (e) {
      console.warn("getBySlug: subcategories failed:", e);
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description || "",
      thumb_url: data.thumb_url || null,
      top_banner_url: data.top_banner_url || null,
      side_banner_url: data.side_banner_url || null,
      top_banner_link_url: data.top_banner_link_url || null,
      side_banner_link_url: data.side_banner_link_url || null,
      meta_title: data.meta_title || `${data.name} Coupons`,
      meta_description:
        data.meta_description || `Best ${data.name} coupons and deals.`,
      stats: {
        stores: storeCount,
        subcategories: subcategories.length,
      },
      subcategories,
    };
  } catch (e) {
    console.error("getBySlug error:", e);
    return null;
  }
}

/**
 * getSubcategoryBySlug(parentSlug, subSlug) - Subcategory + merchants list
 */
export async function getSubcategoryBySlug(
  parentSlug,
  subSlug,
  { cursor = null, limit = 20 } = {},
) {
  if (!parentSlug || !subSlug) return null;

  try {
    // Get parent category
    const { data: parent } = await supabase
      .from("merchant_categories_v2")
      .select("id, name, slug")
      .eq("slug", parentSlug)
      .eq("is_publish", true)
      .is("parent_id", null)
      .maybeSingle();

    if (!parent) return null;

    // Get subcategory
    const { data: subcategory } = await supabase
      .from("merchant_categories_v2")
      .select(
        `
        id, name, slug, description, thumb_url,
        meta_title, meta_description,
        top_banner_url, side_banner_url,
        top_banner_link_url, side_banner_link_url
      `,
      )
      .eq("slug", subSlug)
      .eq("parent_id", parent.id)
      .eq("is_publish", true)
      .maybeSingle();

    if (!subcategory) return null;

    // Get total merchant count
    const { count: totalMerchants } = await supabase
      .from("merchants")
      .select("id", { count: "exact", head: true })
      .eq("is_publish", true)
      .eq("subcategory_id", subcategory.id);

    // Get merchants for this subcategory
    let query = supabase
      .from("merchants")
      .select(
        `id, name, slug, logo_url, active_coupons_count, meta_description`,
      )
      .eq("is_publish", true)
      .eq("subcategory_id", subcategory.id)
      .order("active_coupons_count", { ascending: false })
      .order("name", { ascending: true })
      .limit(limit + 1); // fetch one extra to know if there's a next page

    if (cursor) {
      const { count, name } = JSON.parse(atob(cursor));
      // Keyset: rows where (count < cursor_count) OR (count = cursor_count AND name > cursor_name)
      query = query.or(
        `active_coupons_count.lt.${count},and(active_coupons_count.eq.${count},name.gt.${name})`,
      );
    }

    const { data: merchants, error: merchantsError } = await query;
    if (merchantsError) throw merchantsError;

    const hasMore = merchants.length > limit;
    const items = hasMore ? merchants.slice(0, limit) : merchants;

    const lastItem = items[items.length - 1];
    const nextCursor = hasMore
      ? btoa(
          JSON.stringify({
            count: lastItem.active_coupons_count,
            name: lastItem.name,
          }),
        )
      : null;

    return {
      parent: {
        id: parent.id,
        name: parent.name,
        slug: parent.slug,
      },
      subcategory: {
        id: subcategory.id,
        name: subcategory.name,
        slug: subcategory.slug,
        description: subcategory.description || "",
        thumb_url: subcategory.thumb_url || null,
        top_banner_url: subcategory.top_banner_url || null,
        side_banner_url: subcategory.side_banner_url || null,
        top_banner_link_url: subcategory.top_banner_link_url || null,
        side_banner_link_url: subcategory.side_banner_link_url || null,
        meta_title:
          subcategory.meta_title ||
          `${subcategory.name} Coupons & Deals - ${parent.name}`,
        meta_description:
          subcategory.meta_description ||
          `Browse ${subcategory.name} stores. Find the best coupons and deals.`,
      },
      merchants: items || [],
      pagination: {
        total: totalMerchants || 0,
        limit,
        nextCursor,
        hasMore,
      },
    };
  } catch (e) {
    console.error("getSubcategoryBySlug error:", e);
    return null;
  }
}

export async function getCategoryNameById(id) {
  if (!id) return null;

  try {
    const { data, error } = await supabase
      .from("merchant_categories_v2")
      .select(
        `
        id, name, slug
      `,
      )
      .eq("id", id)
      .eq("is_publish", true)
      .single();

    if (error || !data) return null;
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
    };
  } catch (e) {
    console.error("getCategoryNameById error:", e);
    return null;
  }
}
