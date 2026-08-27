import type { MetadataRoute } from "next";

// The Portal is an internal ops + workforce tool with no public marketing face
// (public recruitment lives in the separate Valtaris marketing website).
// Nothing here is meant to be indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
