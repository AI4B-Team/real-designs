import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { ShellIcon } from "../app-shell/ShellIcon";
import {
  PRES_TABS,
  presentationCreatedActivity,
  presentationHistoryCopy,
  presentationLink,
  presentationMatches,
  presentationRowCopy,
  presentationStatusMeta,
  presentationTabCounts,
  type PresentationActivity,
  type PresentationFilter,
  type PresentationRow,
} from "./list-model";

/**
 * The client-link list surface.
 *
 * React owns the whole `#linkList` region: tabs, filter state, rows, the
 * inline activity timeline and the empty/loading states. The legacy runtime
 * keeps the things this list only triggers — the send/new-link modals and the
 * PDF, board and reel exporters — and hands them in as typed actions.
 */

/** Minimal surface the legacy exporters need to report progress on a button. */
export interface ProgressTarget {
  disabled: boolean;
  innerHTML: string;
}

export interface PresentationListActions {
  send(row: PresentationRow, reminder?: boolean): void;
  exportPdf(id: string, target: ProgressTarget | null): unknown;
  exportBoard(id: string, target: ProgressTarget | null): unknown;
  exportReel(id: string, target: ProgressTarget | null): unknown;
  openStudio(): void;
  newLink(): void;
}

export interface PresentationListDeps {
  loadRows(): Promise<PresentationRow[]>;
  loadActivity(id: string): Promise<PresentationActivity[]>;
  deleteRow(id: string): Promise<unknown>;
  onRowsChanged?(rows: PresentationRow[]): void;
  actions: PresentationListActions;
}

export interface PresentationListHandle {
  refresh(): Promise<void>;
  focus(id: string): Promise<void>;
  rows(): PresentationRow[];
}

type ExportKind = "pdf" | "board" | "reel";
type BusyMap = Record<string, string | undefined>;

const busyKey = (id: string, kind: ExportKind) => id + ":" + kind;

function Skeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div className="rowi sk-rowi" key={i}>
          <div className="sk sk-th" />
          <div className="sk-lines">
            <div className="sk sk-l1" />
            <div className="sk sk-l2" />
          </div>
        </div>
      ))}
    </>
  );
}

export const PresentationList = forwardRef<PresentationListHandle, PresentationListDeps>(
  function PresentationList(deps, ref) {
    /* Props arrive through a spread from the mount adapter, so their identity
       changes on every render. Callbacks read them through a ref instead, which
       keeps effects and handlers stable and the initial load to exactly one. */
    const depsRef = useRef(deps);
    depsRef.current = deps;
    const actions = deps.actions;
    const [rows, setRows] = useState<PresentationRow[] | null>(null);
    const [filter, setFilter] = useState<PresentationFilter>("all");
    const [openHistory, setOpenHistory] = useState<string | null>(null);
    const [history, setHistory] = useState<PresentationActivity[] | null>(null);
    const [copied, setCopied] = useState<string | null>(null);
    const [busy, setBusy] = useState<BusyMap>({});
    const [flash, setFlash] = useState<string | null>(null);

    const rowsRef = useRef<PresentationRow[]>([]);
    const listRef = useRef<HTMLDivElement | null>(null);
    const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
    const alive = useRef(true);

    useEffect(() => {
      alive.current = true;
      const pending = timers.current;
      return () => {
        alive.current = false;
        pending.forEach(clearTimeout);
        pending.length = 0;
      };
    }, []);

    const later = useCallback((fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        if (alive.current) fn();
      }, ms);
      timers.current.push(t);
    }, []);

    const refresh = useCallback(async () => {
      const d = depsRef.current;
      let next: PresentationRow[] = [];
      try {
        next = (await d.loadRows()) || [];
      } catch {
        next = [];
      }
      rowsRef.current = next;
      if (!alive.current) return;
      setRows(next);
      d.onRowsChanged?.(next);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        refresh,
        rows: () => rowsRef.current,
        async focus(id: string) {
          if (!rowsRef.current.length) await refresh();
          if (!alive.current) return;
          setFilter("all");
          setFlash(id);
          later(() => setFlash((cur) => (cur === id ? null : cur)), 2400);
        },
      }),
      [refresh, later],
    );

    useEffect(() => {
      void refresh();
      // Reload after a Studio save so a new link shows up without a view switch.
      const onSaved = () => void refresh();
      window.addEventListener("rd:saved", onSaved);
      return () => window.removeEventListener("rd:saved", onSaved);
    }, [refresh]);

    useEffect(() => {
      if (!flash || !listRef.current) return;
      const node = listRef.current.querySelector('[data-pid="' + CSS.escape(flash) + '"]');
      if (node && typeof node.scrollIntoView === "function")
        node.scrollIntoView({ block: "center", behavior: "smooth" });
    }, [flash]);

    const toggleHistory = useCallback(
      async (row: PresentationRow) => {
        if (openHistory === row.id) {
          setOpenHistory(null);
          return;
        }
        setOpenHistory(row.id);
        setHistory(null);
        let list: PresentationActivity[] = [];
        try {
          list = (await depsRef.current.loadActivity(row.id)) || [];
        } catch {
          list = [];
        }
        if (row.created_at) list = list.concat([presentationCreatedActivity(row)]);
        if (!alive.current) return;
        setHistory(list);
      },
      [openHistory],
    );

    const copyLink = useCallback(
      async (row: PresentationRow) => {
        try {
          await navigator.clipboard.writeText(presentationLink(row.token));
        } catch {
          /* clipboard is best effort */
        }
        setCopied(row.id);
        later(() => setCopied((cur) => (cur === row.id ? null : cur)), 1400);
      },
      [later],
    );

    /* The legacy exporters report progress by writing into a button element.
       They get a small proxy instead so React keeps owning the real button. */
    const runExport = useCallback(
      (row: PresentationRow, kind: ExportKind) => {
        const key = busyKey(row.id, kind);
        const target: ProgressTarget = {
          disabled: false,
          set innerHTML(html: string) {
            const label = html.replace(/<[^>]*>/g, "").trim();
            if (alive.current) setBusy((b) => ({ ...b, [key]: label || " " }));
          },
          get innerHTML() {
            return "";
          },
        };
        setBusy((b) => ({ ...b, [key]: " " }));
        const done = () => {
          if (alive.current) setBusy((b) => ({ ...b, [key]: undefined }));
        };
        const run =
          kind === "pdf"
            ? actions.exportPdf(row.id, target)
            : kind === "board"
              ? actions.exportBoard(row.id, target)
              : actions.exportReel(row.id, target);
        void Promise.resolve(run).then(done, done);
      },
      [actions],
    );

    const remove = useCallback(
      async (row: PresentationRow) => {
        try {
          await depsRef.current.deleteRow(row.id);
        } catch {
          /* the refresh below re-states the truth either way */
        }
        await refresh();
      },
      [refresh],
    );

    if (rows === null) return <Skeleton />;

    if (!rows.length) {
      return (
        <>
          <p style={{ fontSize: ".79rem", color: "var(--mute-2)" }}>
            No Client Links Yet. Save a design in Studio, then use New Link to share it for
            approval.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn btn-primary btn-sm" onClick={() => actions.openStudio()}>
              <ShellIcon name="wand-2" />
              Open Studio
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => actions.newLink()}>
              <ShellIcon name="link" />
              New Link
            </button>
          </div>
        </>
      );
    }

    const counts = presentationTabCounts(rows);
    const visible = rows.filter((r) => presentationMatches(r, filter));

    return (
      <div ref={listRef} className="pres-list-root">
        <div className="notif-tabs" id="presTabs" style={{ margin: "0 0 10px" }}>
          {PRES_TABS.map((tab, i) => (
            <button
              key={tab.key}
              className={"notif-tab" + (filter === tab.key ? " on" : "")}
              data-pf={tab.key}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label} {counts[i]}
            </button>
          ))}
        </div>
        {!visible.length ? (
          <p style={{ fontSize: ".79rem", color: "var(--mute-2)" }}>
            No Links With That Status Yet.
          </p>
        ) : (
          visible.map((r) => {
            const status = presentationStatusMeta(r.status);
            const c = presentationRowCopy(r);
            const isOpen = openHistory === r.id;
            const iconBtn = (
              kind: ExportKind,
              icon: string,
              title: string,
              onClick: () => void,
            ) => {
              const label = busy[busyKey(r.id, kind)];
              return (
                <button
                  className="icon-btn"
                  title={title}
                  disabled={label !== undefined}
                  onClick={onClick}
                >
                  {label !== undefined && label.trim() ? (
                    <span style={{ fontSize: ".66rem", fontWeight: 700 }}>{label}</span>
                  ) : (
                    <ShellIcon name={label !== undefined ? "loader" : icon} />
                  )}
                </button>
              );
            };
            return (
              <div key={r.id}>
                <div
                  className={"rowi" + (flash === r.id ? " rd-flash" : "")}
                  data-pid={r.id}
                  data-tok={r.token}
                >
                  <div className="rowt">
                    <b>{r.title}</b>
                    <span>
                      {c.context ? c.context + " · " : ""}
                      {c.who} · {c.seen} · {c.when}
                      {c.reminders}
                    </span>
                  </div>
                  {c.due ? <span className="pill warn">Follow Up Due</span> : null}
                  <span className={"pill " + status.cls}>
                    {copied === r.id ? "Link Copied" : status.label}
                  </span>
                  <button
                    className="icon-btn"
                    title="Activity History"
                    onClick={() => void toggleHistory(r)}
                  >
                    <ShellIcon name="history" />
                  </button>
                  <button
                    className="icon-btn"
                    title="Send Approval Reminder"
                    onClick={() => actions.send(r, true)}
                  >
                    <ShellIcon name="bell-ring" />
                  </button>
                  <button
                    className="icon-btn"
                    title="Send to Client"
                    onClick={() => actions.send(r)}
                  >
                    <ShellIcon name="send" />
                  </button>
                  <button className="icon-btn" title="Copy Link" onClick={() => void copyLink(r)}>
                    <ShellIcon name="copy" />
                  </button>
                  {iconBtn("pdf", "file-text", "Branded PDF", () => runExport(r, "pdf"))}
                  {iconBtn("board", "shopping-bag", "Product Board", () =>
                    runExport(r, "board"),
                  )}
                  {iconBtn("reel", "clapperboard", "Social Reel, 9x16", () =>
                    runExport(r, "reel"),
                  )}
                  <button className="icon-btn" title="Delete Link" onClick={() => void remove(r)}>
                    <ShellIcon name="trash-2" />
                  </button>
                </div>
                {c.hasNote ? (
                  <>
                    <div className="rowi" style={{ borderTop: 0, paddingTop: 0 }}>
                      <div className="rowt" style={{ paddingLeft: 2 }}>
                        <span style={{ color: "var(--mute-2)" }}>
                          {r.decision_note ? (
                            <>
                              <i>&ldquo;{r.decision_note}&rdquo;</i> &mdash;{" "}
                              {r.client_name || "client"}
                            </>
                          ) : (
                            c.noteLead
                          )}
                        </span>
                        {c.droppedPill ? (
                          <span className="pill warn" style={{ marginLeft: 6 }}>
                            {c.droppedPill}
                          </span>
                        ) : null}
                        {c.notesPill ? (
                          <span className="pill" style={{ marginLeft: 6 }}>
                            {c.notesPill}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {c.lineNotes.map((t, i) => (
                      <div className="rowi" style={{ borderTop: 0, paddingTop: 0 }} key={i}>
                        <div className="rowt" style={{ paddingLeft: 2 }}>
                          <span style={{ color: "var(--mute-2)" }}>
                            <i>&ldquo;{t}&rdquo;</i>
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                ) : null}
                <div className="pres-hist" data-hist-for={r.id} hidden={!isOpen}>
                  {isOpen && history === null ? (
                    <div className="pres-hist-i">
                      <div className="sk-lines">
                        <div className="sk sk-l1" />
                        <div className="sk sk-l1" />
                      </div>
                    </div>
                  ) : null}
                  {isOpen && history !== null && !history.length ? (
                    <div className="pres-hist-i">
                      <span>
                        No Activity Yet. The timeline fills in once the client opens the link.
                      </span>
                    </div>
                  ) : null}
                  {isOpen && history
                    ? history.map((ev, i) => {
                        const h = presentationHistoryCopy(ev);
                        return (
                          <div className="pres-hist-i" key={ev.id + ":" + i}>
                            <ShellIcon name={h.icon} />
                            <div>
                              <b>{h.label}</b>
                              <span>{h.detail}</span>
                              {h.note ? <em>&ldquo;{h.note}&rdquo;</em> : null}
                            </div>
                            <span className="tm">{h.when}</span>
                          </div>
                        );
                      })
                    : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  },
);
