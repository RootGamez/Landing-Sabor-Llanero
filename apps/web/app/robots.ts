import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/siteConfig";

// Genera robots.txt en build time (necesario con output: "export").
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
