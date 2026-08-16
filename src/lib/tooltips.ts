/**
 * Converts native `title` tooltips (rendered with the OS dark bubble) into
 * styled `data-tt` tooltips so every hint matches the light UI, and renders
 * those hints as a floating bubble.
 *
 * The bubble is a real element (not a ::after pseudo element) because inline
 * help icons are SVG nodes, and SVG elements never paint pseudo elements —
 * that is why the info icons looked dead on hover.
 */

let bubble: HTMLDivElement | null = null;
let current: Element | null = null;
let hideTimer: number | undefined;

function ensureBubble(): HTMLDivElement {
  if (bubble && bubble.isConnected) return bubble;
  bubble = document.createElement("div");
  bubble.className = "rd-tt";
  bubble.setAttribute("role", "tooltip");
  document.body.appendChild(bubble);
  return bubble;
}

function place(el: Element, text: string) {
  const b = ensureBubble();
  b.textContent = text;
  b.classList.toggle("short", text.length <= 34);
  b.classList.add("on");
  // Measure after the text is in place.
  const r = el.getBoundingClientRect();
  const bw = b.offsetWidth;
  const bh = b.offsetHeight;
  const pad = 8;
  let left = r.left + r.width / 2 - bw / 2;
  left = Math.max(pad, Math.min(left, window.innerWidth - bw - pad));
  let top = r.top - bh - 8;
  if (top < pad) top = r.bottom + 8;
  b.style.left = `${Math.round(left)}px`;
  b.style.top = `${Math.round(top)}px`;
}

function hide() {
  current = null;
  if (bubble) {
    bubble.classList.remove("on");
    bubble.style.top = "-9999px";
  }
}

function targetFor(node: EventTarget | null): Element | null {
  if (!(node instanceof Element)) return null;
  // SVG icons report closest() fine, but composed paths inside <svg> need the
  // owner element, so walk up manually when closest is unavailable.
  let el: Element | null = node;
  while (el) {
    if (el.hasAttribute?.("data-tt")) return el;
    el = el.parentElement || ((el as any).parentNode as Element | null);
    if (el && el.nodeType !== 1) el = null;
  }
  return null;
}

function show(node: EventTarget | null) {
  const el = targetFor(node);
  if (!el) {
    if (current) hide();
    return;
  }
  const text = el.getAttribute("data-tt");
  if (!text) { if (current === el) hide(); return; }
  // Repaint when the same element changes its hint (a toggle flipping label).
  if (el === current && bubble && bubble.textContent === text) return;
  current = el;
  window.clearTimeout(hideTimer);
  place(el, text);
}

let bound = false;
let lastPointer = "mouse";
function bindBubble() {
  if (bound) return;
  bound = true;
  document.addEventListener("pointerdown", (e) => { lastPointer = (e as PointerEvent).pointerType || "mouse"; }, true);
  document.addEventListener("pointerover", (e) => show(e.target), true);
  document.addEventListener("pointerout", (e) => {
    const to = (e as PointerEvent).relatedTarget;
    if (current && targetFor(to) === current) return;
    hideTimer = window.setTimeout(hide, 60);
  }, true);
  document.addEventListener("focusin", (e) => show(e.target), true);
  document.addEventListener("focusout", hide, true);
  document.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Escape") hide(); }, true);
  window.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
  // Touch: tap an inline help icon to reveal, tap anywhere to dismiss. A mouse
  // click always dismisses, so a hint can never linger over the new UI state.
  document.addEventListener("click", (e) => {
    const el = targetFor(e.target);
    if (el && lastPointer === "touch") { current = null; show(e.target); window.clearTimeout(hideTimer); hideTimer = window.setTimeout(hide, 3200); }
    else hide();
  }, true);
}


export function initTooltips(root: ParentNode = document): () => void {
  const convert = (scope: ParentNode) => {
    const nodes = (scope as Element).querySelectorAll
      ? (scope as Element).querySelectorAll("[title]")
      : [];
    nodes.forEach((el) => {
      const t = el.getAttribute("title");
      if (!t) { el.removeAttribute("title"); return; }
      // Keep existing rail tooltips (data-tip) as the single source of truth.
      if (!el.hasAttribute("data-tip")) el.setAttribute("data-tt", t);
      el.removeAttribute("title");
    });
    label(scope);
  };

  // Icon only controls carry their meaning in data-tt / data-tip. Without an
  // aria-label a screen reader announces them as an unnamed button, so mirror
  // the hint onto the control itself.
  const label = (scope: ParentNode) => {
    const q = (scope as Element).querySelectorAll;
    if (!q) return;
    (scope as Element)
      .querySelectorAll("[data-tt],[data-tip]")
      .forEach((el) => {
        const tag = el.tagName;
        if (tag !== "BUTTON" && tag !== "A" && !el.hasAttribute("role")) return;
        if (el.getAttribute("aria-label")) return;
        if ((el as HTMLElement).textContent?.trim()) return;
        const t = el.getAttribute("data-tt") || el.getAttribute("data-tip");
        if (t) el.setAttribute("aria-label", t);
      });
  };

  convert(root);
  if (typeof document !== "undefined") bindBubble();

  const target = (root as Document).body || (root as Element);
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "attributes" && m.target instanceof Element) convert(m.target.parentNode || document);
      m.addedNodes.forEach((n) => {
        if (n instanceof Element) {
          if (n.hasAttribute("title")) convert(n.parentNode || document);
          convert(n);
        }
      });
      m.removedNodes.forEach((n) => { if (current && n instanceof Element && (n === current || n.contains(current))) hide(); });
    }
  });
  if (target) obs.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ["title", "data-tt", "data-tip"] });
  return () => { obs.disconnect(); hide(); };
}
