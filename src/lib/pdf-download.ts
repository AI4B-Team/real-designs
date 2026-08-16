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
