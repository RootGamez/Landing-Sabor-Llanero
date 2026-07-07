import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/siteConfig";

// Genera sitemap.xml en build time (necesario con output: "export").
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
