// utils/buildStoreSchema.js
// Builds the full JSON-LD @graph for a SavingHarbor store page.

const SITE_URL = "https://www.savingharbor.com";
const SITE_NAME = "SavingHarbor";
const LOGO_URL = "https://www.savingharbor.com/logo.png";

/**
 * buildStoreSchema(payload)
 *
 * @param {Object} payload
 * @param {Object}   payload.store           - store row from getBySlug (enriched)
 * @param {Object}   payload.seo             - from StoresRepo.buildSeo()
 * @param {Array}    payload.coupons         - couponsItems array
 * @param {Array}    payload.trendingOffers  - trendingOffers array
 * @param {Array}    payload.relatedStores   - related_stores array
 * @param {Object}   payload.recentActivity  - { recent: [] }
 * @param {Array}    payload.faqs            - normalized faqs array (all, no limit)
 * @param {Array}    payload.proofs          - proofs array from merchant_proofs
 * @param {number}   payload.totalSavings    - computed savings impact (USD)
 * @param {number}   payload.totalClicks     - summed click_count across all store coupons
 * @param {string}   payload.generatedAt     - ISO date string
 *
 * @returns {Object} JSON-LD @graph object ready for injection
 */
export function buildStoreSchema({
  store,
  seo,
  coupons = [],
  trendingOffers = [],
  relatedStores = [],
  recentActivity = {},
  faqs = [],
  proofs = [],
  totalSavings = 0,
  totalClicks = 0,
  generatedAt,
}) {
  const storeUrl = `${SITE_URL}/stores/${store.slug}`;
  const lastUpdated = generatedAt || new Date().toISOString();
  const lastVerified = store.verifier?.created_at || lastUpdated;
  const graph = [];

  // ── 1. Site-level Organization ────────────────────────────────────────────
  graph.push({
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: LOGO_URL,
    },
  });

  // ── 2. WebSite ────────────────────────────────────────────────────────────
  graph.push({
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    publisher: {
      "@id": `${SITE_URL}/#organization`,
    },
  });

  // ── 3. WebPage ────────────────────────────────────────────────────────────
  graph.push({
    "@type": "WebPage",
    "@id": `${storeUrl}/#webpage`,
    url: storeUrl,
    name: seo.meta_title,
    description: seo.meta_description,
    isPartOf: {
      "@id": `${SITE_URL}/#website`,
    },
    about: {
      "@id": `${storeUrl}/#merchant`,
    },
    mainEntity: {
      "@id": `${storeUrl}/#merchant`,
    },
    mainEntity: {
      "@id": `${storeUrl}/#faq`,
    },
    // faqs: {
    //   "@id": `${storeUrl}/#faq`,
    // },
    breadcrumb: {
      "@id": `${storeUrl}/#breadcrumb`,
    },
    dateModified: lastUpdated,
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: store.logo_url || "",
    },
  });

  // ── 4. BreadcrumbList ─────────────────────────────────────────────────────
  graph.push({
    "@type": "BreadcrumbList",
    "@id": `${storeUrl}/#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${SITE_URL}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Stores",
        item: `${SITE_URL}/stores`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: store.name,
        item: storeUrl,
      },
    ],
  });

  // ── 5. Merchant Organization ──────────────────────────────────────────────
  graph.push({
    "@type": "Organization",
    "@id": `${storeUrl}/#merchant`,
    name: store.name,
    url: store.web_url || storeUrl,
    logo: {
      "@type": "ImageObject",
      url: store.logo_url || "",
    },
    description: seo.meta_description,
    // aggregateRating: {
    //   "@type": "AggregateRating",
    //   ratingValue: "4.5",
    //   reviewCount: String(totalClicks || 0),
    // },
    subjectOf: [{
      "@type": "Review",
      "@id": `${storeUrl}/#verification-review`,
    }
    // , {
    //   "@type": "QuantitativeValue",
    //   "@id": `${storeUrl}/#savings-impact`,
    // }
  ],
  });

  // ── 6. Person (Verifier/Author) ───────────────────────────────────────────
  if (store.verifier) {
    graph.push({
      "@type": "Person",
      "@id": `${storeUrl}/#author`,
      name: store.verifier.name,
      jobTitle:
        store.verifier.designation || "Lead Coupon Verification Specialist",
      description: store.verifier.bio_html,
      knowsAbout: ["Coupon Verification", "E-commerce Discounts", "Savings Strategies"],
      worksFor: {
        "@id": `${SITE_URL}/#organization`,
      },
      image: {
        "@type": "ImageObject",
        url: store.verifier.avatar_url || "",
      },
    });
  }

//  ── 7. Review (Verification Review) ──────────────────────────────────────
  if (store.verifier) {
    graph.push({
      "@type": "Review",
      "@id": `${storeUrl}/#verification-review`,
      author: {
        "@id": `${storeUrl}/#author`,
      },
      itemReviewed: {
        "@id": `${storeUrl}/#merchant`,
      },
      datePublished: lastVerified,
      reviewRating: {
        "@type": "Rating",
        ratingValue: "5",
        bestRating: "5",
      },
      reviewBody:
        `Our team performs comprehensive merchant-wide verification for ${store.name}. We manually test multiple checkout paths to ensure all sitewide offers and seasonal deals are fully operational. The attached screenshots serve as proof of successful application across the entire store.`,
    });
  }

  // ── 8. ImageObject (Verification Proofs — one node per proof, indexed) ──────
  (proofs || []).forEach((proof, i) => {
    if (!proof?.image_url) return;
    graph.push({
      "@type": "ImageObject",
      "@id": `${storeUrl}/#verification-proof-${i + 1}`,
      about: {
        "@id": `${storeUrl}/#merchant`,
      },
      name: `Coupon Verification Proof ${i + 1}`,
      description: "Checkout screenshot showing successful coupon application.",
      contentUrl: proof.image_url,
    });
  });

  // ── 9. Dataset ────────────────────────────────────────────────────────────
  // graph.push({
  //   "@type": "Dataset",
  //   "@id": `${storeUrl}/#coupon-dataset`,
  //   about: {
  //     "@id": `${storeUrl}/#merchant`,
  //   },
  //   name: `${store.name} Coupon Verification Dataset`,
  //   description: `Dataset tracking coupon verification, savings impact and user usage for ${store.name}.`,
  //   creator: {
  //     "@id": `${SITE_URL}/#organization`,
  //   },
  // });

  // ── 10. QuantitativeValue (Savings Impact) ────────────────────────────────
  // graph.push({
  //   "@type": "QuantitativeValue",
  //   "@id": `${storeUrl}/#savings-impact`,

  //   name: "Total Savings Impact",
  //   value: String(totalSavings || 0),
  //   unitText: "USD",
  // });

  // ── 11. ItemList — Active Coupons ─────────────────────────────────────────
  graph.push({
    "@type": "ItemList",
    "@id": `${storeUrl}/#coupon-list`,
    name: `Active ${store.name} Coupons`,
    numberOfItems: String(store.active_coupons || coupons.length || 0),
    itemListElement: coupons.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Offer",
        name: c.title || "",
        description: c.description || "",
        discountCode: c.code || undefined,
        discount: c.discount_value? `${c.discount_value}${c.discount_type === "percentage" ? "%" : " USD"} off` : undefined,
        url: storeUrl,
        availability: c.ends_at && new Date(c.ends_at) < new Date() ? "http://schema.org/OutOfStock" : "http://schema.org/InStock",
        validity: c.ends_at ? `until ${new Date(c.ends_at).toLocaleDateString()}` : "Valid until further notice",
        price: c.discount_value ? String(c.discount_value) : undefined,
        priceCurrency: "USD",
        priceSpecification:{
          "@type": "PriceSpecification",
          price: String(c.discount_value)     
        },   
        seller: {
          "@id": `${storeUrl}/#merchant`,
        },
      },
    })),
  });

  // ── 12. ItemList — Related Stores ─────────────────────────────────────────
  graph.push({
    "@type": "ItemList",
    "@id": `${storeUrl}/#related-stores`,
    name: "Related Stores",
    itemListElement: relatedStores.map((rs, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: rs.name,
      url: `${SITE_URL}/stores/${rs.slug}`,
    })),
  });

  // ── 13. HowTo (Verification Process) ─────────────────────────────────────
  graph.push({
    "@type": "HowTo",
    "@id": `${storeUrl}/#verification-process`,
    name: "SavingHarbor Coupon Verification Process",
    step: [
      {
        "@type": "HowToStep",
        name: "Manual Merchant Visit",
        text: `We visit ${store.web_url || store.name} and identify active promotions.`,
      },
      {
        "@type": "HowToStep",
        name: "Checkout Testing",
        text: "Coupons are applied during checkout to verify validity.",
      },
      {
        "@type": "HowToStep",
        name: "Proof Capture",
        text: "Screenshots are captured as verification proof.",
      },
    ],
  });

  // ── 14. FAQPage — all FAQs from DB, no limit ──────────────────────────────
  if (faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${storeUrl}/#faq`,
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: f.answer,
        },
      })),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}
