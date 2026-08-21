/**
 * The complete Room / Area library, in one focused modal.
 *
 * The panel only ever shows four popular choices inline; everything else
 * lives here where there is room for real preview images. The modal selects
 * nothing until Apply Selection is pressed, so Cancel always restores the
 * previous choice, and it never navigates, generates or charges.
 */
import { areaPreview, areasForSpace, type AreaOption, type CanvasSpace } from "@/lib/space-datasets";

const esc = (s: unknown) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

function icons() {
  try {
    (window as any).lucide?.createIcons({});
  } catch (_) {
    /* icons are cosmetic */
  }
}

export function areaModalTitle(space: CanvasSpace): string {
  if (space === "exterior") return "Choose An Exterior Area";
  if (space === "garden") return "Choose A Garden Area";
  return "Choose A Room";
}

export function openAreaPicker(o: {
  space: CanvasSpace;
  current?: string | null;
  onApply: (label: string) => void;
}) {
  const host = (document.querySelector(".rd-app") || document.body) as HTMLElement;
  document.getElementById("rmPick")?.remove();
  const list = areasForSpace(o.space);
  let picked = o.current || "";
  let query = "";

  const m = document.createElement("div");
  m.id = "rmPick";
  m.className = "up-modal cs-modal on";
  m.innerHTML =
    '<div class="up-scrim" data-close></div>' +
    '<div class="up-card cs-card" role="dialog" aria-modal="true" aria-labelledby="rmTitle">' +
    '<div class="cs-head"><div><h3 id="rmTitle">' +
    esc(areaModalTitle(o.space)) +
    "</h3><p>Pick the space this photo shows. Nothing is generated and no credits are used.</p></div>" +
    '<button class="icon-btn" data-close aria-label="Close"><i data-lucide="x"></i></button></div>' +
    '<div class="cs-filters"><div class="cs-search"><i data-lucide="search"></i>' +
    '<input id="rmQ" type="search" placeholder="Search" aria-label="Search Areas"></div></div>' +
    '<div class="cs-grid" id="rmGrid" role="listbox" aria-label="Areas"></div>' +
    '<div class="cs-foot"><span class="cs-foot-note" id="rmNote"></span>' +
    '<div class="cs-foot-act"><button class="btn btn-dark" data-close>Cancel</button>' +
    '<button class="btn btn-primary" id="rmUse" disabled>Apply Selection</button></div></div>' +
    "</div>";
  host.appendChild(m);

  const grid = m.querySelector("#rmGrid") as HTMLElement;
  const use = m.querySelector("#rmUse") as HTMLButtonElement;
  const note = m.querySelector("#rmNote") as HTMLElement;

  const visible = (): AreaOption[] => {
    const q = query.trim().toLowerCase();
    return q ? list.filter((a) => a.label.toLowerCase().includes(q)) : list;
  };

  function paint() {
    const items = visible();
    grid.innerHTML = items.length
      ? items
          .map((a) => {
            const img = areaPreview(a.id);
            return (
              '<button class="cs-tile' +
              (a.label === picked ? " on" : "") +
              '" role="option" aria-selected="' +
              (a.label === picked ? "true" : "false") +
              '" data-area="' +
              esc(a.label) +
              '"><span class="cs-th">' +
              (img
                ? '<img loading="lazy" src="' + esc(img) + '" alt="' + esc(a.label) + '">'
                : '<i data-lucide="' + esc(a.icon) + '"></i>') +
              "</span><span class=\"cs-tn\">" +
              esc(a.label) +
              "</span></button>"
            );
          })
          .join("")
      : '<div class="cs-empty">Nothing matches that search.</div>';
    use.disabled = !picked;
    note.textContent = picked ? "Selected: " + picked : "Choose an option to continue.";
    icons();
  }
  paint();

  const close = () => {
    m.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);

  m.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (!t || !t.closest) return;
    if (t.closest("[data-close]")) {
      e.preventDefault();
      close();
      return;
    }
    const tile = t.closest("[data-area]") as HTMLElement | null;
    if (tile) {
      picked = tile.dataset["area"] || "";
      paint();
      return;
    }
    if (t.closest("#rmUse")) {
      e.preventDefault();
      if (!picked) return;
      const value = picked;
      close();
      o.onApply(value);
    }
  });
  (m.querySelector("#rmQ") as HTMLInputElement | null)?.addEventListener("input", (e) => {
    query = (e.target as HTMLInputElement).value;
    paint();
  });
  icons();
}
