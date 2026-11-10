// src/components/TopDeals.jsx
import { useState, useEffect } from "react";
import CouponReveal from "./couponReveal.jsx";

function SkeletonCard() {
  return <div className="animate-pulse bg-gray-100 rounded-xl h-40" />;
}

/** @param {{ apiUrl: string, initialDeals?: any[] }} props */
export default function TopDeals({ apiUrl, initialDeals = [] }) {
  const [coupons, setCoupons] = useState(initialDeals);
  const [loading, setLoading] = useState(initialDeals.length === 0);

  useEffect(() => {
    if (initialDeals && initialDeals.length > 0) {
      setCoupons(initialDeals);
      setLoading(false);
      return;
    }
    fetch(`${apiUrl}/coupons?mode=homepage&limit=8&status=active`)
      .then((r) => r.json())
      .then((d) => setCoupons(d.data || []))
      .catch(() => setCoupons([]))
      .finally(() => setLoading(false));
  }, [apiUrl, initialDeals]);

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-brand-secondary">
          Today's Top Deals & Coupons
        </h2>
        <a href="/coupons" className="btn btn-outline--light text-sm">
          Explore more →
        </a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : coupons.length === 0 ? (
          <p className="text-gray-500 col-span-4">
            No coupons available right now. Check back soon.
          </p>
        ) : (
          coupons.map((c) => (
            <div
              key={c.id}
              className="rounded-md bg-white/5 p-3 transition-shadow hover:shadow-store-card"
              style={{
                borderTopWidth: "3px",
                borderTopStyle: "solid",
                borderTopColor: "transparent",
              }}
            >
              <CouponReveal
                coupon={c}
                storeSlug={c.merchant?.slug || c.merchant_name}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
