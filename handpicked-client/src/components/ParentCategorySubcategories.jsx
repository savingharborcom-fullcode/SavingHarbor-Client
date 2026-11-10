import { useState, useEffect } from "react";

export default function ParentCategorySubcategories({
  apiUrl,
  categorySlug,
  initialSubcategories = [],
}) {
  const [subcategories, setSubcategories] = useState(initialSubcategories);
  const [loading, setLoading] = useState(initialSubcategories.length === 0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialSubcategories && initialSubcategories.length > 0) {
      setSubcategories(initialSubcategories);
      setLoading(false);
      return;
    }
    const fetch_ = async () => {
      try {
        const res = await fetch(`${apiUrl}/categories/${categorySlug}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        setSubcategories(data.data?.subcategories || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, [categorySlug, initialSubcategories]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-gray-200 rounded-lg h-40" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Failed to load subcategories</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-brand-primary text-white rounded-lg"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (subcategories.length === 0) {
    return (
      <p className="text-center py-12 text-gray-500">No subcategories found.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {subcategories.map((subcat) => (
        <a
          key={subcat.id}
          href={`/categories/${categorySlug}/${subcat.slug}`}
          className="group bg-white rounded-lg border border-gray-200 p-5 hover:shadow-lg hover:border-brand-primary transition-all"
        >
          <div className="w-12 h-12 mb-3 bg-gradient-to-br from-brand-primary/10 to-brand-primary/20 rounded-lg flex items-center justify-center">
            {subcat.thumb_url ? (
              <img
                src={subcat.thumb_url}
                alt={subcat.name}
                className="w-full h-full object-contain rounded-lg"
                loading="lazy"
              />
            ) : (
              <span className="text-2xl">📦</span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-brand-primary transition-colors line-clamp-2">
            {subcat.name}
          </h3>
          <p className="text-sm text-gray-500">
            {subcat.merchant_count || 0}{" "}
            {subcat.merchant_count === 1 ? "store" : "stores"}
          </p>
        </a>
      ))}
    </div>
  );
}
