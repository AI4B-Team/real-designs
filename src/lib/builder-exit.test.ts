import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync("src/content/rd-reveal.ts", "utf8");

describe("property video builder header controls", () => {
  it("has no Cancel control in the builder header", () => {
    expect(src).not.toContain('id="rvCancel"');
  });

  it("keeps modal-specific Cancel buttons untouched", () => {
    for (const id of ["rvPopCancel", "rvLogoCancel", "rvShortCancel", "rvKitCancel"]) {
      expect(src).toContain(`id="${id}"`);
    }
  });

  it("offers Exit Builder and Delete Draft in the header More menu", () => {
    expect(src).toMatch(/rv-headmore[\s\S]*rvExitBuilder[\s\S]*rvDeleteDraft/);
  });

  it("exits through an autosave flush and returns to Media", () => {
    expect(src).toMatch(/async function exitBuilder[\s\S]*wizSaver\.flush\(\)/);
    expect(src).toMatch(/function leaveBuilder[\s\S]*goTo\("v-media"\)/);
  });

  it("warns with Retry or Leave Anyway when the save failed", () => {
    expect(src).toContain("Leave Anyway");
    expect(src).toContain("Retry Saving");
    expect(src).toMatch(/wizSaver\.state === "error"/);
  });

  it("explains that source photos survive a draft deletion", () => {
    expect(src).toContain("Your uploaded source photos stay in your library");
    expect(src).toContain('id="rvDelPhotos"');
    expect(src).toMatch(/deleteProjectDraft\(\{ data: \{ id: w\.editingId \} \}\)/);
  });
});
