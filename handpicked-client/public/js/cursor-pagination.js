// public/js/cursor-pagination.js
// Minimal fragment-driven client pagination for /coupons, /stores, /blogs
// - Place at /public/js/cursor-pagination.js
// - Intercepts only pagination anchors and fetches server-rendered fragments
// - Injects server HTML into #resource-list and updates pagination UI
// - Delegates "reveal" button clicks to backend click endpoint

(function () {
  if (typeof window === "undefined") return;

  const LIST_WRAPPER_SEL = "#resource-list";
  const PAGINATION_WRAPPER_SEL = ".mt-10";

  const BACKEND_API_BASE =
    (window.PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");

  // ---- helpers ----
  function ensureGridWrapper() {
    const listWrapper = document.querySelector(LIST_WRAPPER_SEL);
    if (!listWrapper) return null;
    // keep whatever grid markup server provided initially; ensure container for replacement
    return listWrapper;
  }

  async function fetchJson(url) {
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error("Fetch failed: " + res.status);
    return res.json();
  }

  function fragmentEndpointForHref(href) {
    try {
      const parsed = new URL(href, window.location.href);
      const path = parsed.pathname;
      const qs = parsed.search || "";
      if (path.startsWith("/coupons")) return `/api/fragments/coupons${qs}`;
      if (path.startsWith("/stores")) return `/api/fragments/stores${qs}`;
      if (path.startsWith("/blogs") || path.startsWith("/blog"))
        return `/api/fragments/blogs${qs}`;
      return null;
    } catch (e) {
      return null;
    }
  }

  function updatePaginationUI(meta = {}, paginationWrapper) {
    if (!paginationWrapper) return;
    const prevHtml = meta.prev
      ? `<a href="${meta.prev}" class="flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white transition">Prev</a>`
      : `<span class="flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed">Prev</span>`;
    const nextHtml = meta.next
      ? `<a href="${meta.next}" class="flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white transition">Next</a>`
      : `<span class="flex items-center gap-1 px-3 py-1.5 text-sm rounded border border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed">Next</span>`;
    const totalPagesText = meta.total
      ? `Total pages: ${
          meta.total_pages ||
          Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || 20)))
        }`
      : "";
    paginationWrapper.innerHTML = `
      <div class="flex items-center justify-between mt-6">
        <div class="text-sm text-gray-500">${totalPagesText}</div>
        <div class="flex items-center gap-2">${prevHtml}${nextHtml}</div>
      </div>
    `;
  }

  // Convert frontend href -> server fragment endpoint (if exists) or backend JSON
  function toFragmentOrBackend(href) {
    const frag = fragmentEndpointForHref(href);
    if (frag) return { type: "fragment", url: frag };
    // fallback to backend json (full API)
    try {
      const parsed = new URL(href, window.location.href);
      const backend = `${BACKEND_API_BASE}${parsed.pathname}${parsed.search}`;
      return { type: "backend", url: backend };
    } catch (e) {
      return { type: "backend", url: `${BACKEND_API_BASE}${href}` };
    }
  }

  // Core: load fragment or backend JSON and inject into #resource-list
  async function loadAndInject(href) {
    const container = ensureGridWrapper();
    const paginationWrapper = document.querySelector(PAGINATION_WRAPPER_SEL);
    if (!container) return;

    const target = toFragmentOrBackend(href);

    try {
      if (target.type === "fragment") {
        const json = await fetchJson(target.url);
        // json.html expected to be server-rendered markup for the resource list
        if (json.html !== undefined && json.html !== null) {
          container.innerHTML = json.html;
          // ensure grid wrapper exists (fallback)
          if (!container.querySelector(".grid")) {
            const wrapper = document.createElement("div");
            wrapper.className =
              "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6";
            const els = Array.from(container.childNodes).filter(
              (n) => n.nodeType === 1
            );
            els.forEach((ch) => wrapper.appendChild(ch));
            if (wrapper.children.length) {
              container.innerHTML = "";
              container.appendChild(wrapper);
            } else {
              // nothing meaningful — fallback to full navigation to avoid blank UI
              window.location.assign(location.pathname + location.search);
            }
          }
        } else {
          // no html field — fallback to full navigation
          window.location.assign(href);
          return;
        }
        updatePaginationUI(json.meta || {}, paginationWrapper);
        // update address bar so bookmarking/back works
        try {
          const u = new URL(href, window.location.href);
          history.pushState({}, "", u.pathname + (u.search || ""));
        } catch (_) {}
        return;
      }

      // backend JSON path: attempt to use returned data.meta.html (not expected) or fallback
      const json = await fetchJson(target.url);
      if (json.html) {
        container.innerHTML = json.html;
        // ensure grid wrapper exists (fallback)
        if (!container.querySelector(".grid")) {
          const wrapper = document.createElement("div");
          wrapper.className =
            "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6";
          const els = Array.from(container.childNodes).filter(
            (n) => n.nodeType === 1
          );
          els.forEach((ch) => wrapper.appendChild(ch));
          if (wrapper.children.length) {
            container.innerHTML = "";
            container.appendChild(wrapper);
          } else {
            // nothing meaningful — fallback to full navigation to avoid blank UI
            window.location.assign(location.pathname + location.search);
          }
        }
        updatePaginationUI(json.meta || {}, paginationWrapper);
        try {
          const u = new URL(href, window.location.href);
          history.pushState({}, "", u.pathname + (u.search || ""));
        } catch (_) {}
        return;
      }

      // If backend returns data array, we don't render client-side markup here.
      // Best fallback: navigate to URL (server will SSR)
      window.location.assign(href);
    } catch (err) {
      console.error("Pagination fetch error", err);
      window.location.assign(href);
    }
  }

  // Reveal handler (delegated)
  async function handleRevealClick(ev) {
    const btn =
      ev.target && ev.target.closest
        ? ev.target.closest(".js-reveal-btn")
        : null;
    if (!btn) return;
    const id = btn.getAttribute("data-offer-id");
    if (!id) return;

    try {
      btn.disabled = true;
      const endpoint = `${BACKEND_API_BASE.replace(
        /\/+$/,
        ""
      )}/offers/${encodeURIComponent(id)}/click`;
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referrer: "site", platform: "web" }),
        credentials: "include",
      });
      if (!resp.ok) {
        console.warn("Reveal request failed", resp.status);
        btn.disabled = false;
        return;
      }
      let data = null;
      try {
        data = await resp.json();
      } catch (e) {}
      const code = data?.code || null;
      const redirect = data?.redirect_url || null;
      if (code) {
        const box = document.createElement("div");
        box.className =
          "w-full rounded-md px-3 py-2 text-sm font-mono text-brand-primary bg-brand-primary/10 border border-dashed border-brand-accent overflow-x-auto";
        box.textContent = code;
        btn.replaceWith(box);
        try {
          await navigator.clipboard.writeText(code);
        } catch (_) {}
      }
      if (redirect) window.open(redirect, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Reveal click failed", err);
      btn.disabled = false;
    }
  }

  // Decide whether an anchor is a pagination anchor (conservative)
  function isPaginationAnchor(a) {
    if (!a || !a.getAttribute) return false;
    // explicit opt-in
    if (a.dataset && a.dataset.paginate === "true") return true;
    if (a.getAttribute("rel") === "pagination") return true;
    // inside pagination wrapper
    if (a.closest && a.closest(PAGINATION_WRAPPER_SEL)) return true;
    // explicit pagination query
    const href = a.getAttribute("href") || "";
    if (href.includes("page=") || href.includes("cursor=")) return true;
    return false;
  }

  // Capture clicks and only intercept pagination anchors
  document.addEventListener(
    "click",
    function (ev) {
      try {
        const a =
          ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
        if (!a) return;
        // allow modifier/new-tab
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || a.target === "_blank")
          return;
        if (!isPaginationAnchor(a)) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        loadAndInject(a.getAttribute("href"));
      } catch (e) {
        console.warn("pagination click handler error", e);
      }
    },
    true // capture
  );

  document.addEventListener("click", handleRevealClick, false);

  // Back/forward: reload fragment for current location
  window.addEventListener("popstate", function () {
    loadAndInject(location.pathname + location.search);
  });

  // init: nothing heavy to do, just ensure container present and expose debug var
  function init() {
    ensureGridWrapper();
    window.PUBLIC_API_BASE_URL = window.PUBLIC_API_BASE_URL || BACKEND_API_BASE;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
