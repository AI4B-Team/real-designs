/**
 * Shared failed-photo state for both builders.
 *
 * A card whose photo cannot be shown keeps its exact dimensions, its
 * checkbox, scene number, overflow menu and room selector. Only the image
 * area is replaced — by a centred panel that explains what happened and
 * offers Retry, Replace Photo and Remove. Nothing here ever touches the
 * stored asset path: a display failure is a display failure, not a deletion.
 */
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { runCardAction } from "@/lib/builder-card-menu";

const esc = (s) =>
  String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const paint = (root) => {
  try {
    createIcons({ icons, nameAttr: "data-lucide", root: root || document });
  } catch (_) {}
};

/** kind -> copy. "loading" is a skeleton, not a panel. */
const COPY = {
  display: {
    icon: "image-off",
    title: "Photo couldn’t be loaded",
    body: "We couldn’t display this photo. Your original may still be available.",
  },
  upload: {
    icon: "cloud-off",
    title: "Photo couldn’t be uploaded",
    body: "We couldn’t finish uploading this photo. The file is still on your device.",
  },
  missing: {
    icon: "image-off",
    title: "Photo is no longer available",
    body: "This photo may have been removed from Media. Replace it to keep this card.",
  },
};

/* asset id -> failure type, for the grid notice and for debugging. */
const FAILED = new Map();

export function photoFailures() {
  return Array.from(FAILED.entries()).map(([key, kind]) => ({ key, kind }));
}

function cardOf(el) {
  return el && el.closest ? el.closest(".rv-tile,[data-k],[data-key]") : null;
}

function keyOf(el) {
  const card = cardOf(el);
  return (
    (card &&
      (card.getAttribute("data-k") ||
        card.getAttribute("data-key") ||
        card.getAttribute("data-asset"))) ||
    ""
  );
}

function flowOf(el) {
  const card = cardOf(el);
  const btn = card && card.querySelector("[data-cardflow]");
  return (btn && btn.getAttribute("data-cardflow")) || "";
}

function panelHtml(kind) {
  const c = COPY[kind] || COPY.display;
  return `<div class="rd-fail-p" role="group" aria-label="${esc(c.title)}">
    <span class="rd-fail-ic"><i data-lucide="${esc(c.icon)}"></i></span>
    <b>${esc(c.title)}</b>
    <span class="rd-fail-t">${esc(c.body)}</span>
    <span class="rd-fail-e" role="status"></span>
    <span class="rd-fail-a">
      <button type="button" class="rd-fail-b primary" data-photo-retry>Retry</button>
      <button type="button" class="rd-fail-b" data-photo-replace>Replace Photo</button>
    </span>
    <button type="button" class="rd-fail-rm" data-photo-remove>Remove</button>
  </div>`;
}

/**
 * Server-rendered variant for a card whose upload failed: the builder already
 * knows the failure at render time, so the panel ships with the card markup
 * and only its retry handler is attached afterwards.
 */
export function photoFailPanelHtml(kind = "upload") {
  return panelHtml(kind);
}

/**
 * Attach retry handlers to panels that were rendered as part of a card.
 * `retry(key)` must resolve truthy once the photo is usable again.
 */
export function mountRenderedFailures(root, retry) {
  const host = root || document;
  const frames = Array.from(host.querySelectorAll("[data-photo-fail]"));
  for (const frame of frames) {
    frame.classList.add("rd-img-fail");
    cardOf(frame)?.classList.add("rd-fail");
    const key = keyOf(frame);
    if (key) FAILED.set(key, frame.getAttribute("data-photo-fail") || "upload");
    frame.__rdFailRetry = () => retry(key, frame);
    paint(frame);
  }
  syncFailures();
}


/**
 * Put a card into its failed state. `retry` returns true when the photo is
 * usable again; the panel is removed only then.
 */
export function markPhotoFailure(frame, opts = {}) {
  if (!frame) return;
  const kind = COPY[opts.kind] ? opts.kind : "display";
  const key = opts.key || keyOf(frame);
  frame.__rdFailRetry = typeof opts.retry === "function" ? opts.retry : null;
  frame.classList.remove("rd-img-load");
  frame.classList.add("rd-img-fail");
  frame.setAttribute("data-photo-fail", kind);
  const existing = frame.querySelector(":scope > .rd-fail-p");
  if (existing && frame.getAttribute("data-photo-failkind") === kind) return void syncFailures();
  if (existing) existing.remove();
  frame.setAttribute("data-photo-failkind", kind);
  frame.insertAdjacentHTML("beforeend", panelHtml(kind));
  paint(frame);
  const card = cardOf(frame);
  if (card) card.classList.add("rd-fail");
  if (key) FAILED.set(key, kind);
  try {
    console.warn("[photo] card unavailable", { asset: key || "(unknown)", failure: kind });
  } catch (_) {}
  syncFailures();
}

/** Back to a healthy card: panel gone, grid notice recalculated. */
export function clearPhotoFailure(frame) {
  if (!frame) return;
  const key = keyOf(frame);
  frame.querySelector(":scope > .rd-fail-p")?.remove();
  frame.classList.remove("rd-img-fail");
  frame.removeAttribute("data-photo-fail");
  frame.removeAttribute("data-photo-failkind");
  frame.__rdFailRetry = null;
  const card = cardOf(frame);
  if (card && !card.querySelector(".rd-img-fail")) card.classList.remove("rd-fail");
  if (key) FAILED.delete(key);
  syncFailures();
}

/* -------------------------------------------------------------- retry flow */

async function runRetry(frame, btn) {
  if (!frame || frame.dataset["failBusy"]) return;
  frame.dataset["failBusy"] = "1";
  const err = frame.querySelector(".rd-fail-e");
  if (err) err.textContent = "";
  const label = btn ? btn.innerHTML : "";
  frame.querySelectorAll(".rd-fail-b,.rd-fail-rm").forEach((b) => (b.disabled = true));
  if (btn) {
    btn.classList.add("busy");
    btn.innerHTML = `<i data-lucide="loader-circle"></i>Retrying…`;
    paint(btn);
  }
  let ok = false;
  try {
    ok = (await frame.__rdFailRetry?.()) !== false;
  } catch (_) {
    ok = false;
  }
  delete frame.dataset["failBusy"];
  if (ok) return void clearPhotoFailure(frame);
  if (!frame.isConnected) return;
  frame.querySelectorAll(".rd-fail-b,.rd-fail-rm").forEach((b) => (b.disabled = false));
  if (btn) {
    btn.classList.remove("busy");
    btn.innerHTML = label || "Retry";
  }
  const e2 = frame.querySelector(".rd-fail-e");
  if (e2) e2.textContent = "Still unavailable. Try again or replace this photo.";
}

/** Retry every failed card currently on screen, one after another. */
export async function retryAllPhotos() {
  const frames = Array.from(document.querySelectorAll(".rd-img-fail"));
  for (const f of frames) {
    const btn = f.querySelector("[data-photo-retry]");
    await runRetry(f, btn);
  }
}

/* ------------------------------------------------------------- grid notice */

const REMOVE_ACTION = { photo: "removeproj", video: "removevideo" };

function noticeHtml(n) {
  return `<div class="rd-failnote" role="status">
    <i data-lucide="triangle-alert"></i>
    <b>Some photos couldn’t be loaded</b>
    <em>${n} photos</em>
    <span class="rd-failnote-a">
      <button type="button" class="rd-fail-b primary" data-failall>Retry All</button>
      <button type="button" class="rd-fail-b" data-failreview>Review Failed Photos</button>
    </span>
  </div>`;
}

/** One compact notice per grid — never a stack of banners. */
export function syncFailures() {
  if (typeof document === "undefined") return;
  const grids = Array.from(document.querySelectorAll(".rv-grid"));
  for (const grid of grids) {
    const tiles = Array.from(grid.querySelectorAll(":scope > .rv-tile"));
    tiles.forEach((t) => t.classList.remove("rd-fail-next"));
    tiles.forEach((t, i) => {
      if (t.classList.contains("rd-fail") && i > 0) tiles[i - 1].classList.add("rd-fail-next");
    });
    /* A connector moved out of its card for a row break still belongs to that
       card: a pair with a failed photo on either side stays hidden, and the
       transition data behind it is left completely untouched. */
    const off = new Set();
    tiles.forEach((t) => {
      if (!t.classList.contains("rd-fail") && !t.classList.contains("rd-fail-next")) return;
      const k = t.getAttribute("data-key") || t.getAttribute("data-k") || "";
      if (k) off.add(k);
    });
    grid.querySelectorAll(".rv-conn[data-key]").forEach((c) => {
      c.classList.toggle("rd-conn-off", off.has(c.getAttribute("data-key") || ""));
    });

    const n = grid.querySelectorAll(".rv-tile.rd-fail").length;
    const host = grid.parentElement;
    if (!host) continue;
    let note = host.querySelector(":scope > .rd-failnote");
    if (n < 2) {
      note?.remove();
      continue;
    }
    if (!note) {
      grid.insertAdjacentHTML("beforebegin", noticeHtml(n));
      note = host.querySelector(":scope > .rd-failnote");
      paint(note);
    } else {
      const em = note.querySelector("em");
      if (em) em.textContent = n + " photos";
    }
  }
}

/* ------------------------------------------------------------- delegation */

if (typeof document !== "undefined" && !document.__rdPhotoFail) {
  document.__rdPhotoFail = true;
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    const retry = t.closest("[data-photo-retry]");
    const replace = t.closest("[data-photo-replace]");
    const remove = t.closest("[data-photo-remove]");
    const all = t.closest("[data-failall]");
    const review = t.closest("[data-failreview]");
    if (!retry && !replace && !remove && !all && !review) return;
    e.preventDefault();
    e.stopPropagation();
    if (all) return void retryAllPhotos();
    if (review) {
      const first = document.querySelector(".rv-tile.rd-fail");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      first?.classList.add("rd-fail-flash");
      window.setTimeout(() => first?.classList.remove("rd-fail-flash"), 1400);
      return;
    }
    const frame = t.closest(".rd-img-fail");
    if (retry) return void runRetry(frame, retry);
    const key = keyOf(t);
    const flow = flowOf(t);
    if (replace) return void runCardAction(flow, "replace", key);
    if (remove) return void runCardAction(flow, REMOVE_ACTION[flow] || "removeproj", key);
  });
}
