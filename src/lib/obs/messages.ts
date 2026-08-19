/**
 * User-facing status and recovery wording.
 *
 * Every failure the product can surface has one honest sentence about what
 * happened, one about what we already did (refunds, retries) and one clear next
 * step, plus the correlation reference support can trace.
 */

import { supportReference } from "./correlation";

export type FailureKind =
  | "upload_failed"
  | "generation_failed"
  | "generation_timeout"
  | "generation_duplicate"
  | "storage_unavailable"
  | "ai_unavailable"
  | "billing_unavailable"
  | "email_unavailable"
  | "listing_unavailable"
  | "auth_required"
  | "unknown";

export interface UserFailure {
  title: string;
  body: string;
  /** Primary recovery action label, when a retry makes sense. */
  action: string | null;
  reference: string | null;
}

const COPY: Record<FailureKind, { title: string; body: string; action: string | null }> = {
  upload_failed: {
    title: "Upload Didn't Finish",
    body: "The photo didn't reach our storage. Nothing was charged.",
    action: "Try Upload Again",
  },
  generation_failed: {
    title: "Generation Didn't Complete",
    body: "The design could not be produced. Any credits held for it have been returned.",
    action: "Try Again",
  },
  generation_timeout: {
    title: "Generation Took Too Long",
    body: "We stopped the job after it ran past its expected time and returned your credits.",
    action: "Try Again",
  },
  generation_duplicate: {
    title: "Already Running",
    body: "This exact request is already in progress, so we didn't start a second one or charge again.",
    action: "View Progress",
  },
  storage_unavailable: {
    title: "Photo Storage Is Unavailable",
    body: "Uploads and previews are temporarily failing. Your existing work is safe.",
    action: "Retry",
  },
  ai_unavailable: {
    title: "Generation Is Temporarily Unavailable",
    body: "Our AI provider isn't responding. No credits were spent.",
    action: "Retry",
  },
  billing_unavailable: {
    title: "Billing Is Temporarily Unavailable",
    body: "Plan changes and top-ups can't be processed right now. Your current plan is unaffected.",
    action: "Retry",
  },
  email_unavailable: {
    title: "Email Delivery Delayed",
    body: "The notification hasn't gone out yet. Your action itself completed normally.",
    action: null,
  },
  listing_unavailable: {
    title: "Listing Lookup Unavailable",
    body: "We couldn't pull details for that address. You can add photos and details manually.",
    action: "Continue Manually",
  },
  auth_required: {
    title: "Please Sign In Again",
    body: "Your session expired. Nothing was lost — sign in and pick up where you left off.",
    action: "Sign In",
  },
  unknown: {
    title: "Something Went Wrong",
    body: "The action didn't complete. Nothing was charged.",
    action: "Try Again",
  },
};

export function userFailure(kind: FailureKind, correlationId?: string): UserFailure {
  const copy = COPY[kind] ?? COPY.unknown;
  return {
    title: copy.title,
    body: copy.body,
    action: copy.action,
    reference: correlationId ? supportReference(correlationId) : null,
  };
}
