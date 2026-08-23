/**
 * Compact batch progress panel.
 *
 * A batch is never one indivisible spinner: every photo owns a row with its
 * own thumbnail, label, room, style, live status and — when it failed — its
 * own Retry. Successful rows are never retried, and the panel is driven only
 * by the job store, so it cannot disagree with the Canvas overlay.
 */

import {
import { escapeHtml as esc } from "@/lib/safe-html";
  STAGE_TITLE,
  batchTitle,
  countBatch,
  countsText,
  isTerminal,
  progressText,
  type Batch,
  type Job,
} from "@/lib/generation-jobs";


export function statusText(job: Job): string {
  if (job.stage === "complete") return "✓ Complete";
  if (job.stage === "failed") return job.interrupted ? "Interrupted" : "Generation Failed";
  if (job.stage === "cancelled") return "Cancelled";
  if (job.stage === "queued") return "Queued";
  return `${STAGE_TITLE[job.stage]}…`;
}

export function rowHtml(job: Job): string {
  const sub = [job.room, job.style].filter(Boolean).join(" · ");
  const detail = job.stage === "failed" ? job.error : progressText(job);
  return `<div class="rd-batch-row" data-stage="${esc(job.stage)}" data-job="${esc(job.id)}">
    ${job.thumb ? `<img src="${esc(job.thumb)}" alt="">` : `<span class="ph"></span>`}
    <span>
      <b>${esc(job.label)}</b>
      <em>${esc(sub)}</em>
      <em class="st">${esc(statusText(job))}${detail ? ` · ${esc(detail)}` : ""}</em>
      ${job.creditRestored ? `<em class="st">Credit restored</em>` : ""}
    </span>
    ${
      job.stage === "failed"
        ? `<button type="button" class="btn btn-ghost btn-xs" data-retry="${esc(job.id)}">Retry</button>`
        : `<span></span>`
    }
  </div>`;
}

export function panelHtml(batch: Batch): string {
  const c = countBatch(batch);
  const done = !c.active;
  return `<div class="rd-batch-h">
      <div><b>${esc(batchTitle(c))}</b><span>${esc(countsText(c))}</span></div>
      <button type="button" class="icon-btn" data-batch-dismiss="1" aria-label="Dismiss">×</button>
    </div>
    <div class="rd-batch-list" role="list" aria-live="polite">${batch.jobs.map(rowHtml).join("")}</div>
    ${
      done
        ? `<div class="rd-batch-foot">
             <button type="button" class="btn btn-ghost btn-xs" data-batch-dismiss="1">Dismiss</button>
             <button type="button" class="btn btn-primary btn-xs" data-batch-view="1">View Results</button>
           </div>`
        : ""
    }`;
}

export type BatchPanel = {
  el: HTMLElement;
  update: (batch: Batch) => void;
  destroy: () => void;
};

/** Mount (or reuse) the single batch panel for this page. */
export function mountBatchPanel(
  batch: Batch,
  handlers: { onRetry?: (jobId: string) => void; onView?: () => void; onDismiss?: () => void } = {},
  root: HTMLElement = document.body,
): BatchPanel {
  const doc = root.ownerDocument || document;
  /* The design tokens live on `.rd-app`. Mounting on <body> drops them and the
     secondary lines inherit the shadcn `--muted` surface colour, which renders
     as near-white text on white. Prefer the app shell as the mount point. */
  const host = (root === doc.body ? (doc.querySelector(".rd-app") as HTMLElement | null) : null) || root;
  let el = doc.querySelector(".rd-batch") as HTMLElement | null;
  if (!el) {
    el = doc.createElement("div");
    el.className = "rd-batch";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Design generation progress");
    host.appendChild(el);
  }

  const node = el;
  const destroy = () => node.remove();
  node.onclick = (ev) => {
    const t = (ev.target as HTMLElement)?.closest?.("[data-retry],[data-batch-view],[data-batch-dismiss]") as HTMLElement | null;
    if (!t) return;
    if (t.hasAttribute("data-retry")) handlers.onRetry?.(t.getAttribute("data-retry") || "");
    else if (t.hasAttribute("data-batch-view")) handlers.onView?.();
    else {
      handlers.onDismiss?.();
      destroy();
    }
  };
  const update = (b: Batch) => {
    node.innerHTML = panelHtml(b);
  };
  update(batch);
  return { el: node, update, destroy };
}

/** One compact notification for the whole batch, never one per photo. */
export function batchDoneMessage(batch: Batch): string {
  const c = countBatch(batch);
  if (c.active) return "";
  if (c.failed && c.complete)
    return `${c.complete} design${c.complete === 1 ? "" : "s"} are ready · ${c.failed} need${c.failed === 1 ? "s" : ""} a retry`;
  if (c.failed) return `${c.failed} design${c.failed === 1 ? "" : "s"} did not render`;
  return `${c.complete} design${c.complete === 1 ? "" : "s"} are ready`;
}

export function thumbClass(job: Pick<Job, "stage">): string {
  if (job.stage === "complete") return "rd-thumb-done";
  if (job.stage === "failed" || job.stage === "cancelled") return "rd-thumb-failed";
  return isTerminal(job.stage) ? "" : "rd-thumb-gen";
}
