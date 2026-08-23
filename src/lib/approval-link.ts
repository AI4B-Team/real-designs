/**
 * Quick Approval Links — one saved design, one immutable version, one decision.
 *
 * Everything a Quick Approval Link needs that is not DOM: creation states,
 * version locking, duplicate-link handling, the email draft and the public URL.
 */

import { resolveShareBranding, type WorkspaceBrand } from "@/lib/share-branding";

export const PRODUCTION_ORIGIN = "https://realdesigns.ai";

export type ApprovalTarget = {
  design_id: string;
  version_id: string;
  version_no?: number | null;
  /** Immutable reference to the exact reviewed pixels. */
  asset_ref: string;
  asset_checksum?: string | null;
  room_name?: string | null;
  address?: string | null;
  style?: string | null;
  thumbnail_url?: string | null;
  created_at?: string | null;
  status?: string | null;
};

export type ApprovalCreateState =
  | { phase: "idle"; url: null }
  | { phase: "creating"; url: null }
  | { phase: "created"; url: string }
  | { phase: "error"; url: null; message: string };

export const idleCreateState = (): ApprovalCreateState => ({ phase: "idle", url: null });

export const CREATE_BUTTON_LABEL: Record<ApprovalCreateState["phase"], string> = {
  idle: "Create Approval Link",
  creating: "Creating Link…",
  created: "Approval Link Created",
  error: "Create Approval Link",
};

/** No URL may ever be shown before server-side creation succeeded. */
export function visibleUrl(state: ApprovalCreateState): string | null {
  return state.phase === "created" ? state.url : null;
}

export function canSubmitCreate(state: ApprovalCreateState, target: ApprovalTarget | null): boolean {
  if (state.phase === "creating" || state.phase === "created") return false;
  return isShareableTarget(target);
}

const SHAREABLE = new Set(["saved", "ready", "complete", "completed", "active", null, undefined]);

/** Only persisted designs are shareable: no previews, jobs, failures or blobs. */
export function isShareableTarget(t: ApprovalTarget | null | undefined): boolean {
  if (!t || !t.version_id || !t.design_id || !t.asset_ref) return false;
  if (/^blob:|^data:/i.test(t.asset_ref)) return false;
  const st = (t.status ?? "").toLowerCase();
  if (!st) return true;
  if (["processing", "pending", "queued", "failed", "error", "deleted", "draft"].includes(st))
    return false;
  return SHAREABLE.has(st) || true;
}

export type ExistingLinkChoice = "reuse" | "create_new" | "revoke_existing";

export const EXISTING_LINK_MESSAGE =
  "An approval link already exists for this exact version. Reuse it so the history stays in one place, or create a new one.";

export function existingLinkFor<T extends { version_id: string; revoked?: boolean | null }>(
  links: T[],
  versionId: string,
): T | null {
  return (links ?? []).find((l) => l.version_id === versionId && !l.revoked) ?? null;
}

export function approvalUrl(token: string, origin?: string | null): string {
  const base = productionSafeOrigin(origin);
  return `${base}/p/${token}`;
}

/** Copied links must never leak a preview or development host. */
export function productionSafeOrigin(origin?: string | null): string {
  const o = (origin ?? "").trim().replace(/\/$/, "");
  if (!o) return PRODUCTION_ORIGIN;
  if (/localhost|127\.0\.0\.1|\.lovable\.app$|lovableproject\.com$|\.local$/i.test(o))
    return PRODUCTION_ORIGIN;
  return o;
}

/**
 * Version-locked approval record. Once written it must never point at content
 * that can change underneath the recipient.
 */
export type ApprovalRecord = {
  design_id: string;
  version_id: string;
  asset_ref: string;
  asset_checksum: string | null;
  link_id: string;
  recipient_name: string | null;
  recipient_email: string | null;
  decision: "approved" | "changes";
  feedback: string | null;
  decided_at: string;
  superseded: boolean;
};

export function buildApprovalRecord(input: {
  target: ApprovalTarget;
  link_id: string;
  recipient_name?: string | null;
  recipient_email?: string | null;
  decision: "approved" | "changes";
  feedback?: string | null;
  decided_at?: string;
}): ApprovalRecord {
  return {
    design_id: input.target.design_id,
    version_id: input.target.version_id,
    asset_ref: input.target.asset_ref,
    asset_checksum: input.target.asset_checksum ?? null,
    link_id: input.link_id,
    recipient_name: input.recipient_name?.trim() || null,
    recipient_email: input.recipient_email?.trim() || null,
    decision: input.decision,
    feedback: input.feedback?.trim() || null,
    decided_at: input.decided_at ?? new Date().toISOString(),
    superseded: false,
  };
}

/** A newer version never mutates an existing request; it supersedes it. */
export function supersede(record: ApprovalRecord, newVersionId: string): ApprovalRecord {
  if (newVersionId === record.version_id) return record;
  return { ...record, superseded: true };
}

export type ApprovalEmail = { subject: string; body: string; html: string; url: string };

const titleCaseRoom = (room?: string | null) => (room ?? "").trim() || "Design";

export function buildApprovalEmail(input: {
  target: ApprovalTarget;
  token: string;
  origin?: string | null;
  recipient_name?: string | null;
  sender_name?: string | null;
  brand?: WorkspaceBrand | null;
  expires_at?: string | null;
}): ApprovalEmail {
  const url = approvalUrl(input.token, input.origin);
  const room = titleCaseRoom(input.target.room_name);
  const address = (input.target.address ?? "").trim();
  const who = (input.recipient_name ?? "").trim();
  const sender = (input.sender_name ?? "").trim();
  const brand = resolveShareBranding(input.brand);
  const subject = `Your ${room} Design Is Ready for Review`;
  const expiry = input.expires_at
    ? `\n\nThis link expires on ${new Date(input.expires_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })}.`
    : "";
  const lead = `Your ${room.toLowerCase()} design${address ? ` for ${address}` : ""} is ready to review.`;
  const body =
    `Hi${who ? " " + who : ""},\n\n` +
    `${lead}\n\n` +
    "Use the secure link below to compare the original and proposed design, leave feedback, approve the design, or request changes. No REAL DESIGNS account is required.\n\n" +
    url +
    expiry +
    `\n\nThank you,\n${sender || brand.name || "REAL DESIGNS"}`;
  const html =
    `<p>Hi${who ? " " + escapeHtml(who) : ""},</p>` +
    `<p>${escapeHtml(lead)}</p>` +
    `<p>Use the secure link below to compare the original and proposed design, leave feedback, approve the design, or request changes. No REAL DESIGNS account is required.</p>` +
    `<p><a href="${url}">Review ${escapeHtml(room)} Design</a></p>` +
    (input.expires_at ? `<p>${escapeHtml(expiry.trim())}</p>` : "") +
    `<p>Thank you,<br>${escapeHtml(sender || brand.name || "REAL DESIGNS")}</p>`;
  return { subject, body, html, url };
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}
