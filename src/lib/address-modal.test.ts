import { describe, it, expect, beforeEach, vi } from "vitest";
import { openAddressModal } from "@/lib/address-modal";

const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));

const PROPS = [
  { id: "p1", address: "123 Main Street, Austin TX" },
  { id: "p2", address: "88 Oak Avenue, Dallas TX" },
];

const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as unknown as T;

describe("property address modal", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("replaces the prompt with an accessible dialog", () => {
    openAddressModal({ properties: PROPS, onSave: async () => {} });
    const dlg = q('[role="dialog"]');
    expect(dlg).toBeTruthy();
    expect(dlg.getAttribute("aria-modal")).toBe("true");
    expect(q<HTMLInputElement>("#addrmIn")).toBeTruthy();
    expect(q("#addrmSave")).toBeTruthy();
  });

  it("cancels without saving and closes on Escape", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    openAddressModal({ properties: PROPS, onSave, onCancel });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector(".addrm")).toBeNull();
    expect(onSave).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });

  it("saves a manually typed address with loading then success", async () => {
    let resolve: () => void = () => {};
    const gate = new Promise<void>((r) => (resolve = r));
    const onSave = vi.fn(async () => { await gate; });
    const onDone = vi.fn();
    openAddressModal({ properties: [], onSave, onDone });
    const input = q<HTMLInputElement>("#addrmIn");
    input.value = "9 Cedar Lane, Reno NV";
    input.dispatchEvent(new Event("input"));
    await settle(200);
    q<HTMLButtonElement>("#addrmSave").click();
    await settle(5);
    expect(q("#addrmMsg").textContent).toContain("Saving");
    expect(q<HTMLButtonElement>("#addrmSave").disabled).toBe(true);
    resolve();
    await settle(10);
    expect(onSave.mock.calls[0][0].address).toBe("9 Cedar Lane, Reno NV");
    expect(onSave.mock.calls[0][0].columns.property_address).toBe("9 Cedar Lane, Reno NV");
    expect(q("#addrmMsg").textContent).toContain("Saved");
    await settle(600);
    expect(document.querySelector(".addrm")).toBeNull();
    expect(onDone).toHaveBeenCalled();
  });

  it("shows an error state and stays open when saving fails", async () => {
    openAddressModal({ properties: [], address: "1 Elm", onSave: async () => { throw new Error("network down"); } });
    q<HTMLButtonElement>("#addrmSave").click();
    await settle(20);
    expect(q("#addrmMsg").textContent).toContain("network down");
    expect(q("#addrmMsg").className).toContain("bad");
    expect(document.querySelector(".addrm")).toBeTruthy();
    expect(q<HTMLButtonElement>("#addrmSave").disabled).toBe(false);
  });

  it("offers suggestions and assigns the picked property", async () => {
    const onSave = vi.fn(async () => {});
    openAddressModal({ properties: PROPS, onSave });
    const input = q<HTMLInputElement>("#addrmIn");
    input.value = "main";
    input.dispatchEvent(new Event("input"));
    await settle(220);
    const opts = document.querySelectorAll("#addrmList li");
    expect(opts).toHaveLength(1);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await settle(10);
    expect(input.value).toBe("123 Main Street, Austin TX");
    q<HTMLButtonElement>("#addrmSave").click();
    await settle(20);
    const res = onSave.mock.calls[0][0];
    expect(res.propertyId).toBe("p1");
    expect(res.assignmentChanged).toBe(true);
  });

  it("surfaces an existing-property match and lets the user keep it separate", async () => {
    const onSave = vi.fn(async () => {});
    openAddressModal({ properties: PROPS, onSave, suggest: async () => [] });
    const input = q<HTMLInputElement>("#addrmIn");
    input.value = "123 main street austin tx";
    input.dispatchEvent(new Event("input"));
    await settle(220);
    expect((q("#addrmMatch") as HTMLElement).hidden).toBe(false);
    q<HTMLButtonElement>("#addrmUse").click();
    q<HTMLButtonElement>("#addrmSave").click();
    await settle(20);
    expect(onSave.mock.calls[0][0].propertyId).toBe("p1");

    /* Keep Separate leaves the project unassigned. */
    document.body.innerHTML = "";
    const onSave2 = vi.fn(async () => {});
    openAddressModal({ properties: PROPS, address: "123 Main Street, Austin TX", propertyId: "p1", onSave: onSave2, suggest: async () => [] });
    q<HTMLButtonElement>("#addrmSep").click();
    q<HTMLButtonElement>("#addrmSave").click();
    await settle(20);
    expect(onSave2.mock.calls[0][0].propertyId).toBeNull();
    expect(onSave2.mock.calls[0][0].assignmentChanged).toBe(true);
  });

  it("clears the address and the assignment", async () => {
    const onSave = vi.fn(async () => {});
    openAddressModal({ properties: PROPS, address: "123 Main Street, Austin TX", propertyId: "p1", onSave });
    q<HTMLButtonElement>("#addrmClearBtn").click();
    await settle(20);
    const res = onSave.mock.calls[0][0];
    expect(res.address).toBe("");
    expect(res.columns.property_address).toBeNull();
    expect(res.propertyId).toBeNull();
    expect(res.assignmentChanged).toBe(true);
  });

  it("never returns a project title", async () => {
    const onSave = vi.fn(async () => {});
    openAddressModal({ properties: [], address: "5 Pine", onSave });
    q<HTMLButtonElement>("#addrmSave").click();
    await settle(20);
    const res = onSave.mock.calls[0][0];
    expect(Object.keys(res)).not.toContain("title");
    expect(JSON.stringify(res.columns)).not.toContain("title");
  });
});
