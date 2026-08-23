// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mountPresentationList } from "./mount";
import type { PresentationRow } from "./list-model";

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const row = (over: Partial<PresentationRow> = {}): PresentationRow => ({
  id: "p1",
  token: "tok1",
  title: "Kitchen Refresh",
  status: "sent",
  created_at: new Date().toISOString(),
  ...over,
});

function deps(rows: PresentationRow[], over: Record<string, unknown> = {}) {
  return {
    loadRows: vi.fn(async () => rows),
    loadActivity: vi.fn(async () => []),
    deleteRow: vi.fn(async () => ({})),
    onRowsChanged: vi.fn(),
    actions: {
      send: vi.fn(),
      exportPdf: vi.fn(),
      exportBoard: vi.fn(),
      exportReel: vi.fn(),
      openStudio: vi.fn(),
      newLink: vi.fn(),
    },
    ...over,
  };
}

let host: HTMLElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  host.id = "linkList";
  document.body.appendChild(host);
});

afterEach(() => {
  host.remove();
  vi.restoreAllMocks();
});

describe("presentation list mount", () => {
  it("renders rows and reports them back to the host runtime", async () => {
    const d = deps([row({ client_name: "Dana", view_count: 2 })]);
    let handle!: ReturnType<typeof mountPresentationList>;
    await act(async () => {
      handle = mountPresentationList(host, d);
    });
    await flush();

    expect(host.querySelectorAll("[data-pid]")).toHaveLength(1);
    expect(host.textContent).toContain("Sent to Dana");
    expect(host.textContent).toContain("opened 2 times");
    expect(handle.rows()).toHaveLength(1);
    expect(d.onRowsChanged).toHaveBeenCalled();

    await act(async () => handle.destroy());
  });

  it("shows the empty state and routes its two actions to the host", async () => {
    const d = deps([]);
    let handle!: ReturnType<typeof mountPresentationList>;
    await act(async () => {
      handle = mountPresentationList(host, d);
    });
    await flush();

    expect(host.textContent).toContain("No Client Links Yet.");
    const buttons = Array.from(host.querySelectorAll("button"));
    await act(async () => buttons[0]?.click());
    await act(async () => buttons[1]?.click());
    expect(d.actions.openStudio).toHaveBeenCalled();
    expect(d.actions.newLink).toHaveBeenCalled();

    await act(async () => handle.destroy());
  });

  it("filters by tab without touching the server", async () => {
    const d = deps([row({ id: "a", status: "sent" }), row({ id: "b", status: "approved" })]);
    let handle!: ReturnType<typeof mountPresentationList>;
    await act(async () => {
      handle = mountPresentationList(host, d);
    });
    await flush();

    const approvedTab = host.querySelector<HTMLButtonElement>('[data-pf="approved"]');
    await act(async () => approvedTab?.click());
    expect(host.querySelectorAll("[data-pid]")).toHaveLength(1);
    expect(host.querySelector("[data-pid]")?.getAttribute("data-pid")).toBe("b");
    expect(d.loadRows).toHaveBeenCalledTimes(1);

    await act(async () => handle.destroy());
  });

  it("hands row actions to the host runtime", async () => {
    const d = deps([row()]);
    let handle!: ReturnType<typeof mountPresentationList>;
    await act(async () => {
      handle = mountPresentationList(host, d);
    });
    await flush();

    const byTitle = (t: string) => host.querySelector<HTMLButtonElement>(`button[title="${t}"]`);
    await act(async () => byTitle("Send to Client")?.click());
    await act(async () => byTitle("Send Approval Reminder")?.click());
    await act(async () => byTitle("Branded PDF")?.click());
    expect(d.actions.send).toHaveBeenCalledTimes(2);
    expect(d.actions.send.mock.calls[1]?.[1]).toBe(true);
    expect(d.actions.exportPdf).toHaveBeenCalledWith("p1", expect.anything());

    await act(async () => handle.destroy());
  });

  it("deletes through the host and reloads the list", async () => {
    const d = deps([row()]);
    let handle!: ReturnType<typeof mountPresentationList>;
    await act(async () => {
      handle = mountPresentationList(host, d);
    });
    await flush();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[title="Delete Link"]')?.click();
    });
    await flush();
    expect(d.deleteRow).toHaveBeenCalledWith("p1");
    expect(d.loadRows).toHaveBeenCalledTimes(2);

    await act(async () => handle.destroy());
  });

  it("expands and collapses the activity timeline", async () => {
    const d = deps([row()], {
      loadActivity: vi.fn(async () => [
        { id: "e1", kind: "viewed", detail: "Client opened the link" },
      ]),
    });
    let handle!: ReturnType<typeof mountPresentationList>;
    await act(async () => {
      handle = mountPresentationList(host, d);
    });
    await flush();

    const hist = () => host.querySelector<HTMLElement>("[data-hist-for]");
    expect(hist()?.hidden).toBe(true);
    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[title="Activity History"]')?.click();
    });
    await flush();
    expect(hist()?.hidden).toBe(false);
    expect(hist()?.textContent).toContain("Client opened the link");
    expect(hist()?.textContent).toContain("Link Created");

    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[title="Activity History"]')?.click();
    });
    expect(hist()?.hidden).toBe(true);

    await act(async () => handle.destroy());
  });

  it("refreshes when a design is saved and stops after teardown", async () => {
    const d = deps([row()]);
    let handle!: ReturnType<typeof mountPresentationList>;
    await act(async () => {
      handle = mountPresentationList(host, d);
    });
    await flush();
    expect(d.loadRows).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("rd:saved"));
    });
    await flush();
    expect(d.loadRows).toHaveBeenCalledTimes(2);

    await act(async () => handle.destroy());
    expect(host.innerHTML).toBe("");
    await act(async () => {
      window.dispatchEvent(new Event("rd:saved"));
    });
    expect(d.loadRows).toHaveBeenCalledTimes(2);
  });

  it("survives a failed load by showing the empty state", async () => {
    const d = deps([], {
      loadRows: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    let handle!: ReturnType<typeof mountPresentationList>;
    await act(async () => {
      handle = mountPresentationList(host, d);
    });
    await flush();
    expect(host.textContent).toContain("No Client Links Yet.");
    await act(async () => handle.destroy());
  });

  it("focus resets the filter to All and flashes the row", async () => {
    const d = deps([row({ id: "a", status: "sent" }), row({ id: "b", status: "approved" })]);
    let handle!: ReturnType<typeof mountPresentationList>;
    await act(async () => {
      handle = mountPresentationList(host, d);
    });
    await flush();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[data-pf="approved"]')?.click();
    });
    expect(host.querySelectorAll("[data-pid]")).toHaveLength(1);

    await act(async () => {
      await handle.focus("a");
    });
    expect(host.querySelectorAll("[data-pid]")).toHaveLength(2);
    expect(host.querySelector('[data-pid="a"]')?.className).toContain("rd-flash");

    await act(async () => handle.destroy());
  });
});
