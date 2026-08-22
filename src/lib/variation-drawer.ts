/**
 * Create Variation: branch a new version from a generated design.
 *
 * The selected design is the source, never the original upload. Room, style,
 * space and property context are carried over, so the fast path is one click,
 * an optional sentence, and one more click.
 */

export type VariationSource = {
  src: string;
  path?: string | null;
  id?: string | null;
  room?: string | null;
  style?: string | null;
  propertyId?: string | null;
  sourceSrc?: string | null;
};

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
    (window as any).rdToast?.(msg);
  } catch (_) {
    /* a missing toast never blocks the flow */
  }
}

/** Shortcuts that shape the prompt. None of them are required. */
const QUICK: { id: string; label: string; prompt: string; primary?: boolean }[] = [
  { primary: true, id: "similar", label: "Keep It Similar", prompt: "Keep the overall look and make a fresh take on it." },
  { primary: true, id: "style", label: "Change Style", prompt: "Shift the design language to a clearly different style." },
  { primary: true, id: "colors", label: "Change Colors", prompt: "Use a different colour palette." },
  { primary: true, id: "materials", label: "Change Materials", prompt: "Swap the main materials and finishes." },
  { primary: true, id: "furniture", label: "Change Furniture", prompt: "Replace the furniture with different pieces." },
  { id: "luxury", label: "More Luxury", prompt: "Make it feel more high end and luxurious." },
  { id: "affordable", label: "More Affordable", prompt: "Use more affordable, budget friendly finishes." },
  { id: "minimal", label: "More Minimal", prompt: "Simplify and declutter the design." },
  { id: "dramatic", label: "More Dramatic", prompt: "Make it bolder and more dramatic." },
  { id: "surprise", label: "Surprise Me", prompt: "Take a creative, unexpected direction." },
];

const STRENGTH: { id: string; label: string; intensity: string; prompt: string }[] = [
  {
    id: "subtle",
    label: "Subtle",
    intensity: "Refresh",
    prompt: "Preserve most of the current design and make modest changes.",
  },
  {
    id: "balanced",
    label: "Balanced",
    intensity: "Makeover",
    prompt: "Preserve the overall design direction but allow noticeable changes.",
  },
  {
    id: "major",
    label: "Major",
    intensity: "Full Redesign",
    prompt: "Use the current design as inspiration while allowing a substantially different result.",
  },
];

const LOCKS = [
  "Layout",
  "Flooring",
  "Cabinets",
  "Countertops",
  "Walls",
  "Lighting",
  "Furniture Placement",
  "Windows & Doors",
  "Structural Elements",
];

function currentStyleName(fallback?: string | null) {
  try {
    const s = (window as any).__rdCanvasState?.();
    if (s?.selectedStyleName) return s.selectedStyleName as string;
  } catch (_) {
    /* fall through to the passed context */
  }
  const sel = document.getElementById("fStyle") as HTMLSelectElement | null;
  return fallback || sel?.value || "Current Style";
}

let openEl: HTMLElement | null = null;

export function closeVariationDrawer() {
  openEl?.remove();
  openEl = null;
}

/** Open the compact right-side drawer for one generated design. */
export function openVariationDrawer(ctx: VariationSource) {
  if (!ctx?.src) {
    toast("Generate A Design First.");
    return;
  }
  closeVariationDrawer();

  const session = (() => {
    try {
      return (window as any).rdSessionVersion?.(ctx.src) || null;
    } catch (_) {
      return null;
    }
  })();

  const room = ctx.room || session?.room || "";
  let styleName = currentStyleName(ctx.style);
  const picked = new Set<string>();
  const locked = new Set<string>();
  let strength = "balanced";

  const el = document.createElement("div");
  el.className = "rdvar-wrap";
  el.innerHTML =
    '<div class="rdvar-scrim" data-vx="close"></div>' +
    '<aside class="rdvar" role="dialog" aria-label="Create Variation">' +
    '<header class="rdvar-h"><div><b>Create Variation</b><span>Build A New Version From This Design.</span></div>' +
    '<button type="button" class="rdvar-x" data-vx="close" aria-label="Close"><i data-lucide="x"></i></button></header>' +
    '<div class="rdvar-b">' +
    '<div class="rdvar-prev"><img src="' +
    esc(ctx.src) +
    '" alt="Selected design"><span>' +
    esc([room, styleName].filter(Boolean).join(" \u00b7 ")) +
    "</span></div>" +
    '<section class="rdvar-s"><label>Quick Changes</label><div class="rdvar-chips" data-q>' +
    QUICK.filter((q) => q.primary)
      .map(
        (q) =>
          '<button type="button" class="rdvar-chip" data-q="' + q.id + '">' + esc(q.label) + "</button>",
      )
      .join("") +
    "</div>" +
    '<details class="rdvar-more"><summary>More Ideas</summary><div class="rdvar-chips" data-q>' +
    QUICK.filter((q) => !q.primary)
      .map(
        (q) =>
          '<button type="button" class="rdvar-chip" data-q="' + q.id + '">' + esc(q.label) + "</button>",
      )
      .join("") +
    "</div></details></section>" +
    '<section class="rdvar-s"><label>Describe Changes <span class="rdvar-opt">Optional</span></label>' +
    '<textarea data-note-in rows="4" placeholder="Make the cabinets lighter, use warmer flooring, and simplify the furniture..."></textarea></section>' +
    '<section class="rdvar-s"><label>Design Style</label>' +
    '<div class="rdvar-style"><b data-style>' +
    esc(styleName) +
    '</b><button type="button" class="rdvar-link" data-vx="style">Change</button></div></section>' +
    '<section class="rdvar-s"><label>How Different?</label><div class="rdvar-seg" data-seg>' +
    STRENGTH.map(
      (s) =>
        '<button type="button" class="rdvar-sb' +
        (s.id === strength ? " on" : "") +
        '" data-s="' +
        s.id +
        '">' +
        esc(s.label) +
        "</button>",
    ).join("") +
    '</div><em class="rdvar-note" data-note>' +
    esc(STRENGTH[1]!.prompt) +
    "</em></section>" +
    '<section class="rdvar-s"><details class="rdvar-more"><summary>Preserve <span class="rdvar-opt">Optional</span></summary>' +
    '<div class="rdvar-chips" data-l>' +
    LOCKS.map(
      (l) => '<button type="button" class="rdvar-chip" data-l="' + esc(l) + '">' + esc(l) + "</button>",
    ).join("") +
    "</div></details></section>" +

    "</div>" +
    '<footer class="rdvar-f"><button type="button" class="btn ghost" data-vx="close">Cancel</button>' +
    '<button type="button" class="btn primary" data-vx="go"><i data-lucide="git-branch"></i>Create Variation \u00b7 1 Credit</button></footer>' +
    "</aside>";
  document.body.appendChild(el);
  openEl = el;
  icons();

  const noteEl = el.querySelector<HTMLElement>("[data-note]");
  const styleEl = el.querySelector<HTMLElement>("[data-style]");

  el.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const q = t.closest<HTMLElement>("[data-q]");
    if (q && q.dataset["q"]) {
      const id = q.dataset["q"]!;
      if (picked.has(id)) picked.delete(id);
      else picked.add(id);
      q.classList.toggle("on", picked.has(id));
      return;
    }
    const l = t.closest<HTMLElement>("[data-l]");
    if (l && l.dataset["l"]) {
      const id = l.dataset["l"]!;
      if (locked.has(id)) locked.delete(id);
      else locked.add(id);
      l.classList.toggle("on", locked.has(id));
      return;
    }
    const s = t.closest<HTMLElement>("[data-s]");
    if (s && s.dataset["s"]) {
      strength = s.dataset["s"]!;
      el.querySelectorAll("[data-s]").forEach((b) => b.classList.remove("on"));
      s.classList.add("on");
      if (noteEl) noteEl.textContent = STRENGTH.find((x) => x.id === strength)?.prompt || "";
      return;
    }
    const act = t.closest<HTMLElement>("[data-vx]")?.dataset["vx"];
    if (act === "close") return closeVariationDrawer();
    if (act === "style") {
      try {
        (window as any).__rdCanvasStyle?.open?.();
      } catch (_) {
        toast("Open Studio To Change The Style.");
      }
      setTimeout(() => {
        styleName = currentStyleName(styleName);
        if (styleEl) styleEl.textContent = styleName;
      }, 600);
      return;
    }
    if (act === "go") {
      const extra =
        (el.querySelector("[data-note-in]") as HTMLTextAreaElement | null)?.value?.trim() || "";
      submit(extra);
    }
  });

  function submit(extra: string) {
    const st = STRENGTH.find((x) => x.id === strength) || STRENGTH[1]!;
    const parts = [
      "Create a variation of this existing design.",
      st.prompt,
      ...QUICK.filter((q) => picked.has(q.id)).map((q) => q.prompt),
      locked.size ? "Keep unchanged: " + Array.from(locked).join(", ") + "." : "",
      /* Room geometry stays put unless the user explicitly asked otherwise. */
      picked.has("surprise") || locked.has("Structural Elements")
        ? ""
        : "Preserve the room geometry and structure.",
      extra,
    ].filter(Boolean);

    (window as any).__rdPendingVariation = {
      src: ctx.src,
      parentPath: ctx.path || session?.path || null,
      parentSrc: ctx.src,
      parentAt: session?.at || null,
      parentVersionId: ctx.id || null,
      propertyId: ctx.propertyId || null,
      room,
      styleName,
      strength: st.label,
      intensity: st.intensity,
      keep: Array.from(locked),
      prompt: parts.join(" "),
      originalSrc: ctx.sourceSrc || null,
    };

    closeVariationDrawer();
    const btn = document.getElementById("genBtn") as HTMLButtonElement | null;
    if (!btn || btn.disabled) {
      (window as any).__rdPendingVariation = null;
      toast("Open This Design In Studio To Create A Variation.");
      return;
    }
    btn.click();
  }
}
