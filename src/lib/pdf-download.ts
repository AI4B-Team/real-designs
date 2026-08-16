import { renderPdf } from "./pdf.functions";
import type { PdfDoc } from "./pdf.server";

export type { PdfDoc };

function safeName(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "real-designs"
  );
}

/** Builds the PDF on the server and saves it as a real file. No popup, no
 *  print dialog, works on a phone. */
export async function downloadPdf(doc: PdfDoc, filename: string): Promise<void> {
  const { base64 } = await renderPdf({ data: { doc } });
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName(filename.replace(/\.pdf$/i, "")) + ".pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Downscales an image and returns a data URL, so PDF export never depends on
 *  the server being able to reach the original asset URL. */
export async function imageForPdf(src: string, maxW = 900): Promise<string | null> {
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("load"));
      i.src = src;
    });
    const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round((img.naturalWidth || maxW) * scale));
    c.height = Math.max(1, Math.round((img.naturalHeight || maxW * 0.66) * scale));
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  } catch {
    return null;
  }
}
