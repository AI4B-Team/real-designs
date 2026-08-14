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
const SEGS = [
  ["all", "Best Matches"],
  ["close", "Closest Match"],
  ["saved", "Saved"],
];
const PREFS = [
  ["best", "Best Overall"],
  ["budget", "Budget"],
  ["premium", "Premium"],
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
    <button class="shop-iconbtn" id="shopCompareBtn" disabled aria-label="Compare Products" data-tip="Select At Least Two Products To Compare"><i data-lucide="columns-2"></i><span class="shop-cnt" id="shopCmpCnt">0</span></button>
    <button class="shop-iconbtn" id="shopSelBtn" aria-label="Selected Products" data-tip="Selected Products"><i data-lucide="shopping-bag"></i><span class="shop-cnt" id="shopSelCnt">0</span></button>
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
    <section class="shop-cat" id="shopCat">
      <div class="shop-cat-h">
        <b>Shop This Room</b>
        <span>Browse products matched to the furniture, lighting, decor and finishes in this design.</span>
      </div>
      <div class="shop-cat-tabs" id="shopCatTabs" role="tablist"></div>
      <div class="shop-cat-grid" id="shopCatGrid"></div>
    </section>
  </div>
  <div class="shop-panel">
    <div class="shop-p-head">
      <button class="icon-btn shop-p-close" id="shopPanelClose" aria-label="Close Quick Matches"><i data-lucide="x"></i></button>
      <b id="shopObjName">Select An Object</b>
      <span id="shopObjSub">Pick a dot on the design, or draw a box around anything the scan missed.</span>
      <button class="shop-applyall" id="shopLock" hidden><i data-lucide="layers"></i>Apply To All Views</button>
    </div>
    <div class="shop-seg" id="shopSeg" role="tablist">${SEGS.map(
      (t, i) => `<button class="shop-segb${i === 0 ? " on" : ""}" role="tab" data-tab="${t[0]}">${t[1]}</button>`,
    ).join("")}</div>
    <div class="shop-filters">
      <div class="shop-search"><i data-lucide="search"></i><input id="shopQ" type="text" placeholder="Search brand, material or product"></div>
      <div class="shop-filters-row">
        <select id="shopSort" class="shop-sel" aria-label="Sort results">
          <option value="match">Best Match</option>
          <option value="low">Price, Low To High</option>
          <option value="high">Price, High To Low</option>
          <option value="stock">In Stock First</option>
        </select>
        <select id="shopPref" class="shop-sel" aria-label="Match preference">${PREFS.map(
          (x) => `<option value="${x[0]}">${x[1]}</option>`,
        ).join("")}</select>
        <div class="shop-fwrap">
          <button class="shop-filterbtn" id="shopFiltersBtn" aria-expanded="false"><i data-lucide="sliders-horizontal"></i>Filters<span class="shop-fcnt" id="shopFCnt" hidden>0</span></button>
          <div class="shop-fpop" id="shopFPop" hidden></div>
        </div>
      </div>
    </div>
    <div class="shop-results" id="shopResults"></div>
    <div class="shop-disc-wrap">
      <button class="shop-disc-t" id="shopDiscT" aria-expanded="false">Product Match And Affiliate Information<i data-lucide="info"></i></button>
      <div class="shop-disc-b" id="shopDiscB" hidden>${DISCLOSURE}</div>
    </div>
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
  let brandFilter = "";
  let materialFilter = "";
  let colorFilter = "";
  let dimFilter = "";
  let pref = "best";
  let hidden = [];
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

  function activeFilterCount() {
    return [priceRange, availFilter, merchFilter, brandFilter, materialFilter, colorFilter, dimFilter].filter(Boolean).length;
  }

  function filtered() {
    let list = tab === "saved" ? savedLater.slice() : results.slice();
    list = list.filter((p) => hidden.indexOf(p.id) < 0);
    if (tab === "close") list = list.filter((p) => ["exact", "close"].indexOf(safeMatchType(p)) > -1);
    if (pref === "budget") list = list.filter((p) => (priceOf(p) || 0) <= 500);
    if (pref === "premium") list = list.filter((p) => (priceOf(p) || 0) > 500);
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
    if (brandFilter) list = list.filter((p) => p.brand === brandFilter);
    if (materialFilter) list = list.filter((p) => (p.materials || []).indexOf(materialFilter) > -1);
    if (colorFilter) list = list.filter((p) => (p.colors || []).indexOf(colorFilter) > -1);
    if (dimFilter) list = list.filter((p) => !p.width || p.width <= Number(dimFilter));
    if (sort === "low") list.sort((a, b) => (priceOf(a) ?? 1e9) - (priceOf(b) ?? 1e9));
    else if (sort === "high") list.sort((a, b) => (priceOf(b) ?? -1) - (priceOf(a) ?? -1));
    else if (sort === "stock") list.sort((a, b) => (a.availability === "in_stock" ? -1 : 1) - (b.availability === "in_stock" ? -1 : 1));
    else list = rankMatches(list, { budgetMax: pref === "budget" ? 500 : design.budgetMax, category: active && active.category });
    return list;
  }

  function uniq(get) {
    return Array.from(new Set(results.flatMap((p) => [].concat(get(p) || [])).filter(Boolean)));
  }

  function opts(values, current) {
    return values.map((v) => `<option value="${esc(v)}"${v === current ? " selected" : ""}>${esc(v)}</option>`).join("");
  }

  /** Filters popover: every secondary filter lives here, never on the panel. */
  function paintFilterPop() {
    const pop = $("shopFPop");
    if (!pop) return;
    pop.innerHTML = `<div class="shop-fpop-h"><b>Filters</b><button class="shop-flink" id="shopClearF">Clear Filters</button></div>
      <label class="shop-fp"><span>Price</span><select id="shopPrice" class="shop-sel"><option value="">Any Price</option>
        <option value="0-250"${priceRange === "0-250" ? " selected" : ""}>Under $250</option>
        <option value="250-750"${priceRange === "250-750" ? " selected" : ""}>$250 To $750</option>
        <option value="750-1500"${priceRange === "750-1500" ? " selected" : ""}>$750 To $1,500</option>
        <option value="1500-99999"${priceRange === "1500-99999" ? " selected" : ""}>Over $1,500</option></select></label>
      <label class="shop-fp"><span>Availability</span><select id="shopAvail" class="shop-sel"><option value="">Any Availability</option>
        <option value="in_stock"${availFilter === "in_stock" ? " selected" : ""}>In Stock Only</option>
        <option value="limited"${availFilter === "limited" ? " selected" : ""}>Limited Stock</option></select></label>
      <label class="shop-fp"><span>Retailer</span><select id="shopMerch" class="shop-sel"><option value="">All Retailers</option>${opts(uniq((p) => p.merchant), merchFilter)}</select></label>
      <label class="shop-fp"><span>Brand</span><select id="shopBrand" class="shop-sel"><option value="">All Brands</option>${opts(uniq((p) => p.brand), brandFilter)}</select></label>
      <label class="shop-fp"><span>Material</span><select id="shopMat" class="shop-sel"><option value="">Any Material</option>${opts(uniq((p) => p.materials), materialFilter)}</select></label>
      <label class="shop-fp"><span>Color</span><select id="shopColor" class="shop-sel"><option value="">Any Color</option>${opts(uniq((p) => p.colors), colorFilter)}</select></label>
      <label class="shop-fp"><span>Dimensions</span><select id="shopDim" class="shop-sel"><option value="">Any Width</option>
        <option value="60"${dimFilter === "60" ? " selected" : ""}>Up To 60" Wide</option>
        <option value="84"${dimFilter === "84" ? " selected" : ""}>Up To 84" Wide</option>
        <option value="96"${dimFilter === "96" ? " selected" : ""}>Up To 96" Wide</option></select></label>`;
    const bind = (id, fn) => {
      const el = $(id);
      if (el)
        el.addEventListener("change", (e) => {
          fn(e.target.value);
          paintResults();
        });
    };
    bind("shopPrice", (v) => (priceRange = v));
    bind("shopAvail", (v) => (availFilter = v));
    bind("shopMerch", (v) => (merchFilter = v));
    bind("shopBrand", (v) => (brandFilter = v));
    bind("shopMat", (v) => (materialFilter = v));
    bind("shopColor", (v) => (colorFilter = v));
    bind("shopDim", (v) => (dimFilter = v));
    $("shopClearF").addEventListener("click", clearFilters);
    try {
      if (window.rdInitSelects) window.rdInitSelects(pop);
    } catch (_) {}
  }

  function clearFilters() {
    priceRange = availFilter = merchFilter = brandFilter = materialFilter = colorFilter = dimFilter = "";
    paintFilterPop();
    paintResults();
  }

  function paintResults() {
    const fc = $("shopFCnt");
    const n = activeFilterCount();
    if (fc) {
      fc.hidden = n === 0;
      fc.textContent = String(n);
    }
    const list = filtered();
    const box = $("shopResults");
    if (!list.length) {
      box.innerHTML = `<div class="shop-empty"><b>No Matches In This View</b><span>Widen the price range, clear a filter, or search by keyword to find a stand-in for this item.</span><button class="btn btn-ghost btn-xs" id="shopClear"><i data-lucide="filter-x"></i>Clear Filters</button></div>`;
      paintIcons();
      const c = $("shopClear");
      if (c)
        c.addEventListener("click", () => {
          query = "";
          tab = "all";
          pref = "best";
          $("shopQ").value = "";
          $("shopPref").value = "best";
          host.querySelectorAll(".shop-segb").forEach((t) => t.classList.toggle("on", t.getAttribute("data-tab") === "all"));
          clearFilters();
        });
      return;
    }
    box.innerHTML = `<div class="shop-count">${list.length} ${list.length === 1 ? "Match" : "Matches"}</div>` + list.map(card).join("");
    paintIcons();
    box.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => openDetail(b.getAttribute("data-open"))));
    box.querySelectorAll("[data-add]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        openAdd(b.getAttribute("data-add"));
      }),
    );
    box.querySelectorAll("[data-more]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = b.parentElement.classList.contains("on");
        box.querySelectorAll(".shop-more").forEach((m) => m.classList.remove("on"));
        b.parentElement.classList.toggle("on", !open);
      }),
    );
    box.querySelectorAll("[data-act]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const act = b.getAttribute("data-act");
        const id = b.getAttribute("data-id");
        const p = results.concat(savedLater).find((x) => x.id === id);
        box.querySelectorAll(".shop-more").forEach((m) => m.classList.remove("on"));
        if (!p) return;
        if (act === "save") {
          if (!savedLater.find((x) => x.id === p.id)) savedLater.push(p);
          toast("Saved For Later");
          track("shop_product_saved", { merchant: p.merchant });
        } else if (act === "compare") {
          if (compare.find((x) => x.id === p.id)) compare = compare.filter((x) => x.id !== p.id);
          else if (compare.length >= 4) return toast("Compare Holds Four Products At A Time");
          else compare.push(p);
          syncCounts();
          paintResults();
        } else if (act === "detail") {
          openDetail(p.id);
        } else if (act === "hide") {
          hidden.push(p.id);
          paintResults();
        } else if (act === "remove") {
          const rec = listProducts().find((r) => r.roomId === design.roomId && r.id === p.id);
          if (rec) removeProduct(rec.recordId);
          syncCounts();
          paintResults();
          toast("Removed From Project");
        }
      }),
    );
  }

  function card(p) {
    const mt = safeMatchType(p);
    const inCmp = !!compare.find((x) => x.id === p.id);
    const added = !!listProducts().find((r) => r.roomId === design.roomId && r.id === p.id);
    // Two status labels at most: match closeness, then availability.
    const matchLabel = mt === "exact" && p.verifiedSku ? "Exact Product" : mt === "close" ? "Close Match" : "Similar Match";
    const dims = [p.width && p.width + '" W', p.depth && p.depth + '" D'].filter(Boolean).join(" × ");
    return `<div class="shop-card" data-open="${p.id}">
      <div class="shop-card-img"><img src="${esc(p.images[0] || "")}" alt="${esc(p.name)}">${p.sample ? '<span class="shop-sample">Sample Data</span>' : ""}</div>
      <div class="shop-card-b">
        <div class="shop-card-t"><b>${esc(p.name)}</b><span class="shop-price">${money(priceOf(p))}${p.salePrice ? `<s>${money(p.regularPrice)}</s>` : ""}</span></div>
        <div class="shop-meta">${esc(p.brand)} &middot; ${esc(p.merchant)}${dims ? " &middot; " + dims : ""}</div>
        <div class="shop-tagrow">
          <span class="shop-tag ${mt === "exact" ? "ok" : "amb"}">${matchLabel}</span>
          <span class="shop-tag ${p.availability === "in_stock" ? "ok" : p.availability === "unavailable" ? "bad" : "amb"}">${p.availability === "in_stock" ? "In Stock" : p.availability === "limited" ? "Low Stock" : availabilityLabel(p.availability)}</span>
        </div>
        <div class="shop-why">${esc(p.matchNotes[0] || "Matched on category and palette.")}</div>
        <div class="shop-card-a">
          ${
            added
              ? `<button class="btn btn-dark btn-xs is-added" disabled><i data-lucide="check"></i>Added</button>`
              : `<button class="btn btn-dark btn-xs" data-add="${p.id}"><i data-lucide="plus"></i>Add To Project</button>`
          }
          <div class="shop-more">
            <button class="shop-morebtn" data-more="${p.id}" aria-label="More actions"><i data-lucide="more-horizontal"></i></button>
            <div class="shop-moremenu">
              <button data-act="save" data-id="${p.id}">Save</button>
              <button data-act="compare" data-id="${p.id}">${inCmp ? "Remove From Compare" : "Compare"}</button>
              <a href="${esc(p.affiliateUrl || p.productUrl)}" target="_blank" rel="nofollow sponsored noopener">View At Retailer</a>
              <button data-act="detail" data-id="${p.id}">Product Details</button>
              ${added ? `<button data-act="remove" data-id="${p.id}">Remove From Project</button>` : `<button data-act="hide" data-id="${p.id}">Hide This Match</button>`}
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ---------------- detail drawer ---------------- */
  function productImages(p) {
    const room = String(design.image || "");
    return (p.images || []).filter((u) => u && String(u) !== room);
  }
  function galleryHtml(p) {
    const imgs = productImages(p);
    if (!imgs.length) {
      return `<div class="shop-dr-gal"><div class="shop-img-box empty"><i data-lucide="image-off"></i><span>Product image unavailable.</span></div></div>`;
    }
    const thumbs = imgs.slice(0, 5);
    const multi = imgs.length > 1;
    return `<div class="shop-dr-gal" id="drGal">
      <div class="shop-img-box"><img id="drGalMain" src="${esc(imgs[0])}" alt="${esc(p.name)}">
        ${multi ? `<button class="shop-gal-nav prev" data-gal="prev" aria-label="Previous Image"><i data-lucide="chevron-left"></i></button><button class="shop-gal-nav next" data-gal="next" aria-label="Next Image"><i data-lucide="chevron-right"></i></button><span class="shop-gal-count" id="drGalCount">1 of ${imgs.length}</span>` : ""}
      </div>
      ${multi ? `<div class="shop-gal-thumbs">${thumbs.map((u, i) => `<button class="shop-gal-th${i === 0 ? " on" : ""}" data-gal-i="${i}" aria-label="Image ${i + 1}"><img src="${esc(u)}" alt=""></button>`).join("")}</div>` : ""}
    </div>`;
  }
  function wireGallery(p) {
    const imgs = productImages(p);
    if (imgs.length < 1) return;
    const main = $("drGalMain");
    if (!main) return;
    let i = 0;
    const set = (n) => {
      i = (n + imgs.length) % imgs.length;
      main.src = imgs[i];
      const c = $("drGalCount");
      if (c) c.textContent = `${i + 1} of ${imgs.length}`;
      document.querySelectorAll(".shop-gal-th").forEach((b) => b.classList.toggle("on", Number(b.getAttribute("data-gal-i")) === i));
    };
    document.querySelectorAll("[data-gal]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        set(i + (b.getAttribute("data-gal") === "next" ? 1 : -1));
      }),
    );
    document.querySelectorAll(".shop-gal-th").forEach((b) => b.addEventListener("click", () => set(Number(b.getAttribute("data-gal-i")))));
    main.addEventListener("click", () => {
      const lb = document.createElement("div");
      lb.className = "shop-lightbox";
      lb.innerHTML = `<img src="${esc(imgs[i])}" alt="${esc(p.name)}">`;
      lb.addEventListener("click", () => lb.remove());
      document.body.appendChild(lb);
    });
  }
  function openDetail(id) {
    const p = results.concat(savedLater).find((x) => x.id === id);
    if (!p) return;
    const mt = safeMatchType(p);
    const d = $("shopDrawer");
    d.hidden = false;
    d.innerHTML = `<div class="shop-dr">
      <div class="shop-dr-h"><b>Product Detail</b><button class="icon-btn" id="drClose" aria-label="Close product detail"><i data-lucide="x"></i></button></div>
      <div class="shop-dr-b">
        ${galleryHtml(p)}

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
    wireGallery(p);
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
      paintResults();
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
    if (compare.length < 2) return toast("Select At Least Two Products To Compare");
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
    const cb = $("shopCompareBtn");
    if (cb) {
      cb.disabled = compare.length < 2;
      cb.setAttribute("data-tip", compare.length < 2 ? "Select At Least Two Products To Compare" : "Compare " + compare.length + " Products");
    }
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
  host.querySelectorAll(".shop-segb").forEach((b) =>
    b.addEventListener("click", () => {
      tab = b.getAttribute("data-tab");
      host.querySelectorAll(".shop-segb").forEach((x) => x.classList.toggle("on", x === b));
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
  $("shopPref").addEventListener("change", (e) => {
    pref = e.target.value;
    paintResults();
  });
  paintFilterPop();
  $("shopFiltersBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const pop = $("shopFPop");
    pop.hidden = !pop.hidden;
    $("shopFiltersBtn").setAttribute("aria-expanded", String(!pop.hidden));
  });
  host.addEventListener("click", (e) => {
    const pop = $("shopFPop");
    if (pop && !pop.hidden && !e.target.closest(".shop-fwrap")) pop.hidden = true;
    if (!e.target.closest(".shop-more")) host.querySelectorAll(".shop-more").forEach((m) => m.classList.remove("on"));
  });
  $("shopDiscT").addEventListener("click", () => {
    const b = $("shopDiscB");
    b.hidden = !b.hidden;
    $("shopDiscT").setAttribute("aria-expanded", String(!b.hidden));
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
