// Display label for a property address. Uploads created before an address was
// entered are stored as "Untitled Property"; everywhere in the UI they should
// read "Unsorted Uploads" so the wording matches the upload manager.
export function propLabel(value?: string | null): string {
  const s = String(value ?? "").trim();
  if (!s || /^untitled property$/i.test(s)) return "Unsorted Uploads";
  return s;
}
