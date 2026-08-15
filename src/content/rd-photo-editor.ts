// Unified property photo editor + listing export.
// Extends the existing app shell: it opens over the current view, reads the
// same property media store the Media view uses, and never overwrites an
// original — every save becomes a new version.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import JSZip from "jszip";
import { roomPhotoUrl, uploadRenderDataUrl } from "@/lib/room-photos";
import {
  addMediaVersion,
  approveMediaVersion,
  updateMediaVersion,
  deleteMediaVersion,
  saveExportPackage,
} from "@/lib/property-media.functions";
import { runPhotoEdit, interpretPhotoRequest, analyzePhoto } from "@/lib/photo-edit.functions";
import { track } from "@/lib/analytics";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const paint = () => {
  try {
    createIcons({ icons });
  } catch (_) {}
};

const PROPERTY_AI = [
  ["auto_enhance", "Auto Enhance"],
  ["window_balance", "Window Balance"],
  ["hdr_merge", "HDR Merge"],
  ["sky", "Sky Enhancement"],
  ["lawn", "Lawn Enhancement"],
  ["dusk", "Day To Dusk"],
  ["object_removal", "Object Removal"],
  ["declutter", "Declutter"],
  ["privacy_blur", "Privacy Blur"],
  ["reflection", "Remove Camera Reflection"],
  ["tv_off", "Turn Off TV"],
  ["fireplace", "Add Fire To Fireplace"],
];

const DESIGN_AI = [
  ["stage", "Virtual Stage"],
  ["redesign", "Redesign"],
  ["empty_room", "Empty Room"],
  ["replace_furniture", "Replace Furniture"],
  ["exterior", "Exterior Design"],
  ["landscape", "Garden Design"],
  ["renovation", "Renovation Visualization"],
];

const QUICK = [
  ["Remove Camera Reflection", "Remove the camera reflection from the mirror and glass."],
  ["Black TV Screen", "Turn the television screen off so it reads as a clean black panel."],
  ["Add Fire To Fireplace", "Add a realistic fire in the fireplace."],
  ["Improve Window View", "Balance the window exposure so the view outside is visible."],
  ["Remove Cords", "Remove the visible cords and cables."],
  ["Remove Trash Bins", "Remove the trash bins from the driveway."],
  ["Green Lawn", "Green the lawn but preserve the existing landscaping."],
  ["Create Twilight", "Create a realistic twilight version of this exterior."],
  ["Replace Curtains", "Replace the curtains with neutral linen curtains."],
  ["Remove Personal Photos", "Remove personal photographs from the walls."],
  ["Blur Faces", "Blur any visible faces."],
  ["Blur License Plates", "Blur any visible license plates."],
  ["Virtual Stage", "Virtually stage this room in a warm minimal direction."],
  ["Declutter", "Declutter the surfaces without changing the furniture."],
];

const ADJUST = [
  ["exposure", "Exposure", -100, 100, 0],
  ["contrast", "Contrast", -100, 100, 0],
  ["temperature", "Temperature", -100, 100, 0],
  ["tint", "Tint", -100, 100, 0],
  ["saturation", "Saturation", -100, 100, 0],
  ["highlights", "Highlights", -100, 100, 0],
  ["shadows", "Shadows", -100, 100, 0],
  ["whites", "Whites", -100, 100, 0],
  ["blacks", "Blacks", -100, 100, 0],
  ["sharpen", "Sharpening", 0, 100, 0],
  ["denoise", "Noise Reduction", 0, 100, 0],
];

const GEOMETRY = [
  ["rotate", "Rotate", -180, 180, 0],
  ["straighten", "Straighten", -15, 15, 0],
  ["vertical", "Vertical Correction", -30, 30, 0],
  ["horizontal", "Horizontal Correction", -30, 30, 0],
  ["perspective", "Perspective Correction", -30, 30, 0],
  ["lens", "Lens Correction", -30, 30, 0],
  ["crop", "Crop, Edge Trim", 0, 25, 0],
];

const DISCLOSURES = [
  "Virtually Staged",
  "Digitally Enhanced",
  "Digitally Altered",
  "AI-Generated Concept",
  "Proposed Design",
  "Renovation Visualization",
  "Custom Disclosure",
];

const PRESETS = {
  mls: { label: "MLS Package", w: 2048, type: "image/jpeg", q: 0.86, disclosure: true },
  portal: { label: "Listing Portal Package", w: 1920, type: "image/jpeg", q: 0.85, disclosure: true },
  social: { label: "Social Media Package", w: 1080, type: "image/jpeg", q: 0.85, disclosure: true },
  print: { label: "Print Package", w: 3000, type: "image/jpeg", q: 0.95, disclosure: true },
  client: { label: "Client Review Package", w: 1600, type: "image/jpeg", q: 0.85, disclosure: true },
  contractor: { label: "Contractor Presentation", w: 1600, type: "image/jpeg", q: 0.85, disclosure: true },
  original: { label: "Original Resolution", w: 0, type: "image/jpeg", q: 0.95, disclosure: true },
  custom: { label: "Custom Export", w: 2048, type: "image/jpeg", q: 0.9, disclosure: true },
};

function host(cls) {
  let el = document.querySelector("." + cls);
  if (!el) {
    el = document.createElement("div");
    el.className = cls;
    (document.querySelector(".rd-app") || document.body).appendChild(el);
  }
  return el;
}

function filterCSS(a) {
  const br = 1 + a.exposure / 220 + a.whites / 900 - a.blacks / 900;
  const ct = 1 + a.contrast / 180 + a.highlights / 900 - a.shadows / 900;
  const sat = 1 + a.saturation / 130;
  const sep = Math.max(0, a.temperature) / 420;
  const hue = a.tint / 12 + (a.temperature < 0 ? a.temperature / 22 : 0);
  const blurPx = a.denoise / 130;
  const parts = [
    `brightness(${br.toFixed(3)})`,
    `contrast(${ct.toFixed(3)})`,
    `saturate(${sat.toFixed(3)})`,
    `hue-rotate(${hue.toFixed(2)}deg)`,
  ];
  if (sep > 0.001) parts.push(`sepia(${sep.toFixed(3)})`);
  if (blurPx > 0.02) parts.push(`blur(${blurPx.toFixed(2)}px)`);
  return parts.join(" ");
}

function transformCSS(g) {
  return [
    `rotate(${(g.rotate + g.straighten).toFixed(2)}deg)`,
    `perspective(1200px)`,
    `rotateX(${(g.vertical / 2 + g.perspective / 3).toFixed(2)}deg)`,
    `rotateY(${(g.horizontal / 2).toFixed(2)}deg)`,
    `scale(${(1 + g.crop / 100 + Math.abs(g.lens) / 300).toFixed(3)})`,
  ].join(" ");
}

function blankAdjust() {
  const a = {};
  ADJUST.forEach(([k, , , , d]) => (a[k] = d));
  return a;
}
function blankGeometry() {
  const g = {};
  GEOMETRY.forEach(([k, , , , d]) => (g[k] = d));
  return g;
}

async function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Image could not be loaded."));
    i.src = src;
  });
}

/** Bake the live preview settings into a real pixel render for the new version. */
async function renderToDataUrl(src, adj, geo, maxW) {
  const img = await loadImg(src);
  const scale = maxW && img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.filter = filterCSS(adj);
  const zoom = 1 + geo.crop / 100 + Math.abs(geo.lens) / 300;
  ctx.translate(w / 2, h / 2);
  ctx.rotate((((geo.rotate + geo.straighten) * Math.PI) / 180));
  ctx.scale(zoom, zoom);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return c.toDataURL("image/jpeg", 0.92);
}

/* =======================================================================
   PHOTO EDITOR
   ======================================================================= */

export async function openPhotoEditor(ctx) {
  const wrap = host("pme-wrap");
  wrap.classList.add("on");
  document.body.style.overflow = "hidden";
  let assets = ctx.assets.slice();
  let idx = Math.max(0, assets.findIndex((a) => a.id === ctx.assetId));
  if (idx < 0) idx = 0;
  let tab = "analyze";
  let compare = "current";
  let adj = blankAdjust();
  let geo = blankGeometry();
  let baseUrl = "";
  let originalUrl = "";
  let versions = [];
  let activeVersionId = null;
  let busy = false;
  let pending = null;
  const analysis = {}; // asset id -> { loading, error, data }
  const picked = new Set(); // asset ids selected for batch work

  const asset = () => assets[idx];

  function shell() {
    wrap.innerHTML = `<div class="pme">
      <div class="pme-top">
        <div class="pme-ctx">
          <span class="pme-kick">${esc(ctx.propertyLabel || "Property Media")}</span>
          <b id="pmeRoom"></b>
          <span class="pme-sub" id="pmeSub"></span>
        </div>
        <div class="pme-top-r">
          <div class="pme-seg" id="pmeCompare" role="group" aria-label="Compare views">
            <button class="on" data-c="current">Current</button>
            <button data-c="original">Original</button>
            <button data-c="slider">Slider</button>
            <button data-c="side">Side By Side</button>
          </div>
          <button class="btn btn-ghost btn-xs" id="pmeHold"><i data-lucide="eye"></i>Hold To Compare</button>
          <button class="btn btn-dark btn-xs" id="pmeSave"><i data-lucide="save"></i>Save Version</button>
          <button class="btn btn-primary btn-xs" id="pmeApprove"><i data-lucide="check"></i>Approve</button>
          <button class="icon-btn" id="pmeClose" aria-label="Close photo editor"><i data-lucide="x"></i></button>
        </div>
      </div>
      <div class="pme-body">
        <div class="pme-stage">
          <div class="pme-canvas" id="pmeCanvas"></div>
          <div class="pme-strip" id="pmeStrip" role="list" aria-label="Property filmstrip"></div>
        </div>
        <aside class="pme-side">
          <div class="pme-tabs" role="tablist">
            <button class="on" data-t="analyze" role="tab">Analyze</button>
            <button data-t="adjust" role="tab">Adjust</button>
            <button data-t="geometry" role="tab">Geometry</button>
            <button data-t="property" role="tab">Property AI</button>
            <button data-t="design" role="tab">Design AI</button>
            <button data-t="history" role="tab">Versions</button>
          </div>
          <div class="pme-pane" id="pmePane"></div>
        </aside>
      </div>
      <div class="pme-toast" id="pmeToast" role="status" aria-live="polite"></div>
    </div>`;
    paint();
    wrap.querySelector("#pmeClose").onclick = close;
    wrap.querySelector("#pmeSave").onclick = saveVersion;
    wrap.querySelector("#pmeApprove").onclick = approveCurrent;
    wrap.querySelectorAll("#pmeCompare button").forEach((b) => {
      b.onclick = () => {
        compare = b.dataset.c;
        wrap.querySelectorAll("#pmeCompare button").forEach((x) => x.classList.toggle("on", x === b));
        renderStage();
      };
    });
    const hold = wrap.querySelector("#pmeHold");
    const show = (v) => {
      const el = wrap.querySelector("#pmeMain");
      if (el) el.style.opacity = v ? "0" : "1";
    };
    ["mousedown", "touchstart"].forEach((e) => hold.addEventListener(e, () => show(true)));
    ["mouseup", "mouseleave", "touchend"].forEach((e) => hold.addEventListener(e, () => show(false)));
    hold.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        show(true);
      }
    });
    hold.addEventListener("keyup", () => show(false));
    wrap.querySelectorAll(".pme-tabs button").forEach((b) => {
      b.onclick = () => {
        tab = b.dataset.t;
        wrap.querySelectorAll(".pme-tabs button").forEach((x) => x.classList.toggle("on", x === b));
        renderPane();
      };
    });
  }

  function toast(m) {
    const t = wrap.querySelector("#pmeToast");
    if (!t) return;
    t.textContent = m;
    t.classList.add("on");
    setTimeout(() => t.classList.remove("on"), 3200);
  }

  function close() {
    wrap.classList.remove("on");
    wrap.innerHTML = "";
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKey);
    ctx.reload && ctx.reload();
  }
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);

  async function loadAsset() {
    adj = blankAdjust();
    geo = blankGeometry();
    const a = asset();
    versions = (ctx.versions || []).filter((v) => v.asset_id === a.id && !v.archived);
    originalUrl = (await roomPhotoUrl(a.storage_path)) || "";
    const approved = versions.find((v) => v.id === a.approved_version_id) || versions[versions.length - 1];
    activeVersionId = approved ? approved.id : null;
    baseUrl = approved ? (await roomPhotoUrl(approved.storage_path)) || originalUrl : originalUrl;
    wrap.querySelector("#pmeRoom").textContent = a.room_group;
    wrap.querySelector("#pmeSub").textContent =
      `${a.modification_class} · ${a.width || "?"}×${a.height || "?"} · ${versions.length} Saved Version${versions.length === 1 ? "" : "s"}`;
    renderStage();
    renderStrip();
    renderPane();
  }

  function renderStage() {
    const c = wrap.querySelector("#pmeCanvas");
    const f = filterCSS(adj);
    const t = transformCSS(geo);
    if (compare === "side") {
      c.innerHTML = `<div class="pme-side2">
        <figure><img src="${esc(originalUrl)}" alt="Original photo"><figcaption>Original</figcaption></figure>
        <figure><img id="pmeMain" src="${esc(baseUrl)}" alt="Current version" style="filter:${f};transform:${t}"><figcaption>Current</figcaption></figure>
      </div>`;
    } else if (compare === "slider") {
      c.innerHTML = `<div class="pme-slide" id="pmeSlide">
        <img src="${esc(originalUrl)}" alt="Original photo">
        <div class="pme-slide-top" id="pmeTop"><img id="pmeMain" src="${esc(baseUrl)}" alt="Current version" style="filter:${f};transform:${t}"></div>
        <input type="range" min="0" max="100" value="50" aria-label="Before and after position" id="pmeRange">
      </div>`;
      const r = c.querySelector("#pmeRange");
      const top = c.querySelector("#pmeTop");
      const set = () => (top.style.width = r.value + "%");
      r.oninput = set;
      set();
    } else {
      const src = compare === "original" ? originalUrl : baseUrl;
      const style = compare === "original" ? "" : `filter:${f};transform:${t}`;
      c.innerHTML = `<img id="pmeMain" src="${esc(src)}" alt="${compare === "original" ? "Original photo" : "Current version"}" style="${style}">`;
    }
    paint();
  }

  async function renderStrip() {
    const s = wrap.querySelector("#pmeStrip");
    s.innerHTML = assets
      .map((a, i) => {
        const an = analysis[a.id];
        const badge = an && an.data
          ? `<span class="pme-th-badge ${an.data.issues.length ? "warn" : "ok"}">${an.data.issues.length ? an.data.issues.length + " Fix" + (an.data.issues.length === 1 ? "" : "es") : "Clean"}</span>`
          : an && an.loading
            ? `<span class="pme-th-badge">Analyzing</span>`
            : "";
        return `<div class="pme-thumb-wrap${picked.has(a.id) ? " picked" : ""}">
          <button class="pme-thumb${i === idx ? " on" : ""}" data-i="${i}" role="listitem" aria-current="${i === idx}" title="${esc(a.room_group)}"><span class="pme-th-img" data-p="${esc(a.storage_path)}"></span>${badge}<em>${esc(a.room_group)}</em></button>
          <label class="pme-th-pick" title="Select For Batch Edit"><input type="checkbox" data-pick="${esc(a.id)}" ${picked.has(a.id) ? "checked" : ""} aria-label="Select ${esc(a.room_group)} for batch edit"></label>
        </div>`;
      })
      .join("");
    s.querySelectorAll(".pme-thumb").forEach((b) => {
      b.onclick = () => {
        idx = Number(b.dataset.i);
        loadAsset();
      };
    });
    s.querySelectorAll("[data-pick]").forEach((c) => {
      c.onchange = () => {
        if (c.checked) picked.add(c.dataset.pick);
        else picked.delete(c.dataset.pick);
        c.closest(".pme-thumb-wrap").classList.toggle("picked", c.checked);
        if (tab === "analyze" || tab === "property" || tab === "design") renderPane();
      };
    });
    for (const el of s.querySelectorAll(".pme-th-img")) {
      const url = await roomPhotoUrl(el.dataset.p);
      if (url) el.style.backgroundImage = `url("${url}")`;
    }
  }

  function targets() {
    const list = assets.filter((a) => picked.has(a.id));
    return list.length ? list : [asset()];
  }


  function sliders(list, store) {
    return list
      .map(
        ([k, label, min, max]) => `<label class="pme-sl">
      <span>${esc(label)}<b>${store[k]}</b></span>
      <input type="range" min="${min}" max="${max}" value="${store[k]}" data-k="${k}" aria-label="${esc(label)}">
    </label>`,
      )
      .join("");
  }

  function renderPane() {
    const p = wrap.querySelector("#pmePane");
    if (tab === "analyze") {
      renderAnalyze(p);
      paint();
      return;
    }
    if (tab === "adjust" || tab === "geometry") {
      const list = tab === "adjust" ? ADJUST : GEOMETRY;
      const store = tab === "adjust" ? adj : geo;
      p.innerHTML = `<div class="pme-group">${sliders(list, store)}</div>
        <button class="btn btn-ghost btn-xs" id="pmeReset"><i data-lucide="rotate-ccw"></i>Reset ${tab === "adjust" ? "Adjustments" : "Geometry"}</button>
        <p class="pme-note">Adjustments preview live and only become a saved version when you choose Save Version. The original upload is never overwritten.</p>`;
      p.querySelectorAll("input[type=range]").forEach((r) => {
        r.oninput = () => {
          store[r.dataset.k] = Number(r.value);
          r.previousElementSibling && (r.parentElement.querySelector("b").textContent = r.value);
          renderStage();
        };
      });
      p.querySelector("#pmeReset").onclick = () => {
        if (tab === "adjust") adj = blankAdjust();
        else geo = blankGeometry();
        renderPane();
        renderStage();
      };
    } else if (tab === "property" || tab === "design") {
      const list = tab === "property" ? PROPERTY_AI : DESIGN_AI;
      const kind = tab === "property" ? "Property AI" : "Design AI";
      p.innerHTML = `<div class="pme-kind ${tab}">
          <b>${kind}</b>
          <span>${tab === "property" ? "Improves the real photograph. Saved to Media." : "Materially changes or stages the property. Saved to My Designs and labeled."}</span>
        </div>
        <div class="pme-ops">${list.map(([k, l]) => `<button class="pme-op" data-op="${k}">${esc(l)}</button>`).join("")}</div>
        <div class="pme-ai">
          <label class="pme-ai-l" for="pmeAsk">Describe What You Want To Change</label>
          <textarea id="pmeAsk" rows="3" placeholder="Describe what you want to change"></textarea>
          <button class="btn btn-dark btn-xs" id="pmeAskBtn"><i data-lucide="sparkles"></i>Review Edit</button>
          <div class="pme-quick">${QUICK.map(([l, v]) => `<button class="pme-chip" data-q="${esc(v)}">${esc(l)}</button>`).join("")}</div>
          <div id="pmeReview"></div>
        </div>
        <p class="pme-note">Each AI edit uses 1 credit and is saved as a new version. ${tab === "design" ? "Design outputs are labeled as modified and cannot be exported as unmodified originals." : ""}</p>`;
      paint();
      p.querySelectorAll(".pme-op").forEach((b) => {
        b.onclick = () => confirmSteps([{ family: tab, op: b.dataset.op, label: b.textContent }], null);
      });
      p.querySelectorAll(".pme-chip").forEach((b) => {
        b.onclick = () => {
          p.querySelector("#pmeAsk").value = b.dataset.q;
        };
      });
      p.querySelector("#pmeAskBtn").onclick = interpret;
    } else {
      renderHistory(p);
    }
    paint();
  }

  async function interpret() {
    const t = wrap.querySelector("#pmeAsk");
    const req = (t.value || "").trim();
    if (req.length < 3) return toast("Describe the change you want first.");
    const box = wrap.querySelector("#pmeReview");
    box.innerHTML = `<div class="pme-review"><b>Reading Your Request</b></div>`;
    try {
      const out = await interpretPhotoRequest({ data: { request: req } });
      if (!out.steps.length) {
        box.innerHTML = `<div class="pme-review"><b>No Matching Edit</b><span>Try naming one of the quick actions above.</span></div>`;
        return;
      }
      confirmSteps(out.steps, req, out.summary, out.material);
    } catch (e) {
      box.innerHTML = `<div class="pme-review err"><b>Could Not Read That Request</b><span>${esc(e.message || e)}</span></div>`;
    }
  }

  function confirmSteps(steps, instruction, summary, material) {
    const box = wrap.querySelector("#pmeReview") || wrap.querySelector("#pmePane");
    const isMaterial = material || steps.some((s) => s.family === "design");
    pending = { steps, instruction };
    box.innerHTML = `<div class="pme-review">
      <b>Review Edit</b>
      ${summary ? `<span>${esc(summary)}</span>` : ""}
      <ul>${steps.map((s) => `<li>${esc(s.label)}</li>`).join("")}</ul>
      <span>Apply to: This photo · ${steps.length} credit${steps.length === 1 ? "" : "s"}</span>
      ${isMaterial ? `<div class="pme-disc"><i data-lucide="triangle-alert"></i>This materially changes the property. It will be saved as Design Media and labeled as modified.</div>` : ""}
      <div class="pme-review-a">
        <button class="btn btn-primary btn-xs" id="pmeApply"><i data-lucide="play"></i>Apply Edit</button>
        <button class="btn btn-ghost btn-xs" id="pmeChange">Change Request</button>
        <button class="btn btn-ghost btn-xs" id="pmeCancel">Cancel</button>
      </div>
    </div>`;
    paint();
    box.querySelector("#pmeApply").onclick = () => applySteps();
    box.querySelector("#pmeChange").onclick = () => {
      box.innerHTML = "";
      const t = wrap.querySelector("#pmeAsk");
      t && t.focus();
    };
    box.querySelector("#pmeCancel").onclick = () => (box.innerHTML = "");
  }

  async function applySteps() {
    if (busy || !pending) return;
    busy = true;
    const box = wrap.querySelector("#pmeReview") || wrap.querySelector("#pmePane");
    box.innerHTML = `<div class="pme-review"><b>Applying Edit</b><span>Working on ${pending.steps.length} step${pending.steps.length === 1 ? "" : "s"}. You can watch the result appear above.</span></div>`;
    let image = null;
    try {
      let src = baseUrl;
      let last = null;
      for (const step of pending.steps) {
        const dataUrl = /^data:/.test(src) ? src : await toDataUrl(src);
        last = await runPhotoEdit({
          data: {
            family: step.family,
            op: step.op,
            image: dataUrl,
            room: asset().room_group,
            direction: ctx.direction || "Warm Minimal",
            instruction: pending.instruction || null,
          },
        });
        src = last.image;
        image = last.image;
        track("ai_edit_submitted", { family: step.family });
      }
      const path = await uploadRenderDataUrl(image);
      const row = await addMediaVersion({
        data: {
          asset_id: asset().id,
          label: pending.steps.map((s) => s.label).join(" + "),
          kind: last.family === "design" ? "design" : "ai_edit",
          modification_class: last.modification_class,
          storage_path: path,
          ops: { steps: pending.steps.map((s) => s.op) },
          approve: false,
        },
      });
      ctx.versions.push(row);
      asset().modification_class = last.modification_class;
      baseUrl = image;
      activeVersionId = row.id;
      versions = ctx.versions.filter((v) => v.asset_id === asset().id && !v.archived);
      adj = blankAdjust();
      geo = blankGeometry();
      renderStage();
      box.innerHTML = "";
      toast(`${row.label} saved as a new version.`);
    } catch (e) {
      box.innerHTML = `<div class="pme-review err"><b>Edit Failed</b><span>${esc(e.message || e)}</span><div class="pme-review-a"><button class="btn btn-ghost btn-xs" id="pmeRetry">Retry</button></div></div>`;
      const r = box.querySelector("#pmeRetry");
      r && (r.onclick = () => applySteps());
    } finally {
      busy = false;
      pending = null;
    }
  }

  async function toDataUrl(url) {
    const blob = await (await fetch(url)).blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.readAsDataURL(blob);
    });
  }

  function renderHistory(p) {
    const a = asset();
    const rows = [
      { id: null, label: "Original Upload", modification_class: "Unmodified Original", created_at: a.created_at },
      ...versions,
    ];
    p.innerHTML = `<div class="pme-hist">${rows
      .map(
        (v) => `<div class="pme-hrow${(activeVersionId || null) === v.id ? " on" : ""}" data-v="${v.id || ""}">
        <div class="pme-hmain"><b>${esc(v.label)}</b><span>${esc(v.modification_class)}${v.id === a.approved_version_id ? " · Approved" : ""}</span></div>
        <div class="pme-hact">
          <button class="icon-btn" data-a="view" title="View This Version" aria-label="View ${esc(v.label)}"><i data-lucide="eye"></i></button>
          ${v.id ? `<button class="icon-btn" data-a="approve" title="Approve" aria-label="Approve ${esc(v.label)}"><i data-lucide="check"></i></button>
          <button class="icon-btn" data-a="rename" title="Rename" aria-label="Rename ${esc(v.label)}"><i data-lucide="pencil"></i></button>
          <button class="icon-btn" data-a="archive" title="Archive" aria-label="Archive ${esc(v.label)}"><i data-lucide="archive"></i></button>
          <button class="icon-btn" data-a="delete" title="Delete" aria-label="Delete ${esc(v.label)}"><i data-lucide="trash-2"></i></button>` : ""}
        </div>
      </div>`,
      )
      .join("")}</div>
      <p class="pme-note">The original upload is always retained. Approving a version is what export packages use.</p>`;
    paint();
    p.querySelectorAll(".pme-hrow").forEach((row) => {
      const id = row.dataset.v || null;
      row.querySelectorAll("[data-a]").forEach((b) => {
        b.onclick = async (e) => {
          e.stopPropagation();
          const act = b.dataset.a;
          const v = versions.find((x) => x.id === id);
          if (act === "view") {
            activeVersionId = id;
            baseUrl = id ? (await roomPhotoUrl(v.storage_path)) || originalUrl : originalUrl;
            adj = blankAdjust();
            geo = blankGeometry();
            renderStage();
            renderPane();
          } else if (act === "approve") {
            await approveMediaVersion({ data: { asset_id: asset().id, version_id: id } });
            asset().approved_version_id = id;
            track("version_approved", {});
            toast("Version approved.");
            renderPane();
          } else if (act === "rename") {
            const name = prompt("Rename this version", v.label);
            if (!name) return;
            await updateMediaVersion({ data: { id, label: name.slice(0, 80) } });
            v.label = name.slice(0, 80);
            renderPane();
          } else if (act === "archive") {
            await updateMediaVersion({ data: { id, archived: true } });
            v.archived = true;
            versions = versions.filter((x) => x.id !== id);
            renderPane();
          } else if (act === "delete") {
            if (!confirm("Delete this version? The original upload is kept.")) return;
            await deleteMediaVersion({ data: { id } });
            const i = ctx.versions.findIndex((x) => x.id === id);
            if (i >= 0) ctx.versions.splice(i, 1);
            versions = versions.filter((x) => x.id !== id);
            if (activeVersionId === id) {
              activeVersionId = null;
              baseUrl = originalUrl;
              renderStage();
            }
            renderPane();
          }
        };
      });
    });
  }

  async function saveVersion() {
    if (busy) return;
    const changed =
      ADJUST.some(([k, , , , d]) => adj[k] !== d) || GEOMETRY.some(([k, , , , d]) => geo[k] !== d);
    if (!changed) return toast("Move an adjustment or geometry control first.");
    busy = true;
    try {
      const dataUrl = await renderToDataUrl(baseUrl, adj, geo, 2600);
      const path = await uploadRenderDataUrl(dataUrl);
      const row = await addMediaVersion({
        data: {
          asset_id: asset().id,
          label: "Manual Adjustments",
          kind: "enhanced",
          modification_class: "Enhanced",
          storage_path: path,
          ops: { adjust: adj, geometry: geo },
          approve: false,
        },
      });
      ctx.versions.push(row);
      versions = ctx.versions.filter((v) => v.asset_id === asset().id && !v.archived);
      activeVersionId = row.id;
      baseUrl = dataUrl;
      adj = blankAdjust();
      geo = blankGeometry();
      renderStage();
      renderPane();
      toast("Saved as a new version.");
    } catch (e) {
      toast(e.message || "Save failed.");
    } finally {
      busy = false;
    }
  }

  async function approveCurrent() {
    if (!activeVersionId) {
      await approveMediaVersion({ data: { asset_id: asset().id, version_id: null } });
      asset().approved_version_id = null;
      return toast("Original marked as the approved version.");
    }
    await approveMediaVersion({ data: { asset_id: asset().id, version_id: activeVersionId } });
    asset().approved_version_id = activeVersionId;
    track("version_approved", {});
    toast("Version approved.");
    renderPane();
  }

  shell();
  await loadAsset();
}

/* =======================================================================
   EXPORT PACKAGES
   ======================================================================= */

export async function openExportDialog(ctx) {
  const wrap = host("pmx-wrap");
  wrap.classList.add("on");
  document.body.style.overflow = "hidden";
  const assets = ctx.assets.filter((a) => !a.hidden);
  let selected = new Set(ctx.selected && ctx.selected.length ? ctx.selected : assets.map((a) => a.id));
  let preset = "mls";
  let running = false;

  const wm = {
    on: false,
    text: ctx.propertyLabel ? "REAL DESIGNS" : "REAL DESIGNS",
    position: "bottom-right",
    size: 26,
    opacity: 55,
    padding: 28,
  };
  const disc = { on: true, preset: "Auto By Modification Type", text: "", position: "bottom-left", size: 22, contrast: "dark" };

  function render() {
    const p = PRESETS[preset];
    const files = assets.filter((a) => selected.has(a.id));
    const est = Math.round((files.length * (p.w ? p.w / 1000 : 3) * 0.42 + 0.2) * 10) / 10;
    wrap.innerHTML = `<div class="pmx" role="dialog" aria-label="Export listing package">
      <div class="pmx-h"><div><b>Export Package</b><span>${esc(ctx.propertyLabel || "Property Media")}</span></div>
        <button class="icon-btn" id="pmxClose" aria-label="Close export"><i data-lucide="x"></i></button></div>
      <div class="pmx-b">
        <div class="pmx-col">
          <div class="pmx-lab">Preset</div>
          <div class="pmx-presets">${Object.entries(PRESETS)
            .map(([k, v]) => `<button class="pmx-p${k === preset ? " on" : ""}" data-p="${k}">${esc(v.label)}</button>`)
            .join("")}</div>
          <div class="pmx-lab">Included Photos</div>
          <div class="pmx-chips">
            <button class="pmx-chip" data-sel="all">All Photos<span>${assets.length}</span></button>
            <button class="pmx-chip" data-sel="rec">Recommended<span>${assets.filter((a) => a.recommended).length}</span></button>
            <button class="pmx-chip" data-sel="approved">Approved Versions<span>${assets.filter((a) => a.approved_version_id).length}</span></button>
          </div>
          <div class="pmx-lab">Watermark</div>
          <label class="pmx-row"><input type="checkbox" id="wmOn" ${wm.on ? "checked" : ""}> Apply Brand Watermark</label>
          <input class="pmx-in" id="wmText" value="${esc(wm.text)}" aria-label="Watermark text" placeholder="Brokerage, agent or photographer">
          <div class="pmx-grid">
            <label>Position<select id="wmPos">${["bottom-right", "bottom-left", "top-right", "top-left", "center"]
              .map((v) => `<option ${v === wm.position ? "selected" : ""}>${v}</option>`)
              .join("")}</select></label>
            <label>Size<input type="range" id="wmSize" min="12" max="60" value="${wm.size}"></label>
            <label>Opacity<input type="range" id="wmOp" min="10" max="100" value="${wm.opacity}"></label>
            <label>Padding<input type="range" id="wmPad" min="8" max="80" value="${wm.padding}"></label>
          </div>
        </div>
        <div class="pmx-col">
          <div class="pmx-lab">Modification Disclosure</div>
          <label class="pmx-row"><input type="checkbox" id="dcOn" ${disc.on ? "checked" : ""}> Apply Disclosure Label</label>
          <label class="pmx-row2">Preset<select id="dcPreset"><option>Auto By Modification Type</option>${DISCLOSURES.map(
            (d) => `<option ${d === disc.preset ? "selected" : ""}>${esc(d)}</option>`,
          ).join("")}</select></label>
          <input class="pmx-in" id="dcText" value="${esc(disc.text)}" placeholder="Custom disclosure text" aria-label="Custom disclosure text">
          <div class="pmx-grid">
            <label>Position<select id="dcPos">${["bottom-left", "bottom-right", "top-left", "top-right"]
              .map((v) => `<option ${v === disc.position ? "selected" : ""}>${v}</option>`)
              .join("")}</select></label>
            <label>Size<input type="range" id="dcSize" min="12" max="48" value="${disc.size}"></label>
            <label>Contrast<select id="dcContrast"><option value="dark" ${disc.contrast === "dark" ? "selected" : ""}>Dark Plate</option><option value="light" ${disc.contrast === "light" ? "selected" : ""}>Light Plate</option></select></label>
          </div>
          <p class="pmx-note">Disclosure requirements vary by brokerage, marketplace and location. Confirm the requirements that apply to your listing.</p>
          <div class="pmx-sum">
            <b>Package Summary</b>
            <div><span>Files</span><b>${files.length}</b></div>
            <div><span>Versions</span><b>Approved, Falls Back To Original</b></div>
            <div><span>Resolution</span><b>${p.w ? p.w + " px Wide" : "Original"}</b></div>
            <div><span>Watermark</span><b>${wm.on ? "On" : "Off"}</b></div>
            <div><span>Disclosure</span><b>${disc.on ? "On" : "Off"}</b></div>
            <div><span>Estimated Size</span><b>~${est} MB</b></div>
          </div>
          <div class="pmx-act">
            <button class="btn btn-primary" id="pmxRun"><i data-lucide="download"></i>Build Package</button>
            <button class="btn btn-ghost" id="pmxCancel">Cancel</button>
          </div>
          <div id="pmxStatus" class="pmx-status" role="status" aria-live="polite"></div>
        </div>
      </div>
    </div>`;
    paint();
    wrap.querySelector("#pmxClose").onclick = close;
    wrap.querySelector("#pmxCancel").onclick = close;
    wrap.querySelectorAll(".pmx-p").forEach((b) => (b.onclick = () => ((preset = b.dataset.p), render())));
    wrap.querySelectorAll(".pmx-chip").forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.sel;
        selected = new Set(
          assets
            .filter((a) => (k === "all" ? true : k === "rec" ? a.recommended : Boolean(a.approved_version_id)))
            .map((a) => a.id),
        );
        render();
      };
    });
    const bind = (id, fn) => {
      const el = wrap.querySelector("#" + id);
      el && (el.onchange = () => (fn(el), render()));
    };
    bind("wmOn", (el) => (wm.on = el.checked));
    bind("wmText", (el) => (wm.text = el.value));
    bind("wmPos", (el) => (wm.position = el.value));
    bind("wmSize", (el) => (wm.size = Number(el.value)));
    bind("wmOp", (el) => (wm.opacity = Number(el.value)));
    bind("wmPad", (el) => (wm.padding = Number(el.value)));
    bind("dcOn", (el) => (disc.on = el.checked));
    bind("dcPreset", (el) => (disc.preset = el.value));
    bind("dcText", (el) => (disc.text = el.value));
    bind("dcPos", (el) => (disc.position = el.value));
    bind("dcSize", (el) => (disc.size = Number(el.value)));
    bind("dcContrast", (el) => (disc.contrast = el.value));
    wrap.querySelector("#pmxRun").onclick = build;
  }

  function close() {
    wrap.classList.remove("on");
    wrap.innerHTML = "";
    document.body.style.overflow = "";
  }

  function place(pos, w, h, pad) {
    const map = {
      "bottom-right": [w - pad, h - pad, "right", "bottom"],
      "bottom-left": [pad, h - pad, "left", "bottom"],
      "top-right": [w - pad, pad, "right", "top"],
      "top-left": [pad, pad, "left", "top"],
      center: [w / 2, h / 2, "center", "middle"],
    };
    return map[pos] || map["bottom-right"];
  }

  function stamp(ctx2, text, opt, w, h) {
    const [x, y, align, baseline] = place(opt.position, w, h, opt.padding ?? 24);
    const size = Math.max(12, Math.round((opt.size / 1000) * w));
    ctx2.font = `600 ${size}px "DM Sans", system-ui, sans-serif`;
    ctx2.textAlign = align;
    ctx2.textBaseline = baseline === "middle" ? "middle" : baseline;
    const m = ctx2.measureText(text);
    if (opt.plate) {
      const padX = size * 0.6;
      const padY = size * 0.42;
      const bw = m.width + padX * 2;
      const bh = size + padY * 2;
      const bx = align === "right" ? x - bw : align === "center" ? x - bw / 2 : x;
      const by = baseline === "bottom" ? y - bh : baseline === "middle" ? y - bh / 2 : y;
      ctx2.fillStyle = opt.plate === "light" ? "rgba(255,255,255,.88)" : "rgba(17,17,17,.72)";
      ctx2.fillRect(bx, by, bw, bh);
      ctx2.fillStyle = opt.plate === "light" ? "#111" : "#fff";
      ctx2.fillText(
        text,
        align === "right" ? x - padX : align === "center" ? x : x + padX,
        baseline === "bottom" ? y - padY : baseline === "middle" ? y : y + padY + size * 0.1,
      );
    } else {
      ctx2.globalAlpha = (opt.opacity ?? 60) / 100;
      ctx2.fillStyle = "#fff";
      ctx2.shadowColor = "rgba(0,0,0,.55)";
      ctx2.shadowBlur = size * 0.4;
      ctx2.fillText(text, x, y);
      ctx2.shadowBlur = 0;
      ctx2.globalAlpha = 1;
    }
  }

  function discFor(a, versions) {
    if (disc.preset !== "Auto By Modification Type") return disc.preset === "Custom Disclosure" ? disc.text || "Custom Disclosure" : disc.preset;
    const v = versions.find((x) => x.id === a.approved_version_id);
    const cls = v ? v.modification_class : a.modification_class;
    if (!cls || cls === "Unmodified Original") return "";
    return cls === "Enhanced" ? "Digitally Enhanced" : cls;
  }

  function safe(s) {
    return String(s || "")
      .trim()
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function build() {
    if (running) return;
    running = true;
    const status = wrap.querySelector("#pmxStatus");
    const p = PRESETS[preset];
    const list = assets.filter((a) => selected.has(a.id));
    track("export_started", { preset, files: list.length });
    const zip = new JSZip();
    const counters = {};
    let done = 0;
    let failed = 0;
    for (const a of list) {
      status.textContent = `Preparing ${done + 1} Of ${list.length}`;
      try {
        const v = ctx.versions.find((x) => x.id === a.approved_version_id);
        const path = v ? v.storage_path : a.storage_path;
        const url = await roomPhotoUrl(path);
        const img = await loadImg(url);
        const scale = p.w && img.naturalWidth > p.w ? p.w / img.naturalWidth : 1;
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const cx = c.getContext("2d");
        cx.drawImage(img, 0, 0, w, h);
        if (wm.on && wm.text) stamp(cx, wm.text, { ...wm }, w, h);
        const label = disc.on ? discFor(a, ctx.versions) : "";
        if (label) stamp(cx, label, { position: disc.position, size: disc.size, padding: 28, plate: disc.contrast }, w, h);
        const blob = await new Promise((res) => c.toBlob(res, p.type, p.q));
        const room = safe(a.room_group);
        counters[room] = (counters[room] || 0) + 1;
        const n = String(counters[room]).padStart(2, "0");
        const suffix = label ? "_" + safe(label) : "";
        const name = `${safe(ctx.propertyLabel || "Property")}_${room}_${n}${suffix}.jpg`;
        zip.folder(room).file(name, blob);
        done++;
      } catch (_) {
        failed++;
      }
    }
    try {
      status.textContent = "Packaging";
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${safe(ctx.propertyLabel || "Property")}_${safe(PRESETS[preset].label)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      await saveExportPackage({
        data: {
          property_id: ctx.propertyId || null,
          property_label: ctx.propertyLabel || null,
          preset,
          label: `${PRESETS[preset].label}, ${done} File${done === 1 ? "" : "s"}`,
          file_count: done,
          options: { watermark: wm.on, disclosure: disc.on, width: PRESETS[preset].w },
        },
      });
      track("export_completed", { preset, files: done, failed });
      status.textContent = failed
        ? `Package ready with ${done} file${done === 1 ? "" : "s"}. ${failed} could not be prepared.`
        : `Package ready with ${done} file${done === 1 ? "" : "s"}.`;
      ctx.reload && ctx.reload();
    } catch (e) {
      track("export_failed", { preset });
      status.textContent = "Export failed. " + (e.message || "");
    } finally {
      running = false;
    }
  }

  render();
  document.addEventListener("keydown", function esc2(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", esc2);
    }
  });
}
