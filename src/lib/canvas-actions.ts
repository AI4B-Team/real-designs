/**
 * The one action bar for a generated design result.
 *
 * A finished render is never a dead end: every surface that shows one (the
 * Studio canvas today, galleries through `resultHoverBarHtml`) offers the same
 * next steps in the same order, and each step reuses the workflow that already
 * exists instead of inventing a second one.
 */
import { startVideoFromCanvas, videoHandoffIssue } from "@/lib/video-handoff";

export type ResultContext = {
  /** Display URL of the result on screen. May be a data: URL before saving. */
  src: string;
  /** Durable storage path. Absent until the version is saved. */
  path?: string | null;
  /** Original photo the result was generated from, for Compare. */
  sourceSrc?: string | null;
  id?: string | null;
  room?: string | null;
  style?: string | null;
  propertyId?: string | null;
  propertyAddress?: string | null;
  origin?: "studio" | "media" | "designs" | "property";
};

export type ResultAction =
  | "edit"
  | "variation"
  | "video"
  | "upscale"
  | "shop"
  | "estimate"
  | "download"
  | "more";

const BAR: { id: ResultAction; icon: string; label: string }[] = [
  { id: "edit", icon: "pencil", label: "Edit" },
  { id: "variation", icon: "git-branch", label: "Variation" },
  { id: "video", icon: "clapperboard", label: "Create Video" },
  { id: "upscale", icon: "sparkles", label: "Upscale" },
  { id: "shop", icon: "shopping-bag", label: "Shop" },
  { id: "estimate", icon: "calculator", label: "Estimate" },
  { id: "download", icon: "download", label: "Download" },
  { id: "more", icon: "ellipsis", label: "More" },
];

const esc = (s: unknown) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

function icons() {
  try {
    (window as any).lucide?.createIcons({});
  } catch (_) {
    /* icons are cosmetic */
  }
}

function toast(msg: string) {
  try {
    const t = (window as any).rdToast || (window as any).__rdToast;
    if (typeof t === "function") t(msg);
  } catch (_) {
    /* a missing toast never blocks an action */
  }
}

function go(view: string) {
  try {
    (window as any).__rdGo?.(view);
  } catch (_) {
    /* navigation is best effort */
  }
}

/* ------------------------------------------------------------------ */
/* markup                                                              */
/* ------------------------------------------------------------------ */

/** The floating toolbar shown over a result image. */
export function resultBarHtml(ids: ResultAction[] = BAR.map((b) => b.id)) {
  return (
    '<div class="rda-bar" role="toolbar" aria-label="Design Actions">' +
    BAR.filter((b) => ids.includes(b.id))
      .map(
        (b) =>
          '<button type="button" class="rda-b" data-rda="' +
          b.id +
          '" title="' +
          esc(b.label) +
          '" aria-label="' +
          esc(b.label) +
          '"><i data-lucide="' +
          b.icon +
          '"></i><span>' +
          esc(b.label) +
          "</span></button>",
      )
      .join("") +
    "</div>"
  );
}

/** The compact bar galleries reveal on hover. */
export function resultHoverBarHtml(
  ids: ResultAction[] = ["video", "edit", "variation", "download", "more"],
) {
  return resultBarHtml(ids).replace('class="rda-bar"', 'class="rda-bar rda-hover"');
}

/* ------------------------------------------------------------------ */
/* image export                                                        */
/* ------------------------------------------------------------------ */

const SIZES: Record<string, { px: number; label: string; note: string }> = {
  standard: { px: 1600, label: "Standard", note: "Web And Email. 1600px On The Long Edge." },
  hd: { px: 2560, label: "HD", note: "Print Flyers And Slides. 2560px On The Long Edge." },
  uhd: { px: 3840, label: "4K", note: "Large Format. 3840px On The Long Edge." },
};

async function exportImage(src: string, px: number): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  const long = Math.max(img.naturalWidth, img.naturalHeight) || px;
  const scale = px / long;
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Could Not Prepare That Image.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.92);
}

async function saveAs(src: string, px: number, name: string) {
  const data = await exportImage(src, px);
  const a = document.createElement("a");
  a.href = data;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ------------------------------------------------------------------ */
/* popovers                                                            */
/* ------------------------------------------------------------------ */

type PopItem = { icon: string; label: string; note?: string | undefined; fn: () => void };

let openPop: HTMLElement | null = null;

function closePop() {
  openPop?.remove();
  openPop = null;
}

function pop(anchor: HTMLElement, items: PopItem[]) {
  closePop();
  const el = document.createElement("div");
  el.className = "rda-pop";
  el.innerHTML = items
    .map(
      (it, i) =>
        '<button type="button" data-i="' +
        i +
        '"><i data-lucide="' +
        esc(it.icon) +
        '"></i><span><b>' +
        esc(it.label) +
        "</b>" +
        (it.note ? "<em>" + esc(it.note) + "</em>" : "") +
        "</span></button>",
    )
    .join("");
  document.body.appendChild(el);
  const r = anchor.getBoundingClientRect();
  el.style.left = Math.max(8, Math.min(window.innerWidth - 268, r.left - 100)) + "px";
  el.style.top = Math.max(8, r.top - el.offsetHeight - 10) + "px";
  el.querySelectorAll<HTMLElement>("button").forEach((b) => {
    b.onclick = () => {
      const it = items[Number(b.dataset["i"])];
      closePop();
      it?.fn();
    };
  });
  openPop = el;
  icons();
  setTimeout(() => {
    const off = (ev: MouseEvent) => {
      if (!el.contains(ev.target as Node)) {
        closePop();
        document.removeEventListener("mousedown", off);
      }
    };
    document.addEventListener("mousedown", off);
  }, 0);
}

/* ------------------------------------------------------------------ */
/* actions                                                             */
/* ------------------------------------------------------------------ */

function fileName(ctx: ResultContext, size: string) {
  const base = (ctx.room || "design").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return "real-designs-" + base + "-" + size + "-" + Date.now() + ".jpg";
}

function startVideo(ctx: ResultContext) {
  const issue = videoHandoffIssue({ path: ctx.path || "" });
  if (issue) {
    toast(issue);
    return;
  }
  const r = startVideoFromCanvas(
    {
      path: ctx.path || null,
      name: ctx.room || null,
      room: ctx.room || null,
      versionId: ctx.id || null,
      propertyId: ctx.propertyId || null,
      propertyAddress: ctx.propertyAddress || null,
    },
    ctx.origin === "studio" ? "studio" : "media",
  );
  if (!r.ok) {
    toast(r.reason);
    return;
  }
  void import("@/content/rd-media-lib").then((m) =>
    m.openVideoWorkflow({
      from: ctx.origin || "studio",
      propertyId: r.handoff.propertyId,
      propertyAddress: r.handoff.propertyAddress,
      motion: r.motion,
      assets: r.handoff.assets.map((a, i) => ({
        id: a.id,
        storage_path: a.path,
        file_name: a.name,
        original_filename: a.name,
        room_group: a.room || a.name,
        sort_order: i,
      })),
    }),
  );
}

function editDesign(ctx: ResultContext) {
  if (ctx.origin === "studio") {
    document.querySelector("#v-studio .studio.rdw")?.classList.add("panel-on");
    const note = document.getElementById("agentNote") as HTMLTextAreaElement | null;
    note?.scrollIntoView({ behavior: "smooth", block: "center" });
    note?.focus();
    return;
  }
  toast("Open This Design In Studio To Keep Editing.");
  go("studio");
}

function moreMenu(anchor: HTMLElement, ctx: ResultContext) {
  const items: PopItem[] = [
    {
      icon: "columns-2",
      label: "Compare With Original",
      fn: () => {
        const btn = document.querySelector<HTMLElement>('#rdwCmp .rdw-cmpb[data-cmp="split"]');
        if (btn) btn.click();
        else toast("A Source Photo Is Needed To Compare.");
      },
    },
    {
      icon: "git-compare",
      label: "Compare With Parent Version",
      fn: () => {
        const v = (() => {
          try {
            return (window as any).rdSessionVersion?.(ctx.src) || null;
          } catch (_) {
            return null;
          }
        })();
        const base = v?.parentSrc || null;
        const ok = base && (window as any).rdSetCompareBase?.(base);
        if (!ok) {
          toast("This Design Has No Parent Version Yet.");
          return;
        }
        document.querySelector<HTMLElement>('#rdwCmp .rdw-cmpb[data-cmp="split"]')?.click();
      },
    },
    {
      icon: "copy-plus",
      label: "Create Variation",
      fn: () => {
        void import("@/lib/variation-drawer").then((m) => m.openVariationDrawer(ctx));
      },
    },
    {
      icon: "presentation",
      label: "Add To Presentation",
      fn: () => go("present"),
    },
    {
      icon: "link",
      label: "Copy Link",
      fn: () => {
        const url = ctx.src;
        if (!url || /^data:/i.test(url)) {
          toast("Save This Design First To Copy A Link.");
          return;
        }
        void navigator.clipboard
          ?.writeText(url)
          .then(() => toast("Link Copied"))
          .catch(() => toast("Could Not Copy That Link."));
      },
    },
    {
      icon: "info",
      label: "Details",
      note: [ctx.room, ctx.style].filter(Boolean).join(" \u00b7 ") || undefined,
      fn: () => go("media"),
    },
  ];
  pop(anchor, items);
}

/** Run one action for one result. Every path reuses an existing workflow. */
export function runResultAction(action: ResultAction, ctx: ResultContext, anchor?: HTMLElement) {
  if (!ctx || !ctx.src) {
    toast("Generate A Design First.");
    return;
  }
  if (action === "edit") return editDesign(ctx);
  if (action === "variation") {
    void import("@/lib/variation-drawer").then((m) => m.openVariationDrawer(ctx));
    return;
  }
  if (action === "video") return startVideo(ctx);
  if (action === "shop") {
    const st = document.getElementById("stShop") as HTMLElement | null;
    if (st) st.click();
    else go("products");
    return;
  }
  if (action === "estimate") return go("scope");
  if (action === "upscale" || action === "download") {
    const items: PopItem[] = Object.entries(SIZES).map(([k, s]) => ({
      icon: "image-down",
      label: s.label,
      note: s.note,
      fn: () => {
        saveAs(ctx.src, s.px, fileName(ctx, k))
          .then(() => toast(s.label + " Image Saved"))
          .catch(() => toast("Could Not Prepare That Image."));
      },
    }));
    if (anchor) pop(anchor, items);
    else items[0]?.fn();
    return;
  }
  if (action === "more" && anchor) return moreMenu(anchor, ctx);
}

/* ------------------------------------------------------------------ */
/* Studio mount                                                        */
/* ------------------------------------------------------------------ */

function studioContext(): ResultContext | null {
  const img = document.querySelector<HTMLImageElement>("#cAfter img");
  const src = img?.src || "";
  if (!src) return null;
  const active = document.querySelector<HTMLElement>("#vars .var.on");
  const displayed = (() => {
    try {
      return (window as any).rdDisplayedVersion?.() || null;
    } catch (_) {
      return null;
    }
  })();
  const room = (document.getElementById("fRoom") as HTMLSelectElement | null)?.value || null;
  const style =
    (document.getElementById("fStyle") as HTMLSelectElement | null)?.value ||
    (() => {
      try {
        return (window as any).__rdCanvasState?.().selectedStyleName || null;
      } catch (_) {
        return null;
      }
    })();
  return {
    src,
    path: active?.dataset["path"] || displayed?.path || null,
    sourceSrc: document.querySelector<HTMLImageElement>("#cBefore img")?.src || null,
    id: displayed?.id || null,
    room,
    style: style || null,
    origin: "studio",
  };
}

/**
 * Attach the floating toolbar to the Studio canvas. It appears only once a
 * result is on screen and disappears while a generation is running, so it can
 * never act on an image the user is not looking at.
 */
export function mountStudioResultActions() {
  const stage = document.getElementById("rdwStage");
  if (!stage || (stage as any).__rda) return;
  (stage as any).__rda = true;

  const bar = document.createElement("div");
  bar.className = "rda-wrap";
  bar.hidden = true;
  bar.innerHTML = resultBarHtml();
  stage.appendChild(bar);
  icons();

  const sync = () => {
    const ctx = studioContext();
    const busy = document.getElementById("cGen")?.classList.contains("on");
    bar.hidden = !ctx || !!busy;
    if (!ctx) return;
    const vid = bar.querySelector<HTMLElement>('[data-rda="video"]');
    if (vid) {
      const blocked = !!videoHandoffIssue({ path: ctx.path || "" });
      vid.classList.toggle("is-off", blocked);
      vid.title = blocked ? "Save This Design To Create A Video" : "Create Video";
    }
    icons();
  };

  bar.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-rda]");
    if (!b) return;
    e.preventDefault();
    const ctx = studioContext();
    if (!ctx) return;
    runResultAction(b.dataset["rda"] as ResultAction, ctx, b);
  });

  const after = document.getElementById("cAfter");
  const gen = document.getElementById("cGen");
  const obs = new MutationObserver(() => sync());
  if (after) obs.observe(after, { childList: true, subtree: true });
  if (gen) obs.observe(gen, { attributes: true, attributeFilter: ["class"] });
  document.getElementById("vars")?.addEventListener("click", () => setTimeout(sync, 0));
  window.addEventListener("rd:saved", sync);
  sync();
}
