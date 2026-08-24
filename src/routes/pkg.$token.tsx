import { createFileRoute } from "@tanstack/react-router";

import { PackageReport } from "@/features/presentations/PackageReport";
import { presentationTitle } from "@/lib/share-presentation";
import { getSharedPackage } from "@/lib/presentation-packages.functions";

export const Route = createFileRoute("/pkg/$token")({
  loader: async ({ params }) => {
    try {
      return {
        token: params.token,
        pack: await getSharedPackage({ data: { token: params.token } }),
      };
    } catch {
      return { token: params.token, pack: null };
    }
  },
  head: ({ loaderData }) => {
    const pk =
      loaderData?.pack && !(loaderData.pack as any).error ? (loaderData.pack as any) : null;
    const title = pk
      ? `${presentationTitle(pk.title)} | REAL DESIGNS`
      : "Client Presentation | REAL DESIGNS";
    const description = pk
      ? `${pk.property_label || "A property presentation"} — designs and before/after views, ready for your review.`
      : "A private presentation shared with you through REAL DESIGNS.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: SharedPackage,
});

function SharedPackage() {
  const { token, pack } = Route.useLoaderData() as any;
  return <PackageReport token={token} pack={pack} />;
}
