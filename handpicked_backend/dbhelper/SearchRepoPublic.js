import { supabase } from "../dbhelper/dbclient.js";

/**
 * searchStores({ q, limit = 6 })
 * - returns array of stores: { id, name, slug, logo_url, category_names: [], active_coupons_count? }
 * - safe: RPC preferred, fallback to direct query if RPC fails.
 */
export async function searchStores({ q, limit = 6 }) {
  if (!q || String(q).trim() === "") return [];

  const term = String(q).trim();
  // avoid tiny queries causing load
  if (term.length < 2) return [];

  const lim = Math.max(1, Math.min(50, Number(limit || 6)));

  // preferred: call RPC
  try {
    const { data, error } = await supabase.rpc("search_stores", {
      query: term,
      lim,
    });
    if (error) {
      console.warn(
        "SearchRepo.searchStores RPC error, falling back:",
        error.message || error,
      );
      // fall through to fallback below
    } else if (Array.isArray(data)) {
      return normalizeStores(data);
    } else {
      // unexpected shape, fall back

      console.warn(
        "SearchRepo.searchStores RPC returned unexpected shape, falling back",
      );
    }
  } catch (rpcErr) {
    console.warn(
      "SearchRepo.searchStores RPC threw, falling back:",
      rpcErr && rpcErr.message ? rpcErr.message : rpcErr,
    );
  }

  // Fallback: do a fast ilike query (will use pg_trgm index if installed)
  try {
    const likeQ = `%${term}%`;

    // Slugify the search term for slug comparison
    const slugifiedTerm = term
      .toLowerCase()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const { data, error } = await supabase
      .from("merchants")
      .select("id, slug, name, logo_url, category_names, active_coupons_count")
      .eq("active", true)
      .or(`name.ilike.%${term}%,slug.ilike.%${slugifiedTerm}%`)
      .eq("is_publish", true)
      .order("active_coupons_count", { ascending: false })
      .limit(lim);

    if (error) {
      console.error("SearchRepo.searchStores fallback query error:", error);
      return [];
    }
    return normalizeStores(data || []);
  } catch (e) {
    console.error("SearchRepo.searchStores fallback exception:", e);
    return [];
  }
}

/** helper to normalize rows coming from RPC or direct query */
function normalizeStores(rows) {
  return (rows || []).map((r) => {
    // normalize category_names to array
    let categories = [];
    try {
      if (Array.isArray(r.category_names)) categories = r.category_names;
      else if (!r.category_names) categories = [];
      else if (typeof r.category_names === "string") {
        try {
          const parsed = JSON.parse(r.category_names);
          categories = Array.isArray(parsed) ? parsed : [];
        } catch {
          // string but not JSON -> try comma split
          categories = r.category_names
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      } else {
        categories = Array.isArray(r.category_names) ? r.category_names : [];
      }
    } catch {
      categories = [];
    }

    const id = r.id === null || r.id === undefined ? null : String(r.id);

    return {
      id,
      name: r.name || "",
      slug: r.slug || "",
      logo_url: r.logo_url || null,
      category_names: categories,
      active_coupons_count:
        typeof r.active_coupons_count === "number"
          ? r.active_coupons_count
          : typeof r.active_coupons === "number"
            ? r.active_coupons
            : undefined,
    };
  });
}
