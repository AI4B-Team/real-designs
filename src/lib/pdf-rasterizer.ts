/**
 * PDF page rasterizer.
 *
 * Plan sets arrive as PDFs far more often than as images, so a PDF upload has
 * to become a picture the vision model can read. pdf.js is heavy, so it is
 * imported lazily the first time a PDF is actually dropped — never at module
 * load — and the worker is pulled from the same install so nothing is fetched
 * from a CDN at runtime.
 */

export type RasterPage = {
  index: number;
  label: string;
  dataUrl: string;
  width: number;
  height: number;
};

let libPromise: Promise<any> | null = null;

async function loadPdfjs(): Promise<any> {
  if (!libPromise) {
    libPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return libPromise;
}

export function isPdf(file: File | Blob | null | undefined): boolean {
  if (!file) return false;
  const name = (file as File).name || "";
  return file.type === "application/pdf" || /\.pdf$/i.test(name);
}

export function isPdfDataUrl(url: string | null | undefined): boolean {
  return !!url && url.startsWith("data:application/pdf");
}

async function toArrayBuffer(input: File | Blob | ArrayBuffer | string): Promise<ArrayBuffer> {
  if (input instanceof ArrayBuffer) return input;
  if (typeof input === "string") {
    const res = await fetch(input);
    return res.arrayBuffer();
  }
  return input.arrayBuffer();
}

/**
 * Renders PDF pages to PNG data URLs, longest edge capped so a large sheet
 * stays inside the model's input limits without losing line work.
 */
export async function rasterizePdf(
  input: File | Blob | ArrayBuffer | string,
  opts: { maxPages?: number; maxEdge?: number } = {},
): Promise<RasterPage[]> {
  const maxPages = Math.max(1, Math.min(opts.maxPages ?? 6, 20));
  const maxEdge = Math.max(768, Math.min(opts.maxEdge ?? 2048, 4096));
  const pdfjs = await loadPdfjs();
  const data = await toArrayBuffer(input);
  const doc = await pdfjs.getDocument({ data }).promise;
  const total = Math.min(doc.numPages, maxPages);
  const pages: RasterPage[] = [];

  for (let i = 1; i <= total; i += 1) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, maxEdge / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale: Math.max(0.5, scale) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser could not render the PDF.");
    /* Plans are line art on white; a white ground keeps thin lines readable. */
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    pages.push({
      index: i,
      label: "Page " + i,
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    });
  }
  try {
    await doc.destroy();
  } catch (_) {
    /* cleanup is best effort */
  }
  if (!pages.length) throw new Error("That PDF has no pages to read.");
  return pages;
}

/** Convenience: the first page only, which is what a single-plan upload needs. */
export async function rasterizeFirstPage(
  input: File | Blob | ArrayBuffer | string,
  maxEdge?: number,
): Promise<string> {
  const pages = await rasterizePdf(input, { maxPages: 1, maxEdge });
  return pages[0]!.dataUrl;
}
