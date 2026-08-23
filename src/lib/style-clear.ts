/**
 * Design Style "Clear" behaviour.
 *
 * Clearing is scope-bound on purpose: the action removes the style exactly
 * where it was set (this photo, this project, the property direction) and
 * never reaches into unrelated photos without an explicit confirmation. It
 * touches nothing else — room type, instructions, direction, finish grade and
 * every other Customize setting are left alone.
 */

import {
  clearDirection,
  setDirection,
  scopeLabel,
  type DirectionContext,
  type DirectionStore,
  type ResolvedDirection,
  type StyleScope,
} from "@/lib/canvas-style";

export const CLEAR_LABEL = "Clear";
export const CLEAR_A11Y = "Remove selected design style.";
export const CHOOSE_STYLE_SUMMARY = "Choose a Design Style";
export const GENERATE_BLOCKED_REASON =
  "Choose a Design Style to generate. Clearing removed the style for this scope.";

/** Below this inspector width the Clear action moves into the overflow menu. */
export const NARROW_INSPECTOR_PX = 340;

export type HeaderAction = {
  id: "clear" | "browse" | "scope";
  label: string;
  /** Clear stays visually secondary; View All is the prominent action. */
  prominence: "primary" | "secondary" | "static";
};

export type HeaderLayout = { inline: HeaderAction[]; overflow: HeaderAction[] };

/**
 * Header actions, left label excluded. Order is fixed: Clear, View All, scope.
 * Clear only exists while a style is selected, and it is pushed into the
 * overflow menu rather than clipped when the inspector is narrow.
 */
export function styleHeaderActions(opts: {
  selected: boolean;
  scopeLabel?: string | null;
  width?: number | null;
}): HeaderLayout {
  const inline: HeaderAction[] = [];
  const overflow: HeaderAction[] = [];
  const narrow = typeof opts.width === "number" && opts.width > 0 && opts.width < NARROW_INSPECTOR_PX;
  const clear: HeaderAction = { id: "clear", label: CLEAR_LABEL, prominence: "secondary" };
  if (opts.selected) (narrow ? overflow : inline).push(clear);
  inline.push({ id: "browse", label: "View All", prominence: "primary" });
  if (opts.scopeLabel)
    inline.push({ id: "scope", label: String(opts.scopeLabel), prominence: "static" });
  return { inline, overflow };
}

export type ClearPlan = {
  /** The single scope the style is removed from. */
  scope: StyleScope;
  /** True when other photos would lose their style too. */
  needsConfirm: boolean;
  confirmMessage: string;
};

/** What a Clear press would do, before doing it. */
export function clearPlan(
  sel: ResolvedDirection | null,
  opts: { otherPhotoCount?: number } = {},
): ClearPlan | null {
  if (!sel) return null;
  const others = Math.max(0, opts.otherPhotoCount || 0);
  const needsConfirm = sel.scope !== "photo" && others > 0;
  return {
    scope: sel.scope,
    needsConfirm,
    confirmMessage: needsConfirm
      ? `This style is set for ${scopeLabel(sel.scope)}. Clearing it removes the style from ${others} other photo${others === 1 ? "" : "s"}.`
      : "",
  };
}

export type StyleUndo = { scope: StyleScope; styleId: string; ctx: DirectionContext };

/** Removes the style at its own scope and returns an undo record. */
export function applyClear(
  store: DirectionStore,
  sel: ResolvedDirection,
  ctx: DirectionContext,
): { store: DirectionStore; undo: StyleUndo } {
  return {
    store: clearDirection(store, sel.scope, ctx),
    undo: { scope: sel.scope, styleId: sel.styleId, ctx },
  };
}

/** Restores the previous style at the exact scope it was cleared from. */
export function undoClear(store: DirectionStore, undo: StyleUndo): DirectionStore {
  return setDirection(store, undo.scope, undo.ctx, undo.styleId);
}

/** Null when generation may proceed, otherwise the reason to show the user. */
export function generateBlockReason(sel: ResolvedDirection | null): string | null {
  return sel ? null : GENERATE_BLOCKED_REASON;
}
