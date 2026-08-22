/**
 * The one durable resume contract.
 *
 * "Continue Editing" must reopen the exact project the user left, after a
 * refresh, in a new tab, or from any surface. A global variable cannot do
 * that, so every handoff is written as a validated envelope that survives the
 * navigation and is only marked consumed once the destination has actually
 * restored the project.
 */

export type WorkflowType =
  | "photo_redesign"
  | "photo_staging"
  | "concept"
  | "video"
  | "image_edit";

export const WORKFLOW_TYPES: WorkflowType[] = [
  "photo_redesign",
  "photo_staging",
  "concept",
  "video",
  "image_edit",
];

export type ResumeContext = {
  projectDraftId: string | null;
  propertyId: string | null;
  projectId: string | null;
  roomId: string | null;
  sourceAssetId: string | null;
  activeVersionId: string | null;
  workflowType: WorkflowType;
  currentStep: string | null;
  sourceStoragePath: string | null;
  generatedStoragePath: string | null;
  prompt: string | null;
  selectedStyleId: string | null;
  settings: Record<string, unknown>;
  /** Diagnostic id logged when a restore fails. Never shown as an alert. */
  diagnosticId: string;
  at: number;
};

export type ResumeInput = Partial<Omit<ResumeContext, "workflowType">> & {
  workflowType: WorkflowType;
};

const KEY = "rd.resume.v1";

/** Where each workflow lives. Nothing is routed to a generic destination. */
export const RESUME_DESTINATION: Record<WorkflowType, string> = {
  photo_redesign: "studio",
  photo_staging: "staging",
  concept: "studio",
  video: "lvideo",
  image_edit: "media",
};

export function destinationFor(workflowType: string): string | null {
  return (RESUME_DESTINATION as Record<string, string>)[workflowType] || null;
}

const str = (v: unknown) => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : null;
};

/** A resume envelope needs a workflow and at least one thing to reopen. */
export function makeResume(input: ResumeInput): ResumeContext | null {
  if (!input || !WORKFLOW_TYPES.includes(input.workflowType)) return null;
  const ctx: ResumeContext = {
    projectDraftId: str(input.projectDraftId),
    propertyId: str(input.propertyId),
    projectId: str(input.projectId),
    roomId: str(input.roomId),
    sourceAssetId: str(input.sourceAssetId),
    activeVersionId: str(input.activeVersionId),
    workflowType: input.workflowType,
    currentStep: str(input.currentStep),
    /* Signed URLs expire; only durable storage paths may be resumed from. */
    sourceStoragePath: durable(input.sourceStoragePath),
    generatedStoragePath: durable(input.generatedStoragePath),
    prompt: str(input.prompt),
    selectedStyleId: str(input.selectedStyleId),
    settings: (input.settings as Record<string, unknown>) || {},
    diagnosticId: str(input.diagnosticId) || newDiagnosticId(),
    at: Date.now(),
  };
  const anchored =
    ctx.projectDraftId ||
    ctx.projectId ||
    ctx.roomId ||
    ctx.activeVersionId ||
    ctx.sourceAssetId ||
    ctx.sourceStoragePath ||
    ctx.generatedStoragePath;
  return anchored ? ctx : null;
}

function durable(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  return /^(blob:|data:)/i.test(s) ? null : s;
}

export function newDiagnosticId(): string {
  return "rsm_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

function store(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

let mem: ResumeContext | null = null;

/** Publish the resume context before navigating. Survives a refresh. */
export function publishResume(input: ResumeInput): ResumeContext | null {
  const ctx = makeResume(input);
  if (!ctx) return null;
  mem = ctx;
  try {
    store()?.setItem(KEY, JSON.stringify(ctx));
  } catch {
    /* private mode still has the in-memory copy for this session */
  }
  return ctx;
}

/** Read without consuming: a failed restore must be retryable. */
export function peekResume(workflowType?: WorkflowType): ResumeContext | null {
  let ctx = mem;
  if (!ctx) {
    try {
      const raw = store()?.getItem(KEY);
      ctx = raw ? (JSON.parse(raw) as ResumeContext) : null;
    } catch {
      ctx = null;
    }
  }
  if (!ctx || !WORKFLOW_TYPES.includes(ctx.workflowType)) return null;
  if (workflowType && ctx.workflowType !== workflowType) return null;
  return ctx;
}

/** Called only after the destination restored the project successfully. */
export function markResumeConsumed(diagnosticId?: string) {
  const ctx = peekResume();
  if (ctx && diagnosticId && ctx.diagnosticId !== diagnosticId) return;
  clearResume();
}

export function clearResume() {
  mem = null;
  try {
    store()?.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}

export type ResumeOutcome = { ok: true; ctx: ResumeContext } | { ok: false; reason: string; diagnosticId: string };

/**
 * The full sequence: read the draft, confirm it exists, resolve its durable
 * images, publish, navigate once. Restoration is reported by the destination
 * through `markResumeConsumed`, never assumed here.
 */
export async function beginResume(opts: {
  input: ResumeInput;
  /** Confirms the persistent record still exists. */
  confirm?: (ctx: ResumeContext) => Promise<boolean> | boolean;
  navigate: (view: string, ctx: ResumeContext) => void;
}): Promise<ResumeOutcome> {
  const ctx = makeResume(opts.input);
  if (!ctx) {
    return { ok: false, reason: "This project couldn't be reopened.", diagnosticId: newDiagnosticId() };
  }
  const dest = destinationFor(ctx.workflowType);
  if (!dest) return { ok: false, reason: "This project couldn't be reopened.", diagnosticId: ctx.diagnosticId };
  try {
    if (opts.confirm) {
      const ok = await opts.confirm(ctx);
      if (!ok) {
        return {
          ok: false,
          reason: "This project couldn't be reopened.",
          diagnosticId: ctx.diagnosticId,
        };
      }
    }
  } catch (_) {
    return { ok: false, reason: "This project couldn't be reopened.", diagnosticId: ctx.diagnosticId };
  }
  publishResume(ctx);
  opts.navigate(dest, ctx);
  return { ok: true, ctx };
}
