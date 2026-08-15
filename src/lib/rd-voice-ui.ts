/* Voice Studio — record or upload a voice sample, profile it, and narrate every
   video in that voice. Shared by the design-video and listing-video builders. */

import {
  MY_VOICE,
  VOICE_SCRIPT,
  clearVoiceProfile,
  createVoiceProfile,
  getVoiceProfile,
  type VoiceProfile,
} from "@/lib/rd-voice";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export { MY_VOICE };

/** Option row for a builder voice <select>, shown once a profile exists. */
export function myVoiceOption(selected: string | null | undefined): string {
  const p = getVoiceProfile();
  if (!p) return "";
  return `<option value="${MY_VOICE}" ${(selected || "").toLowerCase() === MY_VOICE ? "selected" : ""}>${esc(p.label)} (My Voice)</option>`;
}

/** Small button that opens the studio. */
export function voiceStudioButton(): string {
  const p = getVoiceProfile();
  return `<button type="button" class="btn btn-ghost btn-sm" data-a="voiceStudio" id="rdVoiceStudioBtn"><i data-lucide="mic"></i>${p ? "Manage My Voice" : "Clone My Voice"}</button>`;
}

let host: HTMLDivElement | null = null;

function ensureHost(): HTMLDivElement {
  if (host && document.body.contains(host)) return host;
  host = document.createElement("div");
  host.className = "vs-wrap";
  document.body.appendChild(host);
  return host;
}

type State = {
  step: "intro" | "recording" | "review" | "working";
  blob: (Blob & { name?: string }) | null;
  url: string;
  label: string;
  error: string;
  profile: VoiceProfile | null;
};

/**
 * Open the Voice Studio. Resolves when the modal closes, with the active
 * profile (or null when the user removed or never created one).
 */
export function openVoiceStudio(onDone?: (p: VoiceProfile | null) => void) {
  const el = ensureHost();
  const st: State = { step: "intro", blob: null, url: "", label: "", error: "", profile: getVoiceProfile() };

  let rec: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let stream: MediaStream | null = null;
  let seconds = 0;
  let timer: number | null = null;
  let preview: HTMLAudioElement | null = null;

  const stopStream = () => {
    try { stream?.getTracks().forEach((t) => t.stop()); } catch (_) { /* noop */ }
    stream = null;
    if (timer) { window.clearInterval(timer); timer = null; }
  };

  function close() {
    stopStream();
    try { preview?.pause(); } catch (_) { /* noop */ }
    if (st.url) URL.revokeObjectURL(st.url);
    el.classList.remove("on");
    el.innerHTML = "";
    document.removeEventListener("keydown", onKey);
    onDone?.(getVoiceProfile());
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }

  function paint() {
    try { (window as any).lucide?.createIcons?.(); } catch (_) { /* noop */ }
  }

  async function startRecording() {
    st.error = "";
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (_) {
      st.error = "We could not reach your microphone. Allow microphone access, or upload an audio file instead.";
      return render();
    }
    chunks = [];
    seconds = 0;
    try {
      rec = new MediaRecorder(stream);
    } catch (_) {
      st.error = "Recording is not supported in this browser. Upload an audio file instead.";
      stopStream();
      return render();
    }
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec?.mimeType || "audio/webm" }) as Blob & { name?: string };
      stopStream();
      if (blob.size < 2000) {
        st.error = "That clip was too short. Read the full script, then stop the recording.";
        st.step = "intro";
        return render();
      }
      if (st.url) URL.revokeObjectURL(st.url);
      st.blob = blob;
      st.url = URL.createObjectURL(blob);
      st.step = "review";
      render();
    };
    rec.start();
    st.step = "recording";
    render();
    timer = window.setInterval(() => {
      seconds += 1;
      const t = el.querySelector("#vsTimer");
      if (t) t.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      if (seconds >= 60) stopRecording();
    }, 1000);
  }

  function stopRecording() {
    try { rec?.state !== "inactive" && rec?.stop(); } catch (_) { stopStream(); }
  }

  async function save() {
    if (!st.blob) return;
    st.step = "working";
    st.error = "";
    render();
    try {
      st.profile = await createVoiceProfile(st.blob, st.label.trim() || "My Voice");
      st.step = "review";
      render();
    } catch (e: any) {
      st.error = e?.message || "We could not profile that sample.";
      st.step = "review";
      render();
    }
  }

  function render() {
    const p = st.profile;
    const saved = p && st.step === "review" && !st.error && !st.blob ? p : null;
    el.innerHTML = `<div class="vs-scrim" data-a="close"></div>
    <div class="vs" role="dialog" aria-modal="true" aria-label="Voice Studio">
      <div class="vs-top">
        <div><span class="vs-kick">Narration</span><b>Voice Studio</b></div>
        <button class="icon-btn" data-a="close" aria-label="Close voice studio"><i data-lucide="x"></i></button>
      </div>
      <div class="vs-body">
        ${p ? `<div class="vs-active">
          <div><b>${esc(p.label)}</b><span>${esc(p.summary || "Matched from your own recording.")}</span></div>
          <button class="btn btn-ghost btn-xs" data-a="remove"><i data-lucide="trash-2"></i>Remove</button>
        </div>` : ""}
        ${st.error ? `<div class="vs-err"><i data-lucide="triangle-alert"></i><span>${esc(st.error)}</span></div>` : ""}
        ${
          st.step === "working"
            ? `<div class="vs-work"><b>Profiling Your Voice</b><span>Listening to your sample and matching pitch, pace and warmth.</span></div>`
            : st.step === "recording"
              ? `<div class="vs-rec">
                  <div class="vs-dot"></div><b id="vsTimer">00:00</b>
                  <span>Read the script below in your normal presenting voice.</span>
                  <button class="btn btn-primary btn-sm" data-a="stop"><i data-lucide="square"></i>Stop Recording</button>
                </div>
                <div class="vs-script">${esc(VOICE_SCRIPT)}</div>`
              : `<p class="vs-note">Record about twenty seconds of your own speech, or upload a clean audio file. We match it to a narration voice and reuse it in every video you build.</p>
                <div class="vs-script">${esc(VOICE_SCRIPT)}</div>
                ${st.url ? `<audio class="vs-audio" controls src="${st.url}"></audio>` : ""}
                <label class="vs-f"><span>Voice Name</span><input id="vsLabel" value="${esc(st.label)}" placeholder="My Voice" maxlength="48"></label>
                <div class="vs-act">
                  <button class="btn btn-dark btn-sm" data-a="record"><i data-lucide="mic"></i>${st.blob ? "Record Again" : "Start Recording"}</button>
                  <label class="btn btn-ghost btn-sm vs-up"><i data-lucide="upload"></i>Upload Audio File<input type="file" id="vsFile" accept="audio/*" hidden></label>
                  ${st.blob ? `<button class="btn btn-primary btn-sm" data-a="save"><i data-lucide="check"></i>Use This Voice</button>` : ""}
                </div>
                ${saved ? `<p class="vs-note ok">Saved. Pick <b>${esc(saved.label)} (My Voice)</b> in any video builder's voice list.</p>` : ""}`
        }
      </div>
      <div class="vs-foot">
        <span class="vs-fine">Only upload a voice you own or have permission to use.</span>
        <button class="btn btn-ghost btn-sm" data-a="close">Done</button>
      </div>
    </div>`;
    paint();

    el.querySelectorAll("[data-a]").forEach((n) => {
      (n as HTMLElement).onclick = () => {
        const a = (n as HTMLElement).dataset["a"];
        if (a === "close") return close();
        if (a === "record") return void startRecording();
        if (a === "stop") return stopRecording();
        if (a === "save") return void save();
        if (a === "remove") {
          clearVoiceProfile();
          st.profile = null;
          return render();
        }
      };
    });
    const lab = el.querySelector("#vsLabel") as HTMLInputElement | null;
    if (lab) lab.oninput = () => { st.label = lab.value; };
    const file = el.querySelector("#vsFile") as HTMLInputElement | null;
    if (file) {
      file.onchange = () => {
        const f = file.files?.[0];
        if (!f) return;
        if (st.url) URL.revokeObjectURL(st.url);
        st.blob = f;
        st.url = URL.createObjectURL(f);
        if (!st.label) st.label = f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 48);
        st.error = "";
        st.step = "review";
        render();
      };
    }
    preview = el.querySelector(".vs-audio") as HTMLAudioElement | null;
  }

  el.classList.add("on");
  render();
  document.addEventListener("keydown", onKey);
}
