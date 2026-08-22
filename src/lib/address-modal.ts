/* Property Address editor.
   A polished, framework-free application modal used everywhere an address is
   added, changed or cleared. It replaces the native window.prompt: it offers
   suggestions from the workspace's own properties, always allows manual entry,
   surfaces an existing-property match so the user can assign or keep the
   project separate, and reports saving, success and error states.

   Project Title is deliberately absent: an address never rewrites a title. */

import {
import "@/styles/rd-modal.css";
  addressesMatch,
  buildAddress,
  cleanAddressText,
  findMatchingProperty,
  normalizeAddress,
} from "@/lib/property-address";

export type AddressProperty = {
  id: string;
  address?: string | null;
  normalized_address?: string | null;
};

export type AddressModalResult = {
  /** Cleaned address text; "" when the user cleared it. */
  address: string;
  /** Structured columns for the project record. */
  columns: Record<string, any>;
  /** Property to assign to, null to keep the project separate/unassigned. */
  propertyId: string | null;
  /** True when the user explicitly changed the property assignment. */
  assignmentChanged: boolean;
  source: string;
};

export type AddressModalOptions = {
  address?: string | null;
  propertyId?: string | null;
  /** Known properties, used for suggestions and match detection offline. */
  properties?: AddressProperty[];
  title?: string;
  subtitle?: string;
  /** Async suggestion provider; defaults to the workspace properties. */
  suggest?: (q: string) => Promise<AddressProperty[]>;
  onSave: (result: AddressModalResult) => Promise<void> | void;
  onDone?: (result: AddressModalResult) => void;
  onCancel?: () => void;
};

const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

function paint(root: ParentNode) {
  try {
    (window as any).lucide?.createIcons({
      attrs: { "stroke-width": 1.75 },
      nameAttr: "data-lucide",
      root,
    });
  } catch (_) {}
}

const FOCUSABLE =
  'button:not([disabled]),input,select,textarea,[href],[tabindex]:not([tabindex="-1"])';

export function openAddressModal(opts: AddressModalOptions) {
  const properties = (opts.properties || []).filter((p) => p && p.id);
  const startAddress = cleanAddressText(opts.address || "");
  const startProperty = opts.propertyId || null;

  const state = {
    text: startAddress,
    propertyId: startProperty,
    match: null as AddressProperty | null,
    suggestions: [] as AddressProperty[],
    active: -1,
    save: "" as "" | "saving" | "saved" | "error",
    error: "",
  };

  const previouslyFocused = document.activeElement as HTMLElement | null;
  const host = document.createElement("div");
  host.className = "rd-modal addrm";
  host.innerHTML = `<div class="addrm-bg" data-x></div>
    <div class="addrm-w" role="dialog" aria-modal="true" aria-labelledby="addrmTitle">
      <header class="addrm-h">
        <div>
          <h3 id="addrmTitle">${esc(opts.title || "Property Address")}</h3>
          <p>${esc(opts.subtitle || "Optional. Adding an address never changes your project title.")}</p>
        </div>
        <button class="addrm-x" data-x aria-label="Close"><i data-lucide="x"></i></button>
      </header>
      <div class="addrm-b">
        <label class="addrm-f" for="addrmIn">Property Address</label>
        <div class="addrm-in">
          <i data-lucide="map-pin"></i>
          <input id="addrmIn" type="text" maxlength="200" autocomplete="off" role="combobox"
            aria-expanded="false" aria-controls="addrmList" aria-autocomplete="list"
            placeholder="123 Main Street, Austin TX" value="${esc(state.text)}">
          <button class="addrm-clear" id="addrmClear" aria-label="Clear Address"><i data-lucide="x"></i></button>
        </div>
        <ul class="addrm-list" id="addrmList" role="listbox" aria-label="Address Suggestions"></ul>
        <p class="addrm-hint">Type any address manually — suggestions are just a shortcut.</p>
        <div class="addrm-match" id="addrmMatch" hidden></div>
        <p class="addrm-msg" id="addrmMsg" role="status" aria-live="polite"></p>
      </div>
      <footer class="addrm-a">
        <button class="btn btn-ghost btn-sm" id="addrmClearBtn"><i data-lucide="eraser"></i>Clear Address</button>
        <div class="addrm-a-r">
          <button class="btn btn-ghost btn-sm" data-x>Cancel</button>
          <button class="btn btn-primary btn-sm" id="addrmSave">Save Address</button>
        </div>
      </footer>
    </div>`;
  document.body.appendChild(host);
  paint(host);

  const input = host.querySelector("#addrmIn") as HTMLInputElement;
  const list = host.querySelector("#addrmList") as HTMLElement;
  const matchBox = host.querySelector("#addrmMatch") as HTMLElement;
  const msg = host.querySelector("#addrmMsg") as HTMLElement;
  const saveBtn = host.querySelector("#addrmSave") as HTMLButtonElement;

  const suggest =
    opts.suggest ||
    (async (q: string) => {
      const key = normalizeAddress(q);
      return properties
        .filter((p) => !key || normalizeAddress(p.address).includes(key))
        .slice(0, 8);
    });

  function close(cancelled: boolean) {
    document.removeEventListener("keydown", onKey, true);
    host.remove();
    try {
      previouslyFocused?.focus();
    } catch (_) {}
    if (cancelled) opts.onCancel?.();
  }

  function onKey(e: KeyboardEvent) {
    if (!document.body.contains(host)) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key === "Tab") {
      const items = Array.from(host.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || true,
      );
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  document.addEventListener("keydown", onKey, true);

  function drawSuggestions() {
    const items = state.suggestions;
    input.setAttribute("aria-expanded", items.length ? "true" : "false");
    if (!items.length) {
      list.innerHTML = "";
      list.classList.remove("on");
      return;
    }
    list.classList.add("on");
    list.innerHTML = items
      .map(
        (p, i) =>
          `<li role="option" id="addrmOpt${i}" aria-selected="${i === state.active}" class="${i === state.active ? "on" : ""}" data-i="${i}">
            <i data-lucide="map-pin"></i><span>${esc(p.address || "Untitled Property")}</span></li>`,
      )
      .join("");
    paint(list);
    list.querySelectorAll<HTMLElement>("[data-i]").forEach((li) =>
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        choose(Number(li.getAttribute("data-i")));
      }),
    );
  }

  function choose(i: number) {
    const p = state.suggestions[i];
    if (!p) return;
    state.text = cleanAddressText(p.address);
    state.propertyId = p.id;
    state.suggestions = [];
    state.active = -1;
    input.value = state.text;
    drawSuggestions();
    drawMatch();
  }

  function drawMatch() {
    const hit = state.text ? findMatchingProperty(state.text, properties as any) : null;
    state.match = hit || null;
    if (!hit) {
      matchBox.hidden = true;
      matchBox.innerHTML = "";
      return;
    }
    const assigned = state.propertyId === hit.id;
    matchBox.hidden = false;
    matchBox.innerHTML = `<i data-lucide="info"></i>
      <span>${assigned ? "Assigned to the existing property " : "This address matches an existing property: "}<b>${esc(hit.address || "Untitled Property")}</b>.</span>
      <span class="addrm-match-a">
        <button class="btn btn-primary btn-xs" id="addrmUse" ${assigned ? "disabled" : ""}>Use Existing Property</button>
        <button class="btn btn-ghost btn-xs" id="addrmSep" ${assigned ? "" : "disabled"}>Keep Separate</button>
      </span>`;
    paint(matchBox);
    (matchBox.querySelector("#addrmUse") as HTMLButtonElement | null)?.addEventListener(
      "click",
      () => {
        state.propertyId = hit.id;
        drawMatch();
      },
    );
    (matchBox.querySelector("#addrmSep") as HTMLButtonElement | null)?.addEventListener(
      "click",
      () => {
        state.propertyId = null;
        drawMatch();
      },
    );
  }

  let t: any = null;
  input.addEventListener("input", () => {
    state.text = input.value;
    if (
      state.propertyId &&
      !addressesMatch(state.text, (properties.find((p) => p.id === state.propertyId) || {}).address)
    ) {
      /* Typing a different address detaches the automatic assignment; the
         user can re-assign from the match banner. */
      state.propertyId = null;
    }
    setMsg("");
    clearTimeout(t);
    t = setTimeout(async () => {
      try {
        const rows = await suggest(input.value);
        state.suggestions = (rows || []).filter((p) => p && p.id).slice(0, 8);
      } catch (_) {
        state.suggestions = [];
      }
      state.active = -1;
      drawSuggestions();
      drawMatch();
    }, 160);
  });

  input.addEventListener("keydown", (e) => {
    if (!state.suggestions.length) {
      if (e.key === "Enter") {
        e.preventDefault();
        void doSave();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      state.active = (state.active + 1) % state.suggestions.length;
      drawSuggestions();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      state.active = (state.active - 1 + state.suggestions.length) % state.suggestions.length;
      drawSuggestions();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (state.active >= 0) choose(state.active);
      else void doSave();
    }
  });

  function setMsg(text: string, kind = "") {
    msg.textContent = text;
    msg.className = "addrm-msg" + (kind ? " " + kind : "");
  }

  function result(): AddressModalResult {
    const clean = cleanAddressText(state.text);
    const source = !clean ? "unknown" : state.propertyId ? "existing_property" : "manual";
    const columns = clean
      ? {
          ...buildAddress({ text: clean }, source as any),
          property_address: clean,
          normalized_address: normalizeAddress(clean),
        }
      : {
          ...buildAddress({ text: "" }, "unknown"),
          property_address: null,
          normalized_address: null,
        };
    return {
      address: clean,
      columns,
      propertyId: state.propertyId,
      assignmentChanged: (state.propertyId || null) !== (startProperty || null),
      source,
    };
  }

  async function doSave() {
    if (state.save === "saving") return;
    state.save = "saving";
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i data-lucide="loader"></i>Saving…`;
    paint(saveBtn);
    setMsg("Saving your address…");
    const res = result();
    try {
      await opts.onSave(res);
      state.save = "saved";
      setMsg(res.address ? "Address Saved." : "Address Removed.", "ok");
      saveBtn.innerHTML = `<i data-lucide="check"></i>Saved`;
      paint(saveBtn);
      setTimeout(() => {
        if (!document.body.contains(host)) return;
        close(false);
        opts.onDone?.(res);
      }, 500);
    } catch (e: any) {
      state.save = "error";
      saveBtn.disabled = false;
      saveBtn.innerHTML = "Save Address";
      setMsg("Couldn’t save that address: " + (e?.message || "try again") + ".", "bad");
    }
  }

  host.querySelectorAll("[data-x]").forEach((b) => b.addEventListener("click", () => close(true)));
  (host.querySelector("#addrmClear") as HTMLElement).addEventListener("click", () => {
    state.text = "";
    state.propertyId = null;
    state.suggestions = [];
    input.value = "";
    input.focus();
    drawSuggestions();
    drawMatch();
  });
  (host.querySelector("#addrmClearBtn") as HTMLElement).addEventListener("click", () => {
    state.text = "";
    state.propertyId = null;
    input.value = "";
    state.suggestions = [];
    drawSuggestions();
    drawMatch();
    void doSave();
  });
  saveBtn.addEventListener("click", () => void doSave());

  drawMatch();
  setTimeout(() => {
    try {
      input.focus();
      input.select();
    } catch (_) {}
  }, 0);

  return { close: () => close(true), host };
}

export default openAddressModal;
