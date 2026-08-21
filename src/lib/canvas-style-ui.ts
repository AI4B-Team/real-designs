/**
 * Canvas style selection UI: the Setup panel section plus the Browse Styles
 * modal. Reads the shared catalog so Explore, the bulk Design Photos modal and
 * the Canvas all offer the same styles, and writes through canvas-style.ts so
 * the choice survives reloads at the right scope.
 */

import {
  STYLES,
  STYLE_CATEGORIES,
  recommendStyles,
  styleById,
  type StyleRecord,
} from "@/lib/style-catalog";
import {
  applyToPhotos,
  browserSubtitle,
  browserTitle,
  clearDirection,
  directionCompatible,
  loadDirections,
  propertyDirection,
  resolveDirection,
  saveDirections,
  scopeLabel,
  searchStyles,
  sectionTitle,
  setDirection,
  styleNeedForTool,
  styleRequiredPlan,
  stylesForNeed,
  type DirectionContext,
  type ResolvedDirection,
  type StyleNeed,
} from "@/lib/canvas-style";

export type CanvasStyleContext = {
  tool: string;
  projectType: string;
  room?: string | null;
  draftId?: string | null;
  photoKey?: string | null;
  photoLabel?: string | null;
  propertyId?: string | null;
  propertyLabel?: string | null;
  /** Every photo in the current project, for "Apply To All Photos". */
  photoKeys?: string[];
};

export type CanvasStyleApi = {
  refresh: () => void;
  /** Selected style for the active tool, or null when none is chosen. */
  selection: () => (ResolvedDirection & { style: StyleRecord }) | null;
  /** Null when the active tool needs no style. */
  need: () => StyleNeed | null;
  open: () => void;
};

const esc = (s: unknown): string =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) =>
      (
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }) as Record<
          string,
          string
        >
      )[c] as string,
  );

function icons(root?: Element | null) {
  try {
    (window as any).lucide?.createIcons({
      attrs: {},
      ...(root ? { nameAttr: "data-lucide" } : {}),
    });
  } catch (_) {
    /* icons are cosmetic */
  }
}

/* ------------------------------------------------------------------ */
/* quick picks                                                         */
/* ------------------------------------------------------------------ */

/** Popular styles offered inline in the Setup panel, in priority order. */
export const QUICK_STYLE_IDS = [
  "modern",
  "contemporary",
  "transitional",
  "scandinavian",
  "mid-century-modern",
  "minimalist",
  "industrial",
  "modern-farmhouse",
  "coastal",
  "mediterranean",
  "traditional",
  "modern-luxury",
  "japandi",
  "bohemian",
  "art-deco",
  "rustic",
];

/**
 * The four popular styles shown as image cards inside the Setup
 * panel. Only styles the current space actually supports are offered, and the
 * active selection is always included so it can never scroll out of reach.
 */
export function quickStyles(pool: StyleRecord[], selectedId?: string | null, max = 4): StyleRecord[] {
  const byId = new Map(pool.map((s) => [s.id, s]));
  const out: StyleRecord[] = [];
  const sel = selectedId ? byId.get(selectedId) : null;
  if (sel) out.push(sel);
  for (const id of QUICK_STYLE_IDS) {
    if (out.length >= max) break;
    const rec = byId.get(id);
    if (rec && !out.some((s) => s.id === rec.id)) out.push(rec);
  }
  for (const rec of pool) {
    if (out.length >= max) break;
    if (!out.some((s) => s.id === rec.id)) out.push(rec);
  }
  return out;
}

function quickGrid(pool: StyleRecord[], selectedId: string | null): string {
  const list = quickStyles(pool, selectedId);
  if (!list.length) return "";
  return (
    '<div class="cs-quick" role="listbox" aria-label="Design Styles">' +
    list
      .map((s) => {
        const plan = styleRequiredPlan(s);
        const on = s.id === selectedId;
        return (
          '<button type="button" class="cs-qtile' +
          (on ? " on" : "") +
          '" role="option" aria-selected="' +
          (on ? "true" : "false") +
          '" data-quick="' +
          esc(s.id) +
          '" title="' +
          esc(s.displayName) +
          '">' +
          '<span class="cs-qth">' +
          (s.previewImage
            ? '<img loading="lazy" src="' +
              esc(s.previewImage) +
              '" alt="' +
              esc(s.displayName) +
              ' example">'
            : "") +
          (on ? '<span class="cs-qtick"><i data-lucide="check"></i></span>' : "") +
          (plan ? '<span class="cs-qlock"><i data-lucide="lock"></i>' + esc(plan) + "</span>" : "") +
          "</span>" +
          '<span class="cs-qn">' +
          esc(s.displayName) +
          "</span>" +
          "</button>"
        );
      })
      .join("") +
    "</div>" +
    '<button class="btn btn-ghost btn-sm cs-browse" type="button"><i data-lucide="layout-grid"></i>View All Styles</button>'
  );
}

function ctxFor(need: StyleNeed, c: CanvasStyleContext): DirectionContext {

  return {
    need,
    draftId: c.draftId ?? null,
    photoKey: c.photoKey ?? null,
    propertyId: c.propertyId ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* browse modal                                                        */
/* ------------------------------------------------------------------ */

type BrowseOpts = {
  need: StyleNeed;
  ctx: CanvasStyleContext;
  currentId: string;
  onPick: (styleId: string, applyAll: boolean) => void;
};

function openBrowser(o: BrowseOpts) {
  const host = (document.querySelector(".rd-app") || document.body) as HTMLElement;
  let m = document.getElementById("csBrowse") as HTMLElement | null;
  if (m) m.remove();
  m = document.createElement("div");
  m.id = "csBrowse";
  m.className = "up-modal cs-modal on";

  const pool = stylesForNeed(STYLES, o.need, o.ctx.projectType);
  const recs = recommendStyles(
    {
      projectType: (o.need === "stage" ? "virtual-staging" : o.ctx.projectType) as any,
      ...(o.ctx.room ? { roomType: o.ctx.room } : {}),
    },
    4,
  )
    .map((r) => r.style)
    .filter((s) => pool.some((p) => p.id === s.id));

  let picked = o.currentId || "";
  let applyAll = false;
  let query = "";
  let category = "All";
  const canApplyAll = (o.ctx.photoKeys || []).length > 1;

  const cats = ["All", "Recommended"].concat(
    STYLE_CATEGORIES.filter((c) => pool.some((s) => s.category === c)),
  );

  m.innerHTML =
    '<div class="up-scrim" data-close></div>' +
    '<div class="up-card cs-card" role="dialog" aria-modal="true" aria-labelledby="csTitle">' +
    '<div class="cs-head">' +
    '<div><h3 id="csTitle">' +
    esc(browserTitle(o.need, o.ctx.projectType)) +
    "</h3>" +
    "<p>" +
    esc(browserSubtitle(o.need, o.ctx.room, o.ctx.projectType)) +
    "</p></div>" +
    '<button class="icon-btn" data-close aria-label="Close"><i data-lucide="x"></i></button>' +
    "</div>" +
    '<div class="cs-filters">' +
    '<div class="cs-search"><i data-lucide="search"></i>' +
    '<input id="csQ" type="search" placeholder="Search Styles" aria-label="Search Styles"></div>' +
    '<div class="cs-cats" id="csCats">' +
    cats
      .map(
        (c, i) =>
          '<button class="chip' +
          (i === 0 ? " on" : "") +
          '" data-cat="' +
          esc(c) +
          '">' +
          esc(c) +
          "</button>",
      )
      .join("") +
    "</div>" +
    "</div>" +
    '<div class="cs-grid" id="csGrid" role="listbox" aria-label="Styles"></div>' +
    '<div class="cs-foot">' +
    (canApplyAll
      ? '<label class="cs-all"><input type="checkbox" id="csAll"><span>Apply To All Photos In This Project</span></label>'
      : '<span class="cs-foot-note" id="csNote"></span>') +
    '<div class="cs-foot-act">' +
    '<button class="btn btn-dark" data-close>Cancel</button>' +
    '<button class="btn btn-primary" id="csUse" disabled>Use This Style</button>' +
    "</div>" +
    "</div>" +
    "</div>";
  host.appendChild(m);

  const grid = m.querySelector("#csGrid") as HTMLElement;
  const useBtn = m.querySelector("#csUse") as HTMLButtonElement;

  function visible(): StyleRecord[] {
    let list = category === "Recommended" ? recs : pool;
    if (category !== "All" && category !== "Recommended")
      list = pool.filter((s) => s.category === category);
    return searchStyles(list, query);
  }

  function paint() {
    const list = visible();
    if (!list.length) {
      grid.innerHTML =
        '<div class="cs-empty">No styles match that search. Try a different word or clear the filters.</div>';
      return;
    }
    grid.innerHTML = list
      .map((s) => {
        const plan = styleRequiredPlan(s);
        const on = s.id === picked;
        return (
          '<button class="cs-tile' +
          (on ? " on" : "") +
          '" role="option" aria-selected="' +
          (on ? "true" : "false") +
          '" data-style="' +
          esc(s.id) +
          '" title="' +
          esc(s.displayName) +
          '">' +
          '<span class="cs-th">' +
          (s.previewImage
            ? '<img loading="lazy" src="' +
              esc(s.previewImage) +
              '" alt="' +
              esc(s.displayName) +
              ' example">'
            : "") +
          (on ? '<span class="cs-tick"><i data-lucide="check"></i></span>' : "") +
          (plan ? '<span class="cs-lock"><i data-lucide="lock"></i>' + esc(plan) + "</span>" : "") +
          "</span>" +
          '<span class="cs-tn">' +
          esc(s.displayName) +
          "</span>" +
          '<span class="cs-td">' +
          esc(s.shortDescription) +
          "</span>" +
          "</button>"
        );
      })
      .join("");
    icons(grid);
    const rec = styleById(picked);
    useBtn.disabled = !rec;
    useBtn.textContent = rec ? "Use " + rec.displayName : "Use This Style";
  }

  paint();
  icons(m);

  const close = () => {
    m?.remove();
    document.removeEventListener("keydown", onKey);
  };
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    if (
      e.key === "Enter" &&
      picked &&
      document.activeElement &&
      (document.activeElement as HTMLElement).closest(".cs-tile")
    ) {
      e.preventDefault();
      useBtn.click();
    }
  }
  document.addEventListener("keydown", onKey);

  m.addEventListener("click", (e: any) => {
    const t = e.target as HTMLElement;
    if (t.closest("[data-close]")) {
      close();
      return;
    }
    const cat = t.closest("[data-cat]") as HTMLElement | null;
    if (cat) {
      category = cat.dataset["cat"] || "All";
      m!.querySelectorAll("#csCats .chip").forEach((c) => c.classList.toggle("on", c === cat));
      paint();
      return;
    }
    const tile = t.closest("[data-style]") as HTMLElement | null;
    if (tile) {
      picked = tile.dataset["style"] || "";
      paint();
      return;
    }
    if (t.closest("#csUse")) {
      if (!picked) return;
      o.onPick(picked, applyAll);
      close();
    }
  });
  const q = m.querySelector("#csQ") as HTMLInputElement | null;
  q?.addEventListener("input", () => {
    query = q.value;
    paint();
  });
  const all = m.querySelector("#csAll") as HTMLInputElement | null;
  all?.addEventListener("change", () => {
    applyAll = !!all.checked;
  });
  setTimeout(() => {
    try {
      const tile = m!.querySelector(".cs-tile.on") as HTMLElement | null;
      if (tile) tile.focus();
      else q?.focus();
    } catch (_) {
      /* focus is best effort */
    }
  }, 30);
}

/**
 * The same visual style browser, opened from outside the Canvas (the bulk
 * Design Photos modal), filtered to the space that needs a direction. Never a
 * second, plainer picker: one browser, one catalog.
 */
export function openStyleBrowser(o: {
  projectType: string;
  room?: string | null;
  currentId?: string;
  onPick: (styleId: string) => void;
}) {
  openBrowser({
    need: "design",
    ctx: { tool: "design", projectType: o.projectType, room: o.room ?? null },
    currentId: o.currentId || "",
    onPick: (styleId) => o.onPick(styleId),
  });
}

/* ------------------------------------------------------------------ */
/* setup panel section                                                 */
/* ------------------------------------------------------------------ */

export function mountCanvasStyle(
  mountId: string,
  getContext: () => CanvasStyleContext,
  onChange?: (sel: (ResolvedDirection & { style: StyleRecord }) | null) => void,
): CanvasStyleApi {
  let store = loadDirections();

  const host = () => document.getElementById(mountId);

  const needNow = (): StyleNeed | null => styleNeedForTool(getContext().tool);

  function selection(): (ResolvedDirection & { style: StyleRecord }) | null {
    const need = needNow();
    if (!need) return null;
    const hit = resolveDirection(store, ctxFor(need, getContext()));
    if (!hit) return null;
    const style = styleById(hit.styleId);
    return style ? { ...hit, style } : null;
  }

  let expanded = false;

  function paint() {
    const el = host();
    if (!el) return;
    const c = getContext();
    const need = needNow();
    if (!need) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    el.hidden = false;

    /* A selection only survives a space change while the catalog still says it
       fits: an interior staging style is not offered on an exterior photo. */
    const raw = selection();
    /* Only drop the selection when the catalog can actually offer a
       compatible replacement — otherwise the browser falls back to the full
       list and the user could never keep any choice. */
    const hasCompatible = stylesForNeed(STYLES, need, c.projectType).some((s) =>
      directionCompatible(s, need, c.projectType),
    );
    if (raw && hasCompatible && !directionCompatible(raw.style, need, c.projectType)) {
      const dctx = ctxFor(need, c);
      store = clearDirection(store, "photo", dctx);
      store = clearDirection(store, "project", dctx);
      saveDirections(store);
    }
    const sel = selection();
    const propId = propertyDirection(store, ctxFor(need, c));
    const propRec = propId ? styleById(propId) : null;
    const title = sectionTitle(need, c.projectType);

    const pool = stylesForNeed(STYLES, need, c.projectType);

    if (!sel) {
      el.innerHTML =
        '<div class="cs-sec cs-empty-state">' +
        '<div class="cs-sec-h"><label>' +
        esc(title) +
        "</label></div>" +

        quickGrid(pool, null) +
        (propRec
          ? '<button class="btn btn-ghost btn-sm cs-useprop" type="button"><i data-lucide="dna"></i>Use Property Direction &middot; ' +
            esc(propRec.displayName) +
            "</button>"
          : "") +
        "</div>";
      icons(el);
      onChange?.(null);
      return;
    }

    const s = sel.style;
    if (!expanded) {
      /* Once a style is chosen the section collapses to a summary card: the
         full grid only comes back when the user asks to change it. */
      el.innerHTML =
        '<div class="cs-sec cs-done">' +
        '<div class="cs-sec-h"><label>' +
        esc(title) +
        '</label><span class="cs-scope">' +
        esc(scopeLabel(sel.scope)) +
        "</span></div>" +
        '<div class="cs-picked">' +
        '<span class="cs-picked-th">' +
        (s.previewImage
          ? '<img src="' + esc(s.previewImage) + '" alt="' + esc(s.displayName) + ' example">'
          : "") +
        "</span>" +
        '<span class="cs-picked-t"><b>' +
        esc(s.displayName) +
        "</b><em>" +
        esc(s.shortDescription) +
        "</em></span>" +
        '<button class="fb-link cs-change" type="button">Change</button>' +
        "</div>" +
        "</div>";
      icons(el);
      onChange?.(sel);
      return;
    }
    el.innerHTML =
      '<div class="cs-sec">' +
      '<div class="cs-sec-h"><label>' +
      esc(title) +
      '</label><span class="cs-scope">' +
      esc(scopeLabel(sel.scope)) +
      "</span></div>" +
      '<div class="cs-picked">' +
      '<span class="cs-picked-th">' +
      (s.previewImage
        ? '<img src="' + esc(s.previewImage) + '" alt="' + esc(s.displayName) + ' example">'
        : "") +
      "</span>" +
      '<span class="cs-picked-t"><b>' +
      esc(s.displayName) +
      "</b><em>" +
      esc(s.shortDescription) +
      "</em></span>" +
      "</div>" +
      quickGrid(pool, s.id) +
      '<div class="cs-picked-act">' +
      '<button class="fb-link cs-clear" type="button">Clear</button>' +
      "</div>" +
      (sel.scope !== "photo" && c.photoKey
        ? '<p class="cs-inherit">Inherited from ' +
          esc(scopeLabel(sel.scope)) +
          ". Choosing a different style here only changes this photo.</p>"
        : "") +
      "</div>";

    icons(el);
    onChange?.(sel);
  }

  function pick(styleId: string, applyAll: boolean) {
    const need = needNow();
    if (!need) return;
    const c = getContext();
    const dctx = ctxFor(need, c);
    if (applyAll && (c.photoKeys || []).length) {
      store = applyToPhotos(store, need, c.draftId ?? null, c.photoKeys || [], styleId);
      store = setDirection(store, "project", dctx, styleId);
    } else if (c.photoKey) {
      store = setDirection(store, "photo", dctx, styleId);
    } else {
      store = setDirection(store, "project", dctx, styleId);
    }
    saveDirections(store);
    expanded = false;
    paint();
    try {
      window.dispatchEvent(new CustomEvent("rd:canvas-style", { detail: { need, styleId } }));
    } catch (_) {
      /* event is advisory */
    }
  }

  function open() {
    const need = needNow();
    if (!need) return;
    const c = getContext();
    openBrowser({ need, ctx: c, currentId: selection()?.styleId || "", onPick: pick });
  }

  document.addEventListener("click", (e: any) => {
    const el = host();
    if (!el || el.hidden) return;
    const t = e.target as HTMLElement;
    if (!t || !t.closest || !el.contains(t)) return;
    const quick = t.closest("[data-quick]") as HTMLElement | null;
    if (quick) {
      e.preventDefault();
      pick(quick.dataset["quick"] || "", false);
      return;
    }
    if (t.closest(".cs-change")) {
      e.preventDefault();
      expanded = true;
      paint();
      return;
    }
    if (t.closest(".cs-browse")) {
      e.preventDefault();
      open();
      return;
    }

    if (t.closest(".cs-useprop")) {
      e.preventDefault();
      const need = needNow();
      if (need) pick(propertyDirection(store, ctxFor(need, getContext())), false);
      return;
    }
    if (t.closest(".cs-clear")) {
      e.preventDefault();
      const need = needNow();
      if (!need) return;
      const dctx = ctxFor(need, getContext());
      store = clearDirection(store, "photo", dctx);
      store = clearDirection(store, "project", dctx);
      saveDirections(store);
      expanded = true;
      paint();
    }
  });

  paint();
  return { refresh: paint, selection, need: needNow, open };
}
