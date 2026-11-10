// src/components/TopStores.jsx
import { useState, useEffect } from "react";

function SkeletonCard() {
  return <div className="animate-pulse bg-gray-100 rounded-xl h-36" />;
}

/** @param {{ apiUrl: string, initialStores?: any[] }} props */
export default function TopStores({ apiUrl, initialStores = [] }) {
  const [stores, setStores] = useState(initialStores);
  const [loading, setLoading] = useState(initialStores.length === 0);

  useEffect(() => {
    if (initialStores && initialStores.length > 0) {
      setStores(initialStores);
      setLoading(false);
      return;
    }
    fetch(`${apiUrl}/stores?mode=homepage&limit=8`)
      .then((r) => r.json())
      .then((d) => setStores(d.data || []))
      .catch(() => setStores([]))
      .finally(() => setLoading(false));
  }, [apiUrl, initialStores]);

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-brand-secondary">Top Stores</h2>
        <a href="/stores" className="btn btn-outline--light text-sm">
          All stores →
        </a>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : stores.map((store) => (
              <a
                key={store.id}
                href={`/stores/${store.slug}`}
                className="group bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center text-center hover:shadow-md hover:border-brand-primary transition-all"
              >
                <div className="w-16 h-16 mb-3 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden border border-gray-100">
                  {store.logo_url ? (
                    <img
                      src={store.logo_url}
                      alt={store.name}
                      className="w-full h-full object-contain p-1"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-gray-300">
                      {store.name?.charAt(0)}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-brand-primary transition-colors line-clamp-2">
                  {store.name}
                </h3>
                {store.stats?.active_coupons > 0 && (
                  <span className="mt-2 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                    {store.stats.active_coupons} coupons
                  </span>
                )}
              </a>
            ))}
      </div>
    </section>
  );
}
