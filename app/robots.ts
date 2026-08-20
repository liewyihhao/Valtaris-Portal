import type { MetadataRoute } from "next";

// Public recruitment/legal pages are indexable; the authenticated app is not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/how-it-works", "/legal/"],
      disallow: ["/apply", "/dashboard", "/earnings", "/appeals", "/profile", "/payment-details", "/admin"],
    },
  };
}
