import { createFileRoute } from "@tanstack/react-router";

import { PackageReport } from "@/features/presentations/PackageReport";
import { getOwnerPreviewPackage } from "@/lib/presentation-packages.functions";

export const Route = createFileRoute("/_authenticated/presentation/$id/preview")({
  loader: async ({ params }) => {
    try {
      return { pack: await getOwnerPreviewPackage({ data: { id: params.id } }) };
    } catch {
      return { pack: null };
    }
  },
  head: () => ({
    meta: [
      { title: "Presentation Preview | REAL DESIGNS" },
      {
        name: "description",
        content: "See the exact presentation your client receives, before you send it.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Presentation Preview | REAL DESIGNS" },
      {
        property: "og:description",
        content: "See the exact presentation your client receives, before you send it.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OwnerPreview,
});

function OwnerPreview() {
  const { pack } = Route.useLoaderData() as any;
  return <PackageReport pack={pack} preview />;
}
