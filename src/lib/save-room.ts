/**
 * Save Room.
 *
 * One dialog, used everywhere a photo on the canvas should become a permanent
 * room on the account. It asks only for what a room record needs — property,
 * room name, room type — writes through `saveStudioRoom`, and returns the saved
 * record so the caller can keep working against the same identifiers.
 *
 * A room is saved from its source photo alone. No design, no version and no
 * credit is required, and saving twice updates the same room.
 */
import { createIcons, icons } from "lucide";
import { modalFooterHtml, setModalButtonLoading } from "@/lib/modal-footer";
import { ROOM_OPTIONS, ROOM_GROUP_ORDER, roomByLabel } from "@/lib/staging-rooms";
import { saveStudioRoom, listRoomTargets } from "@/lib/rooms.functions";

export type SaveRoomResult = {
  property_id: string;
  project_id: string;
  room_id: string;
  room_name: string;
  room_type: string;
  address: string;
  source_path: string;
  created: boolean;
};

const esc = (s: unknown) =>
  String(s == null ? "" : s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );

function toast(msg: string) {
  try {
    (window as any).rdToast?.(msg);
  } catch (_) {}
}

function roomTypeOptions(selected: string) {
  return ROOM_GROUP_ORDER.map((group) => {
    const opts = ROOM_OPTIONS.filter((r) => r.group === group);
    if (!opts.length) return "";
    return `<optgroup label="${esc(group)}">${opts
      .map(
        (r) =>
          `<option value="${esc(r.label)}"${r.label === selected ? " selected" : ""}>${esc(r.label)}</option>`,
      )
      .join("")}</optgroup>`;
  }).join("");
}

export type SaveRoomOptions = {
  /** Durable storage path of the source photo. Required — blob previews cannot be saved. */
  sourcePath: string;
  /** Suggested room name, usually the current Setup room. */
  roomName?: string | null;
  roomType?: string | null;
  address?: string | null;
  /** Known identifiers turn the save into an update of that same room. */
  roomId?: string | null;
  propertyId?: string | null;
  projectId?: string | null;
};

/**
 * Opens the dialog and resolves with the saved room, or null when the user
 * closes it. Rejects nothing: failures are reported inside the dialog so the
 * user keeps their typing and can retry.
 */
export function openSaveRoomModal(opts: SaveRoomOptions): Promise<SaveRoomResult | null> {
  return new Promise((resolve) => {
    const suggestedType =
      roomByLabel(opts.roomType || opts.roomName)?.label || opts.roomType || "Living Room";

    const wrap = document.createElement("div");
    wrap.className = "rd-modal on";
    wrap.innerHTML = `
      <div class="rd-modal-card" role="dialog" aria-modal="true" aria-label="Save Room" style="max-width:520px">
        <button class="rd-modal-x" data-x aria-label="Close"><i data-lucide="x"></i></button>
        <h3 style="margin:0 0 4px">Save room</h3>
        <p class="sub" style="margin:0 0 14px">Save this room and its designs to your account.</p>

        <div class="srm-body">
          <label class="srm-f">Property
            <select data-prop><option value="">Loading Your Properties…</option></select>
          </label>
          <label class="srm-f" data-addr-field hidden>Property Address
            <input type="text" data-addr placeholder="123 Main St, Tampa, FL" value="${esc(opts.address || "")}">
          </label>
          <label class="srm-f">Room Name
            <input type="text" data-name maxlength="120" placeholder="Front Living Room" value="${esc(opts.roomName || "")}">
          </label>
          <label class="srm-f">Room Type
            <select data-type>${roomTypeOptions(suggestedType)}</select>
          </label>
          <p class="srm-err" data-err hidden></p>
        </div>
        ${modalFooterHtml({
          secondary: { label: "Cancel", value: "cancel" },
          primary: { label: "Save Room", value: "save", icon: "save" },
        })}
      </div>`;

    (document.querySelector(".rd-app") || document.body).appendChild(wrap);
    try {
      createIcons({ icons, root: wrap } as any);
    } catch (_) {}

    const q = <T extends Element>(sel: string) => wrap.querySelector(sel) as T;
    const propSel = q<HTMLSelectElement>("[data-prop]");
    const addrField = q<HTMLElement>("[data-addr-field]");
    const addrInput = q<HTMLInputElement>("[data-addr]");
    const nameInput = q<HTMLInputElement>("[data-name]");
    const typeSel = q<HTMLSelectElement>("[data-type]");
    const errEl = q<HTMLElement>("[data-err]");
    const saveBtn = q<HTMLButtonElement>('[data-mfa="save"]');

    let done = false;
    const close = (value: SaveRoomResult | null) => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey);
      wrap.remove();
      resolve(value);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(null);
    };
    document.addEventListener("keydown", onKey);
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) close(null);
    });
    wrap.querySelectorAll("[data-x],[data-mfa='cancel']").forEach((b: any) => {
      b.onclick = () => close(null);
    });

    const showErr = (msg: string) => {
      errEl.textContent = msg;
      errEl.hidden = !msg;
    };

    const syncAddr = () => {
      addrField.hidden = propSel.value !== "__new";
    };
    propSel.addEventListener("change", syncAddr);

    /* Property list is a convenience: the dialog stays usable if it fails. */
    (async () => {
      let list: any[] = [];
      try {
        list = (await listRoomTargets()) as any[];
      } catch (_) {
        list = [];
      }
      const known = list.find((p) => p.id === opts.propertyId);
      propSel.innerHTML =
        list
          .map(
            (p) =>
              `<option value="${esc(p.id)}"${p.id === opts.propertyId ? " selected" : ""}>${esc(p.address)}</option>`,
          )
          .join("") + `<option value="__new">Add A New Property…</option>`;
      if (!known) propSel.value = "__new";
      syncAddr();
      if (!nameInput.value.trim()) nameInput.value = suggestedType;
      nameInput.focus();
      nameInput.select();
    })();

    saveBtn.addEventListener("click", async () => {
      const name = nameInput.value.trim();
      const isNew = propSel.value === "__new";
      const address = addrInput.value.trim();
      if (!name) return showErr("Give This Room A Name.");
      if (isNew && address.length < 3) return showErr("Add The Property Address.");
      showErr("");
      setModalButtonLoading(saveBtn, true, "Saving…");
      try {
        const saved = (await saveStudioRoom({
          data: {
            room_id: opts.roomId || null,
            property_id: isNew ? null : propSel.value || null,
            address: isNew ? address : null,
            project_id: isNew ? null : opts.projectId || null,
            room_name: name,
            room_type: typeSel.value,
            source_path: opts.sourcePath,
          },
        })) as SaveRoomResult;
        toast(saved.created ? "Room Saved" : "Room Updated");
        try {
          window.dispatchEvent(new Event("rd:saved"));
          window.dispatchEvent(new Event("rd:rooms"));
        } catch (_) {}
        close(saved);
      } catch (err: any) {
        setModalButtonLoading(saveBtn, false);
        showErr(String(err?.message || "That Did Not Save. Please Try Again."));
      }
    });
  });
}
