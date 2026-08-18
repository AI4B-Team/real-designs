/**
 * AI Animate presentation. Pure string builders so every state (and its
 * price, disclosure and wording) is testable without a browser.
 *
 * Nothing here decides anything: prices come from the capability model and
 * statuses come from the durable `scene_clips` row.
 */
import {
  ANIMATE_OPTIONS,
  ANIMATE_CREDITS_PER_CLIP,
  animateOption,
  clipStatusLabel,
  disclosureLabel,
} from "@/lib/scene-enhancement";

export type ClipView = {
  id: string;
  status: string;
  progress?: number | null;
  animate_id?: string | null;
  disclosure?: string | null;
  error_message?: string | null;
  approved?: boolean | null;
  storage_path?: string | null;
  seconds?: number | null;
  url?: string | null;
};

export const ARCHITECTURE_NOTICE =
  "AI will animate this photo while attempting to preserve the property. Review the finished clip before including it in your video.";
export const LIFESTYLE_NOTICE =
  "This option adds AI-generated people who were not present at the property.";
export const AERIAL_NOTICE = "Simulated aerial movement generated from a still photo.";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Rough wait we can state honestly: Veo returns in about one to three minutes. */
export const CLIP_ETA = "About 1–3 Minutes";

/* ------------------------------------------------------------ card */

/** The state strip a scene card shows for its AI clip, if it has one. */
export function clipCardHtml(key: string, clip: ClipView | null | undefined): string {
  if (!clip || clip.status === "deleted") return "";
  const k = esc(key);
  const label = clipStatusLabel(clip.status, clip.status === "processing" ? Number(clip.progress || 0) / 100 : null);
  const btn = (action: string, text: string, cls = "fb-link") =>
    `<button class="${cls}" data-clip="${action}" data-key="${k}" data-id="${esc(clip.id)}">${esc(text)}</button>`;

  if (clip.status === "queued" || clip.status === "processing") {
    return `<div class="rv-clip busy" data-clipstate="${esc(clip.status)}">
      <span class="rv-clip-b"><i data-lucide="loader"></i>AI Clip · ${esc(label)}</span>
      ${btn("view", "View Job")}${btn("cancel", "Cancel")}
    </div>`;
  }
  if (clip.status === "failed") {
    return `<div class="rv-clip bad" data-clipstate="failed">
      <span class="rv-clip-b"><i data-lucide="triangle-alert"></i>AI Clip · Failed</span>
      <em>${esc(clip.error_message || "The clip could not be generated.")}</em>
      ${btn("retry", "Retry")}${btn("open", "Choose Another Animation")}${btn("delete", "Revert To Photo")}
    </div>`;
  }
  if (clip.status === "cancelled") {
    return `<div class="rv-clip" data-clipstate="cancelled">
      <span class="rv-clip-b"><i data-lucide="circle-slash"></i>AI Clip · Cancelled</span>
      ${btn("open", "Generate Again")}${btn("delete", "Revert To Photo")}
    </div>`;
  }
  if (clip.status === "completed" && clip.approved) {
    return `<div class="rv-clip on" data-clipstate="approved">
      <span class="rv-clip-b"><i data-lucide="clapperboard"></i>AI Clip</span>
      <em>Using AI Clip</em>
      ${btn("review", "Preview")}${btn("open", "Replace")}${btn("revert", "Revert To Photo")}${btn("download", "Download")}
    </div>`;
  }
  if (clip.status === "completed") {
    return `<div class="rv-clip ready" data-clipstate="ready">
      <span class="rv-clip-b"><i data-lucide="circle-play"></i>AI Clip · Ready</span>
      ${btn("review", "Review Clip", "fb-link strong")}${btn("use", "Use Clip")}${btn("retry", "Regenerate")}${btn("delete", "Delete")}
    </div>`;
  }
  return "";
}

/* ------------------------------------------------------------ modal */

export type AnimateModalCtx = {
  key: string;
  room?: string | null;
  position?: number | null;
  total?: number | null;
  thumb?: string | null;
  selected?: string | null;
  orientation?: string;
  balance: number;
  clip?: ClipView | null;
  busy?: boolean;
  confirm?: boolean;
  /** Active category filter. "recommended" is the default view. */
  cat?: string | null;
};

/**
 * Option list for one category. "Recommended" is filtered by the detected room
 * type; every other tab shows all options in that category, because the user
 * is always allowed to browse — incompatible picks are warned about, not
 * hidden.
 */
export function animateOptionsHtml(
  selected?: string | null,
  cat: string = "recommended",
  room?: string | null,
): string {
  const rec = recommendedAnimateIds(room);
  const list =
    cat === "recommended"
      ? rec.map((id) => animateOption(id)).filter(Boolean)
      : ANIMATE_OPTIONS.filter((o) => animateCategory(o.id) === cat);
  if (!list.length) return `<p class="an-empty">No Options In This Category.</p>`;
  return list
    .map((o) => {
      const opt = o!;
      const warn = animateWarning(opt.id, room);
      return `<button class="an-card ${selected === opt.id ? "on" : ""}${warn ? " warn" : ""}" data-animate="${esc(opt.id)}" role="option"
      aria-selected="${selected === opt.id}">
      <b>${esc(opt.label)}</b>
      <span>${esc(opt.sub)}</span>
      <em class="an-meta"><i class="mono">${opt.seconds}s</i><i class="mono">${ANIMATE_CREDITS_PER_CLIP} Credits</i></em>
      <i class="an-disc">${esc(disclosureLabel(opt.disclosure))}</i>
      ${rec.includes(opt.id) && cat !== "recommended" ? `<span class="an-rec">Recommended</span>` : ""}
      ${warn ? `<span class="an-warn" title="${esc(warn)}"><i data-lucide="triangle-alert"></i></span>` : ""}
      ${opt.beta ? `<span class="an-beta">Beta</span>` : ""}
    </button>`;
    })
    .join("");
}

export function animateModalHtml(ctx: AnimateModalCtx): string {
  const opt = ctx.selected ? animateOption(ctx.selected) : null;
  const cost = ANIMATE_CREDITS_PER_CLIP;
  const short = ctx.balance < cost;
  const cat = ctx.cat || "recommended";
  const orientation = ctx.orientation === "portrait" ? "Portrait" : ctx.orientation === "square" ? "Square" : "Landscape";
  const warn = opt ? animateWarning(opt.id, ctx.room) : "";
  const notices = opt
    ? [
        warn,
        ARCHITECTURE_NOTICE,
        opt.lifestyle ? LIFESTYLE_NOTICE : "",
        opt.id === "aerial_reveal" ? AERIAL_NOTICE : "",
      ].filter(Boolean)
    : [];

  const detail = opt
    ? `<div class="an-detail">
        <b>${esc(opt.label)}</b>
        <p class="an-prompt">${esc(opt.sub)}. ${esc(opt.prompt)}</p>
        <p class="an-swap">${cost} credits · ${opt.seconds}-second AI clip. Replaces standard motion for this scene.</p>
        <dl>
          <div><dt>Duration</dt><dd class="mono">${opt.seconds}s</dd></div>
          <div><dt>Output</dt><dd>${esc(orientation)}</dd></div>
          <div><dt>Processing</dt><dd>${esc(CLIP_ETA)}</dd></div>
          <div><dt>Cost</dt><dd class="mono">${cost} Credits</dd></div>
          <div><dt>Balance After</dt><dd class="mono">${Math.max(0, ctx.balance - cost)}</dd></div>
          <div><dt>Disclosure</dt><dd>${esc(disclosureLabel(opt.disclosure))}</dd></div>
        </dl>
        ${notices.map((n) => `<p class="an-note">${esc(n)}</p>`).join("")}
      </div>`
    : `<div class="an-detail empty"><p>Choose An Animation To See Its Cost And Disclosure.</p></div>`;

  const status = ctx.clip
    ? `<p class="an-status">AI Clip · ${esc(clipStatusLabel(ctx.clip.status, Number(ctx.clip.progress || 0) / 100))}</p>`
    : "";

  const action = ctx.confirm
    ? `<div class="an-confirm">
        <b>Generate this clip for ${cost} credits?</b>
        <div class="an-confirm-a">
          <button class="btn btn-ghost btn-sm" id="rvAnimNo">Cancel</button>
          <button class="btn btn-primary btn-sm" id="rvAnimYes" ${ctx.busy ? "disabled" : ""}>${ctx.busy ? "Starting…" : "Confirm"}</button>
        </div>
      </div>`
    : "";

  return `<div class="rv-modal on" id="rvAnimWrap"><div class="rv-modal-in xwide" role="dialog" aria-label="AI Animate">
    <div class="rv-modal-h"><div><b>AI Animate</b><span class="rv-modal-sub">Turn this photo into a genuine AI-generated video clip.</span></div>
      <button class="icon-btn" id="rvAnimX" aria-label="Close"><i data-lucide="x"></i></button></div>
    <div class="rv-modal-b an-body">
      <aside class="an-src">
        <div class="an-src-ph" ${ctx.thumb ? `data-img="${esc(ctx.thumb)}"` : ""} role="img" aria-label="Scene photo"></div>
        <b>${esc(ctx.room || "Unassigned")}</b>
        <span>Scene ${ctx.position ?? 1}${ctx.total ? ` of ${ctx.total}` : ""}</span>
        ${status}
      </aside>
      <div class="an-main">
        <nav class="an-cats" aria-label="Animation categories">
          ${ANIMATE_CATEGORIES.map(([id, label]) => `<button class="${cat === id ? "on" : ""}" data-animcat="${esc(id)}">${esc(label)}</button>`).join("")}
        </nav>
        <div class="an-grid" role="listbox" aria-label="AI Animate options">${animateOptionsHtml(ctx.selected, cat, ctx.room)}</div>
        ${detail}
      </div>
    </div>

    ${action}
    <div class="rv-modal-f">
      <span class="an-bal mono">${ctx.balance} Credits Available</span>
      <button class="btn btn-ghost" id="rvAnimCancel">Cancel</button>
      <button class="btn btn-primary" id="rvAnimGo" ${!opt || short || ctx.busy ? "disabled" : ""}>
        ${ctx.busy ? "Starting…" : `Generate AI Clip · ${cost} Credits`}</button>
    </div>
    ${short ? `<p class="an-short">Not Enough Credits. This Clip Costs ${cost}.</p>` : ""}
  </div></div>`;
}

/* ------------------------------------------------------------ review */

export function clipReviewHtml(ctx: {
  clip: ClipView;
  url?: string | null;
  photo?: string | null;
  room?: string | null;
  busy?: boolean;
}): string {
  const opt = animateOption(ctx.clip.animate_id || "");
  const disc = disclosureLabel(ctx.clip.disclosure || opt?.disclosure);
  return `<div class="rv-modal on" id="rvClipWrap"><div class="rv-modal-in wide" role="dialog" aria-label="Review AI clip">
    <div class="rv-modal-h"><div><b>Review AI Clip</b><span class="rv-modal-sub">${esc(opt?.label || "AI Clip")}${ctx.room ? ` · ${esc(ctx.room)}` : ""}</span></div>
      <button class="icon-btn" id="rvClipX" aria-label="Close"><i data-lucide="x"></i></button></div>
    <div class="rv-modal-b cl-body">
      <figure><figcaption>Original Photo</figcaption>
        <div class="an-src-ph" ${ctx.photo ? `data-img="${esc(ctx.photo)}"` : ""} role="img" aria-label="Original photo"></div></figure>
      <figure><figcaption>Generated Clip</figcaption>
        ${ctx.url
          ? `<video id="rvClipVid" src="${esc(ctx.url)}" playsinline controls loop muted></video>`
          : `<div class="an-src-ph">This clip could not be loaded.</div>`}
        <div class="cl-ctrl">
          <button class="btn btn-ghost btn-sm" data-clipctl="play"><i data-lucide="play"></i>Play</button>
          <button class="btn btn-ghost btn-sm" data-clipctl="mute"><i data-lucide="volume-2"></i>Mute</button>
          <button class="btn btn-ghost btn-sm" data-clipctl="replay"><i data-lucide="rotate-ccw"></i>Replay</button>
        </div>
      </figure>
    </div>
    ${disc ? `<p class="cl-disc"><i data-lucide="info"></i>${esc(disc)} · AI-Generated Video</p>` : ""}
    <div class="rv-modal-f">
      <button class="btn btn-ghost" id="rvClipDl">Download Clip</button>
      <button class="btn btn-ghost" id="rvClipKeep">Keep Photo Instead</button>
      <button class="btn btn-ghost" id="rvClipRegen">Regenerate</button>
      <button class="btn btn-primary" id="rvClipUse" ${ctx.busy || !ctx.url ? "disabled" : ""}>Use This Clip</button>
    </div>
  </div></div>`;
}
