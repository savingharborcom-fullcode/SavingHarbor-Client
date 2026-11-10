// src/components/HomeSections.jsx
import PopularCategories from "./CategoriesSection.jsx";
import StoresSection from "./StoresSection.jsx";
import DealsSection from "./DealsSection.jsx";
import TestimonialsCarousel from "./TestimonialsCarousel.jsx";

/**
 * @param {{
 *   apiUrl: string,
 *   testimonials: any[],
 *   avgRating: number|null,
 *   totalReviews: number,
 *   initialStores?: any[],
 *   initialDeals?: any[],
 *   initialCategories?: any[]
 * }} props
 */
export default function HomeSections({
  apiUrl,
  testimonials = [],
  avgRating,
  totalReviews,
  initialStores = [],
  initialDeals = [],
  initialCategories = [],
}) {
  return (
    <>
      <StoresSection apiUrl={apiUrl} initialStores={initialStores} />
      <DealsSection apiUrl={apiUrl} initialDeals={initialDeals} />
      <PopularCategories apiUrl={apiUrl} initialCategories={initialCategories} />
      <TestimonialsCarousel
        items={testimonials}
        avgRating={avgRating}
        totalReviews={totalReviews}
      />
    </>
  );
}
