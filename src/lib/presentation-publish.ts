/**
 * Presentations — multiple deliberately selected designs, saved order.
 *
 * A presentation with no items is a draft. It cannot be published, shared,
 * exported or approved, and nothing about it may be presented to a recipient.
 */

export type PresentationItem = {
  id: string;
  version_id?: string | null;
  url?: string | null;
  status?: string | null;
  sort_order?: number | null;
};

export type PresentationReadiness = {
  itemCount: number;
  isDraft: boolean;
  canPublish: boolean;
  canCopyLink: boolean;
  canSend: boolean;
  canExportPdf: boolean;
  canApprove: boolean;
  canPreview: boolean;
  message: string | null;
};

export const EMPTY_MESSAGE = "Add at least one design before sharing.";
export const RECIPIENT_UNAVAILABLE = "This presentation is temporarily unavailable.";
export const SENDER_EMPTY_WARNING =
  "This presentation no longer contains any designs, so its public link is suspended.";

const usable = (i: PresentationItem) => {
  const st = (i?.status ?? "").toLowerCase();
  if (["failed", "error", "deleted", "processing", "pending"].includes(st)) return false;
  return !!i && !!i.id;
};

export function validItems(items: PresentationItem[] | null | undefined): PresentationItem[] {
  return (items ?? []).filter(usable);
}

export function presentationReadiness(
  items: PresentationItem[] | null | undefined,
): PresentationReadiness {
  const count = validItems(items).length;
  const ok = count > 0;
  return {
    itemCount: count,
    isDraft: !ok,
    canPublish: ok,
    canCopyLink: ok,
    canSend: ok,
    canExportPdf: ok,
    canApprove: ok,
    canPreview: true,
    message: ok ? null : EMPTY_MESSAGE,
  };
}

/** What a recipient may see when a published presentation has become empty. */
export function publicPresentationState(items: PresentationItem[] | null | undefined): {
  visible: boolean;
  showApproval: boolean;
  message: string | null;
} {
  const ok = validItems(items).length > 0;
  return {
    visible: ok,
    showApproval: ok,
    message: ok ? null : RECIPIENT_UNAVAILABLE,
  };
}

/** Duplicate designs must never be added twice to one presentation. */
export function addItem(
  items: PresentationItem[],
  next: PresentationItem,
): { items: PresentationItem[]; added: boolean } {
  const key = (i: PresentationItem) => i.version_id ?? i.id;
  if (!usable(next) || items.some((i) => key(i) === key(next))) return { items, added: false };
  return { items: [...items, { ...next, sort_order: items.length }], added: true };
}

export function reorder(items: PresentationItem[], from: number, to: number): PresentationItem[] {
  const copy = items.slice();
  if (from < 0 || from >= copy.length || to < 0 || to >= copy.length) return copy;
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved!);
  return copy.map((i, idx) => ({ ...i, sort_order: idx }));
}

export const PRESENTATION_STEPS = [
  ["details", "Details"],
  ["designs", "Add Designs"],
  ["arrange", "Arrange"],
  ["settings", "Presentation Settings"],
  ["review", "Review & Share"],
] as const;
