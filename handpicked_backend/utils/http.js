export function ok(res, payload, headers = {}) {
  // Optional per-response headers (e.g., Cache-Control overrides)
  for (const [k, v] of Object.entries(headers || {})) {
    if (v !== undefined && v !== null) res.set(k, v);
  }

  // Cache-Control and ETag handled by middleware; keep fallback only if missing
  if (!res.get("Cache-Control")) {
    res.set(
      "Cache-Control",
      "public, max-age=300, stale-while-revalidate=86400"
    );
  }
  return res.status(200).json(payload);
}

export function notFound(res, message = "Not found", headers = {}) {
  // Sensible cache defaults for public 404s (reduce repeated misses)
  if (!res.get("Cache-Control")) {
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  }
  for (const [k, v] of Object.entries(headers || {})) {
    if (v !== undefined && v !== null) res.set(k, v);
  }
  return res.status(404).json({
    data: null,
    meta: { status: 404, error: { message } },
  });
}

export function gone(res, message = "Resource permanently decommissioned", headers = {}) {
  if (!res.get("Cache-Control")) {
    res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  }
  for (const [k, v] of Object.entries(headers || {})) {
    if (v !== undefined && v !== null) res.set(k, v);
  }
  return res.status(410).json({
    data: null,
    meta: { status: 410, error: { message } },
  });
}

export function fail(res, message, e, statusCode = 500, headers = {}) {
  // Avoid caching errors by default; do not set Cache-Control here.
  for (const [k, v] of Object.entries(headers || {})) {
    if (v !== undefined && v !== null) res.set(k, v);
  }

  const isProd = process.env.NODE_ENV === "production";
  return res.status(statusCode).json({
    data: null,
    meta: {
      error: {
        message,
        details: isProd ? undefined : normalizeErrorDetail(e),
      },
    },
  });
}

// Helper to produce concise, safe details in non-prod
function normalizeErrorDetail(err) {
  if (!err) return undefined;
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || String(err);
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
