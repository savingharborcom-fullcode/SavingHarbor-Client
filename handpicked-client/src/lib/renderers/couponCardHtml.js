// src/lib/renderers/couponCardHtml.js

export function escapeHtml(s = "") {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// load manifest once (server-safe OR browser-safe)
let logoManifest = {};
try {
  if (typeof window === "undefined") {
    const fs = await import("fs");
    const path = await import("path");
    const manifestPath = path.join(
      process.cwd(),
      "public/optimized/logos/manifest.json",
    );
    if (fs.existsSync(manifestPath)) {
      logoManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    }
  } else {
    let logoManifest = {};
    let manifestLoaded = false;

    const doFetchLogoManifest = async () => {
      if (manifestLoaded) return;
      manifestLoaded = true;
      try {
        const res = await fetch("/optimized/logos/manifest.json");
        if (res.ok) logoManifest = await res.json();
      } catch (e) {
        console.warn("Logo manifest fetch failed:", e);
      }
    };

    const firstCard = document.querySelector(".coupon-card, .store-card");
    if (firstCard && "IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (entries, obs) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              obs.disconnect();
              doFetchLogoManifest();
              return;
            }
          }
        },
        { rootMargin: "300px" },
      );
      io.observe(firstCard);
      if ("requestIdleCallback" in window) {
        requestIdleCallback(
          () => {
            if (!manifestLoaded) doFetchLogoManifest();
          },
          { timeout: 2000 },
        );
      } else {
        window.addEventListener(
          "load",
          () =>
            setTimeout(() => {
              if (!manifestLoaded) doFetchLogoManifest();
            }, 1200),
          { once: true },
        );
      }
    } else {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(doFetchLogoManifest, { timeout: 2000 });
      } else {
        window.addEventListener(
          "load",
          () => setTimeout(doFetchLogoManifest, 1200),
          { once: true },
        );
      }
    }
  }
} catch (e) {
  console.warn("Logo manifest load failed:", e.message || e);
}

/**
 * renderCouponCardHtml(item)
 */
export function renderCouponCardHtml(item = {}) {
  const id = escapeHtml(item.id ?? "");
  const title = escapeHtml(item.title ?? "");
  const description = escapeHtml(item.description ?? "");
  const couponType = item.coupon_type || "";
  const discountType = item.discount_type || "none";
  const discountValue = item.discount_value ?? null;

  const endsAt = item.ends_at
    ? escapeHtml(
        new Date(item.ends_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
      )
    : "";

  const clickCount =
    Number.isFinite(Number(item.click_count)) && Number(item.click_count) > 0
      ? Number(item.click_count)
      : 0;

  // ── Discount badge ──
  let badgeTop = "",
    badgeBottom = "",
    badgeBg = "",
    badgeBorder = "",
    badgeTextColor = "";

  if (discountType === "percent" && discountValue) {
    badgeTop = `${discountValue}%`;
    badgeBottom = "OFF";
    badgeBg = "background:#ECFAD0;";
    badgeBorder = "border-color:#B8F200;";
    badgeTextColor = "color:#2A3300;";
  } else if (discountType === "flat" && discountValue) {
    badgeTop = `$${discountValue}`;
    badgeBottom = "OFF";
    badgeBg = "background:#fef3c7;";
    badgeBorder = "border-color:#fcd34d;";
    badgeTextColor = "color:#92400e;";
  } else {
    badgeTop = "DEAL";
    badgeBottom = "";
    badgeBg = "background:#FFF0EB;";
    badgeBorder = "border-color:#FFCBB8;";
    badgeTextColor = "color:#B93C10;";
  }

  const discountBadgeHtml = `
    <div class="flex-shrink-0 flex flex-col items-center justify-center rounded-lg px-3 py-2 border"
         style="${badgeBg} ${badgeBorder} min-width:60px; width:60px;">
      <span class="font-extrabold leading-tight text-center" style="font-size:1rem; ${badgeTextColor}">${badgeTop}</span>
      ${badgeBottom ? `<span class="text-xs font-semibold tracking-wide text-center" style="${badgeTextColor} opacity:0.7;">${badgeBottom}</span>` : ""}
    </div>
  `;

  // ── Verified badges ──
  const badgesHtml = `
    <div class="w-full flex items-center justify-between">
      <div class="flex items-center gap-1.5">
        <img src="/images/verified-badge.webp" alt="Verified" class="h-4 w-4 object-contain" loading="lazy" decoding="async" />
        <span class="text-xs text-emerald-700 font-medium">Verified</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-emerald-700 font-medium">Re-verified</span>
        <img src="/images/reverified-badge.webp" alt="Re-verified" class="h-4 w-4 object-contain" loading="lazy" decoding="async" />
      </div>
    </div>
  `;

  // ── Used by ──
  const usedByHtml =
    clickCount > 0
      ? `<div class="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-1.13a4 4 0 10-8 0 4 4 0 008 0z" />
        </svg>
        <span>${clickCount} ${clickCount === 1 ? "user" : "users"}</span>
      </div>`
      : "";

  // ── Expiry ──
  const expiryHtml = endsAt
    ? `<div class="flex items-center gap-1 text-xs text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Expires ${endsAt}</span>
      </div>`
    : "";

  // code stored on button via data-code — handler reads & displays it on click
  const rawCode = escapeHtml(item.code ?? "");

  const btnLabel = couponType === "coupon" ? "Reveal Code" : "Activate Deal";
  const btnAriaLabel =
    couponType === "coupon" ? "Reveal coupon code" : "Activate deal";

  return `
    <div class="card-base p-3 flex flex-col gap-2.5">

      <!-- Verified badges row -->
      ${badgesHtml}

      <!-- Discount badge + title + description -->
      <div class="flex items-start gap-3">
        ${discountBadgeHtml}
        <div class="flex-1 min-w-0 flex flex-col gap-0.5">
          <div class="relative group" tabindex="0" aria-describedby="title-tip-${id}">
            <h3 class="font-semibold text-sm leading-snug truncate block" style="color:#111418;">
              ${title}
            </h3>
            <div id="title-tip-${id}" role="tooltip"
              class="absolute left-0 top-full mt-1 z-50 max-w-xs w-max p-2 rounded bg-black text-white text-xs shadow-lg break-words opacity-0 pointer-events-none transition-all duration-150 group-hover:opacity-100 group-focus:opacity-100"
              aria-hidden="true">
              ${title}
            </div>
          </div>
          <p class="text-xs leading-relaxed overflow-hidden" style="color:#6B7280; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2;">
            ${description}
          </p>
        </div>
      </div>

      <!-- Bottom row: expiry + used-by + button all in one line -->
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          ${expiryHtml}
          ${usedByHtml}
          <span class="copied-banner-${id} text-xs font-semibold text-green-700 hidden">✓ Copied!</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="js-reveal-btn flex-shrink-0 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold text-white transition disabled:opacity-60 disabled:cursor-not-allowed"
            style="background:#FF5A1F;"
            onmouseover="this.style.background='#E14A15'"
            onmouseout="this.style.background='#FF5A1F'"
            data-offer-id="${id}"
            data-code="${rawCode}"
            data-coupon-type="${couponType}"
            aria-label="${btnAriaLabel}"
          >
            ${
              couponType === "coupon"
                ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`
                : `<svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`
            }
            ${btnLabel}
          </button>
        </div>
      </div>

    </div>
  `;
}
