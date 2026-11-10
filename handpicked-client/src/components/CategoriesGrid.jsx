// src/components/CategoriesGrid.jsx
import { useState, useEffect } from "react";

export default function CategoriesGrid({ apiUrl, initialCategories = [] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [selectedCategory, setSelectedCategory] = useState(initialCategories[0] || null);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(initialCategories.length === 0);
  const [loadingSubcats, setLoadingSubcats] = useState(false);
  const [error, setError] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fetch parent categories
  const fetchCategories = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await fetch(`${apiUrl}/categories?limit=100`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      if (!data?.data) throw new Error("Invalid response");

      setCategories(data.data);

      // Auto-select first category
      if (data.data.length > 0) {
        setSelectedCategory(data.data[0]);
        fetchSubcategories(data.data[0].slug);
      }
    } catch (err) {
      console.error("Error fetching categories:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch subcategories for selected category
  const fetchSubcategories = async (slug) => {
    try {
      setLoadingSubcats(true);
      const response = await fetch(`${apiUrl}/categories/${slug}`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      if (!data?.data) throw new Error("Invalid response");

      setSubcategories(data.data.subcategories || []);
    } catch (err) {
      console.error("Error fetching subcategories:", err);
      setSubcategories([]);
    } finally {
      setLoadingSubcats(false);
    }
  };

  // Handle category selection
  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setIsMobileMenuOpen(false);
    fetchSubcategories(category.slug);
  };

  useEffect(() => {
    if (initialCategories.length > 0) {
      if (initialCategories[0]?.slug) {
        fetchSubcategories(initialCategories[0].slug);
      }
      return;
    }
    fetchCategories();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-lg mb-4">Failed to load categories</p>
        <button
          onClick={fetchCategories}
          className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-dark"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[600px]">
      {/* Mobile: Category Dropdown */}
      <div className="lg:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg flex items-center justify-between text-left font-medium"
        >
          <span>{selectedCategory?.name || "Select Category"}</span>
          <svg
            className={`w-5 h-5 transition-transform ${isMobileMenuOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isMobileMenuOpen && (
          <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat)}
                className={`w-full px-4 py-3 text-left border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                  selectedCategory?.id === cat.id
                    ? "bg-brand-primary/10 text-brand-primary font-semibold"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{cat.name}</span>
                  <span className="text-xs text-gray-500">
                    {cat.stats?.subcategories || 0} subcategories
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: Left Sidebar */}
      <aside className="hidden lg:block lg:w-64 flex-shrink-0">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden sticky top-4">
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Categories</h2>
          </div>
          <nav className="max-h-[calc(100vh-200px)] overflow-y-auto">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat)}
                className={`w-full px-4 py-3 text-left border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors ${
                  selectedCategory?.id === cat.id
                    ? "bg-brand-primary/10 text-brand-primary font-semibold border-l-4 border-l-brand-primary"
                    : "text-gray-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{cat.name}</span>
                  {cat.stats?.subcategories > 0 && (
                    <span className="text-xs text-gray-400">
                      {cat.stats.subcategories}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Right: Subcategories Grid */}
      <main className="flex-1">
        {selectedCategory && (
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedCategory.name}
            </h2>
            {selectedCategory.description && (
              <p className="mt-2 text-gray-600">
                {selectedCategory.description}
              </p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              {subcategories.length} subcategories ·{" "}
              {selectedCategory.stats?.stores || 0} stores
            </p>
          </div>
        )}

        {loadingSubcats ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 rounded-lg h-40"></div>
              </div>
            ))}
          </div>
        ) : subcategories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {subcategories.map((subcat) => (
              <a
                key={subcat.id}
                href={`/categories/${selectedCategory.slug}/${subcat.slug}`}
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
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No subcategories available</p>
          </div>
        )}
      </main>
    </div>
  );
}
