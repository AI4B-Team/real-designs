/**
 * Never render an empty page.
 *
 * Every tool, panel and route in REAL DESIGNS resolves to one of these
 * states. A blank content area is treated as a bug: when there is nothing to
 * show, the surface explains why and offers the way forward.
 */

export type SurfaceState =
  | "loading"
  | "ready"
  | "empty"
  | "needs-context"
  | "unavailable"
  | "coming-soon"
  | "error";

export type SurfaceCopy = {
  icon: string;
  title: string;
  body: string;
  actions: Array<{ id: string; label: string; primary?: boolean }>;
};

const esc = (s: unknown) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

/** Default copy per state; callers may override any field. */
export function surfaceCopy(state: SurfaceState, subject = "This Tool"): SurfaceCopy {
  switch (state) {
    case "empty":
      return {
        icon: "image-plus",
        title: "Nothing Here Yet",
        body: `${subject} has no items yet. Add a photo to get started.`,
        actions: [{ id: "add", label: "Add Photos", primary: true }],
      };
    case "needs-context":
      return {
        icon: "image",
        title: "Choose A Photo First",
        body: `${subject} works on a specific photo. Pick one to continue.`,
        actions: [{ id: "pick", label: "Choose A Photo", primary: true }],
      };
    case "unavailable":
      return {
        icon: "circle-slash",
        title: "Not Available For This Photo",
        body: `${subject} does not apply to this space type.`,
        actions: [{ id: "back", label: "Back To Tools" }],
      };
    case "coming-soon":
      return {
        icon: "clock",
        title: "Coming Soon",
        body: `${subject} is not available yet. Nothing is charged and nothing is estimated until it ships.`,
        actions: [{ id: "notify", label: "Notify Me", primary: true }],
      };
    case "error":
      return {
        icon: "alert-triangle",
        title: "Something Went Wrong",
        body: `${subject} could not be loaded. This is recoverable.`,
        actions: [
          { id: "retry", label: "Retry", primary: true },
          { id: "back", label: "Go Back" },
        ],
      };
    default:
      return { icon: "loader", title: "Loading", body: "", actions: [] };
  }
}

/** Structured skeleton: layout-shaped placeholders, never a blank area. */
export function skeletonHtml(rows = 3): string {
  return (
    '<div class="rd-skel" aria-busy="true">' +
    Array.from({ length: Math.max(1, rows) })
      .map(() => '<div class="rd-skel-row"></div>')
      .join("") +
    "</div>"
  );
}

export function stateHtml(state: SurfaceState, subject?: string, over?: Partial<SurfaceCopy>): string {
  if (state === "loading") return skeletonHtml();
  const c = { ...surfaceCopy(state, subject), ...(over || {}) };
  return (
    '<div class="rd-state" data-state="' +
    esc(state) +
    '"><i data-lucide="' +
    esc(c.icon) +
    '"></i><h4>' +
    esc(c.title) +
    "</h4><p>" +
    esc(c.body) +
    "</p>" +
    (c.actions.length
      ? '<div class="rd-state-a">' +
        c.actions
          .map(
            (a) =>
              '<button type="button" class="btn ' +
              (a.primary ? "btn-primary" : "btn-ghost") +
              ' btn-sm" data-state-action="' +
              esc(a.id) +
              '">' +
              esc(a.label) +
              "</button>",
          )
          .join("") +
        "</div>"
      : "") +
    "</div>"
  );
}

/** Guard: fill any surface that resolved to nothing. */
export function ensureNotEmpty(host: HTMLElement | null, state: SurfaceState = "empty", subject?: string) {
  if (!host) return;
  if (host.textContent && host.textContent.trim()) return;
  host.innerHTML = stateHtml(state, subject);
  try {
    (window as any).lucide?.createIcons({});
  } catch (_) {
    /* icons are cosmetic */
  }
}
