import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { ALL_PAGE_PATHS } from "@/content/seo/nav";
import { SITE_URL } from "@/lib/site";

const BASE_URL = SITE_URL;

type Entry = {
  path: string;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  priority?: string;
};

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: Entry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          ...ALL_PAGE_PATHS.map((path) => ({
            path,
            changefreq: "monthly" as const,
            priority: path.startsWith("/free/") ? "0.9" : "0.8",
          })),
          { path: "/explore", changefreq: "weekly", priority: "0.9" },
          { path: "/pricing", changefreq: "weekly", priority: "0.9" },
          { path: "/founders", changefreq: "weekly", priority: "0.6" },
          { path: "/resources", changefreq: "weekly", priority: "0.7" },
          { path: "/free", changefreq: "weekly", priority: "0.7" },
          { path: "/about", changefreq: "monthly", priority: "0.6" },
          { path: "/contact", changefreq: "yearly", priority: "0.5" },
          { path: "/security", changefreq: "yearly", priority: "0.4" },
          { path: "/status", changefreq: "daily", priority: "0.3" },
          { path: "/terms", changefreq: "yearly", priority: "0.3" },
          { path: "/privacy", changefreq: "yearly", priority: "0.3" },
          { path: "/refunds", changefreq: "yearly", priority: "0.3" },
          { path: "/acceptable-use", changefreq: "yearly", priority: "0.3" },
          { path: "/copyright", changefreq: "yearly", priority: "0.3" },
          { path: "/affiliate-disclosure", changefreq: "yearly", priority: "0.3" },
          { path: "/subprocessors", changefreq: "yearly", priority: "0.3" },
          { path: "/accessibility", changefreq: "yearly", priority: "0.3" },
          { path: "/do-not-sell", changefreq: "yearly", priority: "0.3" },

        ];


        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]

            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
