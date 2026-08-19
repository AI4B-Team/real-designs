import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = path.join(here, "..", "fixtures", ".generated");

/** Minimal 1x1 JPEG, base64. */
const JPEG_1x1 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

/** Minimal 1x1 PNG, base64. */
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function write(name: string, base64: string): string {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const file = path.join(FIXTURE_DIR, name);
  if (!existsSync(file)) writeFileSync(file, Buffer.from(base64, "base64"));
  return file;
}

/** A supported photo (JPG). */
export function validPhoto(name = "room-a.jpg"): string {
  return write(name, JPEG_1x1);
}

/** A second supported photo (PNG) for multi-photo flows. */
export function validPhotoPng(name = "room-b.png"): string {
  return write(name, PNG_1x1);
}

/** An unsupported file the uploader must reject. */
export function unsupportedFile(name = "notes.txt"): string {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const file = path.join(FIXTURE_DIR, name);
  if (!existsSync(file)) writeFileSync(file, "this is not a photo");
  return file;
}

/**
 * Sets files on the uploader used by the active builder step. Prefers the
 * multi-file image input rendered by Studio/Review Rooms, and falls back to a
 * file chooser opened from an upload button.
 */
export async function uploadPhotos(page: Page, files: string[]): Promise<void> {
  const multi = page.locator('input[type="file"][multiple]');
  if ((await multi.count()) > 0) {
    await multi.first().setInputFiles(files);
    return;
  }
  const single = page.locator('input[type="file"]');
  if ((await single.count()) > 0) {
    await single.first().setInputFiles(files.slice(0, 1));
    return;
  }
  const trigger = page
    .getByRole("button", { name: /upload|add photos|add more photos|choose photos/i })
    .first();
  const chooser = page.waitForEvent("filechooser");
  await trigger.click();
  await (await chooser).setFiles(files);
}
