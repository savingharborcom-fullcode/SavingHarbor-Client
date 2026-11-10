// src/components/PopularCategories.jsx
import { useState, useEffect } from "react";

function SkeletonCard() {
  return <div className="animate-pulse bg-gray-100 rounded-xl h-28" />;
}

/** @param {{ apiUrl: string, initialCategories?: any[] }} props */
export default function PopularCategories({ apiUrl, initialCategories = [] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [loading, setLoading] = useState(initialCategories.length === 0);

  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      setCategories(initialCategories);
      setLoading(false);
      return;
    }
    fetch(`${apiUrl}/categories?show_home=true&limit=8`)
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, [apiUrl, initialCategories]);

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-brand-secondary">
          Popular Categories
        </h2>
        <a href="/categories" className="btn btn-outline--light text-sm">
          All categories →
        </a>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : categories.map((cat) => (
              <a
                key={cat.id}
                href={`/categories/${cat.slug}`}
                className="group bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center text-center hover:shadow-md hover:border-brand-primary transition-all"
              >
                <div className="w-12 h-12 mb-3 rounded-lg bg-gradient-to-br from-brand-primary/10 to-brand-primary/20 flex items-center justify-center overflow-hidden">
                  {cat.thumb_url ? (
                    <img
                      src={cat.thumb_url}
                      alt={cat.name}
                      className="w-full h-full object-cover rounded-lg"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-2xl">📦</span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-brand-primary transition-colors line-clamp-2">
                  {cat.name}
                </h3>
                {cat.stats?.subcategories > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    {cat.stats.subcategories} subcategories
                  </p>
                )}
              </a>
            ))}
      </div>
    </section>
  );
}
