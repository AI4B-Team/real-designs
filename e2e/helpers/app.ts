import { expect, type Locator, type Page } from "@playwright/test";

import { RUN_ID } from "./env";
import { waitForAppShell } from "./waits";

/** Navigation + interaction helpers scoped to the back-office app shell. */

export type AppView =
  | "dash"
  | "studio"
  | "explore"
  | "props"
  | "designs"
  | "media"
  | "listings"
  | "products"
  | "reports"
  | "present";

export async function openApp(page: Page): Promise<void> {
  await page.goto("/app", { waitUntil: "domcontentloaded" });
  await waitForAppShell(page);
}

export async function gotoView(page: Page, view: AppView): Promise<void> {
  await page.locator(`.side-nav [data-v="${view}"]`).click();
  await expect(page.locator(`#v-${view}`)).toBeVisible();
}

/** Photo cards used by both the Photo Design and Video builders. */
export function photoCards(page: Page): Locator {
  return page.locator(".rds-card, .rv-card, [data-photo-key]");
}

/** The overflow (three-dot) menu trigger on a card. */
export function cardMenuTrigger(card: Locator): Locator {
  return card.locator('[data-card-menu], [aria-label*="More" i], .rd-card-more').first();
}

export async function openCardMenu(page: Page, card: Locator): Promise<Locator> {
  await card.hover();
  await cardMenuTrigger(card).click();
  const menu = page.locator('[role="menu"], .rd-cardmenu').first();
  await expect(menu).toBeVisible();
  return menu;
}

/** Clicks a menu item by visible label. */
export async function clickMenuItem(menu: Locator, label: RegExp | string): Promise<void> {
  await menu.getByRole("menuitem", { name: label }).or(menu.getByText(label)).first().click();
}

/** Closes the topmost modal with Escape and asserts it is gone. */
export async function cancelModal(page: Page): Promise<void> {
  const modal = page.locator('[role="dialog"], .rd-modal, .modal.on').first();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
}

/** A run-scoped name so records created by a test are always identifiable. */
export function testName(label: string): string {
  return `${RUN_ID} ${label}`;
}
