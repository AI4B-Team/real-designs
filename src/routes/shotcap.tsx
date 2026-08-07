import { createFileRoute } from "@tanstack/react-router";

import { PrototypeSurface } from "@/components/PrototypeSurface";
import { html } from "@/content/rd-app-html";
import { initApp } from "@/content/rd-app-script";
import "@/styles/rd-app.css";

export const Route = createFileRoute("/shotcap")({
  head: () => ({
    meta: [
      { title: "Capture | REAL DESIGNS" },
      { name: "description", content: "Internal capture surface." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <PrototypeSurface className="rd-app" html={html} init={initApp} />,
});
