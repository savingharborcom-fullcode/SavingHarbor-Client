// src/components/couponReveal.jsx
import React, { useState } from "react";

function Toast({ message, onClose }) {
  React.useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 bg-brand-dark text-white text-sm px-3 py-2 rounded shadow z-50"
    >
      {message}
    </div>
  );
}

function CouponCard({ coupon: c, code, isDeal, revealed, onReveal }) {
  const discountType = c.discount_type || "none";
  const discountValue = c.discount_value ?? null;

  const endsAt = c.ends_at
    ? new Date(c.ends_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  const clickCount =
    Number.isFinite(Number(c.click_count)) && Number(c.click_count) > 0
      ? Number(c.click_count)
      : 0;

  // Discount badge
  let badgeTop = "DEAL",
    badgeBottom = "";
  let badgeBg = "bg-[#FFF0EB]",
    badgeBorder = "border-[#FFCBB8]",
    badgeText = "text-[#B93C10]";

  if (discountType === "percent" && discountValue) {
    badgeTop = `${discountValue}%`;
    badgeBottom = "OFF";
    badgeBg = "bg-[#ECFAD0]";
    badgeBorder = "border-[#B8F200]";
    badgeText = "text-[#2A3300]";
  } else if (discountType === "flat" && discountValue) {
    badgeTop = `$${discountValue}`;
    badgeBottom = "OFF";
    badgeBg = "bg-amber-100";
    badgeBorder = "border-amber-300";
    badgeText = "text-amber-800";
  }

  return (
    <div className="card-base p-3 flex flex-col gap-2.5">
      {/* Verified badges row */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <img
            src="/images/verified-badge.webp"
            alt="Verified"
            className="h-4 w-4 object-contain"
            loading="lazy"
            decoding="async"
          />
          <span className="text-xs text-emerald-700 font-medium">Verified</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-emerald-700 font-medium">
            Re-verified
          </span>
          <img
            src="/images/reverified-badge.webp"
            alt="Re-verified"
            className="h-4 w-4 object-contain"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>

      {/* Discount badge + title + description */}
      <div className="flex items-start gap-3">
        <div
          className={`flex-shrink-0 flex flex-col items-center justify-center rounded-lg px-3 py-2 border ${badgeBg} ${badgeBorder}`}
          style={{ minWidth: 60, width: 60 }}
        >
          <span
            className={`font-extrabold leading-tight text-center text-base ${badgeText}`}
          >
            {badgeTop}
          </span>
          {badgeBottom && (
            <span
              className={`text-xs font-semibold tracking-wide text-center ${badgeText} opacity-70`}
            >
              {badgeBottom}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <h3
            className="font-semibold text-sm leading-snug truncate"
            style={{ color: "#111418" }}
          >
            {c.title || ""}
          </h3>
          <p
            className="text-xs leading-relaxed line-clamp-2"
            style={{ color: "#6B7280" }}
          >
            {c.description || ""}
          </p>
        </div>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {endsAt && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.6}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>Expires {endsAt}</span>
            </div>
          )}
          {clickCount > 0 && (
            <div className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.6}
                  d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-1.13a4 4 0 10-8 0 4 4 0 008 0z"
                />
              </svg>
              <span>
                {clickCount} {clickCount === 1 ? "user" : "users"}
              </span>
            </div>
          )}
        </div>

        {/* Reveal area */}
        <div className="flex items-center gap-2">
          {revealed ? (
            isDeal || !code ? (
              <div
                className="rounded-md px-3 py-2 text-sm font-semibold text-center"
                style={{
                  background: "#f0fdf4",
                  color: "#15803d",
                  border: "1px solid #bbf7d0",
                }}
              >
                ✓ Deal Activated
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div
                  className="rounded-md px-3 py-2 text-sm font-mono font-bold tracking-widest text-center border border-dashed overflow-x-auto cursor-pointer select-all"
                  style={{
                    background: "#FFF0EB",
                    borderColor: "#FF5A1F",
                    color: "#B93C10",
                  }}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(code);
                    } catch (_) {}
                  }}
                  title="Click to copy"
                >
                  {code}
                </div>
                <div className="text-xs text-center text-gray-400">
                  Click code to copy again
                </div>
              </div>
            )
          ) : (
            <button
              type="button"
              onClick={onReveal}
              className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold text-white transition"
              style={{ background: "#FF5A1F" }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = "#E14A15")
              }
              onMouseOut={(e) => (e.currentTarget.style.background = "#FF5A1F")}
              aria-label={isDeal ? "Activate deal" : "Reveal coupon code"}
            >
              {isDeal ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              )}
              {isDeal ? "Activate Deal" : "Reveal Code"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CouponReveal({ coupon, storeSlug, affiliateUrl  }) {
  const c = coupon || {};
  const [revealed, setRevealed] = useState(false);
  const [toasts, setToasts] = useState([]);

  const code = c.code ? String(c.code).trim() : null;
  const isDeal = (c.coupon_type || "") !== "coupon";

  const pushToast = (msg) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message: msg }]);
  };
  const removeToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  const handleReveal = async () => {
    if (revealed) return;
    setRevealed(true);

    if (code) {
      try {
        await navigator.clipboard.writeText(code);
        pushToast("Code copied to clipboard");
      } catch (_) {
        pushToast("Code revealed — copy manually");
      }
    }

    if (affiliateUrl) {
      setTimeout(
        () => window.open(affiliateUrl, "_blank", "noopener,noreferrer"),
        100,
      );
    }
  };

  return (
    <>
      <CouponCard
        coupon={c}
        code={code}
        isDeal={isDeal}
        revealed={revealed}
        onReveal={handleReveal}
      />
      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.message}
          onClose={() => removeToast(t.id)}
        />
      ))}
    </>
  );
}
