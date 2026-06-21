import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: cafes } = await sb
          .from("cafes")
          .select("slug, updated_at")
          .eq("is_active", true);

        const staticUrls = ["", "/discover", "/auth"];
        const now = new Date().toISOString();
        const urls = [
          ...staticUrls.map((p) => ({ loc: `${origin}${p}`, lastmod: now, priority: p === "" ? "1.0" : "0.7" })),
          ...(cafes ?? []).map((c) => ({
            loc: `${origin}/c/${c.slug}`,
            lastmod: (c.updated_at ?? now) as string,
            priority: "0.8",
          })),
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
