/** Global toast used across the app prototype surfaces (window.rdToast / window.__rdToast). */
const STYLE_ID = "rd-toast-style";
const HOST_ID = "rd-toast-host";

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
#${HOST_ID}{position:fixed;z-index:99999;bottom:22px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none}
#${HOST_ID} .rd-toast{pointer-events:auto;max-width:min(92vw,460px);background:#141414;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:11px 18px;font:500 13.5px/1.35 'DM Sans',system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.28);opacity:0;transform:translateY(8px);transition:opacity .18s ease,transform .18s ease}
#${HOST_ID} .rd-toast.on{opacity:1;transform:translateY(0)}
#${HOST_ID} .rd-toast.err{background:#CC0000;border-color:rgba(255,255,255,.2)}
`;
  document.head.appendChild(s);
}

export function rdToast(message: string, kind?: "error" | "info") {
  if (typeof document === "undefined") return;
  const msg = String(message ?? "").trim();
  if (!msg) return;
  ensureStyle();
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "rd-toast" + (kind === "error" ? " err" : "");
  el.setAttribute("role", "status");
  el.textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("on"));
  const kill = () => {
    el.classList.remove("on");
    window.setTimeout(() => el.remove(), 220);
  };
  el.addEventListener("click", kill);
  window.setTimeout(kill, 3800);
}

export function installRdToast() {
  if (typeof window === "undefined") return;
  const w = window as any;
  w.rdToast = rdToast;
  w.__rdToast = rdToast;
}
