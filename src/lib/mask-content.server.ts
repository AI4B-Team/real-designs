/**
 * The one place a mask becomes model input.
 *
 * Every targeted tool sends the same three things in the same order: the
 * source photograph, the review overlay the user approved, and the real
 * full-resolution binary mask produced by the canonical engine. The sentence
 * below tells the model exactly how to read the mask, so the mask a user drew
 * is never collected and then ignored.
 */

export const MASK_INSTRUCTION =
  "The final image supplied is a binary mask at the same aspect ratio as the photograph. " +
  "White pixels mark the ONLY area you may change. Black pixels are protected and must be " +
  "returned pixel-identical to the source photograph. Respect the mask edge precisely; " +
  "do not spill the edit outside the white area and do not leave the white area unedited.";

export function maskContent(prompt: string, image: string, overlay: string | null, mask: string | null): unknown[] {
  const content: unknown[] = [
    { type: "text", text: mask ? `${prompt}\n\n${MASK_INSTRUCTION}` : prompt },
    { type: "image_url", image_url: { url: image } },
  ];
  if (overlay) content.push({ type: "image_url", image_url: { url: overlay } });
  if (mask) content.push({ type: "image_url", image_url: { url: mask } });
  return content;
}
