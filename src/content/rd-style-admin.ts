// Admin-only Style Library manager, rendered inside the Explore drawer.
/* eslint-disable */
// @ts-nocheck
import { STYLES, STYLE_CATEGORIES, styleById, applyStyleOverrides } from "@/lib/style-catalog";
import { listStyleOverrides, saveStyleOverride, deleteStyleOverride } from "@/lib/style-admin.functions";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TYPES = ["interior", "exterior", "garden", "virtual-staging", "concept"];

export async function openStyleAdmin(openDrawer, closeDrawer, note, icons_, host) {
  openDrawer(`<div class="xp-dh"><div><span class="xp-eyebrow">Admin</span><h3>Style Library</h3><p>Loading the catalog…</p></div>
    <button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
    <div class="xp-db"><div class="xp-note"><i data-lucide="loader"></i><span>Loading styles…</span></div></div>`);

  let rows = [];
  try {
    const res = await listStyleOverrides();
    rows = (res && res.rows) || [];
    applyStyleOverrides(rows);
  } catch (e) {
    openDrawer(`<div class="xp-dh"><div><span class="xp-eyebrow">Admin</span><h3>Style Library</h3></div>
      <button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="xp-db"><div class="xp-note warn"><i data-lucide="alert-triangle"></i><span>${esc((e && e.message) || "Could not load the style library.")}</span></div></div>`);
    icons_();
    return;
  }

  let editing = null;

  function listHtml() {
    const list = STYLES.slice().sort((a, b) => a.featuredRank - b.featuredRank || a.displayName.localeCompare(b.displayName));
    return `<div class="xp-dh"><div><span class="xp-eyebrow">Admin</span><h3>Style Library</h3><p>${list.length} styles. Public IDs never change, so saved projects keep working.</p></div>
      <button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="xp-db">
        <div class="xp-admin-list">
          ${list.map((s) => `<div class="xp-admin-row${s.isActive ? "" : " off"}">
            <img src="${s.previewImage}" alt="">
            <div class="xp-admin-meta"><b>${esc(s.displayName)}</b><span>${esc(s.category)} · ${esc(s.id)}${s.isFeatured ? " · Featured" : ""}${s.isActive ? "" : " · Hidden"}</span></div>
            <div class="xp-admin-acts">
              <button class="fb-link" data-aedit="${s.id}">Edit</button>
              <button class="fb-link" data-afeat="${s.id}">${s.isFeatured ? "Unfeature" : "Feature"}</button>
              <button class="fb-link" data-ahide="${s.id}">${s.isActive ? "Hide" : "Show"}</button>
            </div></div>`).join("")}
        </div>
      </div>
      <div class="xp-df"><button class="fb-link" data-anew="1">Add Style</button><button class="btn btn-ghost btn-sm" data-close="1">Done</button></div>`;
  }

  function editHtml(s, isNew) {
    return `<div class="xp-dh"><div><span class="xp-eyebrow">Admin</span><h3>${isNew ? "Add Style" : "Edit " + esc(s.displayName)}</h3><p>ID <b>${esc(s.id)}</b> is immutable.</p></div>
      <button class="icon-btn" data-close="1" aria-label="Close"><i data-lucide="x"></i></button></div>
      <div class="xp-db">
        ${isNew ? `<div class="field"><label>Style ID</label><input id="aId" type="text" placeholder="warm-coastal"></div>` : ""}
        <div class="field"><label>Display Name</label><input id="aName" type="text" value="${esc(s.displayName)}"></div>
        <div class="field"><label>Short Description</label><input id="aDesc" type="text" value="${esc(s.shortDescription)}"></div>
        <div class="field"><label>Category</label><select id="aCat">${STYLE_CATEGORIES.map((c) => `<option${c === s.category ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
        <div class="field"><label>Aliases (comma separated)</label><input id="aAlias" type="text" value="${esc(s.aliases.join(", "))}"></div>
        <div class="field"><label>Project Types</label><div class="xp-opts">${TYPES.map((t) => `<label class="xp-opt${s.compatibleProjectTypes.indexOf(t) > -1 ? " on" : ""}"><input type="checkbox" data-atype="${t}"${s.compatibleProjectTypes.indexOf(t) > -1 ? " checked" : ""}><span class="xp-box"><i data-lucide="check"></i></span><span class="xp-optl">${t.replace("-", " ")}</span></label>`).join("")}</div></div>
        <div class="field"><label>Preview Image URL</label><input id="aImg" type="text" value="${esc(s.previewImage)}"></div>
        <div class="field"><label>Sort Order</label><input id="aSort" type="number" value="${s.featuredRank}"></div>
        <div class="field"><label>Generation Prompt</label><textarea id="aPrompt" rows="3">${esc(s.generationPrompt)}</textarea></div>
        <div class="field"><label>Negative Prompt</label><textarea id="aNeg" rows="2">${esc(s.negativePrompt)}</textarea></div>
        <div class="field"><label>Provider Name (Gemini)</label><input id="aProv" type="text" placeholder="${esc(s.displayName)}"></div>
      </div>
      <div class="xp-df">
        ${isNew ? "" : '<button class="fb-link" data-areset="' + s.id + '">Reset Overrides</button>'}
        <button class="btn btn-ghost btn-sm" data-aback="1">Back</button>
        <button class="btn btn-primary btn-sm" data-asave="1">Save Style</button>
      </div>`;
  }

  function paintList() { openDrawer(listHtml()); icons_(); }

  async function persist(patch) {
    try {
      await saveStyleOverride({ data: patch });
      applyStyleOverrides([patch]);
      note("Style Library Updated");
    } catch (e) { note((e && e.message) || "Could not save that change."); }
  }

  host.addEventListener("click", async (e) => {
    const panel = host.querySelector("#xpDPanel");
    if (!panel || !panel.contains(e.target)) return;
    const t = e.target;
    let el;
    if ((el = t.closest("[data-aedit]"))) { editing = styleById(el.dataset.aedit); openDrawer(editHtml(editing, false)); icons_(); return; }
    if ((el = t.closest("[data-afeat]"))) { const s = styleById(el.dataset.afeat); await persist({ style_id: s.id, is_featured: !s.isFeatured }); paintList(); return; }
    if ((el = t.closest("[data-ahide]"))) { const s = styleById(el.dataset.ahide); await persist({ style_id: s.id, is_hidden: s.isActive }); paintList(); return; }
    if ((el = t.closest("[data-areset]"))) {
      try { await deleteStyleOverride({ data: { style_id: el.dataset.areset } }); note("Overrides Cleared. Reload To See Shipped Values."); } catch (err) { note((err && err.message) || "Could not reset."); }
      paintList(); return;
    }
    if (t.closest("[data-anew]")) {
      editing = { id: "", displayName: "", shortDescription: "", category: STYLE_CATEGORIES[0], aliases: [], compatibleProjectTypes: ["interior"], previewImage: "", featuredRank: 900, generationPrompt: "", negativePrompt: "" };
      openDrawer(editHtml(editing, true)); icons_(); return;
    }
    if (t.closest("[data-aback]")) { paintList(); return; }
    if (t.closest("[data-asave]")) {
      const v = (id) => { const n = panel.querySelector("#" + id); return n ? n.value.trim() : ""; };
      const id = editing && editing.id ? editing.id : v("aId").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (!id) { note("A Style ID Is Required."); return; }
      const types = Array.from(panel.querySelectorAll("[data-atype]:checked")).map((x) => x.dataset.atype);
      const prov = v("aProv");
      const patch = {
        style_id: id,
        display_name: v("aName") || id,
        short_description: v("aDesc"),
        category: v("aCat"),
        aliases: v("aAlias") ? v("aAlias").split(",").map((x) => x.trim()).filter(Boolean) : [],
        project_types: types.length ? types : ["interior"],
        preview_image: v("aImg") || null,
        generation_prompt: v("aPrompt") || null,
        negative_prompt: v("aNeg") || null,
        sort_order: Number(v("aSort") || 900),
        is_custom: !styleById(id),
      };
      if (prov) patch.provider_map = { gemini: prov };
      await persist(patch);
      paintList();
      return;
    }
  });

  paintList();
}
