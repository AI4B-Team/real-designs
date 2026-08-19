/* Server side PDF generation.
   pdf-lib is pure JavaScript, so it runs in the Worker runtime with no native
   binaries. Everything the app used to print through a popup window is now
   rendered here and downloaded as a real file. */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type PdfColumn = { label: string; align?: "left" | "right"; width: number };
export type PdfSection = {
  heading?: string;
  text?: string;
  columns?: PdfColumn[];
  rows?: string[][];
  /** Rows rendered with a shaded background, e.g. division subtotals. */
  emphasizeRows?: number[];
};
export type PdfImage = { url: string; caption?: string };

export type PdfDoc = {
  title: string;
  subtitle?: string;
  org?: string;
  metaRight?: string[];
  images?: PdfImage[];
  sections?: PdfSection[];
  totals?: Array<{ label: string; value: string; strong?: boolean }>;
  notes?: string[];
  signatures?: string[];
  accent?: string;
};

const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const M = 44;
const RED = rgb(0.8, 0, 0);
const INK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.42, 0.42, 0.42);
const LINE = rgb(0.9, 0.9, 0.9);

function hexColor(hex?: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return RED;
  const n = parseInt(m[1]!, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** pdf-lib's WinAnsi fonts throw on characters they cannot encode. */
function clean(s: unknown): string {
  return String(s ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00b7/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of clean(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

async function fetchImage(pdf: PDFDocument, url: string) {
  try {
    if (!/^https?:|^data:/.test(url)) return null;
    let bytes: Uint8Array;
    let kind = "";
    if (url.startsWith("data:")) {
      kind = url.slice(5, url.indexOf(";"));
      const b64 = url.slice(url.indexOf(",") + 1);
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    } else {
      const res = await fetch(url);
      if (!res.ok) return null;
      kind = res.headers.get("content-type") || "";
      bytes = new Uint8Array(await res.arrayBuffer());
    }
    if (/png/i.test(kind)) return await pdf.embedPng(bytes);
    return await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function buildPdfBytes(doc: PdfDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = hexColor(doc.accent);
  const W = PAGE_W - M * 2;

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - M;
  };
  const need = (h: number) => {
    if (y - h < M + 24) newPage();
  };
  const text = (
    s: string,
    x: number,
    size: number,
    opts: {
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      align?: "left" | "right" | undefined;
      width?: number;
    } = {},
  ) => {
    const f = opts.font || reg;
    const str = clean(s);
    const tx = opts.align === "right" ? x + (opts.width || 0) - f.widthOfTextAtSize(str, size) : x;
    page.drawText(str, { x: tx, y, size, font: f, color: opts.color || INK });
  };

  // ---- masthead ----
  text(doc.org || "REAL DESIGNS", M, 9, { font: bold, color: accent });
  y -= 18;
  text(doc.title, M, 19, { font: bold });
  const metaTop = y + 14;
  y -= 14;
  if (doc.subtitle) {
    for (const l of wrap(doc.subtitle, reg, 10, W * 0.62)) {
      text(l, M, 10, { color: MUTED });
      y -= 13;
    }
  }
  let ry = metaTop;
  for (const m of doc.metaRight || []) {
    page.drawText(clean(m), {
      x: PAGE_W - M - reg.widthOfTextAtSize(clean(m), 9),
      y: ry,
      size: 9,
      font: reg,
      color: MUTED,
    });
    ry -= 12;
  }
  y = Math.min(y, ry) - 8;
  page.drawRectangle({ x: M, y, width: W, height: 2, color: accent });
  y -= 22;

  // ---- images ----
  if (doc.images?.length) {
    const imgs = await Promise.all(doc.images.map((i) => fetchImage(pdf, i.url)));
    const shown = imgs
      .map((img, i) => ({ img, cap: doc.images![i]!.caption }))
      .filter((p) => p.img);
    if (shown.length) {
      const gap = 12;
      const cw = (W - gap * (shown.length - 1)) / shown.length;
      const ch = Math.min(150, cw * 0.66);
      need(ch + 26);
      const top = y;
      shown.forEach((p, i) => {
        const x = M + i * (cw + gap);
        page.drawImage(p.img!, { x, y: top - ch, width: cw, height: ch });
        if (p.cap)
          page.drawText(clean(p.cap), { x, y: top - ch - 12, size: 8, font: reg, color: MUTED });
      });
      y = top - ch - 28;
    }
  }

  // ---- sections ----
  for (const sec of doc.sections || []) {
    if (sec.heading) {
      need(34);
      text(sec.heading.toUpperCase(), M, 9, { font: bold, color: MUTED });
      y -= 14;
    }
    if (sec.text) {
      for (const l of wrap(sec.text, reg, 10, W)) {
        need(14);
        text(l, M, 10);
        y -= 13;
      }
      y -= 6;
    }
    if (sec.columns?.length && sec.rows?.length) {
      const totalW = sec.columns.reduce((a, c) => a + c.width, 0);
      const xs: number[] = [];
      let acc = M;
      for (const c of sec.columns) {
        xs.push(acc);
        acc += (c.width / totalW) * W;
      }
      const colW = sec.columns.map((c) => (c.width / totalW) * W - 6);

      const header = () => {
        need(22);
        sec.columns!.forEach((c, i) =>
          text(c.label.toUpperCase(), xs[i]!, 7.5, {
            font: bold,
            color: MUTED,
            align: c.align,
            width: colW[i]!,
          }),
        );
        y -= 6;
        page.drawRectangle({ x: M, y, width: W, height: 0.7, color: LINE });
        y -= 12;
      };
      header();

      sec.rows.forEach((row, ri) => {
        const cells = row.map((cell, i) => wrap(cell, reg, 9, colW[i]!));
        const h = Math.max(...cells.map((c) => c.length)) * 11 + 6;
        if (y - h < M + 24) {
          newPage();
          header();
        }
        if (sec.emphasizeRows?.includes(ri)) {
          page.drawRectangle({
            x: M - 4,
            y: y - h + 8,
            width: W + 8,
            height: h,
            color: rgb(0.97, 0.97, 0.97),
          });
        }
        const rowTop = y;
        cells.forEach((linesArr, i) => {
          y = rowTop;
          for (const l of linesArr) {
            text(l, xs[i]!, 9, {
              align: sec.columns![i]!.align,
              width: colW[i]!,
              font: sec.emphasizeRows?.includes(ri) ? bold : reg,
            });
            y -= 11;
          }
        });
        y = rowTop - h;
        page.drawRectangle({ x: M, y: y + 4, width: W, height: 0.5, color: LINE });
      });
      y -= 14;
    }
  }

  // ---- totals ----
  if (doc.totals?.length) {
    need(doc.totals.length * 16 + 20);
    page.drawRectangle({
      x: M,
      y: y - (doc.totals.length * 16 + 10),
      width: W,
      height: doc.totals.length * 16 + 14,
      borderColor: LINE,
      borderWidth: 1,
    });
    y -= 6;
    for (const t of doc.totals) {
      y -= 14;
      text(t.label, M + 10, t.strong ? 12 : 10, { font: t.strong ? bold : reg });
      text(t.value, M, t.strong ? 12 : 10, {
        font: t.strong ? bold : reg,
        align: "right",
        width: W - 10,
      });
    }
    y -= 22;
  }

  // ---- notes ----
  for (const n of doc.notes || []) {
    for (const l of wrap(n, reg, 8.5, W - 10)) {
      need(12);
      page.drawRectangle({ x: M, y: y - 2, width: 2, height: 11, color: accent });
      text(l, M + 10, 8.5, { color: MUTED });
      y -= 11;
    }
    y -= 8;
  }

  // ---- signatures ----
  if (doc.signatures?.length) {
    need(50);
    y -= 24;
    const gap = 24;
    const cw = (W - gap * (doc.signatures.length - 1)) / doc.signatures.length;
    doc.signatures.forEach((s, i) => {
      const x = M + i * (cw + gap);
      page.drawRectangle({ x, y: y + 12, width: cw, height: 0.8, color: INK });
      page.drawText(clean(s), { x, y, size: 8, font: reg, color: MUTED });
    });
  }

  return await pdf.save();
}
