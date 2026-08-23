import { createIcons, icons as lucideIcons } from "lucide";
/**
 * The one action bar for a generated design result.
 *
 * A finished render is never a dead end: every surface that shows one (the
 * Studio canvas today, galleries through `resultHoverBarHtml`) offers the same
 * next steps in the same order, and each step reuses the workflow that already
 * exists instead of inventing a second one.
 */
import { startVideoBuilder, videoHandoffIssue } from "@/lib/video-handoff";
import { IMAGE_ACTIONS, recordImageAction, type ImageActionId } from "@/lib/image-actions";

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
  /** Operations behind this render, used to classify the export. */
  operations?: string[];
  /** Version identifier written into the export audit trail. */
  versionId?: string | null;
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

/* Icons, labels and tooltips come from the shared registry so the same glyph
   never means two different things on two different screens. */
const CANON: Partial<Record<ResultAction, ImageActionId>> = {
  edit: "edit",
  variation: "createVariation",
  video: "sendToVideo",
  shop: "shop",
  download: "download",
  more: "more",
};

function spec(id: ResultAction): { icon: string; label: string; tooltip: string } {
  const canon = CANON[id];
  if (canon) {
    const a = IMAGE_ACTIONS[canon];
    return { icon: a.icon, label: a.label, tooltip: a.tooltip };
  }
  const local: Record<string, { icon: string; label: string; tooltip: string }> = {
    upscale: { icon: "sparkles", label: "Upscale", tooltip: "Upscale This Image" },
    estimate: { icon: "calculator", label: "Estimate", tooltip: "Estimate This Design" },
  };
  return local[id] || { icon: "circle", label: id, tooltip: id };
}

const BAR: { id: ResultAction; icon: string; label: string }[] = (
  [
    "edit",
    "variation",
    "video",
    "upscale",
    "shop",
    "estimate",
    "download",
    "more",
  ] as ResultAction[]
).map((id) => ({ id, icon: spec(id).icon, label: spec(id).label }));

const esc = (s: unknown) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

function icons() {
  try {
    createIcons({ icons: lucideIcons });
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
          Esc(spec(b.id).tooltip) +
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
  /* One canonical handoff: publish the selection, then open the builder. */
  const r = startVideoBuilder({
    origin: ctx.origin === "studio" ? "canvas" : "media",
    propertyId: ctx.propertyId || null,
    propertyAddress: ctx.propertyAddress || null,
    assets: [
      {
        storagePath: ctx.path || "",
        fileName: ctx.room || "Design",
        roomName: ctx.room || null,
        versionId: ctx.id || null,
        propertyId: ctx.propertyId || null,
        sourceType: "generated-version",
      },
    ],
  });
  if (!r.ok) toast(r.reason);
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
  /* The user clicked Edit, so this navigation is intentional. */
  go("studio");
}

/** Pixel retouching on the result. The stored render is never written over. */
async function retouchPhoto(ctx: ResultContext) {
  const src = ctx.path || ctx.src;
  if (!src) return toast("Save This Design Before Retouching It.");
  const { openPhotoEditor } = await import("@/lib/photo-editor");
  await openPhotoEditor({
    editorMode: "generated",
    photos: [
      {
        key: ctx.id || ctx.path || ctx.src,
        name: ctx.room || "Design",
        room: ctx.room || "Design",
        property: ctx.propertyAddress || "",
        path: ctx.path || "",
        storagePath: ctx.path || "",
        src: ctx.src,
        assetId: ctx.id || ctx.path || ctx.src,
        assetType: "generated_image",
        propertyId: (ctx as any).propertyId || undefined,
        roomId: (ctx as any).roomId || undefined,
        versionId: (ctx as any).versionId || undefined,
        versionNumber: (ctx as any).versionNumber,
        editorMode: "generated",
      },
    ],
    startKey: ctx.id || ctx.path || ctx.src,
  });
}

async function restoreOriginalPhoto(ctx: ResultContext) {
  const key = ctx.id || ctx.path || ctx.src;
  if (!key) return toast("There Is Nothing To Restore Yet.");
  try {
    const { resetPhotoEdit } = await import("@/lib/photo-edits.functions");
    await resetPhotoEdit({ data: { asset_key: key } });
    toast("Original Restored. Reopen The Image To See It.");
  } catch (err: any) {
    toast(err?.message || "That Image Could Not Be Restored.");
  }
}


function moreMenu(anchor: HTMLElement, ctx: ResultContext) {
  const items: PopItem[] = [
    {
      icon: "sliders-horizontal",
      label: "Retouch Photo",
      fn: () => void retouchPhoto(ctx),
    },
    {
      icon: "rotate-ccw",
      label: "Restore Original",
      fn: () => void restoreOriginalPhoto(ctx),
    },
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
  /* Diagnostics: which action ran, from which surface, against which record. */
  const canon = CANON[action];
  if (canon)
    recordImageAction(canon, ctx.origin === "media" ? "media-card" : "canvas", {
      propertyId: ctx.propertyId ?? null,
      roomId: ctx.id ?? null,
      resultPath: ctx.path ?? null,
    });
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
  if (action === "download") {
    /* Every download leaves through the shared Disclosure & Watermark sheet. */
    void import("@/lib/disclosure-export").then((m) =>
      m.openDisclosureExport({
        items: [
          {
            id: ctx.id || ctx.path || "design",
            name: [ctx.propertyAddress, ctx.room].filter(Boolean).join(" ") || "design",
            src: ctx.src,
            operations: ctx.operations?.length
              ? ctx.operations
              : ctx.origin === "media"
                ? []
                : ["redesign"],
            assetId: ctx.path || ctx.id || null,
            versionId: ctx.versionId ?? null,
          },
        ],
        purpose: "listing",
        scope: "current-photo",
        title: "Download Design",
      }),
    );
    return;
  }
  if (action === "upscale") {
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

/** Editing actions live behind one button, never on top of the image. */
const EDIT_MENU: ResultAction[] = ["edit", "variation", "video", "upscale", "shop", "estimate"];

/**
 * Studio result actions.
 *
 * The image itself stays clean: no permanent toolbar covers the design. Every
 * editing action lives in one "Edit" button in the action row below the canvas,
 * which opens a popover with the same workflows in the same order.
 */
export function mountStudioResultActions() {
  const stage = document.getElementById("rdwStage");
  if (!stage || (stage as any).__rda) return;
  (stage as any).__rda = true;

  const mountBtn = (): HTMLElement | null => {
    const row = document.querySelector<HTMLElement>(".rdw-resbar");
    if (!row) return null;
    let b = row.querySelector<HTMLElement>('[data-rda="editmenu"]');
    if (!b) {
      b = document.createElement("button");
      b.setAttribute("type", "button");
      b.className = "btn btn-ghost btn-sm";
      b.dataset["rda"] = "editmenu";
      b.innerHTML = '<i data-lucide="pencil"></i>Edit';
      row.insertBefore(b, row.firstChild);
      b.addEventListener("click", (e) => {
        e.preventDefault();
        const ctx = studioContext();
        if (!ctx) return;
        pop(
          b as HTMLElement,
          BAR.filter((x) => EDIT_MENU.includes(x.id)).map((x) => ({
            icon: x.icon,
            label: x.label,
            fn: () => runResultAction(x.id, ctx, b as HTMLElement),
          })),
        );
      });
      icons();
    }
    return b;
  };

  const sync = () => {
    const ctx = studioContext();
    const busy = document.getElementById("cGen")?.classList.contains("on");
    const b = mountBtn();
    if (b) b.hidden = !ctx || !!busy;
    icons();
  };

  const after = document.getElementById("cAfter");
  const gen = document.getElementById("cGen");
  const obs = new MutationObserver(() => sync());
  if (after) obs.observe(after, { childList: true, subtree: true });
  if (gen) obs.observe(gen, { attributes: true, attributeFilter: ["class"] });
  document.getElementById("vars")?.addEventListener("click", () => setTimeout(sync, 0));
  window.addEventListener("rd:saved", sync);
  sync();
}

