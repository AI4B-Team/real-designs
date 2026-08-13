// Shop the Design: product sourcing workspace launched from Studio, Designs and
// design detail. It extends the existing systems instead of duplicating them:
// selections are written to the shared project product store, which the existing
// Products page and Scope & Budget rollups read from.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import {
  visualSearchProvider,
  sampleDetection,
  isProductSearchConfigured,
  matchTypeLabel,
  matchStrengthLabel,
  availabilityLabel,
  safeMatchType,
  priceOf,
  rankMatches,
  PRODUCT_CATEGORIES,
} from "@/lib/product-catalog";
import {
  addProduct,
  listProducts,
  removeProduct,
  setStatus,
  roomSelections,
  lockedCategories,
  budgetRollup,
  STATUS_LABEL,
} from "@/lib/project-products";
import { track } from "@/lib/analytics";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const money = (n) =>
  n == null ? "Price Unavailable" : "$" + Number(n).toLocaleString(undefined, { maximumFractionDigits: n < 20 ? 2 : 0 });

const PHASES = ["Design", "Demo", "Rough In", "Finishes", "Furnishing", "Punch List"];
const BUDGET_CATS = ["Furniture", "Lighting", "Textiles", "Décor", "Fixtures", "Finishes", "Appliances", "Outdoor"];
const TABS = [
  ["all", "All Matches"],
  ["close", "Exact And Close"],
  ["budget", "Budget"],
  ["premium", "Premium"],
  ["saved", "Saved"],
];

const DISCLOSURE =
  "Product matches are suggestions generated from the design image. Prices, availability and specifications come from the retailer and can change at any time. Confirm dimensions and stock with the retailer before purchase. Some retailer links may be affiliate links, which can earn REAL DESIGNS a commission at no extra cost to you.";

function shell() {
  return `<div class="shop-head">
  <div class="shop-h-l">
    <span class="shop-kick">Shop The Design</span>
    <b id="shopTitle">Loading Design</b>
    <div class="shop-ctx" id="shopCtx"></div>
  </div>
  <div class="shop-h-r">
    <button class="btn btn-ghost btn-xs" id="shopCompareBtn"><i data-lucide="columns-2"></i>Compare<span class="shop-cnt" id="shopCmpCnt">0</span></button>
    <button class="btn btn-ghost btn-xs" id="shopSelBtn"><i data-lucide="shopping-bag"></i>Selected Products<span class="shop-cnt" id="shopSelCnt">0</span></button>
    <button class="icon-btn" id="shopClose" aria-label="Close Shop The Design"><i data-lucide="x"></i></button>
  </div>
</div>
<div class="shop-body">
  <div class="shop-canvas">
    <div class="shop-tools">
      <button class="btn btn-ghost btn-xs" id="shopDetect"><i data-lucide="scan-search"></i>Re-Scan Objects</button>
      <button class="btn btn-ghost btn-xs" id="shopDraw"><i data-lucide="square-dashed-mouse-pointer"></i>Add Object</button>
      <button class="btn btn-ghost btn-xs" id="shopDots"><i data-lucide="eye"></i>Hide Dots</button>
      <span class="shop-hint" id="shopHint">Tap Any Dot To Shop That Item</span>
    </div>
    <div class="shop-stage" id="shopStage">
      <img id="shopImg" alt="Design being shopped">
      <div class="shop-dots" id="shopDotLayer"></div>
      <div class="shop-scan" id="shopScan" hidden><span></span>Scanning The Design For Shoppable Objects</div>
    </div>
    <div class="shop-objs" id="shopObjs"></div>
  </div>
  <div class="shop-panel">
    <div class="shop-p-head">
      <div>
        <b id="shopObjName">Select An Object</b>
        <span id="shopObjSub">Pick a dot on the design, or draw a box around anything the scan missed.</span>
      </div>
      <button class="btn btn-ghost btn-xs" id="shopLock" hidden><i data-lucide="lock"></i>Use In All Views</button>
    </div>
    <div class="shop-tabs" id="shopTabs">${TABS.map(
      (t, i) => `<button class="shop-tab${i === 0 ? " on" : ""}" data-tab="${t[0]}">${t[1]}</button>`,
    ).join("")}</div>
    <div class="shop-filters">
      <div class="shop-search"><i data-lucide="search"></i><input id="shopQ" type="text" placeholder="Refine by brand, material or keyword"></div>
      <select id="shopSort" class="shop-sel" aria-label="Sort results">
        <option value="match">Best Match</option>
        <option value="low">Price, Low To High</option>
        <option value="high">Price, High To Low</option>
        <option value="stock">In Stock First</option>
      </select>
    </div>
    <div class="shop-filters2">
      <select id="shopPrice" class="shop-sel" aria-label="Price range">
        <option value="">Any Price</option><option value="0-250">Under $250</option><option value="250-750">$250 To $750</option>
        <option value="750-1500">$750 To $1,500</option><option value="1500-99999">Over $1,500</option>
      </select>
      <select id="shopAvail" class="shop-sel" aria-label="Availability">
        <option value="">Any Availability</option><option value="in_stock">In Stock Only</option>
      </select>
      <select id="shopMerch" class="shop-sel" aria-label="Retailer"><option value="">All Retailers</option></select>
    </div>
    <div class="shop-results" id="shopResults"></div>
    <div class="shop-disc"><i data-lucide="info"></i><span>${DISCLOSURE}</span></div>
  </div>
</div>
<div class="shop-drawer" id="shopDrawer" hidden></div>
<div class="shop-toast" id="shopToast"></div>`;
}

let host = null;

export function openShop(ctx) {
  const root = document.querySelector(".rd-app") || document.body;
  if (!host) {
    host = document.createElement("div");
    host.className = "shop-wrap";
    root.appendChild(host);
  }
  host.innerHTML = shell();
  host.classList.add("on");
  document.body.style.overflow = "hidden";
  mount(ctx || {});
  track("shop_opened", { design: ctx && ctx.designLabel, room: ctx && ctx.roomLabel });
}

function closeShop() {
  if (!host) return;
  host.classList.remove("on");
  host.innerHTML = "";
  document.body.style.overflow = "";
}

function mount(ctx) {
  const $ = (id) => host.querySelector("#" + id);
  const paintIcons = () => {
    try {
      createIcons({ icons });
    } catch (_) {}
  };
  const toast = (m) => {
    const t = $("shopToast");
    if (!t) return;
    t.textContent = m;
    t.classList.add("on");
    clearTimeout(t._h);
    t._h = window.setTimeout(() => t.classList.remove("on"), 3200);
  };

  const design = {
    image: ctx.image || "",
    roomType: ctx.roomType || "Living Room",
    roomId: String(ctx.roomId || "room-unassigned"),
    roomLabel: ctx.roomLabel || "Unassigned Room",
    propertyId: String(ctx.propertyId || "prop-unassigned"),
    propertyLabel: ctx.propertyLabel || "No Property Selected",
    designId: String(ctx.designId || "design-current"),
    designLabel: ctx.designLabel || "Current Design",
    budgetMax: ctx.budgetMax || null,
    colors: ctx.colors || [],
    materials: ctx.materials || [],
  };

  let objects = [];
  let active = null;
  let results = [];
  let tab = "all";
  let sort = "match";
  let query = "";
  let priceRange = "";
  let availFilter = "";
  let merchFilter = "";
  let drawing = false;
  let compare = [];
  let savedLater = [];
  let dotsOn = true;

  $("shopTitle").textContent = design.designLabel;
  $("shopCtx").innerHTML =
    `<span><i data-lucide="map-pin"></i>${esc(design.propertyLabel)}</span>` +
    `<span><i data-lucide="sofa"></i>${esc(design.roomLabel)}</span>` +
    (isProductSearchConfigured()
      ? ""
      : `<span class="shop-warn"><i data-lucide="triangle-alert"></i>Sample Product Data, No Retailer Feed Connected</span>`);
  const img = $("shopImg");
  if (design.image) img.src = design.image;
  else img.replaceWith(Object.assign(document.createElement("div"), { className: "shop-noimg", textContent: "No Design Image Available" }));

  paintIcons();
  syncCounts();

  /* ---------------- detection ---------------- */
  async function detect() {
    $("shopScan").hidden = false;
    $("shopDotLayer").innerHTML = "";
    try {
      objects = await sampleDetection.detect(design.image, design.roomType);
      const locked = lockedCategories(design.roomId);
      objects.forEach((o) => (o.locked = locked.indexOf(o.category) > -1));
      paintDots();
      if (!objects.length) emptyObjects();
      else selectObject(objects[0]);
    } catch (e) {
      $("shopResults").innerHTML = errorBlock("The object scan could not finish.");
      wireRetry();
    } finally {
      $("shopScan").hidden = true;
    }
  }

  function emptyObjects() {
    $("shopObjs").innerHTML = `<div class="shop-empty"><b>No Objects Detected</b><span>Draw a box around any item in the design and we will search for matching products.</span></div>`;
  }

  function paintDots() {
    const layer = $("shopDotLayer");
    layer.innerHTML = objects
      .map(
        (o) =>
          `<button class="shop-dot${active && active.id === o.id ? " on" : ""}${o.locked ? " locked" : ""}" data-dot="${o.id}" style="left:${(o.box.x + o.box.w / 2) * 100}%;top:${(o.box.y + o.box.h / 2) * 100}%" title="${esc(o.label)}"><span></span><em>${esc(o.label)}</em></button>`,
      )
      .join("");
    layer.querySelectorAll("[data-dot]").forEach((b) =>
      b.addEventListener("click", () => {
        const o = objects.find((x) => x.id === b.getAttribute("data-dot"));
        if (o) selectObject(o);
      }),
    );
    $("shopObjs").innerHTML =
      `<div class="shop-objs-h">Detected Objects</div>` +
      objects
        .map(
          (o) =>
            `<button class="shop-obj${active && active.id === o.id ? " on" : ""}" data-obj="${o.id}"><i data-lucide="${o.origin === "manual" ? "square-dashed" : "circle-dot"}"></i>${esc(o.label)}${o.locked ? '<em class="shop-lockpill">Selected</em>' : ""}</button>`,
        )
        .join("");
    $("shopObjs")
      .querySelectorAll("[data-obj]")
      .forEach((b) =>
        b.addEventListener("click", () => {
          const o = objects.find((x) => x.id === b.getAttribute("data-obj"));
          if (o) selectObject(o);
        }),
      );
    layer.classList.toggle("hide", !dotsOn);
    paintIcons();
  }

  /* ---------------- search ---------------- */
  async function selectObject(o) {
    active = o;
    paintDots();
    $("shopObjName").textContent = o.label;
    $("shopObjSub").textContent = o.origin === "manual" ? "Custom object you outlined on the design." : "Detected in the design image.";
    $("shopLock").hidden = false;
    $("shopResults").innerHTML = skeleton();
    track("shop_object_selected", { category: o.category });
    try {
      results = await visualSearchProvider().search({
        imageUrl: design.image,
        crop: o.box,
        category: o.category,
        traits: { colors: design.colors, materials: design.materials },
        query: query || undefined,
      });
      paintResults();
    } catch (e) {
      $("shopResults").innerHTML = errorBlock("Product search is unavailable right now.");
      wireRetry();
    }
  }

  function skeleton() {
    return `<div class="shop-skel">${Array.from({ length: 4 })
      .map(() => `<div class="shop-sk"><i></i><div><b></b><em></em><u></u></div></div>`)
      .join("")}</div>`;
  }

  function errorBlock(msg) {
    return `<div class="shop-empty"><b>Something Went Wrong</b><span>${esc(msg)} Try again, or search manually by keyword.</span><button class="btn btn-dark btn-xs" id="shopRetry"><i data-lucide="refresh-cw"></i>Try Again</button></div>`;
  }
  function wireRetry() {
    paintIcons();
    const r = $("shopRetry");
    if (r) r.addEventListener("click", () => (active ? selectObject(active) : detect()));
  }

  function filtered() {
    let list = results.slice();
    if (tab === "close") list = list.filter((p) => ["exact", "close"].indexOf(safeMatchType(p)) > -1);
    if (tab === "budget") list = list.filter((p) => (priceOf(p) || 0) <= 500);
    if (tab === "premium") list = list.filter((p) => (priceOf(p) || 0) > 500);
    if (tab === "saved") list = savedLater.slice();
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((p) => (p.name + " " + p.brand + " " + p.merchant + " " + p.materials.join(" ")).toLowerCase().indexOf(q) > -1);
    }
    if (priceRange) {
      const [a, b] = priceRange.split("-").map(Number);
      list = list.filter((p) => {
        const v = priceOf(p);
        return v != null && v >= a && v <= b;
      });
    }
    if (availFilter) list = list.filter((p) => p.availability === availFilter);
    if (merchFilter) list = list.filter((p) => p.merchant === merchFilter);
    if (sort === "low") list.sort((a, b) => (priceOf(a) ?? 1e9) - (priceOf(b) ?? 1e9));
    else if (sort === "high") list.sort((a, b) => (priceOf(b) ?? -1) - (priceOf(a) ?? -1));
    else if (sort === "stock") list.sort((a, b) => (a.availability === "in_stock" ? -1 : 1) - (b.availability === "in_stock" ? -1 : 1));
    else list = rankMatches(list, { budgetMax: design.budgetMax, category: active && active.category });
    return list;
  }

  function paintResults() {
    const merch = $("shopMerch");
    const seen = Array.from(new Set(results.map((p) => p.merchant)));
    merch.innerHTML = `<option value="">All Retailers</option>` + seen.map((m) => `<option value="${esc(m)}"${m === merchFilter ? " selected" : ""}>${esc(m)}</option>`).join("");
    const list = filtered();
    const box = $("shopResults");
    if (!list.length) {
      box.innerHTML = `<div class="shop-empty"><b>No Matches In This View</b><span>Widen the price range, clear a filter, or search by keyword to find a stand-in for this item.</span><button class="btn btn-ghost btn-xs" id="shopClear"><i data-lucide="filter-x"></i>Clear Filters</button></div>`;
      paintIcons();
      const c = $("shopClear");
      if (c)
        c.addEventListener("click", () => {
          priceRange = availFilter = merchFilter = query = "";
          tab = "all";
          $("shopQ").value = "";
          $("shopPrice").value = $("shopAvail").value = $("shopMerch").value = "";
          host.querySelectorAll(".shop-tab").forEach((t) => t.classList.toggle("on", t.getAttribute("data-tab") === "all"));
          paintResults();
        });
      return;
    }
    box.innerHTML = `<div class="shop-count">${list.length} Matches</div>` + list.map(card).join("");
    paintIcons();
    box.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openDetail(b.getAttribute("data-open"))));
    box.querySelectorAll("[data-add]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        openAdd(b.getAttribute("data-add"));
      }),
    );
    box.querySelectorAll("[data-save]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const p = results.find((x) => x.id === b.getAttribute("data-save"));
        if (!p) return;
        if (!savedLater.find((x) => x.id === p.id)) savedLater.push(p);
        toast("Saved For Later");
        track("shop_product_saved", { merchant: p.merchant });
      }),
    );
    box.querySelectorAll("[data-cmp]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const p = results.find((x) => x.id === b.getAttribute("data-cmp")) || savedLater.find((x) => x.id === b.getAttribute("data-cmp"));
        if (!p) return;
        if (compare.find((x) => x.id === p.id)) compare = compare.filter((x) => x.id !== p.id);
        else if (compare.length >= 4) return toast("Compare Holds Four Products At A Time");
        else compare.push(p);
        syncCounts();
        paintResults();
      }),
    );
  }

  function card(p) {
    const mt = safeMatchType(p);
    const inCmp = !!compare.find((x) => x.id === p.id);
    return `<div class="shop-card" data-open="${p.id}">
      <div class="shop-card-img"><img src="${esc(p.images[0] || "")}" alt="${esc(p.name)}">${p.sample ? '<span class="shop-sample">Sample Data</span>' : ""}</div>
      <div class="shop-card-b">
        <div class="shop-card-t"><b>${esc(p.name)}</b><span class="shop-price">${money(priceOf(p))}${p.salePrice ? `<s>${money(p.regularPrice)}</s>` : ""}</span></div>
        <div class="shop-meta">${esc(p.brand)} &middot; ${esc(p.merchant)}${p.width ? ` &middot; ${p.width}" W` : ""}</div>
        <div class="shop-tagrow">
          <span class="shop-tag ${mt === "exact" ? "ok" : mt === "close" ? "amb" : ""}">${matchTypeLabel(mt)}</span>
          <span class="shop-tag">${matchStrengthLabel(p.matchStrength)}</span>
          <span class="shop-tag ${p.availability === "in_stock" ? "ok" : p.availability === "unavailable" ? "bad" : "amb"}">${availabilityLabel(p.availability)}</span>
        </div>
        <div class="shop-why">${esc(p.matchNotes[0] || "Matched on category and palette.")}</div>
        <div class="shop-card-a">
          <button class="btn btn-dark btn-xs" data-add="${p.id}"><i data-lucide="plus"></i>Add To Project</button>
          <button class="btn btn-ghost btn-xs" data-save="${p.id}"><i data-lucide="bookmark"></i>Save</button>
          <button class="btn btn-ghost btn-xs${inCmp ? " on" : ""}" data-cmp="${p.id}"><i data-lucide="columns-2"></i>${inCmp ? "In Compare" : "Compare"}</button>
        </div>
      </div>
    </div>`;
  }

  /* ---------------- detail drawer ---------------- */
  function openDetail(id) {
    const p = results.concat(savedLater).find((x) => x.id === id);
    if (!p) return;
    const mt = safeMatchType(p);
    const d = $("shopDrawer");
    d.hidden = false;
    d.innerHTML = `<div class="shop-dr">
      <div class="shop-dr-h"><b>Product Detail</b><button class="icon-btn" id="drClose" aria-label="Close product detail"><i data-lucide="x"></i></button></div>
      <div class="shop-dr-b">
        <div class="shop-dr-img"><img src="${esc(p.images[0] || "")}" alt="${esc(p.name)}"></div>
        <h4>${esc(p.name)}</h4>
        <div class="shop-meta">${esc(p.brand)} &middot; ${esc(p.merchant)}</div>
        <div class="shop-dr-price">${money(priceOf(p))}${p.salePrice ? `<s>${money(p.regularPrice)}</s>` : ""}<span class="shop-tag ${p.availability === "in_stock" ? "ok" : "amb"}">${availabilityLabel(p.availability)}</span></div>
        <div class="shop-tagrow"><span class="shop-tag ${mt === "exact" ? "ok" : "amb"}">${matchTypeLabel(mt)}</span><span class="shop-tag">${matchStrengthLabel(p.matchStrength)}</span></div>
        <div class="shop-dr-sec"><b>Why This Was Matched</b><ul>${p.matchNotes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>
        <div class="shop-dr-sec"><b>Specifications</b><dl>
          ${p.width || p.depth || p.height ? `<div><dt>Dimensions</dt><dd>${[p.width && p.width + '" W', p.depth && p.depth + '" D', p.height && p.height + '" H'].filter(Boolean).join(" × ")}</dd></div>` : ""}
          <div><dt>Materials</dt><dd>${esc(p.materials.join(", ") || "Not Listed")}</dd></div>
          <div><dt>Colors</dt><dd>${esc(p.colors.join(", ") || "Not Listed")}</dd></div>
          <div><dt>Delivery</dt><dd>${esc(p.delivery || "Not Listed")}</dd></div>
          <div><dt>Verified SKU</dt><dd>${p.verifiedSku ? "Yes" : "No"}</dd></div>
        </dl></div>
        ${p.sample ? `<div class="shop-disc"><i data-lucide="triangle-alert"></i><span>This is sample development data. Live retailer pricing and stock are not connected yet.</span></div>` : ""}
        <div class="shop-disc"><i data-lucide="info"></i><span>${DISCLOSURE}</span></div>
      </div>
      <div class="shop-dr-f">
        <button class="btn btn-dark btn-xs" id="drAdd"><i data-lucide="plus"></i>Add To Project</button>
        <button class="btn btn-ghost btn-xs" id="drSave"><i data-lucide="bookmark"></i>Save For Later</button>
        <a class="btn btn-ghost btn-xs" href="${esc(p.affiliateUrl || p.productUrl)}" target="_blank" rel="nofollow sponsored noopener"><i data-lucide="external-link"></i>View At Retailer</a>
      </div>
    </div>`;
    paintIcons();
    $("drClose").addEventListener("click", () => (d.hidden = true));
    $("drAdd").addEventListener("click", () => openAdd(p.id));
    $("drSave").addEventListener("click", () => {
      if (!savedLater.find((x) => x.id === p.id)) savedLater.push(p);
      toast("Saved For Later");
    });
    track("shop_product_viewed", { merchant: p.merchant, category: p.category });
  }

  /* ---------------- add to project ---------------- */
  function openAdd(id) {
    const p = results.concat(savedLater).find((x) => x.id === id);
    if (!p) return;
    const d = $("shopDrawer");
    d.hidden = false;
    d.innerHTML = `<div class="shop-dr">
      <div class="shop-dr-h"><b>Add To Project</b><button class="icon-btn" id="drClose" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="shop-dr-b">
        <div class="shop-mini"><img src="${esc(p.images[0] || "")}" alt=""><div><b>${esc(p.name)}</b><span>${esc(p.merchant)} &middot; ${money(priceOf(p))}</span></div></div>
        <label class="shop-f"><span>Quantity</span><input id="afQty" type="number" min="1" value="1"></label>
        <label class="shop-f"><span>Room</span><input id="afRoom" type="text" value="${esc(design.roomLabel)}" readonly></label>
        <label class="shop-f"><span>Phase</span><select id="afPhase">${PHASES.map((x) => `<option${x === "Furnishing" ? " selected" : ""}>${x}</option>`).join("")}</select></label>
        <label class="shop-f"><span>Budget Category</span><select id="afCat">${BUDGET_CATS.map((x) => `<option>${x}</option>`).join("")}</select></label>
        <label class="shop-f"><span>Status</span><select id="afStatus"><option value="selected">Selected</option><option value="saved">Saved</option><option value="approved">Approved</option></select></label>
        <label class="shop-f"><span>Design DNA</span><select id="afDna"><option value="none">Do Not Add To Design DNA</option><option value="room">Lock For This Room</option><option value="rooms">Apply To Similar Rooms</option><option value="property">Apply To Whole Property</option></select></label>
        <label class="shop-f col"><span>Notes</span><textarea id="afNote" rows="2" placeholder="Anything the buyer or client should know"></textarea></label>
      </div>
      <div class="shop-dr-f"><button class="btn btn-dark btn-xs" id="afGo"><i data-lucide="check"></i>Add To Project</button><button class="btn btn-ghost btn-xs" id="afCancel">Cancel</button></div>
    </div>`;
    paintIcons();
    $("drClose").addEventListener("click", () => (d.hidden = true));
    $("afCancel").addEventListener("click", () => (d.hidden = true));
    $("afGo").addEventListener("click", () => {
      const r = addProduct({
        product: p,
        status: $("afStatus").value,
        quantity: Math.max(1, Number($("afQty").value) || 1),
        propertyId: design.propertyId,
        propertyLabel: design.propertyLabel,
        roomId: design.roomId,
        roomLabel: design.roomLabel,
        designId: design.designId,
        designLabel: design.designLabel,
        hotspotId: active ? active.id : "",
        detectedCategory: active ? active.category : p.category,
        phase: $("afPhase").value,
        budgetCategory: $("afCat").value,
        notes: $("afNote").value.trim(),
        dnaScope: $("afDna").value,
      });
      d.hidden = true;
      syncCounts();
      if (active) active.locked = true;
      paintDots();
      toast(r.duplicate ? "Product Already On This Room, Updated Instead" : "Added To Project");
      track("shop_product_added", { merchant: p.merchant, category: p.category, price: priceOf(p) });
    });
  }

  /* ---------------- selected products + compare ---------------- */
  function openSelected() {
    const list = roomSelections(design.roomId);
    const roll = budgetRollup((r) => r.roomId === design.roomId);
    const d = $("shopDrawer");
    d.hidden = false;
    d.innerHTML = `<div class="shop-dr">
      <div class="shop-dr-h"><b>Selected Products</b><button class="icon-btn" id="drClose" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="shop-dr-b">
        ${
          list.length
            ? list
                .map(
                  (r) => `<div class="shop-mini"><img src="${esc(r.images[0] || "")}" alt=""><div><b>${esc(r.name)}</b><span>${esc(r.merchant)} &middot; ${money(priceOf(r))} &times; ${r.quantity} &middot; ${STATUS_LABEL[r.status]}</span></div>
                  <button class="icon-btn" data-rm="${r.recordId}" aria-label="Remove product"><i data-lucide="trash-2"></i></button></div>`,
                )
                .join("")
            : `<div class="shop-empty"><b>Nothing Selected Yet</b><span>Add products from the matches panel and they appear here and on the Products page.</span></div>`
        }
        <div class="shop-roll"><div><span>Product Subtotal</span><b>${money(roll.subtotal)}</b></div>
          <div><span>Estimated Tax</span><b>${money(roll.tax)}</b></div>
          <div><span>Estimated Delivery</span><b>${money(roll.delivery)}</b></div>
          <div><span>Contingency</span><b>${money(roll.contingency)}</b></div>
          <div class="tot"><span>Estimated Product Total</span><b>${money(roll.total)}</b></div></div>
        <div class="shop-disc"><i data-lucide="info"></i><span>Product totals are planning estimates and roll into Scope &amp; Budget alongside the labor and materials estimate.</span></div>
      </div>
      <div class="shop-dr-f"><button class="btn btn-dark btn-xs" id="selGo"><i data-lucide="shopping-bag"></i>Open Products Page</button></div>
    </div>`;
    paintIcons();
    $("drClose").addEventListener("click", () => (d.hidden = true));
    d.querySelectorAll("[data-rm]").forEach((b) =>
      b.addEventListener("click", () => {
        removeProduct(b.getAttribute("data-rm"));
        syncCounts();
        openSelected();
      }),
    );
    $("selGo").addEventListener("click", () => {
      closeShop();
      if (typeof ctx.go === "function") ctx.go("products");
    });
  }

  function openCompare() {
    if (!compare.length) return toast("Add Products To Compare First");
    const d = $("shopDrawer");
    d.hidden = false;
    d.innerHTML = `<div class="shop-dr wide">
      <div class="shop-dr-h"><b>Compare Products</b><button class="icon-btn" id="drClose" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="shop-dr-b"><div class="shop-cmp">${compare
        .map(
          (p) => `<div class="shop-cmp-c"><img src="${esc(p.images[0] || "")}" alt=""><b>${esc(p.name)}</b>
        <span class="shop-meta">${esc(p.merchant)}</span>
        <div class="shop-price">${money(priceOf(p))}</div>
        <dl><div><dt>Size</dt><dd>${[p.width && p.width + '"', p.depth && p.depth + '"', p.height && p.height + '"'].filter(Boolean).join(" × ") || "Not Listed"}</dd></div>
        <div><dt>Material</dt><dd>${esc(p.materials.join(", ") || "Not Listed")}</dd></div>
        <div><dt>Stock</dt><dd>${availabilityLabel(p.availability)}</dd></div>
        <div><dt>Match</dt><dd>${matchStrengthLabel(p.matchStrength)}</dd></div></dl>
        <button class="btn btn-dark btn-xs" data-add="${p.id}"><i data-lucide="plus"></i>Add To Project</button></div>`,
        )
        .join("")}</div></div>
    </div>`;
    paintIcons();
    $("drClose").addEventListener("click", () => (d.hidden = true));
    d.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () => openAdd(b.getAttribute("data-add"))));
  }

  function syncCounts() {
    const s = $("shopSelCnt");
    if (s) s.textContent = String(listProducts().filter((r) => r.roomId === design.roomId).length);
    const c = $("shopCmpCnt");
    if (c) c.textContent = String(compare.length);
  }

  /* ---------------- manual object draw ---------------- */
  const stage = $("shopStage");
  let start = null;
  let ghost = null;
  stage.addEventListener("mousedown", (e) => {
    if (!drawing) return;
    const r = stage.getBoundingClientRect();
    start = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    ghost = document.createElement("div");
    ghost.className = "shop-ghost";
    stage.appendChild(ghost);
  });
  stage.addEventListener("mousemove", (e) => {
    if (!drawing || !start || !ghost) return;
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width,
      y = (e.clientY - r.top) / r.height;
    Object.assign(ghost.style, {
      left: Math.min(x, start.x) * 100 + "%",
      top: Math.min(y, start.y) * 100 + "%",
      width: Math.abs(x - start.x) * 100 + "%",
      height: Math.abs(y - start.y) * 100 + "%",
    });
  });
  stage.addEventListener("mouseup", (e) => {
    if (!drawing || !start) return;
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width,
      y = (e.clientY - r.top) / r.height;
    const box = { x: Math.min(x, start.x), y: Math.min(y, start.y), w: Math.abs(x - start.x), h: Math.abs(y - start.y) };
    if (ghost) ghost.remove();
    ghost = null;
    start = null;
    drawing = false;
    $("shopDraw").classList.remove("on");
    if (box.w < 0.03 || box.h < 0.03) return;
    const cat = window.prompt("What Is This Item? For example: " + PRODUCT_CATEGORIES.slice(0, 5).join(", "), "Chair");
    if (!cat) return;
    const o = { id: "manual-" + Date.now(), category: cat.trim(), label: cat.trim(), box, origin: "manual" };
    objects.push(o);
    selectObject(o);
    track("shop_manual_object", { category: o.category });
  });

  /* ---------------- wiring ---------------- */
  $("shopClose").addEventListener("click", closeShop);
  $("shopDetect").addEventListener("click", detect);
  $("shopSelBtn").addEventListener("click", openSelected);
  $("shopCompareBtn").addEventListener("click", openCompare);
  $("shopDraw").addEventListener("click", () => {
    drawing = !drawing;
    $("shopDraw").classList.toggle("on", drawing);
    $("shopHint").textContent = drawing ? "Drag A Box Around The Item You Want To Shop" : "Tap Any Dot To Shop That Item";
  });
  $("shopDots").addEventListener("click", () => {
    dotsOn = !dotsOn;
    $("shopDotLayer").classList.toggle("hide", !dotsOn);
    $("shopDots").innerHTML = `<i data-lucide="${dotsOn ? "eye" : "eye-off"}"></i>${dotsOn ? "Hide Dots" : "Show Dots"}`;
    paintIcons();
  });
  $("shopLock").addEventListener("click", () => toast("This Selection Now Applies To Every View Of This Room"));
  host.querySelectorAll(".shop-tab").forEach((b) =>
    b.addEventListener("click", () => {
      tab = b.getAttribute("data-tab");
      host.querySelectorAll(".shop-tab").forEach((x) => x.classList.toggle("on", x === b));
      paintResults();
    }),
  );
  let qt = null;
  $("shopQ").addEventListener("input", (e) => {
    query = e.target.value.trim();
    clearTimeout(qt);
    qt = window.setTimeout(paintResults, 180);
  });
  $("shopSort").addEventListener("change", (e) => {
    sort = e.target.value;
    paintResults();
  });
  $("shopPrice").addEventListener("change", (e) => {
    priceRange = e.target.value;
    paintResults();
  });
  $("shopAvail").addEventListener("change", (e) => {
    availFilter = e.target.value;
    paintResults();
  });
  $("shopMerch").addEventListener("change", (e) => {
    merchFilter = e.target.value;
    paintResults();
  });
  host.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeShop();
  });
  /* Escape works wherever focus sits, and leaving the workspace by any
     other route must never leave the page scroll locked behind the overlay. */
  if (!window.__rdShopGlobals) {
    window.__rdShopGlobals = true;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && host && host.classList.contains("on")) closeShop();
    });
    window.addEventListener("hashchange", () => {
      if (host && host.classList.contains("on")) closeShop();
    });
  }


  detect();
}

/** Renders the selected-product list into the existing Products page. */
export function renderSelectedProducts(mountEl, go) {
  if (!mountEl) return;
  const list = listProducts();
  const roll = budgetRollup();
  if (!list.length) {
    mountEl.innerHTML = `<div class="card"><div class="card-b"><b style="display:block;margin-bottom:5px">No Products Selected Yet</b>
      <span style="font-size:.8rem;color:var(--mute-2)">Open any saved design and choose Shop This Design to source real products from the image. Everything you add lands here.</span></div></div>`;
    return;
  }
  const groups = {};
  list.forEach((r) => {
    const k = r.roomLabel || "Unassigned Room";
    (groups[k] = groups[k] || []).push(r);
  });
  mountEl.innerHTML =
    Object.keys(groups)
      .map(
        (k) => `<div class="sp-group"><div class="sp-group-h"><b>${esc(k)}</b><span>${groups[k].length} Products</span></div>
    ${groups[k]
      .map(
        (r) => `<div class="sp-row"><img src="${esc(r.images[0] || "")}" alt="">
      <div class="sp-main"><b>${esc(r.name)}</b><span>${esc(r.brand)} &middot; ${esc(r.merchant)} &middot; ${esc(r.budgetCategory)} &middot; ${esc(r.phase)}</span></div>
      <span class="shop-tag">${STATUS_LABEL[r.status]}</span>
      <span class="sp-price">${money(priceOf(r))}${r.quantity > 1 ? ` &times; ${r.quantity}` : ""}</span>
      <a class="btn btn-ghost btn-xs" href="${esc(r.affiliateUrl || r.productUrl)}" target="_blank" rel="nofollow sponsored noopener"><i data-lucide="external-link"></i>Retailer</a>
      <button class="btn btn-ghost btn-xs" data-sp-approve="${r.recordId}"><i data-lucide="check"></i>Approve</button>
      <button class="icon-btn" data-sp-rm="${r.recordId}" aria-label="Remove product"><i data-lucide="trash-2"></i></button></div>`,
      )
      .join("")}</div>`,
      )
      .join("") +
    `<div class="shop-roll"><div><span>Product Subtotal</span><b>${money(roll.subtotal)}</b></div>
    <div><span>Estimated Tax</span><b>${money(roll.tax)}</b></div>
    <div><span>Estimated Delivery</span><b>${money(roll.delivery)}</b></div>
    <div><span>Contingency</span><b>${money(roll.contingency)}</b></div>
    <div class="tot"><span>Estimated Product Total</span><b>${money(roll.total)}</b></div></div>
    <div class="shop-disc"><i data-lucide="info"></i><span>${DISCLOSURE}</span></div>`;
  try {
    createIcons({ icons });
  } catch (_) {}
  mountEl.querySelectorAll("[data-sp-rm]").forEach((b) =>
    b.addEventListener("click", () => {
      removeProduct(b.getAttribute("data-sp-rm"));
      renderSelectedProducts(mountEl, go);
    }),
  );
  mountEl.querySelectorAll("[data-sp-approve]").forEach((b) =>
    b.addEventListener("click", () => {
      setStatus(b.getAttribute("data-sp-approve"), "approved");
      renderSelectedProducts(mountEl, go);
    }),
  );
}
