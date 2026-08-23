/**
 * Pure model behind the public presentation link (/pkg/$token).
 *
 * The route renders what these helpers return, so the recipient-facing rules
 * (what is visible, what a decision covers, when Request Changes is allowed)
 * can be tested without a browser.
 */

export type ShareSection = { key?: string; section_key?: string; title?: string | null };

export type ShareAsset = {
  id: string;
  section_key: string;
  kind?: string | null;
  title?: string | null;
  caption?: string | null;
  url?: string | null;
  compare_url?: string | null;
  meta?: Record<string, unknown> | null;
  sort_order?: number | null;
};

export type ShareComment = {
  id: string;
  section_key?: string | null;
  author_name?: string | null;
  body: string;
  created_at: string;
};

export type PresentationItem = {
  id: string;
  /** Comment key for this item; stays under the 40 char server limit. */
  commentKey: string;
  sectionKey: string;
  roomName: string;
  title: string;
  caption: string | null;
  kind: string;
  url: string | null;
  compareUrl: string | null;
  style: string | null;
  notes: string | null;
  version: string | null;
  index: number;
};

export type SharePermissions = {
  comments: boolean;
  approve: boolean;
  changes: boolean;
  download: boolean;
  share: boolean;
  mode: "slideshow" | "scroll";
};

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
};

/** Internal placeholder names must never reach a client-facing page. */
const PLACEHOLDER = /^(test|demo|sample|untitled|draft|new)\b|pkg$|^[0-9a-f-]{20,}$/i;

export function presentationTitle(raw: unknown): string {
  const t = str(raw);
  if (!t || PLACEHOLDER.test(t)) return "Design Presentation";
  return t;
}

export function recipientLine(clientName: unknown): string {
  const name = str(clientName);
  return name ? `Prepared for ${name}` : "Prepared for your review";
}

export function preparedByLine(settings: Record<string, unknown> | null | undefined): string | null {
  const s = settings ?? {};
  const person = str(s["sender_name"]) ?? str(s["prepared_by"]);
  const company = str(s["brand_name"]) ?? str(s["company"]);
  if (person && company) return `Prepared by ${person} · ${company}`;
  if (person) return `Prepared by ${person}`;
  if (company) return `Prepared by ${company}`;
  return null;
}

export function permissionsFrom(
  settings: Record<string, unknown> | null | undefined,
): SharePermissions {
  const s = settings ?? {};
  const on = (k: string) => s[k] !== false;
  return {
    comments: on("allow_comments"),
    approve: on("allow_approve"),
    changes: on("allow_changes"),
    download: s["allow_download"] === true,
    share: s["allow_share"] === true,
    mode: s["mode"] === "scroll" ? "scroll" : "slideshow",
  };
}

/** Flattens visible sections + assets into the ordered list the client sees. */
export function buildItems(sections: ShareSection[], assets: ShareAsset[]): PresentationItem[] {
  const titles = new Map<string, string>();
  const order: string[] = [];
  for (const s of sections ?? []) {
    const key = (s.key ?? s.section_key ?? "").trim();
    if (!key) continue;
    titles.set(key, str(s.title) ?? key);
    order.push(key);
  }
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i === -1 ? 999 : i;
  };
  const visible = (assets ?? []).filter((a) => a && a.section_key && titles.has(a.section_key));
  visible.sort(
    (a, b) =>
      rank(a.section_key) - rank(b.section_key) || (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  return visible.map((a, i) => {
    const meta = (a.meta ?? {}) as Record<string, unknown>;
    return {
      id: a.id,
      commentKey: `a:${String(a.id).slice(0, 36)}`,
      sectionKey: a.section_key,
      roomName: titles.get(a.section_key) ?? a.section_key,
      title: str(a.title) ?? titles.get(a.section_key) ?? "Design",
      caption: str(a.caption),
      kind: str(a.kind) ?? "image",
      url: str(a.url),
      compareUrl: str(a.compare_url),
      style: str(meta["style"]),
      notes: str(meta["notes"]),
      version: str(meta["version"]),
      index: i,
    };
  });
}

/** Fingerprint of exactly what the recipient reviewed. */
export function presentationVersion(items: PresentationItem[]): string {
  return items.map((i) => `${i.id}:${i.version ?? "1"}`).join("|");
}

export function approvalScopeMessage(count: number): string {
  if (count === 1) return "You are approving the 1 design in this presentation.";
  return `You are approving all ${count} designs in this presentation.`;
}

export function commentsFor(comments: ShareComment[], key: string): ShareComment[] {
  return (comments ?? []).filter((c) => (c.section_key ?? "") === key);
}

/** Request Changes is only meaningful when the sender receives usable feedback. */
export function canRequestChanges(overall: string, itemComments: ShareComment[]): boolean {
  if (overall.trim().length >= 3) return true;
  return (itemComments ?? []).some((c) => (c.body ?? "").trim().length >= 3);
}

export function formatStamp(value: string | number | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDay(value: string | number | Date | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/** Copy for a link that cannot be opened — never reveals whether it exists. */
export function gateMessage(error: string | null | undefined): string {
  if (error === "expired")
    return "This presentation link has expired. Contact the sender for a new link.";
  return "This presentation is no longer available.";
}
