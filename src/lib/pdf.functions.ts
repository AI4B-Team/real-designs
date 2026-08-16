import { createServerFn } from "@tanstack/react-start";

/** Renders a document spec into a real PDF file, returned base64 encoded.
 *  The spec carries only content the caller already has on screen, so this is
 *  safe to call from the public client link page as well as the app. */
export const renderPdf = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = data as { doc?: unknown };
    if (!d || typeof d !== "object" || !d.doc) throw new Error("Nothing to export.");
    const json = JSON.stringify(d.doc);
    if (json.length > 900_000) throw new Error("That document is too large to export.");
    return { doc: d.doc as import("./pdf.server").PdfDoc };
  })
  .handler(async ({ data }) => {
    const { buildPdfBytes } = await import("./pdf.server");
    const bytes = await buildPdfBytes(data.doc);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return { base64: btoa(binary) };
  });
