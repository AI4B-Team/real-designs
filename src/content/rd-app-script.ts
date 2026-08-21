// Auto-ported interactions from the REAL DESIGNS prototype.
/* eslint-disable */
// @ts-nocheck
import { createIcons, icons } from "lucide";
import { installRdToast } from "@/lib/rd-toast";
import { isPlanBlocked, planBlockTitle } from "@/lib/rd-upgrade";
import { PHOTOS, photo } from "@/content/rd-photos";
import { priceScopePreview } from "@/lib/estimator-preview.functions";
import { detectChanges } from "@/lib/change-detect.functions";
import { estimateDimensions } from "@/lib/dimensions.functions";
import { renderDesign } from "@/lib/design-render.functions";
import { renderPlan3d } from "@/lib/plan3d.functions";
import { runRoomTool } from "@/lib/room-tools.functions";
import { startWalkthrough, pollWalkthrough } from "@/lib/walkthrough.functions";
import { getMyCredits, listCreditHistory } from "@/lib/credits.functions";
import {
  saveEstimate,
  listSavedEstimates,
  deleteSavedEstimate,
  getWorkspaceSummary,
  getPropertyTree,
  saveRoomVersion,
  setPropertyDna,
  copyPropertyDna,
  createProject,
  setVersionStatus,
  listRoomVersions,
  setVersionStatusBulk,
  deleteVersions,
} from "@/lib/workspace.functions";
import {
  saveStudioRoom,
  saveStudioVersion,
  getRoomStats,
  listRoomTargets,
} from "@/lib/rooms.functions";
import { openSaveRoomModal } from "@/lib/save-room";
import { initCanvasInspector } from "@/lib/canvas-inspector";
import { initCanvasWorkspace } from "@/lib/canvas-workspace";
import { suggestDesignTitle } from "@/lib/property-address";

import { supabase } from "@/integrations/supabase/client";
import {
  uploadRoomPhoto,
  roomPhotoUrl,
  resolvePhotoUrl,
  uploadRenderDataUrl,
} from "@/lib/room-photos";
import { saveProjectDraft, getProjectDraft, deleteProjectDraft } from "@/lib/drafts.functions";
import { newDraftId } from "@/lib/project-draft";
import {
  GENERIC_STUDIO,
  canonicalHash,
  canvasSubtitle as studioSubtitle,
  isPhotoCanvas,
  needsNormalize,
  photoCanvasContext,
} from "@/lib/studio-context";
import { mountReports } from "@/content/rd-reports";
import { mountPropertyDetail } from "@/content/rd-property-detail";
import {
  mountBudgetComingSoon,
  budgetAvailability,
  budgetsLive,
  openBudgetPopover,
} from "@/lib/budget-coming-soon";
import {
  loadSampleWorkspace,
  removeSampleWorkspace,
  hasSampleWorkspace,
} from "@/lib/sample.functions";
import {
  listPresentations,
  createPresentation,
  deletePresentation,
  getPresentationPackage,
  listPresentationActivity,
  markPresentationReminded,
  listShareableVersions,
} from "@/lib/presentations.functions";
import { buildSocialReel } from "@/lib/social-reel";
import { track } from "@/lib/analytics";
import { mountFirstUse } from "@/content/rd-firstuse";
import { mountStudioStart } from "@/content/rd-studio-start";
import { submitFeedback } from "@/lib/feedback";
import { initBeta, diagnosticId } from "@/lib/beta/beta-ui";
import { polishFeedback } from "@/lib/feedback.functions";
import { readIntegrations } from "@/lib/integrations.functions";
import { isProductSearchConfigured } from "@/lib/product-catalog";
import {
  listTeam,
  inviteMember,
  revokeInvite,
  acceptInvite,
  declineInvite,
  updateInviteRole,
} from "@/lib/team.functions";
import { getPrefs, savePrefs, DEFAULT_PREFS } from "@/lib/prefs";
import { exportMyData, deleteMyAccount } from "@/lib/account.functions";
import { summaryHTML, metric } from "@/lib/result-summary";
import { mountExplore } from "@/content/rd-explore";
import { mountWatch } from "@/content/rd-watch";
import { STYLES, STYLE_CATEGORIES, resolveStyle } from "@/lib/style-catalog";
import { getStudioStyle, applyStudioStyleToControls } from "@/lib/studio-style";
import { mountCanvasStyle } from "@/lib/canvas-style-ui";
import { styleNeedForTool, sectionTitle } from "@/lib/canvas-style";
import {
  costLabel,
  fallbackTool,
  instructionPlaceholder,
  normalizeSpace,
  spacePromptRules,
  toolCost,
  toolDescription,
  toolLabel,
  toolSupport,
} from "@/lib/space-tools";
import { downloadPdf, imageForPdf } from "@/lib/pdf-download";
import { setHandoff } from "@/lib/handoff";
import { openStagingReview } from "@/content/rd-staging";
import { openVideoWorkflow } from "@/content/rd-media-lib";

/** Mirrors an Explore style choice into the Studio controls once per selection. */
let STYLE_CHOICE_TS = 0;
function syncStudioStyleChoice(force?: boolean) {
  const c = getStudioStyle();
  if (!c) return;
  if (!force && c.ts === STYLE_CHOICE_TS) return;
  if (applyStudioStyleToControls(c)) STYLE_CHOICE_TS = c.ts;
}

/** Canonical style id currently selected in Studio. */
function currentStyleId() {
  const sel = document.getElementById("fStyle") as any;
  const opt = sel && sel.selectedOptions && sel.selectedOptions[0];
  const fromData = opt && opt.dataset ? opt.dataset.styleId : "";
  return fromData || resolveStyle(sel ? sel.value : "").id;
}
/** Project type implied by the Studio space chips. */
function currentProjectType() {
  const c = document.querySelector("#spChips .chip.on") as any;
  const v = c ? String(c.dataset.sp || "").toLowerCase() : "interior";
  if (v === "exterior") return "exterior";
  if (v === "landscape" || v === "garden") return "garden";
  if (v === "staging" || v === "virtual-staging") return "virtual-staging";
  return "interior";
}
/** Fill the Studio Style select from the canonical catalog, grouped by family. */
function populateStyleSelect() {
  const sel = document.getElementById("fStyle") as any;
  if (!sel || sel.dataset.catalog === "1") return;
  const keep = sel.value;
  const type = currentProjectType();
  const html = STYLE_CATEGORIES.map((cat) => {
    const items = STYLES.filter(
      (x) => x.isActive && x.category === cat && x.compatibleProjectTypes.indexOf(type) > -1,
    );
    if (!items.length) return "";
    return (
      '<optgroup label="' +
      cat +
      '">' +
      items
        .map(
          (x) =>
            '<option value="' +
            x.displayName +
            '" data-style-id="' +
            x.id +
            '">' +
            x.displayName +
            "</option>",
        )
        .join("") +
      "</optgroup>"
    );
  }).join("");
  sel.innerHTML =
    '<option value="Auto — Let REAL DESIGNS Decide" data-style-id="auto">Auto — Let REAL DESIGNS Decide</option>' +
    html;
  sel.dataset.catalog = "1";
  let match: any = Array.from(sel.options).find((o: any) => o.value === keep || o.text === keep);
  if (!match && keep && keep !== "Warm Minimal") {
    // Keep a chosen style (e.g. picked on Explore) even when it is not in this
    // project type's catalog, instead of silently resetting to Warm Minimal.
    const opt = document.createElement("option");
    opt.value = keep;
    opt.textContent = keep;
    sel.insertBefore(opt, sel.firstChild);
    match = opt;
  }
  sel.value = match ? (match as any).value : "Warm Minimal";
  // Never leave the control blank: fall back to the first available option.
  if (!sel.value && sel.options.length) sel.value = sel.options[0].value;
}
try {
  document.addEventListener(
    "click",
    (e: any) => {
      if (e.target && e.target.closest && e.target.closest("#spChips .chip")) {
        const sel = document.getElementById("fStyle") as any;
        if (sel) {
          sel.dataset.catalog = "";
          setTimeout(() => {
            try {
              populateStyleSelect();
            } catch (_) {}
          }, 0);
        }
      }
    },
    true,
  );
  window.addEventListener("rd:style-selected", () => {
    try {
      populateStyleSelect();
      syncStudioStyleChoice(true);
    } catch (_) {}
  });
  document.addEventListener("DOMContentLoaded", () => {
    try {
      populateStyleSelect();
    } catch (_) {}
  });
  setTimeout(() => {
    try {
      populateStyleSelect();
    } catch (_) {}
  }, 600);
} catch (_) {}
import { openShop, renderSelectedProducts } from "@/content/rd-shop";
import {
  beginNavigation as navBegin,
  retargetNavigation as navRetarget,
  isCurrentNavigation as navIsCurrent,
  navView as navViewName,
} from "@/lib/app-nav";

import {
  mountReveal,
  createVideoFrom,
  startDesignVideo,
  continueDesignVideo,
  resetReveal,
  resumeActiveBuilder,
  forgetActiveBuilder,
} from "@/content/rd-reveal";
import { openPropertyUpload, mountUploadDock } from "@/content/rd-propmedia";
import { mountSourcePicker } from "@/lib/source-picker";
import { mountMediaLibrary } from "@/content/rd-media-lib";
import { mountCrm } from "@/content/rd-crm";
import * as RDMediaLib from "@/lib/media-library";
try {
  (window as any).rdMedia = RDMediaLib;
} catch (_) {}
import {
  normalizePlan,
  planAllows,
  planName,
  planRank,
  resolveSubscriptionPlan,
} from "@/lib/plan";
import {
  getSubscription,
  changePlan,
  setCancelAtPeriodEnd,
  withdrawPlanRequest,
  listBillingEvents,
} from "@/lib/subscription.functions";

export function initApp(): () => void {
  installRdToast();
  const root = document.querySelector(".rd-app") as HTMLElement | null;
  if (root && root.dataset["rdInit"] === "1") return () => {};
  if (root) root.dataset["rdInit"] = "1";
  try {
    initCanvasInspector();
    initCanvasWorkspace();
  } catch (_) {}
  const timers: number[] = [];
  const setInterval = (fn: any, ms?: number) => {
    const id = window.setInterval(fn, ms);
    timers.push(id);
    return id;
  };
  const setTimeout = (fn: any, ms?: number) => {
    const id = window.setTimeout(fn, ms);
    timers.push(id);
    return id;
  };
  const lucide = { createIcons: (o: any = {}) => createIcons({ icons, ...o }) };
  try {
    /* ---------- room svg ---------- */
    /* ---------- room photos ---------- */
    function room(mode, pal) {
      const src = mode === "after" ? pal || PHOTOS.after : PHOTOS.before;
      return photo(
        src,
        mode === "after" ? "Redesigned space, AI render" : "Original space before redesign",
      );
    }
    const PALS = {
      warm: PHOTOS.after,
      coastal: PHOTOS.coastal,
      farm: PHOTOS.farmhouse,
      green: PHOTOS.japandi,
      kitchen: PHOTOS.kitchen,
      bath: PHOTOS.bath,
      yard: PHOTOS.resortYard,
      exterior: PHOTOS.paintedBrick,
      craftsman: PHOTOS.craftsman,
      ranch: PHOTOS.ranch,
    };

    /* ---------- nav ---------- */
    const titles = {
      home: ["Dashboard", "Your workspace at a glance"],
      dash: ["Dashboard", "Your workspace at a glance"],
      props: ["Properties", "Property, project, room, version"],
      studio: ["Studio", "Price a room and save it to a project"],
      explore: ["Explore", "Discover design directions before you start a project"],
      watch: ["Site Watch", "Monitor a listing site you own and prepare videos for new properties"],
      media: ["Media", "Property photos, enhancements and listing packages"],
      lvideo: [
        "Create A Property Video",
        "Turn your property photos into a polished listing video",
      ],
      reveal: [
        "Property Videos",
        "Turn your property photos and completed designs into polished videos, reveals and marketing content",
      ],
      designs: ["Designs", "Saved versions across your properties"],
      listings: ["Listing Batch", "Stage a whole property in one direction"],
      scope: ["Budget", "Planning estimates from approved designs"],
      products: ["Products", "Shop the design, three price tiers per item"],
      present: ["Presentations", "Client ready packages and approval links"],
      reports: ["Reports", "Portfolio rollup and credit spend"],
      crm: ["CRM Sync", "Connect your CRM, sync contacts and push finished work"],
      team: ["Team", "Unlimited seats on Pro and above"],
      settings: ["Settings", "Brand kit, defaults and integrations"],
      account: ["Account", "Profile, security, subscription and billing"],
      help: ["Help Center", "Guides, answers and support"],
      tutorials: ["Tutorials", "Short walkthroughs, five minutes or less"],
      notifications: ["Notifications", "Activity, mentions and alerts"],
      staging: ["Photo Staging", "Add photos, confirm rooms, then design"],
    };
    /* "account" itself must resolve to a pane: without it the account view opens
   with no rail item selected and no pane on screen. */
    const ACCT_ALIAS = {
      account: "profile",
      team: "team",
      settings: "brand",
      branding: "brand",
      brand: "brand",
      billing: "billing",
      invoices: "invoices",
      api: "api",
      profile: "profile",
      security: "security",
      crm: "integrations",
      integrations: "integrations",
      watch: "watch",
      monitor: "watch",
      sites: "watch",
    };
    /* Video lives inside Media now. Only the video workspace itself may open
   the reveal view, and it flags that intent right before navigating. */
    /* The first route after a page load may reopen a saved builder session. */
    let __bootRoute = true;
    /* Opening the video workspace is explicit intent, not a timing window: the
   flag is set immediately before navigating and consumed by that navigation. */
    let __revealIntent: "" | "open" | "new" = "";
    try {
      (window as any).__rdAllowReveal = () => {
        __revealIntent = "open";
      };
    } catch (_) {}
    try {
      (window as any).__rdNewVideo = () => {
        __revealIntent = "new";
      };
    } catch (_) {}
    try {
      (window as any).__rdGo = (x: string) => go(x);
    } catch (_) {}

    /* Views mount their content asynchronously, and the browser's scroll
   anchoring pulls the page back to roughly where it was once that content
   lands. Pinning the top on the next few frames keeps every page open at
   the top the way a fresh page load would. */
    function scrollTopHard() {
      const top = () => {
        try {
          window.scrollTo(0, 0);
          document.documentElement.scrollTop = 0;
          if (document.body) document.body.scrollTop = 0;
        } catch (_) {}
      };
      top();
      try {
        requestAnimationFrame(() => {
          top();
          requestAnimationFrame(top);
        });
      } catch (_) {}
      [60, 160, 320, 600].forEach((ms) => window.setTimeout(top, ms));
    }
    let __paneSeq = 0;

    /* ---- studio context -------------------------------------------------------
   The Studio view hosts two different things. A generic session may open the
   source chooser and start a brand new project. A Photo Design Canvas belongs
   to an existing Photo Design draft and must never be re-initialised as a
   blank Studio session. The context is explicit state, never inferred from
   whatever happens to be in the DOM. */
    let STUDIO_MODE: any = GENERIC_STUDIO;
    /* Every navigation bumps this token, so a delayed startup callback can tell
   whether the route it was queued for is still the one on screen. */
    let __navSeq = 0;
    let __navView = "";
    /**
     * One monotonic navigation sequence for the whole app (see src/lib/app-nav.ts).
     *
     * Every intentional navigation bumps it and records the destination. Any
     * asynchronous work (startup routing, builder restoration, preference loads,
     * summaries) captures the token it was queued under and must check it again
     * before it is allowed to move the user. An older callback simply does
     * nothing instead of yanking the page away from where the user went.
     */
    function beginNavigation(view, reason?, source?) {
      __navSeq = navBegin(view, {
        reason: reason || "user",
        source: source || "app_router",
        userInitiated: reason !== "startup_preference",
      });
      __navView = navViewName();
      return __navSeq;
    }
    /** The router remapped the destination; keep the recorded route truthful. */
    function retargetNavigation(view) {
      navRetarget(view, "unknown");
      __navView = navViewName();
    }
    /** True while the newest navigation intent is the video builder itself. */
    function inBuilderRoute() {
      return navViewName() === "lvideo" || navViewName() === "reveal";
    }
    function isCurrentNavigation(sequence, view) {
      return navIsCurrent(sequence, view === undefined ? null : view);
    }

    function studioMode() {
      return STUDIO_MODE;
    }
    function inPhotoCanvas() {
      return isPhotoCanvas(STUDIO_MODE);
    }
    /** Canonical route test: tolerates the legacy "#studio" form during migration. */
    function isCurrentView(v) {
      const raw = (location.hash || "").replace(/^#/, "").replace(/^v-/, "");
      if (!raw) return false;
      return (viewFromHash() || raw) === v;
    }
    try {
      (window as any).__rdIsView = (v: string) => isCurrentView(v);
      (window as any).__rdStudioMode = () => studioMode();
      (window as any).__rdNavToken = () => __navSeq;
      (window as any).__rdNavCurrent = (tok: number, view?: string) =>
        isCurrentNavigation(tok, view);
      /* The canonical destination, for asynchronous workflows to compare against. */
      (window as any).__rdNavView = () => __navView;
      (window as any).__rdNav = {
        token: () => __navSeq,
        view: () => __navView,
        current: (tok: number, view?: string) => isCurrentNavigation(tok, view),
      };
      (window as any).__rdClearStudioMode = () => {
        STUDIO_MODE = GENERIC_STUDIO;
      };
      /* The one way to open a Photo Design Canvas. It routes through the same
     navigation everything else uses, with the context set first, so no
     generic Studio startup logic can run against it. */
      (window as any).__rdOpenPhotoCanvas = (ctx: any) => {
        STUDIO_MODE = photoCanvasContext((ctx && ctx.draftId) || "", (ctx && ctx.photoKey) || "");
        go("studio", true);
        return STUDIO_MODE;
      };
    } catch (_) {}

    function go(v, fromHash) {
      /* Project Budget is a roadmap feature: no navigation path, including a
     bookmarked hash, may reach the unfinished Budget view. Clicking it only
     explains what is coming. */
      if (v === "scope" && !budgetsLive()) {
        try {
          const anchor =
            (document.activeElement as HTMLElement) ||
            (document.querySelector('.nav-i[data-v="scope"]') as HTMLElement);
          if (anchor && anchor.getBoundingClientRect) openBudgetPopover(anchor);
        } catch (_) {}
        return;
      }
      /* A stale startup callback must never drop a live Canvas back on the
     generic Studio page. */
      if (v === "studio" && !fromHash && inPhotoCanvas() && document.querySelector("#v-studio.on"))
        return;
      /* Leaving a live builder through the global Studio navigation saves the
     draft first; the builder re-issues this navigation once it is safe. */
      if (v === "studio" && !fromHash) {
        try {
          const ex = (window as any).__rdBuilderSaveExit;
          if (typeof ex === "function" && ex()) return;
        } catch (_) {}
      }
      beginNavigation(v);
      /* Any route that is not the Studio view ends the Canvas context. */
      if (v !== "studio" && inPhotoCanvas()) STUDIO_MODE = GENERIC_STUDIO;
      const acctAlias = ACCT_ALIAS[v] ? v : "";
      if (ACCT_ALIAS[v]) {
        const pane = ACCT_ALIAS[v];
        v = "account";
        /* The account markup can mount (and remount) after this call, so retry
       briefly on unmanaged timers. Never run synchronously: acctPane reads
       consts declared later in this module. A sequence token makes sure an
       older retry loop can never re-select a pane the user has left. */
        const seq = ++__paneSeq;
        let n = 0;
        const applyPane = () => {
          if (seq !== __paneSeq) return;
          let done = false;
          try {
            const el = document.getElementById("p-" + pane);
            if (el) {
              if (!el.classList.contains("on")) acctPane(pane);
              done = true;
            }
          } catch (_) {}
          if (!done && ++n < 60) window.setTimeout(applyPane, 75);
        };
        window.setTimeout(applyPane, 0);
      } else if (v !== "account") {
        __paneSeq++;
      }
      const bootRoute = __bootRoute;
      __bootRoute = false;
      /* One-shot: the intent belongs to this navigation only. */
      const intent = __revealIntent;
      __revealIntent = "";
      const revealLive = (() => {
        try {
          return !!((window as any).__rdRevealBusy && (window as any).__rdRevealBusy());
        } catch (_) {
          return false;
        }
      })();
      if (v === "reveal" && !revealLive && !intent) {
        /* Nobody asked for the workspace: a remembered builder session reopens on
       the first route after a page load, otherwise Media's Videos tab shows. */
        let saved = "";
        try {
          saved = localStorage.getItem("rd_reveal_active") || "";
        } catch (_) {}
        if (bootRoute && saved) {
          v = "lvideo";
        } else {
          (window as any).__rdMediaTab = "videos";
          v = "media";
        }
        /* The recorded destination must name the view that actually opens, so a
       guard comparing against it agrees with what the user sees. */
        retargetNavigation(v);
      }

      /* Unknown or legacy view keys (old bookmarks, stale hashes, builder-only
     keys like lvideo) must never leave the content area blank. Home and the
     dashboard are one view now, reachable only as dash. */
      let viewId = v === "lvideo" ? "reveal" : v === "home" ? "dash" : v;
      /* The staging page mounts on demand; make sure its container exists before
     the unknown-view fallback runs. On a cold boot straight to #v-staging the
     staging module can still be initialising, so wait for it instead of
     dropping the user on the dashboard and losing the saved draft. */
      if (viewId === "staging") {
        const api = (window as any).rdStaging;
        if (!api) {
          let tries = 0;
          /* If the user navigates while we wait for the module, this loop dies
         instead of pulling them back onto Photo Design. */
          const tok = __navSeq;
          const wait = () => {
            if (!isCurrentNavigation(tok, "staging")) return;
            if ((window as any).rdStaging) {
              go("staging", true);
            } else if (++tries < 60) window.setTimeout(wait, 50);
            else go("dash");
          };
          window.setTimeout(wait, 50);
          return;
        }
        try {
          api.ensure();
        } catch (_) {}
      }
      if (!document.getElementById("v-" + viewId)) viewId = "dash";

      const navId = v === "lvideo" ? "lvideo" : viewId === "reveal" ? "media" : viewId;

      /* Drop any half-finished video builder before showing another view, so a
     stale wizard can never flash on the next visit. */
      if (viewId !== "reveal") {
        try {
          resetReveal();
        } catch (_) {}
      }
      document
        .querySelectorAll(".nav-i")
        .forEach((b) => b.classList.toggle("on", b.dataset.v === navId));
      document
        .querySelectorAll(".view")
        .forEach((x) => x.classList.toggle("on", x.id === "v-" + viewId));

      scrollTopHard();
      try {
        window.__rdRailForView && window.__rdRailForView(v);
      } catch (_) {}
      if (v === "explore") {
        try {
          mountExplore(go, {
            curProp: () => curProp(),
            setPropertyDna,
            reloadTree: () => reloadTree(),
          });
        } catch (_) {}
      }
      if (v === "media") {
        try {
          mountMediaLibrary(go, {});
        } catch (_) {}
      }
      if (v === "reveal") {
        try {
          mountReveal(go, {});
        } catch (_) {}
      }
      if (v === "lvideo") {
        /* Mounting the view never destroys a project. A brand new project is only
       created when the user explicitly asked for one; otherwise the persisted
       active project is restored, and only a confirmed "nothing saved" result
       falls back to a fresh builder. */
        const wantNew = intent === "new";
        const tok = __navSeq;
        if (wantNew) {
          try {
            forgetActiveBuilder();
            createVideoFrom({ sourceType: "address", from: "menu" });
          } catch (_) {}
        } else {
          /* Restoration is asynchronous: by the time it resolves the user may
         already be somewhere else, and it must not reopen the builder. */
          void (async () => {
            try {
              const ok = await resumeActiveBuilder({
                stillCurrent: () => isCurrentNavigation(tok, "lvideo"),
              });
              /* Restoration navigates to the builder itself, so the check here is
             "is a builder route still the destination", not the old token. */
              if (ok || !inBuilderRoute()) return;
              createVideoFrom({ sourceType: "address", from: "menu" });
            } catch (_) {
              /* A failed restore is not a reason to throw work away or to move the
             user: leave the persisted pointer intact and stay put. */
            }
          })();
        }
      }

      if (v === "studio") {
        /* Repainting the controls is safe in both contexts. Anything that could
       start a new generic session is skipped while a Canvas is active. */
        try {
          paintStudioSub();
          paintStudioState();
        } catch (_) {}
        if (!inPhotoCanvas()) {
          /* Media hands a draft id over the window so Studio reopens the real work. */
          try {
            const did = (window as any).__rdStudioDraft;
            if (did) {
              (window as any).__rdStudioDraft = null;
              resumeStudioDraft(did);
            }
          } catch (_) {}
          /* A refresh taken inside a Canvas boots to Studio. Reopen the saved
         work instead of dropping the user on the empty start page. */
          if (bootRoute) {
            const tok = __navSeq;
            void (async () => {
              try {
                let api = (window as any).rdStaging;
                for (let i = 0; !api && i < 40; i++) {
                  await new Promise((r) => window.setTimeout(r, 50));
                  api = (window as any).rdStaging;
                }
                if (!api || !api.canvasWasOpen || !api.canvasWasOpen()) return;
                if (!isCurrentNavigation(tok, "studio")) return;
                await api.resumeCanvas();
              } catch (_) {}
            })();
          }
        }
      }
      /* Photo staging is a normal page: mount it on entry, hand the rail back on
     exit, so browser Back and a refresh both behave like every other view. */
      if (viewId === "staging") {
        try {
          (window as any).rdStaging && (window as any).rdStaging.mount();
        } catch (_) {}
      } else {
        try {
          (window as any).rdStaging && (window as any).rdStaging.detach();
        } catch (_) {}
      }
      if (v === "reports") {
        try {
          mountReports(go);
        } catch (_) {}
      }
      if (v === "scope") {
        try {
          paintBudgetGate();
        } catch (_) {}
      }

      /* Legacy or unknown keys fall back to the dashboard view, so the header
     must follow the view that actually rendered, never the stale one. */
      const titleKey = titles[v] ? v : viewId;
      if (titles[titleKey]) {
        const t1 = document.getElementById("pgTitle");
        if (t1) t1.innerHTML = titles[titleKey][0];
        const t2 = document.getElementById("pgCrumb");
        if (t2) t2.innerHTML = titles[titleKey][1];
      }
      /* The hash must always name the view that actually rendered, including
     when a deep link was redirected (stale #v-reveal, unknown keys), so a
     refresh or a copied link never lands somewhere else. */
      try {
        const h =
          "#v-" +
          (acctAlias && viewId === "account" ? acctAlias : v === "lvideo" ? "lvideo" : viewId);
        if (location.hash !== h)
          history.replaceState(null, "", location.pathname + location.search + h);
      } catch (_) {}

      scrollTopHard();
    }

    /* deep links: /app#v-scope, /app#scope and browser back/forward.
   Friendly hashes match the sidebar labels a user would guess, so a typed
   or bookmarked /app#budget opens Budget instead of a dead hash. */
    const VIEW_ALIAS = {
      dashboard: "dash",
      home: "home",
      start: "home",
      overview: "dash",
      properties: "props",
      property: "props",
      batch: "listings",
      listing: "listings",
      listings: "listings",
      budget: "scope",
      estimate: "scope",
      video: "reveal",
      videos: "reveal",
      presentations: "present",
      report: "reports",
      product: "products",
      shop: "products",
      shopping: "products",
      sourcing: "products",
      explore: "explore",
      designs: "designs",
      media: "media",
      watch: "watch",
      monitor: "watch",
      sites: "watch",
    };
    function viewFromHash() {
      let raw = (location.hash || "").replace(/^#/, "").replace(/^v-/, "");
      if (!raw) return "";
      /* Path style deep links such as #account/billing resolve to the section. */
      if (raw.indexOf("/") > -1) {
        const parts = raw.split("/").filter(Boolean);
        const tail = parts[parts.length - 1];
        raw = titles[tail] || ACCT_ALIAS[tail] || VIEW_ALIAS[tail] ? tail : parts[0];
      }
      if (!titles[raw] && !ACCT_ALIAS[raw] && VIEW_ALIAS[raw]) raw = VIEW_ALIAS[raw];
      return titles[raw] || ACCT_ALIAS[raw] ? raw : "";
    }
    window.addEventListener("hashchange", () => {
      const v = viewFromHash();
      /* Legacy hashes are rewritten to the canonical form once, in place, so the
     address bar and the router agree and nothing re-navigates. */
      if (v && needsNormalize(location.hash)) {
        try {
          history.replaceState(
            null,
            "",
            location.pathname + location.search + canonicalHash(location.hash),
          );
        } catch (_) {}
      }
      if (v) {
        go(v, true);
        return;
      }
      /* An unknown hash arriving mid session must not sit in the address bar
     while a different view is on screen. Point it at what is rendered. */
      try {
        const cur =
          document.querySelector(".rd-app .view.on") || document.querySelector(".view.on");
        if (cur && location.hash && location.hash !== "#" + cur.id) {
          history.replaceState(null, "", location.pathname + location.search + "#" + cur.id);
        }
      } catch (_) {}
    });

    document
      .querySelectorAll(".nav-i")
      .forEach((b) => b.addEventListener("click", () => go(b.dataset.v)));
    document
      .querySelectorAll("[data-goto]")
      .forEach((b) => b.addEventListener("click", () => go(b.dataset.goto)));
    /* The listing video builder is merged into the property video builder.
   Every legacy entry point now opens the unified four step builder. */
    try {
      (window as any).rdListingVideo = (seed: any) => {
        try {
          const s = seed || {};
          const files = Array.from(s.files || []).filter(
            (file: any) => typeof File !== "undefined" && file instanceof File,
          );
          const sourceType = files.length
            ? "upload"
            : s.propertyId
              ? "property"
              : s.versionId
                ? "design"
                : s.sourceType || "address";
          createVideoFrom({ ...s, files, sourceType });
        } catch (_) {}
      };
    } catch (_) {}
    document.querySelectorAll("[data-lvideo]").forEach((b) =>
      b.addEventListener("click", () => {
        try {
          const p = curProp && curProp();
          createVideoFrom(
            p && p.id
              ? {
                  sourceType: "property",
                  propertyId: p.id,
                  propertyLabel: p.address || p.name || "",
                  from: "properties",
                }
              : { sourceType: "address", from: "menu" },
          );
        } catch (_) {
          createVideoFrom({});
        }
      }),
    );
    try {
      (window as any).rdCreateVideo = (seed: any) => {
        try {
          createVideoFrom(seed || {});
        } catch (_) {}
      };
    } catch (_) {}
    document.querySelectorAll("[data-createvideo]").forEach((b) =>
      b.addEventListener("click", () => {
        try {
          createVideoFrom(JSON.parse(b.getAttribute("data-createvideo") || "{}"));
        } catch (_) {
          createVideoFrom({});
        }
      }),
    );
    document.querySelectorAll("[data-propupload]").forEach((b) =>
      b.addEventListener("click", () => {
        try {
          openPropertyUpload();
        } catch (_) {}
      }),
    );
    try {
      mountUploadDock(go);
    } catch (_) {}
    /* the app shell mounts after this module runs, and can remount once,
   so keep re-asserting the deep linked view for a short window */
    (function applyHash() {
      const v = viewFromHash();
      if (!v) {
        /* an unknown or stale hash must not stay in the address bar while a
       different view is on screen, or a refresh looks like a dead link.
       The shell can mount after this runs, so keep looking for the live
       view for a short window instead of giving up on the first frame */
        const bad = location.hash;
        if (!bad) return;
        let n = 0;
        const clean = () => {
          const now = location.hash;
          /* the router re-applies its own url for a few frames after mount, so
         keep re-asserting until the bad hash stops coming back */
          if (now !== bad && now !== "") return;
          try {
            const cur =
              document.querySelector(".rd-app .view.on") || document.querySelector(".view.on");
            if (cur)
              history.replaceState(null, "", location.pathname + location.search + "#" + cur.id);
          } catch (_) {}
          if (++n < 80) window.setTimeout(clean, 75);
        };
        clean();

        return;
      }

      const startHash = location.hash;
      const pane = ACCT_ALIAS[v] || "";
      const want = "v-" + (pane ? "account" : v);
      let tries = 0;
      const tick = () => {
        /* stop the moment the user navigates away, so this loop can never
       drag an old view or account pane back on screen */
        if (location.hash !== startHash) return;
        /* Staging owns a lazily created container, so a cold boot straight to
       #v-staging has to build it before this loop can find the view. */
        if (v === "staging") {
          try {
            (window as any).rdStaging && (window as any).rdStaging.ensure();
          } catch (_) {}
        }
        const target = document.getElementById(want);
        if (target && !target.classList.contains("on")) go(v, true);
        /* A friendly alias such as #dashboard that already matches the mounted
       view still needs the canonical hash, or a copied link looks broken. */
        else if (target && !pane) {
          const canon = "#" + want;
          if (location.hash !== canon) {
            try {
              history.replaceState(null, "", location.pathname + location.search + canon);
            } catch (_) {}
            return;
          }
        }
        if (pane) {
          try {
            const el = document.getElementById("p-" + pane);
            if (el && !el.classList.contains("on")) acctPane(pane);
          } catch (_) {}
        }
        if (++tries < 110) setTimeout(tick, 75);
      };
      tick();
    })();

    /* ---------- account menu ---------- */
    const acctBtn = document.getElementById("acctBtn"),
      acctMenu = document.getElementById("acctMenu");
    function closeAcct() {
      acctMenu.classList.remove("on");
      acctBtn.setAttribute("aria-expanded", "false");
    }
    acctBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      try {
        window.rdCloseCreateMenu && window.rdCloseCreateMenu();
      } catch (_) {}
      const open = !acctMenu.classList.contains("on");
      acctMenu.classList.toggle("on", open);
      acctBtn.setAttribute("aria-expanded", String(open));
    });
    acctMenu.addEventListener("click", (e) => {
      if (e.target.closest(".acct-i,[data-goto]")) closeAcct();
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".acct-wrap")) closeAcct();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAcct();
    });

    /* ---------- search scope menu + live results ---------- */
    const schBtn = document.getElementById("schBtn"),
      schMenu = document.getElementById("schMenu");
    const schInput = document.querySelector(".search input");
    let SCH_SCOPE = "All";
    let schRes = null;
    if (schMenu && schMenu.parentElement) {
      schRes = document.createElement("div");
      schRes.className = "search-menu";
      schRes.id = "schRes";
      schMenu.parentElement.appendChild(schRes);
    }
    function closeSch() {
      if (schMenu) {
        schMenu.classList.remove("on");
        schBtn.setAttribute("aria-expanded", "false");
      }
    }
    function closeSchRes() {
      if (schRes) schRes.classList.remove("on");
    }
    function searchIndex() {
      const out = [];
      PROP_TREE.forEach((p, pi) => {
        out.push({
          kind: "Properties",
          ic: "map-pin",
          t: p.address,
          s: p.has_dna ? "DNA Locked" : "No DNA yet",
          pi,
          pri: 0,
        });
        p.projects.forEach((pr, pri) => {
          pr.rooms.forEach((r) => {
            out.push({
              kind: "Rooms",
              ic: "sofa",
              t: r.name,
              s: p.address + " \u00b7 " + pr.name,
              pi,
              pri,
            });
            out.push({
              kind: "Designs",
              ic: "images",
              t: r.name + " v" + (r.version_no || 1),
              s: (r.status === "approved" ? "Approved" : "Draft") + " \u00b7 " + pr.name,
              pi,
              pri,
              design: true,
            });
          });
        });
      });
      (typeof PRES_ROWS !== "undefined" ? PRES_ROWS : []).forEach((pr) => {
        out.push({
          kind: "Presentations",
          ic: "presentation",
          t: pr.title || "Client link",
          s:
            pr.status === "approved"
              ? "Approved"
              : pr.status === "viewed"
                ? "Opened"
                : pr.status === "changes"
                  ? "Changes requested"
                  : "Sent",
          view: "present",
          pres: pr.id,
        });
      });
      /* Saved budget records are preserved, but while budgets are coming soon they
     are never surfaced as searchable budget results. */
      SAVED_EST.forEach((e) => {
        if (budgetsLive()) {
          out.push({
            kind: "Budgets",
            ic: "calculator",
            t: (e.name || "Saved room") + " budget",
            s:
              (e.grade ? e.grade[0].toUpperCase() + e.grade.slice(1) + " grade" : "Budget") +
              (e.total_low ? " \u00b7 $" + Math.round(e.total_low / 1000) + "k+" : ""),
            view: "scope",
          });
        }
        out.push({
          kind: "Products",
          ic: "shopping-bag",
          t: (e.name || "Saved room") + " product board",
          s: budgetsLive() ? "Allowances from the saved budget" : "Saved product board",
          view: "products",
        });
      });
      return out;
    }
    function runSearch() {
      if (!schRes) return;
      const q = ((schInput && schInput.value) || "").trim().toLowerCase();
      if (!q) {
        closeSchRes();
        return;
      }
      let rows = searchIndex()
        .filter(
          (r) =>
            (SCH_SCOPE === "All" || r.kind === SCH_SCOPE) &&
            (r.t + " " + r.s).toLowerCase().includes(q),
        )
        .slice(0, 8);
      schRes.innerHTML = rows.length
        ? '<div class="acct-group">Results</div>' +
          rows
            .map(
              (r, i) =>
                `<button class="acct-i" data-r="${i}"><i data-lucide="${r.ic}"></i>${r.t}<span class="mv">${r.s}</span></button>`,
            )
            .join("")
        : '<div class="acct-group">Results</div><div class="acct-i" style="pointer-events:none;color:var(--mute-2)">Nothing matches that search.</div>';
      schRes.classList.add("on");
      lucide.createIcons();
      schRes.querySelectorAll("[data-r]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const r = rows[+btn.dataset.r];
          if (!r) return;
          if (r.pi != null) SEL = { p: r.pi, pr: r.pri };
          closeSchRes();
          if (schInput) schInput.value = "";
          go(r.view || (r.design ? "designs" : "props"));
          paintTree();
          if (r.pres)
            setTimeout(() => {
              try {
                focusPresentation(r.pres);
              } catch (_) {}
            }, 60);
        }),
      );
    }
    function updateSearchMeta() {
      if (!schMenu) return;
      const rooms = PROP_TREE.reduce(
        (n, p) => n + p.projects.reduce((m, pr) => m + pr.rooms.length, 0),
        0,
      );
      const designs = PROP_TREE.reduce(
        (n, p) =>
          n + p.projects.reduce((m, pr) => m + pr.rooms.reduce((k, r) => k + r.versions, 0), 0),
        0,
      );
      const set = (sc, v) => {
        const b = schMenu.querySelector('[data-scope="' + sc + '"] .mv');
        if (b) b.textContent = String(v);
      };
      set("Properties", PROP_TREE.length);
      set("Rooms", rooms);
      set("Designs", designs);
      set("Presentations", (typeof PRES_ROWS !== "undefined" ? PRES_ROWS : []).length);
      set("Budgets", budgetsLive() ? SAVED_EST.length : 0);
      set("Products", SAVED_EST.length);
      const recents = searchIndex()
        .filter((r) => r.kind === "Designs")
        .slice(0, 3);
      const groups = schMenu.querySelectorAll(".acct-group");
      const recHead = groups[groups.length - 1];
      if (recHead) {
        let n = recHead.nextElementSibling;
        while (n) {
          const nx = n.nextElementSibling;
          n.remove();
          n = nx;
        }
        recHead.insertAdjacentHTML(
          "afterend",
          recents.length
            ? recents
                .map(
                  (r) =>
                    `<button class="acct-i" data-rec="${r.pi}:${r.pri}"><i data-lucide="history"></i>${r.t}</button>`,
                )
                .join("")
            : '<div class="acct-i" style="pointer-events:none;color:var(--mute-2)">Nothing Saved Yet</div>',
        );
        schMenu.querySelectorAll("[data-rec]").forEach((b) =>
          b.addEventListener("click", () => {
            const [pi, pri] = b.dataset.rec.split(":").map(Number);
            SEL = { p: pi, pr: pri };
            closeSch();
            go("props");
            paintTree();
          }),
        );
        lucide.createIcons();
      }
    }
    if (schBtn && schMenu) {
      schBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAcct();
        closeSchRes();
        try {
          window.rdCloseCreateMenu && window.rdCloseCreateMenu();
        } catch (_) {}
        const open = !schMenu.classList.contains("on");
        schMenu.classList.toggle("on", open);
        schBtn.setAttribute("aria-expanded", String(open));
      });
      schMenu.addEventListener("click", (e) => {
        const it = e.target.closest(".acct-i");
        if (!it) return;
        const sc = it.dataset.scope;
        if (sc) {
          SCH_SCOPE = sc === "All" ? "All" : sc;
          if (schInput)
            schInput.setAttribute(
              "placeholder",
              sc === "All" ? "Search properties, rooms, designs" : "Search " + sc.toLowerCase(),
            );
        }
        closeSch();
        runSearch();
      });
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-wrap")) {
          closeSch();
          closeSchRes();
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          closeSch();
          closeSchRes();
        }
      });
    }
    if (schInput) {
      schInput.addEventListener("input", () => {
        closeSch();
        runSearch();
      });
      schInput.addEventListener("focus", () => {
        if (schInput.value.trim()) runSearch();
      });
      schInput.addEventListener("keydown", (e) => {
        if (!schRes || !schRes.classList.contains("on")) return;
        const items = [...schRes.querySelectorAll("[data-r]")];
        if (!items.length) return;
        const cur = items.findIndex((x) => x.classList.contains("sel"));
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const nx =
            e.key === "ArrowDown"
              ? (cur + 1) % items.length
              : cur <= 0
                ? items.length - 1
                : cur - 1;
          items.forEach((x, i) => x.classList.toggle("sel", i === nx));
          items[nx].scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") {
          e.preventDefault();
          items[cur >= 0 ? cur : 0].click();
        }
      });
      document.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          schInput.focus();
          schInput.select();
        }
      });
    }

    /* ---------- account page ---------- */
    const NOTIF_PREFS = [
      ["designs", "Saved & Approved Designs", "Shows in your in app notification feed"],
      ["approvals", "Client Approvals", "When a client approves a presentation link"],
      ["team", "Team & Invites", "Invites you receive and teammates who join your workspace"],
      ["billing", "Credits & Billing", "Credit spend, refunds and low balance warnings"],
    ];
    let PREFS = null;
    function paintNotifPrefs() {
      if (!PREFS) return;
      const body =
        NOTIF_PREFS.map(([k, n, d]) => {
          const on = PREFS.notifs[k] !== false;
          return `<div class="rowi"><div class="rowt"><b>${n}</b><span>${d}</span></div>
      <button class="pill ${on ? "p-ok" : "p-gray"}" data-npref="${k}">${on ? "On" : "Off"}</button></div>`;
        }).join("") +
        '<div class="note"><i data-lucide="info"></i><span>These control the in app feed. We do not send marketing email, and account email is limited to security messages.</span></div>';
      ["notifRows", "notifPrefs"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = body;
      });
      lucide.createIcons();
    }
    document.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-npref]");
      if (!b || !PREFS) return;
      const k = b.getAttribute("data-npref");
      const next = PREFS.notifs[k] === false;
      PREFS.notifs[k] = next;
      paintNotifPrefs();
      try {
        await savePrefs({ notifs: { [k]: next } });
      } catch (_) {}
      try {
        window.dispatchEvent(new CustomEvent("rd:prefs"));
      } catch (_) {}
    });

    const INV_EMPTY =
      '<tr><td colspan="4" style="padding:18px 12px;color:var(--mute-2);font-size:.82rem">' +
      "No Billing History Yet. Plan changes, monthly refills and receipts appear here.</td></tr>";
    document.getElementById("invRows").innerHTML = INV_EMPTY;
    const EV_LABEL = {
      requested: "Plan Requested",
      activated: "Plan Activated",
      downgraded: "Plan Changed",
      canceled: "Canceled",
      cancel_scheduled: "Cancellation Scheduled",
      cancel_reverted: "Cancellation Reverted",
      refill: "Monthly Refill",
      past_due: "Renewal Due",
      request_withdrawn: "Request Withdrawn",
    };
    async function paintBillingEvents() {
      const el = document.getElementById("invRows");
      if (!el) return;
      try {
        const rows = await listBillingEvents();
        if (!rows.length) {
          el.innerHTML = INV_EMPTY;
          return;
        }
        el.innerHTML = rows
          .map((r) => {
            const when = new Date(r.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            const amt = r.meta && (r.meta.amount || r.meta.credits);
            return (
              "<tr><td>" +
              when +
              "</td><td>" +
              (EV_LABEL[r.kind] || r.kind) +
              '<div style="color:var(--mute-2);font-size:.76rem">' +
              (r.detail || "").replace(/</g, "&lt;") +
              "</div></td>" +
              '<td class="mono" style="text-align:right">' +
              (amt ? "+" + amt + " Credits" : "\u2014") +
              "</td>" +
              '<td style="text-align:right;color:var(--mute-2);font-size:.78rem">' +
              (r.kind === "activated" ? "Manual" : "\u2014") +
              "</td></tr>"
            );
          })
          .join("");
      } catch (e) {
        /* signed out */
      }
    }
    window.rdPaintBillingEvents = paintBillingEvents;

    const PANE_META = {
      profile: ["Profile", "How you appear to teammates and clients"],
      security: ["Security", "Password, two factor and active sessions"],
      notifs: ["Notifications", "What we email and push to you"],
      billing: ["Subscription", "Plan, usage and payment method"],
      invoices: ["Invoices", "Receipts for paid plans and credit top ups"],
      team: ["Team", "Members, roles and seat usage"],
      brand: ["Brand Kit", "Applied to exports, decks and client links"],
      defaults: ["Defaults", "Applied to every new design"],
      api: ["API & White Label", "Business plan feature"],
      danger: ["Data & Privacy", "Export or permanently remove your data"],
      integrations: ["Integrations", "Services you connect, and what the platform provides"],
      watch: ["Site Watch", "Monitor a listing site you own and prepare videos for new properties"],
    };
    function acctPane(k) {
      if (!PANE_META[k]) k = "profile";
      document
        .querySelectorAll(".arail-i")
        .forEach((b) => b.classList.toggle("on", b.dataset.pane === k));
      document
        .querySelectorAll(".apane")
        .forEach((x) => x.classList.toggle("on", x.id === "p-" + k));
      const t = document.getElementById("acctPaneTitle"),
        su = document.getElementById("acctPaneSub");
      if (t) t.textContent = PANE_META[k][0];
      if (su) su.textContent = PANE_META[k][1];
      if (k === "watch") {
        try {
          mountWatch(go);
        } catch (_) {}
      }
      if (k === "integrations") {
        try {
          mountCrm(go);
        } catch (_) {}
        try {
          paintIntegrations();
        } catch (_) {}
      }
      /* The address bar must name the pane on screen, so a refresh or a copied
     link reopens the same account section instead of falling back. */
      try {
        const acctOn = document.getElementById("v-account");
        if (acctOn && acctOn.classList.contains("on")) {
          const h = "#v-" + k;
          if (location.hash !== h)
            history.replaceState(null, "", location.pathname + location.search + h);
        }
      } catch (_) {}
    }
    document
      .querySelectorAll(".arail-i")
      .forEach((b) => b.addEventListener("click", () => acctPane(b.dataset.pane)));

    /* ---------- integrations readiness (owner only, read from the server) ---------- */
    async function paintIntegrations() {
      const box = document.getElementById("integRows");
      if (!box) return;
      let res = null;
      try {
        res = await readIntegrations();
      } catch (_) {}
      const rail = document.getElementById("railIntegrations");
      if (!res || !res.owner) {
        if (rail) rail.hidden = true;
        return;
      }
      if (rail) rail.hidden = false;
      const stateOf = (it) =>
        it.connected
          ? ["Connected", "p-ok"]
          : it.key === "products"
            ? ["Sample Data", "p-amb"]
            : ["Not Configured", "p-ink"];
      box.innerHTML = res.items
        .map((it) => {
          const st = stateOf(it);
          return (
            '<div class="rowi"><div class="rowt"><b>' +
            it.name +
            "</b><span>" +
            (it.connected ? "Connected And In Use." : it.note) +
            '</span></div><span class="pill ' +
            st[1] +
            '">' +
            st[0] +
            "</span></div>"
          );
        })
        .join("");
      const prod = res.items.find((x) => x.key === "products");
      const note = document.getElementById("prodSampleNote");
      if (note) note.hidden = !!(prod && prod.connected);
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }
    (function () {
      const n = document.getElementById("prodSampleNote");
      if (n) n.hidden = isProductSearchConfigured();
    })();
    paintIntegrations();

    /* ---------- dashboard: real data for the signed-in account ---------- */
    const kfmt = (n) =>
      n >= 1000
        ? "$" + Math.round(n / 100) / 10 + "K"
        : "$" + Math.round(n).toLocaleString("en-US");
    const empty = (t, s) =>
      '<div class="rowi"><div class="rowt"><b>' + t + "</b><span>" + s + "</span></div></div>";
    /* Skeleton placeholders shown while real data loads. */
    const skList = (n = 3) =>
      Array.from(
        { length: n },
        () =>
          '<div class="rowi sk-rowi"><div class="sk sk-th"></div><div class="sk-lines"><div class="sk sk-l1"></div><div class="sk sk-l2"></div></div></div>',
      ).join("");
    const skRows = (cols = 6, n = 4) =>
      Array.from(
        { length: n },
        () =>
          '<tr class="sk-tr">' +
          Array.from({ length: cols }, () => '<td><div class="sk sk-cell"></div></td>').join("") +
          "</tr>",
      ).join("");
    const skLines = (n = 3) =>
      '<div class="sk-lines">' +
      Array.from({ length: n }, () => '<div class="sk sk-l1"></div>').join("") +
      "</div>";

    /* First run checklist on the dashboard, driven by real workspace data.
   Every task here must be completable today, so the budget tasks only appear
   once verified cost data exists for a market. */
    async function paintOnboarding(s, pres) {
      const view = document.getElementById("v-dash");
      if (!view) return;
      let card = document.getElementById("obCard");
      let brandOk = false;
      try {
        brandOk = !!(PREFS && PREFS.brand && (PREFS.brand.company || "").trim());
      } catch (_) {}
      let videoOk = false;
      try {
        const mod = await import("@/lib/reveal.functions");
        const vids = await mod.listVideos();
        videoOk = ((vids && vids.projects) || []).length > 0;
      } catch (_) {}

      const done = [
        [
          "Save Your First Room",
          "Upload a photo in Studio and save it to a property.",
          (s.counts.designs || 0) > 0,
          "studio",
          "Open Studio",
        ],
        [
          "Create A Listing Video",
          "Turn property photos into a video you can share.",
          videoOk,
          "lvideo",
          "Open Listing Video",
        ],
        [
          "Send A Client Presentation",
          "Share a branded approval link and track the decision.",
          (pres || []).length > 0,
          "present",
          "Open Presentations",
        ],
        [
          "Set Up Your Brand Kit",
          "Add your logo and contact details to everything you send.",
          brandOk,
          "settings",
          "Open Brand Kit",
        ],
      ];
      let budgetLive = false;
      try {
        budgetLive = !!(await budgetAvailability()).available;
      } catch (_) {}
      if (budgetLive) {
        done.push([
          "Price A Budget",
          "Turn an approved room into a line by line planning range.",
          (s.counts.priced || 0) > 0,
          "scope",
          "Open Budget",
        ]);
        done.push([
          "Set A Budget Target",
          "Give a project a target so the dashboard can flag overruns.",
          s.projects.some((p) => p.budget_target),
          "scope",
          "Open Budget",
        ]);
      }
      const total = done.length;
      const left = done.filter((d) => !d[2]).length;
      /* the first run Get Started card covers the same ground, never show both */
      if (
        !left ||
        localStorage.getItem("rd.obDone") === "1" ||
        document.getElementById("onbCard")
      ) {
        if (card) card.remove();
        return;
      }
      if (!card) {
        card = document.createElement("div");
        card.id = "obCard";
        card.className = "card ob-card";
        view.prepend(card);
      }
      card.innerHTML =
        '<div class="card-h"><div><h3>Get Set Up</h3><div class="sub">' +
        (total - left) +
        " Of " +
        total +
        " Done</div></div>" +
        '<button class="btn btn-ghost btn-xs" id="obHide">Hide</button></div>' +
        '<div class="card-b ob-steps">' +
        done
          .map(
            ([t, sub, ok, dest, lab]) =>
              '<div class="ob-step' +
              (ok ? " ok" : "") +
              '"><i data-lucide="' +
              (ok ? "check-circle-2" : "circle") +
              '"></i>' +
              '<div class="rowt"><b>' +
              t +
              "</b><span>" +
              sub +
              "</span></div>" +
              (ok
                ? '<span class="pill p-ok">Done</span>'
                : '<button class="btn btn-ghost btn-xs" data-goto="' +
                  dest +
                  '">' +
                  lab +
                  "</button>") +
              "</div>",
          )
          .join("") +
        "</div>";
      try {
        lucide.createIcons();
      } catch (_) {}
      const hide = document.getElementById("obHide");
      if (hide)
        hide.addEventListener("click", () => {
          localStorage.setItem("rd.obDone", "1");
          card.remove();
        });
      card
        .querySelectorAll("[data-goto]")
        .forEach((b) => b.addEventListener("click", () => go(b.dataset.goto)));
    }

    /* ---------- sample workspace ---------- */
    let SAMPLE_BUSY = false;
    async function paintSample(s) {
      const host = document.getElementById("v-dash");
      if (!host) return;
      let bar = document.getElementById("sampleBar");
      let present = false;
      try {
        present = (await hasSampleWorkspace()).present;
      } catch (_) {}
      const wanted = present || !s.counts.properties;
      if (!wanted) {
        if (bar) bar.remove();
        return;
      }
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "sampleBar";
        bar.className = "note";
        bar.style.margin = "0 0 16px";
        host.insertBefore(bar, host.firstChild);
      }
      bar.innerHTML = present
        ? '<i data-lucide="flask-conical"></i><span><b>Sample Property Loaded.</b> 1420 Bayshore Boulevard is example data for exploring Properties, Designs and Reports.</span>' +
          '<button class="btn btn-ghost btn-xs" id="sampleGo" style="margin-left:auto"><i data-lucide="map-pin"></i>Open It</button>' +
          '<button class="btn btn-ghost btn-xs" id="sampleOff"><i data-lucide="trash-2"></i>Remove Sample</button>'
        : '<i data-lucide="flask-conical"></i><span><b>Nothing Saved Yet.</b> Load a sample property with three rooms to see how the workspace fits together. No credits are used.</span>' +
          '<button class="btn btn-primary btn-xs" id="sampleOn" style="margin-left:auto"><i data-lucide="download"></i>Load Sample Property</button>';
      try {
        lucide.createIcons();
      } catch (_) {}

      const on = document.getElementById("sampleOn");
      const off = document.getElementById("sampleOff");
      const goP = document.getElementById("sampleGo");
      if (goP) goP.onclick = () => go("props");
      const run = async (fn, btn, label) => {
        if (SAMPLE_BUSY) return;
        SAMPLE_BUSY = true;
        if (btn) {
          btn.classList.add("is-busy");
          btn.textContent = label;
        }
        try {
          await fn();
        } catch (e) {
          try {
            showAlert(e.message || "That did not go through. Give it another try in a moment.");
          } catch (_) {}
        }
        SAMPLE_BUSY = false;
        await loadDashboard();
        try {
          window.dispatchEvent(new Event("rd:saved"));
        } catch (_) {}
      };
      if (on)
        on.onclick = () =>
          run(
            () =>
              loadSampleWorkspace({
                data: {
                  photos: {
                    livingBefore: PHOTOS.before,
                    livingAfter: PHOTOS.after,
                    kitchenBefore: PHOTOS.kitchenBefore,
                    kitchenAfter: PHOTOS.kitchenAfter,
                    bathBefore: PHOTOS.bathBefore,
                  },
                },
              }),
            on,
            "Loading Sample",
          );
      if (off) off.onclick = () => run(() => removeSampleWorkspace(), off, "Removing");
    }

    async function loadDashboard() {
      const rl = document.getElementById("recentList"),
        al = document.getElementById("attnList"),
        bt = document.getElementById("budgetTable");
      if (!rl || !al || !bt) return;
      rl.innerHTML = skList(3);
      al.innerHTML = skList(2);
      bt.innerHTML = skRows(6, 3);
      let s;
      try {
        s = await Promise.race([
          getWorkspaceSummary(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 25000)),
        ]);
      } catch (e) {
        const slow = e && e.message === "timeout";
        rl.innerHTML =
          empty(
            slow ? "This Is Taking Longer Than Usual" : "We Could Not Load Your Workspace",
            slow
              ? "Your workspace did not load in time. Try again."
              : "Your session may have timed out. Sign in again, then refresh this page.",
          ) +
          '<div class="rowi"><button class="btn" id="dashRetry" type="button">Retry</button></div>';
        al.innerHTML = "";
        bt.innerHTML = "";
        const rb = document.getElementById("dashRetry");
        if (rb) rb.onclick = () => loadDashboard();
        return;
      }

      const kpis = document.querySelectorAll("#v-dash .grid.g4 .kpi");
      const setKpi = (i, val, note) => {
        const k = kpis[i];
        if (!k) return;
        const b = k.querySelector("b");
        if (b) b.textContent = val;
        const d = k.querySelector(".d");
        if (d) {
          d.textContent = note;
          d.classList.remove("up");
        }
      };
      setKpi(
        0,
        String(s.counts.designs),
        s.counts.designs ? s.counts.priced + " Priced With A Budget" : "Save A Room To Get Started",
      );
      setKpi(
        1,
        String(s.counts.properties),
        s.counts.properties ? "Saved To Your Account" : "No Properties Yet",
      );
      setKpi(
        2,
        s.counts.scopedTotal ? kfmt(s.counts.scopedTotal) : "Coming Soon",
        s.counts.scopedTotal
          ? s.counts.priced + " Priced " + (s.counts.priced === 1 ? "Room" : "Rooms")
          : "Verified Local Cost Data Coming Soon",
      );
      setKpi(
        3,
        String(s.counts.drafts),
        s.counts.drafts ? "Rooms Not Approved Yet" : "Nothing Pending",
      );

      /* recent rooms */
      if (!s.recent.length) {
        rl.innerHTML = empty("No Designs Yet", "Upload a photo in Studio, price it, then save it");
      } else {
        rl.innerHTML = s.recent
          .map(
            (r) => `
<div class="rowi"><div class="thumb"><img data-photo="${r.before_path || ""}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px" hidden></div>
<div class="rowt"><b>${r.room_name}</b><span>${r.address} &middot; ${r.project_name}</span></div>
<span class="pill ${r.total_low != null ? "p-ok" : "p-gray"}">${r.total_low != null ? "Priced" : "Draft"}</span></div>`,
          )
          .join("");
        rl.querySelectorAll("[data-photo]").forEach(async (img) => {
          const p = img.getAttribute("data-photo");
          if (!p) return;
          const url = await resolvePhotoUrl(p);
          if (url) {
            img.src = url;
            img.hidden = false;
          }
        });
      }

      /* needs attention */
      const attn = [];
      let attnBudgetLive = false;
      try {
        attnBudgetLive = !!(await budgetAvailability()).available;
      } catch (_) {}
      if (attnBudgetLive) {
        s.projects.forEach((p) => {
          if (p.priced < p.rooms)
            attn.push([
              p.rooms -
                p.priced +
                " " +
                (p.rooms - p.priced === 1 ? "room needs" : "rooms need") +
                " pricing",
              p.address + " &middot; " + p.project_name,
              "p-amb",
              "Price It",
              "scope",
            ]);
          if (p.budget_target && p.high > p.budget_target)
            attn.push([
              "Budget exceeds target by " + kfmt(p.high - p.budget_target),
              p.address + " &middot; " + p.project_name,
              "p-red",
              "Review",
              "scope",
            ]);
        });
      }
      let pres = [];
      try {
        pres = (await listPresentations()) || [];
        const hrs = (d) => (d ? (Date.now() - new Date(d).getTime()) / 36e5 : null);
        pres.forEach((p) => {
          const who = p.client_name || p.client_email || "Client";
          const where = (p.address ? p.address + " &middot; " : "") + p.room_name;
          if (p.status === "changes")
            attn.unshift([
              who + " requested changes on " + p.title,
              where,
              "p-red",
              "Review",
              "present",
              p.id,
            ]);
          else if (p.status === "viewed" && hrs(p.last_viewed_at) > 48)
            attn.push([
              who + " viewed but has not decided",
              where + " &middot; " + Math.round(hrs(p.last_viewed_at) / 24) + " days ago",
              "p-amb",
              "Follow Up",
              "present",
              p.id,
            ]);
          else if (p.status === "sent" && hrs(p.created_at) > 72)
            attn.push([
              p.title + " has not been opened",
              where + " &middot; sent " + Math.round(hrs(p.created_at) / 24) + " days ago",
              "p-amb",
              "Resend",
              "present",
              p.id,
            ]);
        });
      } catch (e) {}

      /* first run checklist: shown until every step is done or the user dismisses it */
      paintOnboarding(s, pres);
      paintSample(s);

      al.innerHTML = attn.length
        ? attn
            .slice(0, 5)
            .map(
              ([t, sub, cls, lab, dest, pid]) => `
<div class="rowi"${dest ? ` data-goto="${dest}"${pid ? ` data-focus-pres="${pid}"` : ""} role="button" tabindex="0" style="cursor:pointer"` : ""}><div class="rowt"><b>${t}</b><span>${sub}</span></div><span class="pill ${cls}">${lab}</span></div>`,
            )
            .join("")
        : empty("Nothing Needs Your Attention", "Priced rooms inside target will stay quiet here");

      /* budget vs scope */
      bt.innerHTML = s.projects.length
        ? s.projects
            .map((p) => {
              const t = p.budget_target;
              const fit = !p.priced
                ? ["p-gray", "Not Priced"]
                : !t
                  ? ["p-ink", "No Target"]
                  : p.high <= t
                    ? ["p-ok", "Within"]
                    : p.low <= t
                      ? ["p-amb", "Tight"]
                      : ["p-red", "Over"];
              return `<tr><td><b>${p.address}</b></td><td>${p.project_name}</td><td>${p.rooms}</td>
<td class="n">${t ? kfmt(t) : "—"}</td><td class="n">${p.priced ? kfmt(p.low) + " to " + kfmt(p.high) : "—"}</td>
<td style="text-align:right"><span class="pill ${fit[0]}">${fit[1]}</span></td></tr>`;
            })
            .join("")
        : '<tr><td colspan="6">No Saved Projects Yet. Save A Room In Studio To Start One.</td></tr>';
    }
    document.getElementById("attnList")?.addEventListener("click", (e) => {
      const r = e.target.closest("[data-goto]");
      if (!r) return;
      go(r.dataset.goto);
      const pid = r.dataset.focusPres;
      if (pid)
        setTimeout(() => {
          try {
            focusPresentation(pid);
          } catch (_) {}
        }, 60);
    });
    loadDashboard();
    window.addEventListener("rd:saved", loadDashboard);

    /* ---------- properties: real owned hierarchy ---------- */
    const RT_ICON = (t) => {
      const s = String(t || "").toLowerCase();
      if (s.includes("kitchen")) return "chef-hat";
      if (s.includes("bath")) return "bath";
      if (s.includes("bed")) return "bed";
      if (s.includes("exterior") || s.includes("elevation") || s.includes("yard")) return "home";
      if (s.includes("office")) return "lamp-desk";
      return "sofa";
    };
    let PROP_TREE = [],
      SEL = { p: 0, pr: 0 };
    let SAVED_EST = [];

    async function paintRooms() {
      const rc = document.getElementById("roomCards");
      if (!rc) return;
      const prop = PROP_TREE[SEL.p] || null,
        proj = prop ? prop.projects[SEL.pr] || null : null;
      const t = document.getElementById("propTitle"),
        sub = document.getElementById("propSub"),
        rs = document.getElementById("roomsSub");
      if (t) t.textContent = prop ? prop.address : "No Property Selected";
      if (sub)
        sub.textContent =
          prop && proj
            ? proj.name +
              " \u00b7 " +
              proj.rooms.length +
              (proj.rooms.length === 1 ? " room" : " rooms") +
              " \u00b7 " +
              proj.rooms.reduce((n, r) => n + r.versions, 0) +
              " versions"
            : "Save a room in Studio to build your property tree";
      if (rs)
        rs.textContent = proj
          ? "Rooms saved under " + proj.name
          : "Rooms saved under the selected project";
      const dnaPill = document.getElementById("dnaPill");
      if (dnaPill) {
        const n = ((prop && prop.dna) || []).length;
        dnaPill.className = "pill " + (n ? "p-ink" : "p-gray");
        dnaPill.innerHTML =
          '<i data-lucide="dna"></i>' + (n ? "Design DNA Locked" : "No Design DNA Yet");
      }
      const dna = document.getElementById("dnaRow");
      if (dna) {
        const items = (prop && prop.dna) || [];
        dna.innerHTML = items.length
          ? items
              .map(
                (it) =>
                  `<span class="dna-i"><span class="sw" style="background:${it.color}"></span>${it.label}</span>`,
              )
              .join("")
          : '<span style="font-size:.79rem;color:var(--mute-2)">No Design DNA locked for this property yet. Use Edit DNA to set the palette and finishes every room should follow.</span>';
      }

      const rooms = proj ? proj.rooms : [];
      if (!rooms.length) {
        rc.innerHTML =
          '<p style="font-size:.79rem;color:var(--mute-2)">No Rooms Here Yet. Price a room in Studio, then use Save To My Projects.</p>';
        return;
      }
      rc.innerHTML = rooms
        .map((r) => {
          const priced = r.total_low != null;
          const cls = priced ? "p-ok" : "p-gray";
          const cost = priced ? kfmt(r.total_low) + " to " + kfmt(r.total_high) : "Not priced yet";
          const st = r.status === "approved" ? "Approved" : r.status ? "Draft" : "\u2014";
          return `<div class="card"><div style="aspect-ratio:8/5;background:#EFEDE8;border-radius:7px 7px 0 0;overflow:hidden">
<img data-photo="${r.after_path || r.before_path || ""}" alt="${r.name}" style="width:100%;height:100%;object-fit:cover" hidden></div>
<div style="padding:12px 14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
<b style="font-size:.87rem">${r.name}</b><span class="pill ${cls}">v${r.version_no || 1} ${st}</span></div>
<div class="mono" style="font-size:.71rem;color:var(--mute-2);margin-top:5px">${cost}</div></div></div>`;
        })
        .join("");
      rc.querySelectorAll("[data-photo]").forEach(async (img) => {
        const p = img.getAttribute("data-photo");
        if (!p) return;
        const url = await resolvePhotoUrl(p);
        if (url) {
          img.src = url;
          img.hidden = false;
        }
      });
      lucide.createIcons();
    }

    function paintStudioSub() {
      const el = document.getElementById("studioSub");
      if (!el) return;
      const roomSel = document.getElementById("fRoom");
      const room = roomSel ? roomSel.value : "New Room";
      /* never imply a saved project is loaded: only a real Studio context is named */
      const ctx = typeof STUDIO_CTX !== "undefined" ? STUDIO_CTX : null;
      el.textContent =
        ctx && ctx.address
          ? ctx.address +
            (ctx.project ? " \u00b7 " + ctx.project : "") +
            " \u00b7 " +
            (ctx.room || room)
          : "New Design \u00b7 " + room;
    }

    function paintTree() {
      const el = document.getElementById("tree");
      if (!el) return;
      if (!PROP_TREE.length) {
        el.innerHTML =
          '<p style="font-size:.79rem;color:var(--mute-2)">No Properties Yet. Saving a room in Studio creates one.</p>';
        paintRooms();
        paintStudioSub();
        return;
      }
      const rows = [];
      PROP_TREE.forEach((p, pi) => {
        rows.push(
          `<div class="tr l1 ${pi === SEL.p ? "on" : ""}" data-pi="${pi}" data-pri="0"><i data-lucide="map-pin"></i><span class="tr-label" title="${p.address}">${p.address}</span><span class="meta">${p.has_dna ? "DNA Locked" : "No DNA"}</span><button class="tr-vid" data-vid-prop="${p.id}" data-vid-label="${p.address}" title="Create Video" aria-label="Create Video"><i data-lucide="clapperboard"></i></button></div>`,
        );
        p.projects.forEach((pr, pri) => {
          rows.push(
            `<div class="tr l2 ${pi === SEL.p && pri === SEL.pr ? "on" : ""}" data-pi="${pi}" data-pri="${pri}"><i data-lucide="folder"></i><span class="tr-label" title="${pr.name}">${pr.name}</span><span class="meta">${pr.rooms.length} ${pr.rooms.length === 1 ? "room" : "rooms"}</span></div>`,
          );
          pr.rooms.forEach((r) => {
            rows.push(
              `<div class="tr l3" data-pi="${pi}" data-pri="${pri}"><i data-lucide="${RT_ICON(r.room_type)}"></i><span class="tr-label" title="${r.name}">${r.name}</span><span class="meta">v${r.version_no || 1}</span></div>`,
            );
          });
        });
      });
      el.innerHTML = rows.join("");
      el.querySelectorAll(".tr").forEach((tr) =>
        tr.addEventListener("click", () => {
          SEL = { p: +tr.dataset.pi, pr: +tr.dataset.pri };
          paintTree();
        }),
      );
      el.querySelectorAll("[data-vid-prop]").forEach((b) =>
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          try {
            createVideoFrom({
              sourceType: "property",
              propertyId: b.getAttribute("data-vid-prop"),
              propertyLabel: b.getAttribute("data-vid-label"),
            });
          } catch (_) {}
        }),
      );
      lucide.createIcons();
      paintRooms();
      try {
        mountPropertyDetail(PROP_TREE[SEL.p] || null);
      } catch (_) {}
      paintStudioSub();
    }

    async function loadProperties() {
      if (!document.getElementById("tree")) return;
      try {
        PROP_TREE = await getPropertyTree();
      } catch (e) {
        PROP_TREE = [];
      }
      if (SEL.p >= PROP_TREE.length) SEL = { p: 0, pr: 0 };
      const cp = document.getElementById("cntProps"),
        cd = document.getElementById("cntDesigns");
      if (cp) cp.textContent = String(PROP_TREE.length);
      if (cd)
        cd.textContent = String(
          PROP_TREE.reduce(
            (n, p) =>
              n + p.projects.reduce((m, pr) => m + pr.rooms.reduce((k, r) => k + r.versions, 0), 0),
            0,
          ),
        );
      /* A zero is not information: the badge only appears once there is work. */
      [cp, cd].forEach((c) => {
        if (c) c.hidden = !(Number(c.textContent) > 0);
      });

      paintTree();
      paintDesigns();
      updateSearchMeta();
      try {
        paintBatch();
      } catch (_) {}
      try {
        progressiveNav();
      } catch (_) {}
      try {
        paintHome();
      } catch (_) {}
    }
    loadProperties();
    window.addEventListener("rd:saved", loadProperties);

    /* ---------- progressive navigation ----------
   The sidebar only shows what the workspace can actually use today. Counts
   are read from the live property tree, never from a flag. */
    function workspaceCounts() {
      let props = 0,
        designs = 0;
      try {
        props = PROP_TREE.length;
        designs = PROP_TREE.reduce(
          (n, p) =>
            n + p.projects.reduce((m, pr) => m + pr.rooms.reduce((k, r) => k + r.versions, 0), 0),
          0,
        );
      } catch (_) {}
      return { props, designs };
    }
    /* Budget is promised, not faked: until verified cost data exists for a market
   every budget surface shows the same coming soon block instead of numbers. */
    async function paintBudgetGate() {
      const view = document.getElementById("v-scope");
      if (!view) return;
      const grid = document.getElementById("scopeGrid");
      let host = document.getElementById("budgetSoon");
      if (!host) {
        host = document.createElement("div");
        host.id = "budgetSoon";
        view.insertBefore(host, view.firstChild);
      }
      const gated = await mountBudgetComingSoon(host, "Every Number You Share With A Client");
      if (grid) grid.hidden = !!gated;
      host.hidden = !gated;
    }
    /* A feature nobody can use yet leaves the primary navigation entirely: the
   sidebar never advertises development status. The route stays reachable. */
    function setNavAvailable(view, available) {
      const b = document.querySelector('.nav-i[data-v="' + view + '"]');
      if (!b) return;
      if (available) b.removeAttribute("data-unavailable");
      else b.setAttribute("data-unavailable", "1");
      b.querySelectorAll(".nav-soon").forEach((s) => s.remove());
      try {
        progressiveNav();
      } catch (_) {}
    }
    (async function budgetNavGate() {
      try {
        const a = await budgetAvailability();
        setNavAvailable("scope", !!a.available);
      } catch (_) {}
    })();



    /* Single runtime switch for every other Budget surface in the shell. Static
   markup always ships in the "coming soon" shape; this turns pieces back on
   once budgetAvailability() resolves true, so nothing has to be duplicated. */
    async function applyBudgetGating() {
      let live = false;
      try {
        live = !!(await budgetAvailability()).available;
      } catch (_) {}

      /* search: scope entry + index rows */
      try {
        const schBudgetsBtn = document.querySelector('#schMenu [data-scope="Budgets"]');
        if (schBudgetsBtn) schBudgetsBtn.remove();
      } catch (_) {}

      /* dashboard: budget KPI + budget vs estimate table */
      try {
        const kpi = document.getElementById("kpiBudget");
        if (kpi && !live) {
          kpi.querySelector(".t").innerHTML = '<i data-lucide="sparkles"></i>Recent Generations';
          kpi.dataset.rebalanced = "1";
        }
      } catch (_) {}
      try {
        const card = document.getElementById("budgetVsEstimateCard");
        if (card) card.hidden = !live;
      } catch (_) {}

      /* studio: build budget action + tool row */
      try {
        const bb = document.getElementById("studioBuildBudget");
        if (bb) bb.hidden = !live;
      } catch (_) {}
      try {
        const row = document.getElementById("toolrowBudget");
        if (row && !live) {
          row.setAttribute("aria-disabled", "true");
          row.classList.add("is-disabled");
          /* Branded tooltip only: native title is stripped by the tooltip layer. */
          row.setAttribute("data-tt", "Coming Soon \u00b7 Not Included In Any Plan Yet");
          const pill = row.querySelector(".plan-pill");
          if (pill) {
            pill.className = "pill p-gray";
            pill.textContent = "Coming Soon";
          }
          delete TOOL_COST["Budget"];
        }
      } catch (_) {}

      /* team: permission copy + usage column */
      try {
        const perm = document.getElementById("permRunBudgets");
        if (perm)
          perm.textContent = live
            ? "Run Budgets, Videos And Presentations"
            : "Run Videos And Presentations";
      } catch (_) {}
      try {
        const head = document.getElementById("usageBudgetsHead");
        const tbl = head && head.closest("table");
        if (tbl) tbl.classList.toggle("no-budgets-col", !live);
      } catch (_) {}

      /* account defaults: market for labor pricing + default budget band */
      try {
        const mf = document.getElementById("dfMarketField");
        if (mf) mf.hidden = !live;
        const bf = document.getElementById("dfBandField");
        if (bf) bf.hidden = !live;
      } catch (_) {}

      /* help, tutorials and faq read live budget state directly */
      try {
        BUDGET_LIVE = live;
        renderCats(document.getElementById("helpQ")?.value || "");
        renderFaq(document.getElementById("helpQ")?.value || "");
        renderTuts();
      } catch (_) {}

      return live;
    }
    applyBudgetGating();
    window.addEventListener("rd:prefs", () => {
      try {
        applyBudgetGating();
      } catch (_) {}
    });

    function progressiveNav() {
      const { props, designs } = workspaceCounts();
      const rule = {
        designs: designs > 0,
        scope: designs > 0,
        products: designs > 0,
        media: props > 0,
        listings: props > 0,
        present: props > 0,
        reports: designs >= 3,
      };
      document.querySelectorAll(".nav-i").forEach((b) => {
        const v = b.dataset.v;
        /* Not usable yet: hidden regardless of workspace progress. */
        if (b.hasAttribute("data-unavailable")) {
          b.hidden = true;
          return;
        }
        if (!(v in rule)) return;
        const show = rule[v] || b.classList.contains("on");
        b.hidden = !show;
      });
      /* Counts are live workspace information, never a zero-state badge. */
      document.querySelectorAll(".nav-i .cnt").forEach((c) => {
        const n = Number((c.textContent || "").trim());
        c.hidden = !(n > 0);
      });
      /* Group headers with nothing left under them should not linger. */
      document.querySelectorAll(".side-nav .nav-group").forEach((g) => {
        let any = false;
        for (
          let n = g.nextElementSibling;
          n && !n.classList.contains("nav-group");
          n = n.nextElementSibling
        ) {
          if (n.classList.contains("nav-i") && !n.hidden) any = true;
        }
        g.hidden = !any;
      });
    }
    /* Modules that only hold sample or manual data stay out of the primary
   navigation until they do real work — no development-status badges. */
    (async function moduleNavGate() {
      try {
        const r = await readIntegrations();
        const byKey = {};
        (r.items || []).forEach((i) => {
          byKey[i.key] = i;
        });
        if (byKey["products"]) setNavAvailable("products", !!byKey["products"].connected);
        if (byKey["listing"]) setNavAvailable("listings", !!byKey["listing"].connected);
      } catch (_) {}
    })();


    /* The home chooser is gone: Home renders the dashboard, and the two doors
   live in the sidebar under Create. */

    /* ---------- studio ----------
   Studio never boots with sample content. Everything below is driven by an
   explicit source state, and the canvas stays empty until a real source
   (upload, handoff, saved design, property or an intentionally chosen sample)
   is loaded. */
    const cRng = document.getElementById("cRng"),
      cAfter = document.getElementById("cAfter"),
      cHnd = document.getElementById("cHnd");
    const cBefore = document.getElementById("cBefore");
    const studioWrap = document.querySelector("#v-studio .studio");
    const SRC_EMPTY = "empty";
    let STUDIO_SRC = SRC_EMPTY; // empty|uploading|user_upload|website_handoff|existing_design|existing_property|saved_draft|intentional_sample|processing|generated|error
    let STUDIO_RESULT = false;
    let studioAnalyzeTimer = null;

    /**
     * The viewer always shows the shape the design will be delivered in, so a
     * portrait output is never squeezed into a landscape banner. Before and
     * After share this one container, so their geometry can never drift.
     */
    function setCanvasRatio(ratio, src) {
      const cv = document.getElementById("canvas");
      if (!cv) return;
      const map = {
        "9:16": "9 / 16",
        "16:9": "16 / 9",
        "1:1": "1 / 1",
        "4:3": "4 / 3",
        "4:5": "4 / 5",
        "3:2": "3 / 2",
        "2:3": "2 / 3",
      };
      const ar = map[String(ratio || "")];
      if (ar) {
        cv.style.setProperty("--rd-canvas-ar", ar);
        return;
      }
      /* "Original" or unknown: follow the source photo's own shape. */
      cv.style.setProperty("--rd-canvas-ar", "16 / 9");
      if (!src) return;
      const probe = new Image();
      probe.onload = () => {
        if (probe.naturalWidth && probe.naturalHeight)
          cv.style.setProperty(
            "--rd-canvas-ar",
            probe.naturalWidth + " / " + probe.naturalHeight,
          );
      };
      probe.src = src;
    }


    function setC(v) {
      cAfter.style.clipPath = `inset(0 0 0 ${v}%)`;
      cHnd.style.left = v + "%";
    }
    cRng.addEventListener("input", (e) => setC(e.target.value));
    setC(50);

    /** Caption shown over an uploaded source before anything has been generated. */
    /* The Canvas carries exactly one title and one dynamic subtitle, in its card
   header. The old inset "Your Source Photo" panel repeated both, so it is
   gone; this only clears any copy left over from an earlier session. */
    function sourceCaption(_on?: any, _text?: any) {
      const cap = document.getElementById("srcCap");
      if (cap) cap.remove();
    }

    /* The single Studio start experience: in-canvas empty state plus the compact
   "Start With" panel on the right. Mounted lazily so the Studio markup exists. */
    let STUDIO_START = null;
    function studioStart() {
      if (STUDIO_START) return STUDIO_START;
      try {
        STUDIO_START = mountStudioStart({
          lucide: { createIcons: (o) => lucide.createIcons(o) },
          esc: (v) => esc(v),
          photos: PHOTOS,
          go: (v) => go(v),
          track: (e, pr) => track(e, pr),
          uploadPhoto: async (f) => {
            const path = await uploadRoomPhoto(f);
            try {
              window.rdPendingPhotoPath = path;
            } catch (_) {}
            const url = await roomPhotoUrl(path);
            return url || URL.createObjectURL(f);
          },
          setSource: (kind, src, alt, opts) => setStudioSource(kind, src, alt, opts),
          showConcept: async (image, label, prompt) => {
            setStudioSource("user_upload", image, "Design concept", {
              caption:
                "Concept design. Attach a real photo, sketch or plan for a true-to-space result.",
            });
            cAfter.innerHTML = photo(image, (label || "Concept") + " design");
            /* A concept is real work: store it privately so it lands in Media. */
            let path = null;
            try {
              path = await uploadRenderDataUrl(image);
            } catch (_) {
              path = null;
            }
            lastRender = image;
            lastRenderPath = path;
            addRenderVariant(image, label || "Concept", path);
            markStudioResult();
            finalizeGeneratedDesign(path);

            if (path) {
              STUDIO_DRAFT_ID = null;
              STUDIO_DRAFT_PATH = null;
              try {
                await saveStudioDraft(path, { prompt: prompt || null, concept: true });
              } catch (_) {}
            }
            try {
              window.dispatchEvent(new Event("rd:photo"));
            } catch (_) {}
            try {
              window.dispatchEvent(new Event("rd:credits-changed"));
            } catch (_) {}
          },

          getProperties: () => {
            try {
              return PROP_TREE || [];
            } catch (_) {
              return [];
            }
          },
          getRecent: () => {
            try {
              return designItems()
                .filter((d) => !d.sample)
                .slice(0, 4)
                .map((d) => ({
                  id: String(d.id),
                  name: d.name,
                  sub: d.sub || "",
                  status: (ST_PILL(d.status) || [])[1] || "",
                  path: d.path || "",
                }));
            } catch (_) {
              return [];
            }
          },
          openRecent: (id) => {
            try {
              const d = designItems().find((x) => String(x.id) === String(id));
              if (d && d.room) openInStudio(d.room);
            } catch (_) {}
          },
          resolvePhoto: (p) => resolvePhotoUrl(p),
          /* Only finished work: a real generated image, never a sample or draft. */
          getFinishedDesigns: async () => {
            const out = [];
            (PROP_TREE || []).forEach((p) =>
              (p.projects || []).forEach((pr) =>
                (pr.rooms || []).forEach((r) => {
                  if (!r.after_path) return;
                  if (r.status === "archived") return;
                  out.push({
                    id: String(r.id),
                    path: r.after_path,
                    beforePath: r.before_path || null,
                    room: r.name || pr.name || "Design",
                    address: p.address || null,
                    propertyId: p.id || null,
                    createdAt: r.created_at || null,
                    versionId: r.version_id || null,
                  });
                }),
              ),
            );
            out.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
            return out;
          },
          setContext: (c) => {
            STUDIO_CTX = Object.assign(blankStudioCtx(), {
              room: (c && c.room) || null,
              address: (c && c.address) || null,
              project: (c && c.project) || null,
              roomId: (c && c.roomId) || null,
              propertyId: (c && c.propertyId) || null,
              projectId: (c && c.projectId) || null,
              sourcePath: (c && c.sourcePath) || null,
            });
            paintStudioSub();
          },
          showAlert: (m) => showAlert(m),
          fileToDataUrl: (file) =>
            new Promise((res, rej) => {
              const r = new FileReader();
              r.onload = () => res(String(r.result));
              r.onerror = () => rej(new Error("Could not read that file."));
              r.readAsDataURL(file);
            }),
        });
      } catch (e) {
        STUDIO_START = null;
      }
      return STUDIO_START;
    }
    /* The source chooser belongs to a generic Studio session only. */
    window.rdStudioStart = (method) => {
      if (inPhotoCanvas()) return;
      const s = studioStart();
      if (s && s.open) s.open(method);
    };

    /** '' | 'generating' | 'error' — drives the one dynamic Canvas subtitle. */
    let CANVAS_PHASE = "";
    function setCanvasPhase(ph) {
      CANVAS_PHASE = ph || "";
      const sub = document.querySelector("#canvasCard .card-h .sub");
      if (sub) sub.textContent = canvasSubtitle();
    }

    /** The single Canvas subtitle. One line, driven by the real source state. */
    function canvasSubtitle() {
      return studioSubtitle({
        empty: STUDIO_SRC === SRC_EMPTY,
        result: !!STUDIO_RESULT,
        phase: CANVAS_PHASE as any,
      });
    }
    try {
      (window as any).__rdCanvasSubtitle = () => canvasSubtitle();
    } catch (_) {}

    function paintStudioState() {
      if (studioWrap) {
        studioWrap.dataset.src = STUDIO_SRC;
        studioWrap.classList.toggle("st-empty", STUDIO_SRC === SRC_EMPTY);
        studioWrap.classList.toggle("st-result", STUDIO_RESULT);
      }
      /* The canvas is a workspace: it borrows the left menu as a rail whenever the
     Studio view is open, and hands it straight back on the way out. */
      try {
        const onCanvas = !!document.querySelector("#v-studio.on");
        const applyRail = () => {
          const rail = (window as any).__rdRailBorrow;
          if (!rail) {
            setTimeout(applyRail, 60);
            return;
          }
          if (onCanvas === (window as any).__rdCanvasRail) return;
          (window as any).__rdCanvasRail = onCanvas;
          if (onCanvas) rail.collapse();
          else rail.release();
        };
        applyRail();
      } catch (_) {}

      const gen = document.getElementById("genBtn");
      if (gen) gen.classList.toggle("is-disabled", STUDIO_SRC === SRC_EMPTY);
      const canvas = document.getElementById("canvas");
      if (canvas) canvas.classList.toggle("has-result", STUDIO_RESULT);
      try {
        paintSaveRoomBtn();
      } catch (_) {}
      const csub = document.querySelector("#canvasCard .card-h .sub");
      if (csub) csub.textContent = canvasSubtitle();
      const s = studioStart();
      if (s && s.paint) s.paint(STUDIO_SRC === SRC_EMPTY);
      if (STUDIO_SRC !== SRC_EMPTY) {
        try {
          populateStyleSelect();
          syncStudioStyleChoice();
        } catch (_) {}
      }
    }

    /**
     * Object Controls stay disabled until real per-photo detection exists. A timer
     * is not an analysis pass, and hotspots from one image must never be shown
     * over another, so nothing is claimed here that the app cannot back up.
     */
    let DETECTED_OBJECTS = [];
    function objectControlsReady() {
      return DETECTED_OBJECTS.length > 0;
    }
    function analyzeObjects() {
      if (studioAnalyzeTimer) {
        clearTimeout(studioAnalyzeTimer);
        studioAnalyzeTimer = null;
      }
      if (studioWrap) studioWrap.classList.remove("st-analyzing");
      /* Detections are per photo: never carry them across sources. */
      DETECTED_OBJECTS = [];
      try {
        Object.keys(locks).forEach((k) => {
          delete locks[k];
        });
      } catch (_) {}
      try {
        document.querySelectorAll(".hot").forEach((h) => {
          h.className = "hot";
          h.hidden = true;
        });
      } catch (_) {}
      drawLocks();
    }

    /**
     * Loads a real source into Studio. Never called with sample imagery unless the
     * user intentionally picked a sample space.
     */
    function setStudioSource(kind, src, alt, opts) {
      const o = opts || {};
      STUDIO_SRC = kind || "user_upload";
      if (kind !== "existing_design" && kind !== "existing_property")
        STUDIO_CTX = blankStudioCtx();
      STUDIO_RESULT = false;
      CANVAS_PHASE = "";
      lastRender = null;
      lastRenderPath = o.afterPath || null;
      /* Switching photos must not carry another photo's unsaved render or its
         session versions onto this canvas. */
      dropPendingSave();
      try {
        SESSION_VERSIONS.length = 0;
      } catch (_) {}

      if (cBefore && src) cBefore.innerHTML = photo(src, alt || "Your source photo");
      setCanvasRatio(o.ratio, src);

      if (cAfter) cAfter.innerHTML = "";
      const vars = document.getElementById("vars");
      if (vars) vars.innerHTML = "";
      const sum = document.getElementById("studioSummary");
      if (sum) sum.innerHTML = "";
      Object.keys(locks).forEach((k) => delete locks[k]);
      document.querySelectorAll(".hot").forEach((h) => (h.className = "hot"));
      sourceCaption(true, o.caption);
      // Remember the source so Explore can recommend compatible styles.
      try {
        localStorage.setItem(
          "rd_last_source",
          JSON.stringify({
            projectType: currentProjectType(),
            roomType: (document.getElementById("fRoom") || {}).value || "",
            brightness: "average",
            woodTones: true,
            text: (document.getElementById("agentNote") || {}).value || "",
            ts: Date.now(),
          }),
        );
      } catch (_) {}
      analyzeObjects();
      paintStudioState();
      paintStudioSub();

      /* Persist the in-progress design as soon as a durable source exists. */
      if (kind !== "saved_draft") {
        STUDIO_DRAFT_ID = null;
        STUDIO_DRAFT_PATH = null;
        const srcPath =
          o.srcPath || (typeof window !== "undefined" ? window.rdPendingPhotoPath : null) || null;
        if (kind !== "intentional_sample" && srcPath && !/^(blob:|data:)/i.test(srcPath))
          STUDIO_CTX.sourcePath = srcPath;
        if (kind !== "intentional_sample" && srcPath) {
          try {
            saveStudioDraft(srcPath);
          } catch (_) {}
        }
      }

      cRng.value = 50;
      setC(50);
    }

    /* ---- durable image-design drafts ----------------------------------------
   An in-progress Studio design is real work: it survives a refresh, another
   device and a sign-out, and shows up in Media and under its property. */
    let STUDIO_DRAFT_ID = null,
      STUDIO_DRAFT_PATH = null;

    function studioDraftTitle() {
      const room =
        (STUDIO_CTX && STUDIO_CTX.room) ||
        ((document.getElementById("fRoom") || {}).value || "").trim();
      return (
        (STUDIO_CTX && STUDIO_CTX.project) ||
        suggestDesignTitle((STUDIO_CTX && STUDIO_CTX.address) || "", room) ||
        "Untitled Design"
      );
    }

    /** Saves or refreshes the draft row for whatever source is on the canvas. */
    async function saveStudioDraft(path, extra) {
      const p = path || STUDIO_DRAFT_PATH;
      if (!p || /^(blob:|data:)/i.test(p)) return;
      STUDIO_DRAFT_PATH = p;
      if (!STUDIO_DRAFT_ID) STUDIO_DRAFT_ID = newDraftId();
      try {
        await saveProjectDraft({
          data: {
            id: STUDIO_DRAFT_ID,
            project_type: "photo_redesign",
            status: "draft",
            title: studioDraftTitle(),
            property_address: (STUDIO_CTX && STUDIO_CTX.address) || null,
            builder_step: "canvas",
            assets: [{ key: "source", path: p }],
            settings: Object.assign(
              {
                room: (STUDIO_CTX && STUDIO_CTX.room) || null,
                style: (document.getElementById("fStyle") || {}).value || null,
              },
              extra || {},
            ),
          },
        });
      } catch (_) {}
    }

    /** A finished render retires the draft; the saved design is the durable record. */
    async function clearStudioDraft() {
      const id = STUDIO_DRAFT_ID;
      STUDIO_DRAFT_ID = null;
      STUDIO_DRAFT_PATH = null;
      if (!id) return;
      try {
        await deleteProjectDraft({ data: { id } });
      } catch (_) {}
    }

    /** Reopens an image-design draft picked from Media. */
    async function resumeStudioDraft(id) {
      try {
        const d = await getProjectDraft({ data: { id } });
        const assets = (d && d.assets) || [];
        const path = (assets.find((a) => a && a.path) || {}).path;
        if (!path) return false;
        const url = await resolvePhotoUrl(path);
        if (!url) return false;
        STUDIO_CTX = Object.assign(blankStudioCtx(), {
          room: (d.settings && d.settings.room) || null,
          address: d.property_address || null,
          project: d.title || null,
          roomId: (d.settings && d.settings.roomId) || null,
          propertyId: (d.settings && d.settings.propertyId) || null,
          projectId: (d.settings && d.settings.projectId) || null,
          sourcePath: path,
        });
        setStudioSource("saved_draft", url, "Your source photo", { draftId: d.id, srcPath: path });
        STUDIO_DRAFT_ID = d.id;
        STUDIO_DRAFT_PATH = path;
        return true;
      } catch (_) {
        return false;
      }
    }
    window.rdStudioResumeDraft = (id) => resumeStudioDraft(id);

    /** Called once a real generated result lands on the canvas.
        The in-progress draft is deliberately kept here: it is only retired once
        the render has a durable path AND a version row exists, so a failed
        upload or a failed version insert can never lose the work. */
    function markStudioResult() {
      STUDIO_RESULT = true;

      if (STUDIO_SRC !== "intentional_sample") STUDIO_SRC = "generated";
      sourceCaption(false);
      paintStudioState();
      paintVersions();
      try {
        window.rdPaintClearBtn && window.rdPaintClearBtn();
      } catch (_) {}
    }

    /** Returns Studio to the clean welcome state. */
    function clearStudioSource() {
      STUDIO_SRC = SRC_EMPTY;
      STUDIO_RESULT = false;
      STUDIO_CTX = blankStudioCtx();
      lastRender = null;
      lastRenderPath = null;
      /* A discarded design must not leave an unsaved-render banner, a retry that
         would upload an image the user threw away, or its versions in the list. */
      dropPendingSave();
      try {
        SESSION_VERSIONS.length = 0;
      } catch (_) {}
      if (cBefore) cBefore.innerHTML = "";
      if (cAfter) cAfter.innerHTML = "";
      const vars = document.getElementById("vars");
      if (vars) vars.innerHTML = "";
      const sum = document.getElementById("studioSummary");
      if (sum) sum.innerHTML = "";
      Object.keys(locks).forEach((k) => delete locks[k]);
      document.querySelectorAll(".hot").forEach((h) => (h.className = "hot"));
      sourceCaption(false);
      document.getElementById("fuSampleBar")?.remove();
      document.getElementById("hoBanner")?.remove();
      if (studioWrap) studioWrap.classList.remove("st-analyzing");
      drawLocks();
      paintStudioState();
      paintStudioSub();
      try {
        window.rdPaintClearBtn && window.rdPaintClearBtn();
      } catch (_) {}
    }
    window.rdSetStudioSource = setStudioSource;
    window.rdClearStudioSource = clearStudioSource;
    window.rdStudioSourceState = () => STUDIO_SRC;
    window.rdStudioHasSource = () => STUDIO_SRC !== SRC_EMPTY;

    /* object locks */
    let mode = "keep";
    const locks = {};
    document.querySelectorAll("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => {
        document.querySelectorAll("[data-mode]").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        mode = b.dataset.mode;
      }),
    );
    function drawLocks() {
      const k = Object.keys(locks);
      const sub = document.getElementById("lockCount");
      const list = document.getElementById("lockList");
      const ready = objectControlsReady();
      document.querySelectorAll("[data-mode]").forEach((b) => {
        b.disabled = !ready;
        b.classList.toggle("is-disabled", !ready);
      });
      if (!ready) {
        if (sub) sub.textContent = "Analysis Pending";
        const help = document.getElementById("lockHelp");
        if (help) help.hidden = true;
        if (list)
          list.innerHTML =
            '<p style="font-size:.79rem;color:var(--mute-2)">Analyzing photo for object controls\u2026</p>';
        try {
          lucide.createIcons();
        } catch (_) {}
        return;
      }
      const help = document.getElementById("lockHelp");
      if (help) help.hidden = false;
      if (sub)
        sub.textContent = k.length
          ? `${k.length} Object${k.length > 1 ? "s" : ""} Locked`
          : "Click Objects On The Canvas";
      if (list)
        list.innerHTML = k.length
          ? k
              .map((o) => {
                const cls = { keep: "p-ok", replace: "p-blue", remove: "p-red" }[locks[o]];
                return `<div class="rowi" style="padding:9px 0"><div class="rowt"><b>${o}</b></div>
    <span class="pill ${cls}">${locks[o]}</span>
    <button class="icon-btn" data-rm="${o}" style="width:24px;height:24px"><i data-lucide="x" style="width:13px;height:13px"></i></button></div>`;
              })
              .join("")
          : '<p style="font-size:.79rem;color:var(--mute-2)">Pick a mode, then click an object on the canvas to keep, replace or remove it.</p>';
      lucide.createIcons();
      document.querySelectorAll("[data-rm]").forEach((b) =>
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          const o = b.dataset.rm;
          delete locks[o];
          document.querySelectorAll(".hot").forEach((h) => {
            if (h.dataset.o === o) h.className = "hot";
          });
          drawLocks();
        }),
      );
    }
    document.querySelectorAll(".hot").forEach((h) =>
      h.addEventListener("click", () => {
        if (STUDIO_SRC === SRC_EMPTY || !objectControlsReady()) return;
        const o = h.dataset.o;
        if (locks[o] === mode) {
          delete locks[o];
          h.className = "hot";
        } else {
          locks[o] = mode;
          h.className = "hot set " + mode;
        }
        drawLocks();
      }),
    );
    try {
      window.rdObjectControlsReady = () => objectControlsReady();
    } catch (_) {}
    drawLocks();

    /* Design Intensity: how far the redesign goes. It shapes the generated image
   and carries no dollar figures while budgets are coming soon. */
    const BANDS = [
      { name: "Refresh", scope: "Paint & Styling" },
      { name: "Makeover", scope: "Furnishings & Finishes" },
      { name: "Renovation", scope: "Cabinetry & Surfaces" },
      { name: "Full Remodel", scope: "Full Replacement" },
    ];
    function paintStudioSummary(d) {
      const el = document.getElementById("studioSummary");
      if (!el) return;
      if (!STUDIO_RESULT || !d) {
        el.innerHTML = "";
        return;
      }
      const grade = document.querySelector("#gradeChips .chip.on");
      const gradeTxt = grade ? grade.textContent.trim() : "Retail Grade";
      const wasOpen = el.querySelector("details")?.open ? " open" : "";
      /* Compact by default: the image viewer stays the largest thing on the
         Canvas and the full detail grid is one click away. */
      el.innerHTML =
        `<details class="gen-details"${wasOpen}><summary><span class="gd-k">Generation Details</span>` +
        `<span class="gd-sum">${d.name} &middot; ${gradeTxt} &middot; Geometry Preserved</span>` +
        `<i data-lucide="chevron-down"></i></summary><div class="gd-body">` +
        summaryHTML({
          primaryLabel: "Design Intensity",
          primaryValue: d.name,
          metrics: [
            metric("What Changes", d.scope),
            metric("Reality Lock", "Geometry Held", "positive"),
            metric("Structure", "No Changes", "positive"),
          ],
        }) +
        `</div></details>`;
      try {
        lucide.createIcons();
      } catch (_) {}
    }

    function currentBand() {
      const b = document.querySelector(".bchip.on");
      return BANDS[b ? +b.dataset.b : 1];
    }
    document.querySelectorAll(".bchip").forEach((b) =>
      b.addEventListener("click", () => {
        document.querySelectorAll(".bchip").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        paintStudioSummary(BANDS[+b.dataset.b]);
      }),
    );
    document.querySelectorAll("#gradeChips .chip, #spChips .chip").forEach((c) =>
      c.addEventListener("click", () => {
        c.parentElement.querySelectorAll(".chip").forEach((x) => x.classList.remove("on"));
        c.classList.add("on");
        /* Space changed: recalculate tools, styles, labels and the gate.
           Intensity, finish grade and instructions are deliberately kept. */
        try {
          (window as any).__rdPaintSpaceTools && (window as any).__rdPaintSpaceTools();
        } catch (_) {}
      }),
    );
    try {
      const rsel = document.getElementById("fRoom");
      rsel &&
        rsel.addEventListener("change", () => {
          try {
            (window as any).__rdPaintSpaceTools && (window as any).__rdPaintSpaceTools();
          } catch (_) {}
        });
    } catch (_) {}
    paintStudioState();

    const gsteps = [
      "Reading room geometry",
      "Applying object locks",
      "Applying design intensity",
      "Selecting retail grade finishes",
      "Rendering the space",
      "Finishing the image",
    ];
    let busy = false,
      lastRender = null,
      lastRenderPath = null;
    document.getElementById("genBtn").addEventListener("click", async () => {
      if (busy) return;
      const srcImg = document.querySelector("#cBefore img");
      if (STUDIO_SRC === SRC_EMPTY || !srcImg || !srcImg.src) {
        needSourceModal();
        return;
      } // never spends a credit
      const gTool = activeToolName();
      if (styleNeedForTool(gTool) && !canvasStyleSelected()) {
        promptForStyle(gTool);
        return;
      }
      if (LIVE_TOOLS[gTool]) {
        LIVE_TOOLS[gTool]();
        return;
      }
      if (!ensureCredits(1, "A Design Render")) return;
      /* A variation branches from the selected design instead of the source
         photo: same room, same property, new child version. */
      const VAR = (window as any).__rdPendingVariation || null;
      (window as any).__rdPendingVariation = null;
      busy = true;
      setCanvasPhase("generating");
      const btn = document.getElementById("genBtn");
      btn.disabled = true;
      const ov = document.getElementById("cGen"),
        bar = document.getElementById("cBar"),
        st = document.getElementById("cStep");
      ov.classList.add("on");
      bar.style.width = "0%";
      st.textContent = gsteps[0];
      let p = 0,
        i = 0;
      const t = setInterval(() => {
        p = Math.min(p + Math.random() * 7 + 2, 94);
        bar.style.width = p + "%";
        if (p > (i + 1) * (94 / gsteps.length) && i < gsteps.length - 1) {
          i++;
          st.textContent = gsteps[i];
        }
      }, 240);
      const finish = () => {
        clearInterval(t);
        bar.style.width = "100%";
        setTimeout(() => {
          ov.classList.remove("on");
          busy = false;
          btn.disabled = false;
        }, 320);
      };
      try {
        const image = await toDataUrl((VAR && VAR.src) || srcImg.src, 1100);
        const band = document.querySelector(".bchip.on"),
          grade = document.querySelector("#gradeChips .chip.on");
        const groups = { keep: [], replace: [], remove: [] };
        Object.keys(locks).forEach((o) => {
          (groups[locks[o]] || groups.keep).push(o);
        });
        if (VAR && Array.isArray(VAR.keep)) {
          VAR.keep.forEach((k) => {
            if (k && groups.keep.indexOf(k) < 0) groups.keep.push(k);
          });
        }
        const varNotes = VAR
          ? [VAR.prompt, (document.getElementById("agentNote") || {}).value || null]
              .filter(Boolean)
              .join(" ")
          : (document.getElementById("agentNote") || {}).value || null;
        const r = await renderDesign({
          data: {
            image,
            room_type: (VAR && VAR.room) || currentRoomType(),
            direction:
              (VAR && VAR.styleName) ||
              (document.getElementById("fStyle") || {}).value ||
              "Warm Minimal",
            style_id: currentStyleId(),
            project_type: currentProjectType(),
            tool: activeToolName(),
            preserve_architecture: true,
            intensity: (VAR && VAR.intensity) || (band ? band.querySelector("b").textContent : "Makeover"),
            grade: grade ? grade.textContent : "Retail Grade",
            notes: varNotes || null,
            keep: groups.keep,
            replace: groups.replace,
            remove: groups.remove,
            variation_of: (VAR && VAR.parentPath) || null,
          },
        });
        track("design_rendered", { surface: "studio", room_type: currentRoomType() });
        lastRender = r.image;
        lastRenderPath = await persistRender(r.image, "Your Render");
        cAfter.innerHTML = photo(r.image, "Redesigned space, AI render");
        if (VAR) (window as any).__rdVariationMeta = VAR;
        addRenderVariant(
          r.image,
          (VAR && VAR.styleName) ||
            (document.getElementById("fStyle") || {}).value ||
            "Your Render",
          lastRenderPath,
        );

        setCanvasPhase("");
        markStudioResult();
        finalizeGeneratedDesign(lastRenderPath);


        paintStudioSummary(currentBand());
        window.dispatchEvent(new Event("rd:credits-changed"));
        window.dispatchEvent(new Event("rd:photo"));
        finish();
        cRng.value = 100;
        setC(100);
        setTimeout(() => {
          let v = 100;
          const b2 = setInterval(() => {
            v -= 2.6;
            cRng.value = v;
            setC(v);
            if (v <= 44) clearInterval(b2);
          }, 20);
        }, 600);
      } catch (e) {
        finish();
        setCanvasPhase("error");
        if (!creditGate(e))
          showAlert(
            "Could not render this design. " + ((e && e.message) || "Try again in a moment."),
          );
      }
    });

    /** Clear now means: start a brand new design, back to the welcome state. */
    function startNewDesignFlow() {
      if (STUDIO_SRC === SRC_EMPTY) {
        /* already empty: never add anything to the page, just draw attention */
        clearStudioSource();
        try {
          window.rdStudioStart && window.rdStudioStart();
        } catch (_) {}
        return;
      }
      let m = document.getElementById("newDesignModal");
      if (!m) {
        m = document.createElement("div");
        m.id = "newDesignModal";
        m.className = "up-modal";
        m.innerHTML =
          '<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true">' +
          "<h3>Start A New Design?</h3>" +
          "<p>Your current draft has unsaved changes. Save it before starting over, or discard the changes.</p>" +
          '<div class="up-act"><button class="btn btn-primary" id="ndSave">Save and Start New</button>' +
          '<button class="btn btn-dark" id="ndDiscard">Discard and Start New</button>' +
          '<button class="btn btn-ghost" data-close>Cancel</button></div></div>';
        (document.querySelector(".rd-app") || document.body).appendChild(m);
        m.addEventListener("click", (e) => {
          if (e.target.closest && e.target.closest("[data-close]")) m.classList.remove("on");
        });
        m.querySelector("#ndSave").addEventListener("click", async () => {
          m.classList.remove("on");
          /* Save really saves: the room (and anything generated on it) is
             written to the account, then Studio starts clean. No navigation. */
          try {
            const saved =
              STUDIO_CTX && STUDIO_CTX.roomId
                ? await window.rdStudioBackfill()
                : await openStudioSaveRoom();
            if (!saved && !(STUDIO_CTX && STUDIO_CTX.roomId)) return;
          } catch (_) {
            return;
          }
          window.rdToast && window.rdToast("Room Saved");
          clearStudioSource();
        });

        m.querySelector("#ndDiscard").addEventListener("click", () => {
          m.classList.remove("on");
          clearStudioSource();
        });
      }
      m.classList.add("on");
      lucide.createIcons();
    }
    /* Clear resets only the unsaved setup for the room currently on the canvas.
   It never navigates, never drops the source photo, its room/property context
   or any saved version, and never spends a credit. */
    function setupDirty() {
      if (Object.keys(locks).length) return true;
      const note = document.getElementById("agentNote");
      if (note && note.value.trim()) return true;
      const tool = document.querySelector("#fTool .toolrow.on");
      if (tool && tool.getAttribute("data-tool") !== "Redesign") return true;
      const band = document.querySelector(".bchip.on");
      if (band && band.dataset.b !== "1") return true;
      const grade = document.querySelector("#gradeChips .chip.on");
      if (grade && grade.dataset.g !== "retail") return true;
      const style = document.getElementById("fStyle");
      if (style && style.selectedIndex > 0) return true;
      return false;
    }
    function paintClearBtn() {
      const b = document.getElementById("clearLocks");
      if (!b) return;
      const off = !setupDirty();
      b.disabled = off;
      b.title = off ? "Nothing To Clear" : "Clear Current Setup";
    }
    function resetCanvasSetup() {
      Object.keys(locks).forEach((k) => delete locks[k]);
      document.querySelectorAll(".hot").forEach((h) => (h.className = "hot"));
      mode = "keep";
      document
        .querySelectorAll("[data-mode]")
        .forEach((x) => x.classList.toggle("on", x.dataset.mode === "keep"));
      const note = document.getElementById("agentNote");
      if (note) note.value = "";
      const tool = document.querySelector('#fTool .toolrow[data-tool="Redesign"]');
      if (tool && !tool.classList.contains("on")) tool.click();
      const band = document.querySelector('.bchip[data-b="1"]');
      if (band && !band.classList.contains("on")) band.click();
      const grade = document.querySelector('#gradeChips .chip[data-g="retail"]');
      if (grade && !grade.classList.contains("on")) grade.click();
      const style = document.getElementById("fStyle");
      if (style && style.selectedIndex > 0) {
        style.selectedIndex = 0;
        style.dispatchEvent(new Event("change", { bubbles: true }));
      }
      drawLocks();
      paintClearBtn();
      try {
        window.rdToast && window.rdToast("Setup Cleared");
      } catch (_) {}
    }
    function confirmClearSetup() {
      if (!setupDirty()) {
        resetCanvasSetup();
        return;
      }
      let m = document.getElementById("clearSetupModal");
      if (!m) {
        m = document.createElement("div");
        m.id = "clearSetupModal";
        m.className = "up-modal";
        m.innerHTML =
          '<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true">' +
          "<h3>Clear Current Setup?</h3>" +
          "<p>This will remove your unsaved selections and instructions for this room. Your source photo and saved versions will remain.</p>" +
          '<div class="up-act"><button class="btn btn-dark" id="csKeep">Keep Editing</button>' +
          '<button class="btn btn-primary" id="csGo">Clear Setup</button></div></div>';
        (document.querySelector(".rd-app") || document.body).appendChild(m);
        m.addEventListener("click", (e) => {
          if (e.target.closest && e.target.closest("[data-close]")) m.classList.remove("on");
        });
        m.querySelector("#csKeep").addEventListener("click", () => m.classList.remove("on"));
        m.querySelector("#csGo").addEventListener("click", () => {
          m.classList.remove("on");
          resetCanvasSetup();
        });
      }
      m.classList.add("on");
      lucide.createIcons();
    }
    document.getElementById("clearLocks")?.addEventListener("click", confirmClearSetup);
    document.getElementById("v-studio")?.addEventListener("input", paintClearBtn);
    document
      .getElementById("v-studio")
      ?.addEventListener("click", () => setTimeout(paintClearBtn, 0));
    window.rdPaintClearBtn = paintClearBtn;
    window.rdResetCanvasDesign = resetCanvasSetup;
    paintClearBtn();
    (function () {
      const btn = document.getElementById("newDesignBtn"),
        menu = document.getElementById("createMenu");
      if (!btn) return;
      function close() {
        if (menu) {
          menu.classList.remove("on");
          btn.setAttribute("aria-expanded", "false");
        }
      }
      /* Sibling topbar menus stopPropagation on their own button, so a plain
     document click listener never sees them: expose the close so every other
     menu can dismiss this one and only one popup is ever open. */
      window.rdCloseCreateMenu = close;
      if (!menu) {
        btn.addEventListener("click", () => {
          go("studio");
          startNewDesignFlow();
        });
        return;
      }
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        try {
          closeAcct();
        } catch (_) {}
        try {
          closeSch();
        } catch (_) {}
        try {
          closeHelp();
        } catch (_) {}
        try {
          closeNotif();
        } catch (_) {}
        const open = !menu.classList.contains("on");
        menu.classList.toggle("on", open);
        btn.setAttribute("aria-expanded", String(open));
      });
      document.addEventListener("click", (e) => {
        if (!e.target.closest || !e.target.closest(".create-wrap")) close();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });
      menu.addEventListener("click", (e) => {
        const it = e.target.closest("[data-create]");
        if (!it) return;
        close();
        go("studio");
        try {
          window.rdStudioStart && window.rdStudioStart(it.getAttribute("data-create"));
        } catch (_) {}
      });
    })();

    /** Shown when Generate is pressed with no valid source. No credit is charged. */
    function needSourceModal() {
      let m = document.getElementById("noSrcModal");
      if (!m) {
        m = document.createElement("div");
        m.id = "noSrcModal";
        m.className = "up-modal";
        m.innerHTML =
          '<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true">' +
          "<h3>Add A Source To Continue</h3>" +
          "<p>Upload a photo, sketch or plan\u2014or intentionally choose a sample space.</p>" +
          '<div class="up-act"><button class="btn btn-primary" id="nsUpload"><i data-lucide="image-up"></i>Upload a Source</button>' +
          '<button class="btn btn-ghost" id="nsSample">Try a Sample</button></div></div>';
        (document.querySelector(".rd-app") || document.body).appendChild(m);
        m.addEventListener("click", (e) => {
          if (e.target.closest && e.target.closest("[data-close]")) m.classList.remove("on");
        });
        m.querySelector("#nsUpload").addEventListener("click", () => {
          m.classList.remove("on");
          try {
            window.rdStudioStart && window.rdStudioStart("upload");
          } catch (_) {}
        });
        m.querySelector("#nsSample").addEventListener("click", () => {
          m.classList.remove("on");
          try {
            window.rdStudioStart && window.rdStudioStart("sample");
          } catch (_) {}
        });
      }
      m.classList.add("on");
      lucide.createIcons();
    }

    /* A generated image is only "saved" once it reaches durable storage. When
       the upload fails we keep the preview, say so plainly, and offer a retry
       that re-uploads the SAME image (no second generation, no second charge). */
    let PENDING_SAVE = null;
    /* The persistent version currently shown on the canvas, and whether a save
       is still running. Approval may only ever target a saved version. */
    let DISPLAYED_VERSION = null;
    let VERSION_SAVING = false;
    /** A render that reached storage but whose version row still has to be written. */
    let PENDING_VERSION = null;

    function paintSaveWarn() {
      const w = document.getElementById("studioSaveWarn");
      if (w) w.hidden = !(PENDING_SAVE || PENDING_VERSION);
    }
    function dropPendingSave() {
      PENDING_SAVE = null;
      PENDING_VERSION = null;
      DISPLAYED_VERSION = null;
      paintSaveWarn();
    }
    async function persistRender(image, label) {
      /* One quiet second attempt absorbs a blip; after that we tell the user. */
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const path = await uploadRenderDataUrl(image);
          PENDING_SAVE = null;
          paintSaveWarn();
          return path;
        } catch (err) {
          console.error("[studio] render upload failed (attempt " + (attempt + 1) + ")", err);
          if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
        }
      }
      PENDING_SAVE = { image, label: label || "Your Render" };
      paintSaveWarn();
      window.rdToast && window.rdToast("Your Design Was Generated But Could Not Be Saved");
      return null;
    }

    /* Retry never regenerates and never charges again: it re-uploads the same
       image when storage failed, or writes only the missing version row. */
    async function retryPendingSave() {
      const btn = document.getElementById("studioRetrySave");
      if (!PENDING_SAVE) {
        const path = PENDING_VERSION;
        if (!path) return;
        if (btn) btn.disabled = true;
        PENDING_VERSION = null;
        paintSaveWarn();
        const v = await finalizeGeneratedDesign(path);
        if (btn) btn.disabled = false;
        if (v) window.rdToast && window.rdToast("Design Saved");
        return;
      }
      if (btn) btn.disabled = true;
      const { image, label } = PENDING_SAVE;
      const path = await persistRender(image, label);
      if (btn) btn.disabled = false;
      if (!path) return;
      lastRenderPath = path;
      try {
        const v = SESSION_VERSIONS.find((x) => x && x.src === image);
        if (v) v.path = path;
        const tile = document.querySelector('#vars .var[data-src="' + CSS.escape(image) + '"]');
        if (tile) tile.dataset.path = path;
        paintVersions();
        /* A finished render is what the user wants to inspect next. */
        window.rdInspectorShow && window.rdInspectorShow("versions");
      } catch (_) {}
      window.rdToast && window.rdToast("Design Saved");
      await finalizeGeneratedDesign(path);
      window.dispatchEvent(new Event("rd:saved"));
      window.dispatchEvent(new Event("rd:photo"));
    }

    try {
      const rb = document.getElementById("studioRetrySave");
      rb && rb.addEventListener("click", retryPendingSave);
    } catch (_) {}

    function addRenderVariant(src, label, path) {
      /* Persisting a render is the caller's job (finalizeGeneratedDesign), so
         reopening a saved version never writes a duplicate version row. */

      /* Version History shows this render immediately, before any save. */
      const vmeta = (window as any).__rdVariationMeta || null;
      (window as any).__rdVariationMeta = null;
      try {
        SESSION_VERSIONS.unshift({
          src,
          path: path || null,
          label: label || "Your Render",
          style: ((document.getElementById("fStyle") || {}).value || "").trim() || null,
          at: Date.now(),
          room: activeStudioRoom(),
          /* Branching metadata: a variation always names its parent version. */
          parentAt: vmeta ? vmeta.parentAt || null : null,
          parentSrc: vmeta ? vmeta.parentSrc || vmeta.src || null : null,
          parentPath: vmeta ? vmeta.parentPath || null : null,
          variationStrength: vmeta ? vmeta.strength || null : null,
          variationPrompt: vmeta ? vmeta.prompt || null : null,
          variationLocks: vmeta && Array.isArray(vmeta.keep) ? vmeta.keep.slice() : null,
        });

        paintVersions();
      } catch (_) {}

      const wrap = document.getElementById("vars");
      if (!wrap) return;
      const d = document.createElement("div");
      d.className = "var on";
      d.dataset.src = src;
      if (path) d.dataset.path = path;
      d.innerHTML =
        `<div style="aspect-ratio:8/5">${photo(src, label + " render")}</div>` +
        `<div class="vl">${label}${path ? "" : ' <span class="rd-unsaved">Not Saved</span>'}</div>`;
      wrap.querySelectorAll(".var").forEach((x) => x.classList.remove("on"));
      wrap.prepend(d);
      d.addEventListener("click", () => {
        wrap.querySelectorAll(".var").forEach((x) => x.classList.remove("on"));
        d.classList.add("on");
        cAfter.innerHTML = photo(src, label + " render");
        lastRender = src;
        lastRenderPath = d.dataset.path || null;
      });
    }


    /* ---------- studio tools: 3D plan and walkthrough video ---------- */
    function toolOverlay(steps) {
      const ov = document.getElementById("cGen"),
        bar = document.getElementById("cBar"),
        st = document.getElementById("cStep");
      let p = 0,
        i = 0;
      ov.classList.add("on");
      bar.style.width = "0%";
      st.textContent = steps[0];
      const t = setInterval(() => {
        p = Math.min(p + Math.random() * 4 + 1, 92);
        bar.style.width = p + "%";
        if (p > (i + 1) * (92 / steps.length) && i < steps.length - 1) {
          i++;
          st.textContent = steps[i];
        }
      }, 600);
      return {
        say: (m) => {
          st.textContent = m;
        },
        at: (pct) => {
          p = Math.max(p, Math.min(pct, 96));
          bar.style.width = p + "%";
        },
        done: () => {
          clearInterval(t);
          bar.style.width = "100%";
          setTimeout(() => ov.classList.remove("on"), 320);
        },
      };
    }

    async function run3dPlan() {
      if (busy) return;
      if (!window.rdStudioHasSource()) {
        needSourceModal();
        return;
      }
      if (!ensureCredits(6, "A 3D Plan")) return;
      busy = true;
      const ui = toolOverlay([
        "Reading the room geometry",
        "Building the floor plate",
        "Placing the furniture",
        "Rendering the 3D plan",
      ]);
      try {
        const image = await toDataUrl(lastRender || studioSrc("after"), 1100);
        const r = await renderPlan3d({
          data: {
            image,
            room_type: currentRoomType(),
            direction: (document.getElementById("fStyle") || {}).value || "Warm Minimal",
            floor_area_sf: parseFloat((document.getElementById("scFloor") || {}).value) || null,
          },
        });
        lastRender = r.image;
        lastRenderPath = await persistRender(r.image, "3D Plan");
        cAfter.innerHTML = photo(r.image, "Furnished 3D plan of the same room");
        addRenderVariant(r.image, "3D Plan", lastRenderPath);
        window.dispatchEvent(new Event("rd:credits-changed"));
        ui.done();
      } catch (e) {
        ui.done();
        if (!creditGate(e))
          showToolError("Could not build the 3D plan. " + ((e && e.message) || ""));
      } finally {
        busy = false;
      }
    }

    async function runWalkthrough() {
      if (busy) return;
      if (!window.rdStudioHasSource()) {
        needSourceModal();
        return;
      }
      if (!ensureCredits(40, "A Walkthrough Video")) return;
      busy = true;
      const ui = toolOverlay([
        "Locking the finished render",
        "Queuing the camera move",
        "Rendering the walkthrough",
      ]);
      try {
        const image = await toDataUrl(lastRender || studioSrc("after"), 1100);
        const job = await startWalkthrough({
          data: {
            image,
            room_type: currentRoomType(),
            direction: (document.getElementById("fStyle") || {}).value || "Warm Minimal",
          },
        });
        window.dispatchEvent(new Event("rd:credits-changed"));
        ui.say("Rendering the walkthrough, this takes a minute or two");
        let url = null;
        for (let i = 0; i < 50; i++) {
          await new Promise((res) => setTimeout(res, 6000));
          const s = await pollWalkthrough({ data: { id: job.id } });
          if (s.progress) ui.at(Math.max(20, s.progress));
          if (s.status === "completed" && s.url) {
            url = s.url;
            break;
          }
        }
        ui.done();
        if (!url) throw new Error("The video is taking longer than usual. Check back in a moment.");
        videoModal(url);
      } catch (e) {
        ui.done();
        if (!creditGate(e))
          showToolError("Could not render the walkthrough. " + ((e && e.message) || ""));
      } finally {
        busy = false;
      }
    }

    const ROOM_TOOL_STEPS = {
      stage: [
        "Reading the empty room",
        "Choosing furniture that fits",
        "Placing and lighting the set",
        "Rendering the staged room",
      ],
      declutter: [
        "Reading the room",
        "Marking clutter and personal items",
        "Filling the space naturally",
        "Rendering the clean room",
      ],
      materials: [
        "Reading surfaces and finishes",
        "Selecting the new materials",
        "Matching light and reflection",
        "Rendering the swap",
      ],
      sketch: [
        "Reading the sketch lines",
        "Building the geometry",
        "Applying real materials",
        "Rendering the photo",
      ],
      angle: [
        "Reading room geometry",
        "Moving the virtual camera",
        "Keeping the design consistent",
        "Rendering the new angle",
      ],
    };

    /** Run one of the one-credit Studio room tools against the current canvas image. */
    async function runRoomToolFlow(tool, label, useRender) {
      if (busy) return;
      if (!ensureCredits(1, label)) return;
      busy = true;
      const ui = toolOverlay(ROOM_TOOL_STEPS[tool] || ["Working on the image"]);
      try {
        const base = useRender ? lastRender || studioSrc("after") : studioSrc("before");
        const image = await toDataUrl(base, 1100);
        const grade = document.querySelector("#gradeChips .chip.on");
        const r = await runRoomTool({
          data: {
            tool,
            image,
            room_type: currentRoomType(),
            direction: (document.getElementById("fStyle") || {}).value || "Warm Minimal",
            style_id: currentStyleId(),
            grade: grade ? grade.textContent : "Retail Grade",
            notes: (document.getElementById("agentNote") || {}).value || null,
          },
        });
        lastRender = r.image;
        lastRenderPath = await persistRender(r.image, label || "Your Render");
        cAfter.innerHTML = photo(r.image, label + " result");
        addRenderVariant(r.image, label, lastRenderPath);
        window.dispatchEvent(new Event("rd:credits-changed"));
        ui.done();
        cRng.value = 100;
        setC(100);
        setTimeout(() => {
          let v = 100;
          const b2 = setInterval(() => {
            v -= 2.6;
            cRng.value = v;
            setC(v);
            if (v <= 44) clearInterval(b2);
          }, 20);
        }, 600);
      } catch (e) {
        ui.done();
        if (!creditGate(e))
          showToolError("Could not finish " + label + ". " + ((e && e.message) || ""));
      } finally {
        busy = false;
      }
    }

    function showToolError(msg) {
      const i = document.getElementById("toolInfo");
      if (!i) {
        window.rdToast && window.rdToast(msg);
        return;
      }
      document.getElementById("toolInfoName").textContent = "That Did Not Finish";
      document.getElementById("toolInfoDesc").textContent = msg;
      i.hidden = false;
    }

    function videoModal(url) {
      let m = document.getElementById("vidModal");
      if (!m) {
        m = document.createElement("div");
        m.id = "vidModal";
        m.className = "up-modal";
        m.innerHTML =
          '<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true" style="width:min(720px,calc(100vw - 32px))">' +
          "<h3>Walkthrough Video</h3><p>Eight seconds, dolly in, built from your finished render.</p>" +
          '<video id="vidPlayer" controls playsinline style="width:100%;border-radius:12px;background:#111"></video>' +
          '<a class="btn btn-primary btn-block" id="vidDl" style="margin-top:12px" download="walkthrough.mp4"><i data-lucide="download"></i>Download MP4</a>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:8px" data-close>Close</button></div>';
        (document.querySelector(".rd-app") || document.body).appendChild(m);
        m.addEventListener("click", (e) => {
          if (e.target.hasAttribute && e.target.hasAttribute("data-close")) {
            m.classList.remove("on");
            m.querySelector("#vidPlayer").pause();
          }
        });
      }
      m.querySelector("#vidPlayer").src = url;
      m.querySelector("#vidDl").href = url;
      m.classList.add("on");
      lucide.createIcons();
    }

    async function openInStudio(r) {
      try {
        const beforeUrl = r.before_path ? await resolvePhotoUrl(r.before_path) : null;
        const afterUrl = r.after_path ? await resolvePhotoUrl(r.after_path) : null;
        if (!beforeUrl && !afterUrl) {
          go("studio");
          return;
        }
        STUDIO_CTX = Object.assign(blankStudioCtx(), {
          room: r.name || null,
          address: r.address || null,
          project: r.project_name || null,
          roomId: r.id || null,
          propertyId: r.property_id || null,
          projectId: r.project_id || null,
          sourcePath: r.before_path || null,
        });
        setStudioSource(
          "existing_design",
          beforeUrl || afterUrl,
          "The saved source photo for this design",
          { afterPath: r.after_path || null },
        );
        if (afterUrl) {
          cAfter.innerHTML = photo(afterUrl, "Redesigned space, AI render");
          lastRender = null;
          lastRenderPath = r.after_path || null;
          addRenderVariant(
            afterUrl,
            (r.name || "Saved") + " v" + (r.version_no || 1),
            r.after_path || null,
          );
          markStudioResult();
          cRng.value = 44;
          setC(44);
        }
      } catch (e) {}
      go("studio");
    }

    /* The Studio context always carries the persistent identifiers of the room
       currently on the canvas, so every save updates that same record. */
    function blankStudioCtx() {
      return {
        room: null,
        address: null,
        project: null,
        roomId: null,
        propertyId: null,
        projectId: null,
        sourcePath: null,
      };
    }
    let STUDIO_CTX = blankStudioCtx();

    /* Renders produced in this session appear in Version History right away,
       before any save round-trip completes. */
    const SESSION_VERSIONS = [];
    function activeStudioRoom() {
      const setupRoom = ((document.getElementById("fRoom") || {}).value || "").trim();
      return (STUDIO_CTX && STUDIO_CTX.room) || setupRoom || "";
    }

    /* ---------------- Saved rooms ----------------
       A room is the durable record of the space on the canvas. It can be saved
       before any design exists, and once it is saved every generated version is
       attached to it automatically. */

    /** The stored path of whatever is currently on the canvas, or null. */
    function studioSourcePath() {
      const p =
        (STUDIO_CTX && STUDIO_CTX.sourcePath) ||
        STUDIO_DRAFT_PATH ||
        (typeof window !== "undefined" ? window.rdPendingPhotoPath : null) ||
        null;
      return p && !/^(blob:|data:|https?:)/i.test(String(p)) ? p : null;
    }

    function paintSaveRoomBtn() {
      const b = document.getElementById("stSaveRoom");
      if (!b) return;
      const canSave = STUDIO_SRC !== SRC_EMPTY && !!studioSourcePath();
      b.hidden = STUDIO_SRC === SRC_EMPTY;
      b.disabled = !canSave;
      const saved = !!(STUDIO_CTX && STUDIO_CTX.roomId);
      b.innerHTML =
        '<i data-lucide="' +
        (saved ? "check" : "save") +
        '"></i>' +
        (saved ? "Room Saved" : "Save Room");
      b.setAttribute(
        "data-tt",
        !canSave
          ? "Your Photo Is Still Uploading"
          : saved
            ? "Update This Saved Room"
            : "Store This Photo And Property On Your Account",
      );
      try {
        lucide.createIcons();
      } catch (_) {}
    }

    window.rdDisplayedVersion = () => DISPLAYED_VERSION;
    /* The variation drawer reads the branch record of whatever is on screen. */
    window.rdSessionVersion = (src) =>
      (SESSION_VERSIONS || []).find((v) => v && src && v.src === src) || null;
    window.rdSessionVersions = () => (SESSION_VERSIONS || []).slice();
    window.rdStudioSourceImage = () => {
      const i = document.querySelector("#cBefore img");
      return (i && i.src) || null;
    };
    /* Compare against a chosen base (parent version or the original photo). */
    window.rdSetCompareBase = (src) => {
      const b = document.getElementById("cBefore");
      if (!b || !src) return false;
      b.innerHTML = photo(src, "Comparison base");
      return true;
    };
    window.rdVersionSaving = () => VERSION_SAVING;


    /** Intensity and finish grade exactly as the user set them. */
    function currentBandLabel() {
      const b = document.querySelector(".bchip.on b");
      return b ? b.textContent.trim() : null;
    }
    function currentGradeLabel() {
      const g = document.querySelector("#gradeChips .chip.on");
      return g ? g.textContent.trim() : null;
    }

    /** Approval only ever offers itself for a version that already exists. */
    function paintApproveBtn() {
      const b = document.getElementById("stApprove");
      if (!b) return;
      const unsaved = VERSION_SAVING || (!!lastRenderPath && !DISPLAYED_VERSION) || !!PENDING_VERSION;
      b.disabled = !!VERSION_SAVING;
      b.setAttribute(
        "data-tt",
        VERSION_SAVING
          ? "This Design Is Still Saving"
          : unsaved
            ? "Save This Version Before Approving"
            : DISPLAYED_VERSION
              ? "Approve Version " + DISPLAYED_VERSION.version_no
              : "Approve The Latest Saved Version",
      );
    }
    window.rdPaintApproveBtn = paintApproveBtn;


    /** Paints "Saving…" / "Saved as Version N" on the tile for one render. */
    function paintVersionBadge(path, text, cls) {
      if (!path) return;
      try {
        const tile = document.querySelector('#vars .var[data-path="' + CSS.escape(path) + '"]');
        const lab = tile && tile.querySelector(".vl");
        if (!lab) return;
        const mark = lab.querySelector(".rd-unsaved,.rd-vsave");
        if (mark) mark.remove();
        if (!text) return;
        const s = document.createElement("span");
        s.className = cls || "rd-vsave";
        s.textContent = text;
        lab.appendChild(document.createTextNode(" "));
        lab.appendChild(s);
      } catch (_) {}
    }

    /** Attaches one generated image to the saved room, if there is one. */
    async function attachVersionToRoom(afterPath) {
      const roomId = STUDIO_CTX && STUDIO_CTX.roomId;
      const before = studioSourcePath();
      if (!roomId || !afterPath || !before) return null;
      VERSION_SAVING = true;
      paintVersionBadge(afterPath, "Saving…");
      paintApproveBtn();
      try {
        const v = await saveStudioVersion({
          data: {
            room_id: roomId,
            before_path: before,
            after_path: afterPath,
            style: currentStyleId ? String(currentStyleId() || "") || null : null,
            intensity: currentBandLabel ? currentBandLabel() : null,
            grade: currentGradeLabel ? currentGradeLabel() : null,
            settings: {
              tool: activeToolName(),
              notes: (document.getElementById("agentNote") || {}).value || null,
              room_type: currentRoomType(),
            },
          },
        });
        paintVersionBadge(afterPath, "Saved As Version " + v.version_no, "rd-vsaved");
        if (afterPath === lastRenderPath)
          DISPLAYED_VERSION = { id: v.id, version_no: v.version_no, path: afterPath };
        /* The temporary draft may retire only now: durable image + version row. */
        try {
          await clearStudioDraft();
        } catch (_) {}
        window.dispatchEvent(new Event("rd:saved"));
        window.rdRefreshOnboarding && window.rdRefreshOnboarding();
        return v;
      } catch (e) {
        console.error("[studio] version save failed", e);
        paintVersionBadge(afterPath, "Not Saved", "rd-unsaved");
        window.rdToast && window.rdToast("Could Not Save That Version. Use Retry Save.");
        PENDING_VERSION = afterPath;
        paintSaveWarn();
        return null;
      } finally {
        VERSION_SAVING = false;
        paintApproveBtn();
      }
    }

    /** Saves everything already on the canvas against the room record. */
    async function backfillRoomVersions() {
      if (!STUDIO_CTX || !STUDIO_CTX.roomId) return;
      const seen = new Set();
      for (const v of SESSION_VERSIONS || []) {
        if (!v || !v.path || seen.has(v.path)) continue;
        seen.add(v.path);
        await attachVersionToRoom(v.path);
      }
      if (lastRenderPath && !seen.has(lastRenderPath)) await attachVersionToRoom(lastRenderPath);
    }

    /**
     * The one lifecycle a finished render follows.
     *
     * With a saved room the version is written immediately; without one the
     * Save Room dialog opens over the visible result and the version is written
     * as soon as the room exists. Nothing is discarded on failure.
     */
    async function finalizeGeneratedDesign(afterPath) {
      if (!afterPath) return null; /* upload failed: Retry Save owns this case */
      if (STUDIO_CTX && STUDIO_CTX.roomId) return attachVersionToRoom(afterPath);
      const saved = await openStudioSaveRoom();
      if (!saved) {
        window.rdToast && window.rdToast("Save This Room To Keep The Design");
        return null;
      }
      return DISPLAYED_VERSION;
    }
    window.rdFinalizeGeneratedDesign = (p) => finalizeGeneratedDesign(p);


    async function openStudioSaveRoom() {
      const path = studioSourcePath();
      if (!path) {
        window.rdToast && window.rdToast("Your Photo Is Still Uploading");
        return null;
      }
      const saved = await openSaveRoomModal({
        sourcePath: path,
        roomName: activeStudioRoom() || null,
        roomType: activeStudioRoom() || null,
        address: (STUDIO_CTX && STUDIO_CTX.address) || null,
        roomId: (STUDIO_CTX && STUDIO_CTX.roomId) || null,
        propertyId: (STUDIO_CTX && STUDIO_CTX.propertyId) || null,
        projectId: (STUDIO_CTX && STUDIO_CTX.projectId) || null,
      });
      if (!saved) return null;
      STUDIO_CTX.roomId = saved.room_id;
      STUDIO_CTX.propertyId = saved.property_id;
      STUDIO_CTX.projectId = saved.project_id;
      STUDIO_CTX.room = saved.room_name;
      STUDIO_CTX.address = saved.address;
      STUDIO_CTX.sourcePath = saved.source_path;
      paintSaveRoomBtn();
      try {
        const f = document.getElementById("fRoom");
        if (f && saved.room_name) f.value = saved.room_name;
      } catch (_) {}
      /* Anything already generated belongs to this room too. */
      await backfillRoomVersions();
      window.rdRefreshOnboarding && window.rdRefreshOnboarding();
      return saved;
    }
    window.rdStudioSaveRoom = () => openStudioSaveRoom();
    window.rdStudioBackfill = () => backfillRoomVersions();

    /** Starts a clean Studio session for saving a brand new room. */
    window.rdStudioNewRoom = () => {
      try {
        clearStudioSource();
      } catch (_) {}
      paintSaveRoomBtn();
    };
    try {
      const sr = document.getElementById("stSaveRoom");
      sr && sr.addEventListener("click", () => openStudioSaveRoom());
      paintSaveRoomBtn();
    } catch (_) {}


    async function paintVersions() {
      const el = document.getElementById("verList");
      if (!el) return;
      const sub = document.querySelector("#v-studio .right .card:last-child .card-h .sub");
      if (!el.innerHTML.trim()) el.innerHTML = skList(3);
      let list = [];
      try {
        list = await listSavedEstimates();
      } catch (e) {
        list = [];
      }
      SAVED_EST = list;
      updateSearchMeta();
      /* only the active room's real versions, never an unrelated project's history.
     The room comes from the opened design when there is one, otherwise from the
     Setup room selector, so a design started from an upload still shows history. */
      const setupRoom = ((document.getElementById("fRoom") || {}).value || "").trim();
      const activeRoom = (STUDIO_CTX && STUDIO_CTX.room) || setupRoom || "";
      const norm = (s) =>
        String(s || "")
          .trim()
          .toLowerCase();
      if (activeRoom) list = list.filter((v) => norm(v.room_name) === norm(activeRoom));
      else list = [];
      if (sub) sub.textContent = activeRoom || "This Design";

      list = list.slice(0, 6);
      const norm2 = norm;
      const session = SESSION_VERSIONS.filter(
        (v) => !activeRoom || !v.room || norm2(v.room) === norm2(activeRoom),
      ).slice(0, 6);
      if (!list.length && !session.length) {
        el.innerHTML =
          '<div style="padding:6px 0"><b style="font-size:.85rem">No Versions Yet</b>' +
          '<p style="font-size:.78rem;color:var(--mute-2);margin-top:4px">Your generated and approved versions will appear here.</p></div>';
        return;
      }
      const ago = (iso) => {
        const s = (Date.now() - new Date(iso).getTime()) / 1000;
        if (s < 90) return "just now";
        if (s < 5400) return Math.round(s / 60) + "m ago";
        if (s < 172800) return Math.round(s / 3600) + "h ago";
        return Math.round(s / 86400) + "d ago";
      };
      /* A version is numbered, never named after the tool that made it. The
         tool and style are secondary metadata under the number. */
      const savedCount = list.length;
      const numberOf = (v) => savedCount + (session.length - session.indexOf(v));
      const sessionHTML = session
        .map((v, i) => {
          const no = savedCount + (session.length - i);
          const meta = [v.label, v.style].filter(Boolean).join(" \u00b7 ");
          const when = ago(new Date(v.at).toISOString());
          /* A variation reads as a child of the version it branched from. */
          const parent = v.parentAt
            ? session.find((x) => x && x.at === v.parentAt) ||
              session.find((x) => x && v.parentSrc && x.src === v.parentSrc)
            : null;
          const from = parent ? " &middot; From V" + numberOf(parent) : v.parentAt ? " &middot; Variation" : "";
          const sub = (v.path ? meta + " &middot; " + when : meta + " &middot; Saving\u2026") + from;
          return (
            `<button type="button" class="ver-row" data-vi="${i}"><span class="ver-th">${photo(v.src, "Version " + no)}</span>` +
            `<span class="rowt"><b>Version ${no}</b><span>${sub}</span></span>` +
            `<span class="pill ${v.path ? (i === 0 ? "p-ok" : "p-gray") : "p-amb"}">${v.path ? (i === 0 ? "Latest" : "Past") : "Saving"}</span></button>`
          );
        })
        .join("");


      el.innerHTML =
        sessionHTML +
        list
          .map((v, i) => {
            const st =
              v.status === "approved"
                ? ["p-ok", "Live"]
                : v.status === "review"
                  ? ["p-amb", "Review"]
                  : ["p-gray", !session.length && i === 0 ? "Latest" : "Past"];
            const lab =
              (v.status || "draft").charAt(0).toUpperCase() + (v.status || "draft").slice(1);
            return `<div class="rowi" style="padding:9px 0"><div class="rowt"><b>Version ${v.version_no || 1}</b><span>${v.room_name} &middot; ${lab} &middot; ${ago(v.created_at)}</span></div><span class="pill ${st[0]}">${st[1]}</span></div>`;
          })
          .join("");
      /* Approve always names the version actually on the canvas. */
      const setApproveLabel = (no) => {
        const ap = document.getElementById("stApprove");
        if (ap && !ap.dataset.approved)
          ap.innerHTML = '<i data-lucide="check"></i>Approve Version ' + no;
        try {
          lucide.createIcons();
        } catch (_) {}
      };
      if (session.length) setApproveLabel(savedCount + session.length);
      else if (list.length) setApproveLabel(list[0].version_no || 1);

      el.querySelectorAll(".ver-row").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = +btn.dataset.vi;
          const v = session[i];
          if (!v || !cAfter) return;
          el.querySelectorAll(".ver-row").forEach((x) => x.classList.remove("on"));
          btn.classList.add("on");
          cAfter.innerHTML = photo(v.src, "Version " + (savedCount + (session.length - i)));
          lastRender = v.src;
          lastRenderPath = v.path || null;
          setApproveLabel(savedCount + (session.length - i));
        });
      });
    }



    paintVersions();
    window.addEventListener("rd:saved", paintVersions);
    document.getElementById("fRoom")?.addEventListener("change", () => {
      paintVersions();
    });

    /* ---------- designs: real saved versions plus sample gallery ---------- */
    let DESIGN_FILTER = "all",
      DESIGN_CAT = "all",
      DESIGN_Q = "",
      DESIGN_SORT = "recent";
    let DESIGN_FAVONLY = false,
      DESIGN_SELMODE = false;
    let DESIGN_SEL = [];
    const ST_PILL = (s) =>
      s === "approved"
        ? ["p-ok", "Approved"]
        : s === "review"
          ? ["p-amb", "In Review"]
          : s === "archived"
            ? ["p-gray", "Archived"]
            : ["p-gray", "Draft"];

    const DG_CATS = [
      ["all", "All"],
      ["kitchen", "Kitchen"],
      ["bath", "Bath"],
      ["living", "Living"],
      ["bedroom", "Bedroom"],
      ["office", "Office"],
      ["exterior", "Exterior"],
      ["outdoor", "Outdoor"],
    ];
    function dgCat(t) {
      const s = String(t || "").toLowerCase();
      if (s.indexOf("kitchen") > -1) return "kitchen";
      if (s.indexOf("bath") > -1) return "bath";
      if (s.indexOf("living") > -1 || s.indexOf("family") > -1 || s.indexOf("great") > -1)
        return "living";
      if (s.indexOf("bed") > -1) return "bedroom";
      if (s.indexOf("office") > -1 || s.indexOf("study") > -1) return "office";
      if (
        s.indexOf("exterior") > -1 ||
        s.indexOf("facade") > -1 ||
        s.indexOf("front") > -1 ||
        s.indexOf("curb") > -1
      )
        return "exterior";
      if (
        s.indexOf("yard") > -1 ||
        s.indexOf("landscape") > -1 ||
        s.indexOf("patio") > -1 ||
        s.indexOf("pool") > -1
      )
        return "outdoor";
      return "living";
    }
    const DG_SAMPLES = [
      {
        id: "sm-k1",
        name: "Kitchen, Warm Minimal",
        cat: "kitchen",
        status: "approved",
        img: PHOTOS.kitchenAfter,
        note: "Shaker fronts, quartz, warm brass",
      },
      {
        id: "sm-k2",
        name: "Kitchen, Modern Farmhouse",
        cat: "kitchen",
        status: "review",
        img: PHOTOS.farmhouse,
        note: "Painted island, apron sink",
      },
      {
        id: "sm-b1",
        name: "Primary Bath, Spa Neutral",
        cat: "bath",
        status: "approved",
        img: PHOTOS.bath,
        note: "Porcelain tile, floating vanity",
      },
      {
        id: "sm-b2",
        name: "Guest Bath, Luxury Stone",
        cat: "bath",
        status: "draft",
        img: PHOTOS.luxury,
        note: "Stone slab, matte black trim",
      },
      {
        id: "sm-l1",
        name: "Living Room, Warm Minimal",
        cat: "living",
        status: "approved",
        img: PHOTOS.after,
        note: "Oak floors, linen seating",
      },
      {
        id: "sm-l2",
        name: "Living Room, Midcentury",
        cat: "living",
        status: "review",
        img: PHOTOS.midcentury,
        note: "Walnut, low profile seating",
      },
      {
        id: "sm-l3",
        name: "Living Room, Japandi",
        cat: "living",
        status: "archived",
        img: PHOTOS.japandi,
        note: "Pale wood, quiet palette",
      },
      {
        id: "sm-d1",
        name: "Primary Bedroom, Soft Modern",
        cat: "bedroom",
        status: "approved",
        img: PHOTOS.bedroomAfter,
        note: "Layered neutrals, wide plank",
      },
      {
        id: "sm-d2",
        name: "Guest Bedroom, Investor Neutral",
        cat: "bedroom",
        status: "draft",
        img: PHOTOS.neutral,
        note: "Rental grade, durable finishes",
      },
      {
        id: "sm-o1",
        name: "Home Office, Focus Studio",
        cat: "office",
        status: "review",
        img: PHOTOS.officeAfter,
        note: "Built in desk, warm task light",
      },
      {
        id: "sm-e1",
        name: "Facade, Fresh Curb Appeal",
        cat: "exterior",
        status: "approved",
        img: PHOTOS.exteriorAfter,
        note: "New paint, lighting, planting",
      },
      {
        id: "sm-e2",
        name: "Facade, Painted Brick",
        cat: "exterior",
        status: "review",
        img: PHOTOS.paintedBrick,
        note: "Limewash brick, black windows",
      },
      {
        id: "sm-e3",
        name: "Facade, Craftsman Revival",
        cat: "exterior",
        status: "archived",
        img: PHOTOS.craftsman,
        note: "Tapered columns, warm stain",
      },
      {
        id: "sm-y1",
        name: "Backyard, Resort Yard",
        cat: "outdoor",
        status: "approved",
        img: PHOTOS.yardAfter,
        note: "Turf, pavers, evening lighting",
      },
      {
        id: "sm-y2",
        name: "Backyard, Shade Lounge",
        cat: "outdoor",
        status: "draft",
        img: PHOTOS.resortYard,
        note: "Pergola, gravel, native planting",
      },
    ];

    const DG_FAV_KEY = "rd.designFavs",
      DG_HIDE_KEY = "rd.designSampleHidden";
    function dgRead(k) {
      try {
        const v = JSON.parse(localStorage.getItem(k) || "[]");
        return Array.isArray(v) ? v : [];
      } catch (e) {
        return [];
      }
    }
    function dgWrite(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    }
    let DG_FAVS = dgRead(DG_FAV_KEY),
      DG_HIDDEN = dgRead(DG_HIDE_KEY);
    function isFav(id) {
      return DG_FAVS.indexOf(String(id)) > -1;
    }
    function toggleFav(id, on) {
      const s = String(id),
        i = DG_FAVS.indexOf(s);
      const want = on === undefined ? i < 0 : !!on;
      if (want && i < 0) DG_FAVS.push(s);
      if (!want && i > -1) DG_FAVS.splice(i, 1);
      dgWrite(DG_FAV_KEY, DG_FAVS);
    }

    function designItems() {
      const all = [];
      PROP_TREE.forEach((p) =>
        p.projects.forEach((pr) =>
          pr.rooms.forEach((r) =>
            all.push({
              id: String(r.id),
              version_id: r.version_id,
              sample: false,
              name: r.name,
              version_no: r.version_no || 1,
              status: r.status || "draft",
              cat: dgCat(r.room_type || r.name),
              path: r.after_path || r.before_path || "",
              sub: p.address,
              total_low: r.total_low,
              total_high: r.total_high,
              room: { ...r, address: p.address, project: pr.name },
            }),
          ),
        ),
      );
      const samples = DG_SAMPLES.filter((s) => DG_HIDDEN.indexOf(s.id) < 0).map((s) => ({
        id: s.id,
        version_id: null,
        sample: true,
        name: s.name,
        version_no: 1,
        status: s.status,
        cat: s.cat,
        path: s.img,
        sub: s.note,
        total_low: null,
        total_high: null,
      }));
      return all.concat(samples);
    }
    function designFiltered() {
      const q = DESIGN_Q.trim().toLowerCase();
      let list = designItems().filter((d) => {
        if (DESIGN_FILTER === "approved" && d.status !== "approved") return false;
        if (DESIGN_FILTER === "review" && d.status !== "review") return false;
        if (DESIGN_FILTER === "archived" && d.status !== "archived") return false;
        if (DESIGN_CAT !== "all" && d.cat !== DESIGN_CAT) return false;
        if (DESIGN_FAVONLY && !isFav(d.id)) return false;
        if (q && (d.name + " " + (d.sub || "")).toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      if (DESIGN_SORT === "name") list.sort((a, b) => a.name.localeCompare(b.name));
      else if (DESIGN_SORT === "cost")
        list.sort((a, b) => (b.total_high || 0) - (a.total_high || 0));
      return list;
    }

    function dgCard(d) {
      const s = ST_PILL(d.status);
      const cost = d.sample
        ? d.sub
        : d.total_low != null
          ? kfmt(d.total_low) + " to " + kfmt(d.total_high)
          : "Not priced yet";
      const sel = DESIGN_SEL.indexOf(d.id) > -1;
      const fav = isFav(d.id);
      return `<div class="card dg-card${sel ? " sel" : ""}" data-card="${d.id}"><div class="dg-thumb">
<img data-photo="${d.path}" alt="${d.name}" style="width:100%;height:100%;object-fit:cover" hidden>
<div class="dg-ov l${DESIGN_SELMODE || sel ? " show" : ""}"><button class="dg-ob chk${sel ? " on" : ""}" data-pick="${d.id}" aria-label="Select design" title="Select"><i data-lucide="${sel ? "check" : "square"}"></i></button></div>
<div class="dg-ov r"><button class="dg-ob${fav ? " fav" : ""}" data-fav="${d.id}" aria-label="Favorite" title="${fav ? "Remove From Favorites" : "Add To Favorites"}"><i data-lucide="heart"></i></button>
<button class="dg-ob del" data-del="${d.id}" aria-label="Delete design" title="Delete"><i data-lucide="trash-2"></i></button></div>
${d.sample ? '<span class="pill dg-sample">Sample</span>' : ""}</div>
<div class="dg-body"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
<b style="font-size:.86rem">${d.name}${d.sample ? "" : " v" + d.version_no}</b><span class="pill ${s[0]}">${s[1]}</span></div>
<div class="mono" style="font-size:.7rem;color:var(--mute-2);margin-top:5px">${d.sample ? "Sample Design" : d.sub} &middot; ${cost}</div>
<div class="dg-acts">${
        d.sample
          ? `<button class="btn btn-ghost btn-xs" style="flex:1" data-goto="studio">Try This Style</button>`
          : `<button class="btn btn-ghost btn-xs" style="flex:1" data-open="${d.id}">Open</button>
<button class="btn btn-ghost btn-xs" data-hist="${d.id}" title="Version History"><i data-lucide="history"></i></button>`
      }
<button class="btn btn-ghost btn-xs" data-shop="${d.id}" title="Shop This Design"><i data-lucide="shopping-bag"></i></button><button class="btn btn-ghost btn-xs" data-vid="${d.id}" title="Turn Into Video" aria-label="Turn ${esc(d.name)} into a video"><i data-lucide="clapperboard"></i></button><button class="btn btn-ghost btn-xs" data-dl="${d.id}" title="Download Image"><i data-lucide="download"></i></button></div></div></div>`;
    }

    function paintDesignChrome() {
      const cats = document.getElementById("designCats");
      if (cats && !cats.dataset.built) {
        cats.dataset.built = "1";
        cats.innerHTML = DG_CATS.map(
          (c) =>
            `<button data-cat="${c[0]}"${c[0] === DESIGN_CAT ? ' class="on"' : ""}>${c[1]}</button>`,
        ).join("");
        cats.querySelectorAll("[data-cat]").forEach((b) =>
          b.addEventListener("click", () => {
            DESIGN_CAT = b.getAttribute("data-cat");
            cats.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
            paintDesigns();
          }),
        );
      }
      const bulk = document.getElementById("designBulk");
      if (bulk) bulk.classList.toggle("on", DESIGN_SELMODE || DESIGN_SEL.length > 0);
      const cnt = document.getElementById("dgCount");
      if (cnt) cnt.textContent = DESIGN_SEL.length + " Selected";
    }

    function paintDesigns() {
      const g = document.getElementById("designGrid");
      if (!g) return;
      const list = designFiltered();
      const ids = list.map((d) => d.id);
      DESIGN_SEL = DESIGN_SEL.filter((id) => ids.indexOf(id) > -1);
      paintDesignChrome();
      if (!list.length) {
        g.innerHTML =
          '<p style="font-size:.79rem;color:var(--mute-2)">' +
          (DESIGN_FAVONLY
            ? "No Favorites In This View Yet. Tap The Heart On Any Design."
            : "No Designs Match This View Yet. Upload A Photo In Studio, Price It, Then Save It.") +
          "</p>";
        return;
      }
      const mine = list.filter((d) => !d.sample),
        samples = list.filter((d) => d.sample);
      g.innerHTML =
        mine.map(dgCard).join("") +
        (samples.length
          ? `<div class="dg-head" style="grid-column:1/-1"><b>Sample Designs</b><span>Examples you can explore, they do not use credits</span></div>` +
            samples.map(dgCard).join("")
          : "");
      lucide.createIcons();
      g.querySelectorAll("[data-photo]").forEach(async (img) => {
        const p = img.getAttribute("data-photo");
        if (!p) return;
        const url = await resolvePhotoUrl(p);
        if (url) {
          img.src = url;
          img.hidden = false;
        }
      });
      g.querySelectorAll("[data-goto]").forEach((b) =>
        b.addEventListener("click", () => go(b.dataset.goto)),
      );
      g.querySelectorAll("[data-open]").forEach((b) =>
        b.addEventListener("click", () => {
          const d = list.find((x) => x.id === b.getAttribute("data-open"));
          if (d && d.room) openInStudio(d.room);
        }),
      );
      g.querySelectorAll("[data-hist]").forEach((b) =>
        b.addEventListener("click", () => {
          const d = list.find((x) => x.id === b.getAttribute("data-hist"));
          if (d && d.room) openHistory(d.room);
        }),
      );
      g.querySelectorAll("[data-fav]").forEach((b) =>
        b.addEventListener("click", () => {
          toggleFav(b.getAttribute("data-fav"));
          paintDesigns();
        }),
      );
      g.querySelectorAll("[data-pick]").forEach((b) =>
        b.addEventListener("click", () => {
          const id = b.getAttribute("data-pick"),
            i = DESIGN_SEL.indexOf(id);
          if (i > -1) DESIGN_SEL.splice(i, 1);
          else DESIGN_SEL.push(id);
          paintDesigns();
        }),
      );
      g.querySelectorAll("[data-del]").forEach((b) =>
        b.addEventListener("click", () => {
          const d = list.find((x) => x.id === b.getAttribute("data-del"));
          if (d) removeDesigns([d]);
        }),
      );
      const toast = (m) => {
        try {
          (window as any).rdToast
            ? (window as any).rdToast(m)
            : (window as any).__rdToast && (window as any).__rdToast(m);
        } catch (_) {}
      };
      g.querySelectorAll("[data-vid]").forEach((b) =>
        b.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = b.getAttribute("data-vid");
          const d = list.find((x) => x.id === id);
          if (!d) {
            toast("That design could not be found. Refresh and try again.");
            return;
          }
          if (!d.path) {
            toast("That design has no image yet, so it cannot be turned into a video.");
            return;
          }
          if (b.dataset.busy === "1") return;
          b.dataset.busy = "1";
          b.classList.add("is-busy");
          b.setAttribute("aria-busy", "true");
          const old = b.innerHTML;
          b.innerHTML = '<i data-lucide="loader-2" class="spin"></i>';
          try {
            lucide.createIcons();
          } catch (_) {}
          try {
            await startDesignVideo(d);
          } catch (err) {
            toast(
              (err && err.message) || "The video workspace could not be opened. Please try again.",
            );
          } finally {
            b.dataset.busy = "";
            b.classList.remove("is-busy");
            b.removeAttribute("aria-busy");
            b.innerHTML = old;
            try {
              lucide.createIcons();
            } catch (_) {}
          }
        }),
      );
      g.querySelectorAll("[data-shop]").forEach((b) =>
        b.addEventListener("click", () => {
          const d = list.find((x) => x.id === b.getAttribute("data-shop"));
          if (d && window.rdShopDesign) window.rdShopDesign(d);
        }),
      );
      g.querySelectorAll("[data-dl]").forEach((b) =>
        b.addEventListener("click", async () => {
          const d = list.find((x) => x.id === b.getAttribute("data-dl"));
          if (!d || !d.path) return;
          const url = await resolvePhotoUrl(d.path);
          if (!url) return;
          const a = document.createElement("a");
          a.href = url;
          a.download = d.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".jpg";
          a.target = "_blank";
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }),
      );
    }

    async function removeDesigns(items) {
      if (!items.length) return;
      const real = items.filter((d) => !d.sample && d.version_id);
      const label = items.length === 1 ? "this design" : items.length + " designs";
      if (
        real.length &&
        !window.confirm("Delete " + label + "? Saved versions are removed permanently.")
      )
        return;
      items
        .filter((d) => d.sample)
        .forEach((d) => {
          if (DG_HIDDEN.indexOf(d.id) < 0) DG_HIDDEN.push(d.id);
        });
      dgWrite(DG_HIDE_KEY, DG_HIDDEN);
      items.forEach((d) => {
        const i = DESIGN_SEL.indexOf(d.id);
        if (i > -1) DESIGN_SEL.splice(i, 1);
      });
      if (real.length) {
        try {
          await deleteVersions({ data: { version_ids: real.map((d) => d.version_id) } });
          window.dispatchEvent(new Event("rd:saved"));
        } catch (e) {
          console.error("[designs] bulk delete failed", e);
          window.rdToast && window.rdToast("We Couldn't Delete Those Designs. Please Try Again.");
        }
      }
      paintDesigns();
    }

    async function bulkDesigns(action) {
      const list = designFiltered().filter((d) => DESIGN_SEL.indexOf(d.id) > -1);
      if (!list.length) return;
      if (action === "favorite") {
        const on = !list.every((d) => isFav(d.id));
        list.forEach((d) => toggleFav(d.id, on));
        paintDesigns();
        return;
      }
      if (action === "delete") {
        await removeDesigns(list);
        return;
      }
      if (action === "download") {
        for (const d of list) {
          if (!d.path) continue;
          const url = await resolvePhotoUrl(d.path);
          if (!url) continue;
          const a = document.createElement("a");
          a.href = url;
          a.download = d.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".jpg";
          a.target = "_blank";
          a.rel = "noopener";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        return;
      }
      const real = list.filter((d) => !d.sample && d.version_id);
      if (real.length) {
        try {
          await setVersionStatusBulk({
            data: { version_ids: real.map((d) => d.version_id), status: action },
          });
          window.dispatchEvent(new Event("rd:saved"));
        } catch (e) {
          console.error("[designs] bulk status update failed", e);
          window.rdToast && window.rdToast("We Couldn't Update Those Designs. Please Try Again.");
        }
      }
      DESIGN_SEL = [];
      paintDesigns();
    }

    (function wireDesignChrome() {
      const q = document.getElementById("designSearch");
      if (q)
        q.addEventListener("input", () => {
          DESIGN_Q = q.value || "";
          paintDesigns();
        });
      const so = document.getElementById("designSort");
      if (so)
        so.addEventListener("change", () => {
          DESIGN_SORT = so.value;
          paintDesigns();
        });
      const fav = document.getElementById("designFav");
      if (fav)
        fav.addEventListener("click", () => {
          DESIGN_FAVONLY = !DESIGN_FAVONLY;
          fav.classList.toggle("on", DESIGN_FAVONLY);
          paintDesigns();
        });
      const selBtn = document.getElementById("designSelect");
      if (selBtn)
        selBtn.addEventListener("click", () => {
          DESIGN_SELMODE = !DESIGN_SELMODE;
          selBtn.classList.toggle("on", DESIGN_SELMODE);
          if (!DESIGN_SELMODE) DESIGN_SEL = [];
          paintDesigns();
        });
      const all = document.getElementById("dgAll");
      if (all)
        all.addEventListener("click", () => {
          DESIGN_SEL = designFiltered().map((d) => d.id);
          paintDesigns();
        });
      const none = document.getElementById("dgNone");
      if (none)
        none.addEventListener("click", () => {
          DESIGN_SEL = [];
          paintDesigns();
        });
      document
        .querySelectorAll("[data-bulk]")
        .forEach((b) =>
          b.addEventListener("click", () => bulkDesigns(b.getAttribute("data-bulk"))),
        );
    })();

    /* ---------- version history for one room ---------- */
    let HIST_ROOM = null,
      HIST_LIST = [];
    function histModal() {
      let m = document.getElementById("histModal");
      if (!m) {
        m = document.createElement("div");
        m.id = "histModal";
        m.className = "up-modal";
        m.innerHTML =
          '<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true" style="max-width:560px">' +
          '<h3 id="hmTitle">Version History</h3><p id="hmSub"></p><div id="hmBody"></div>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:10px" data-close>Close</button></div>';
        (document.querySelector(".rd-app") || document.body).appendChild(m);
        m.addEventListener("click", (e) => {
          if (e.target.hasAttribute && e.target.hasAttribute("data-close"))
            m.classList.remove("on");
        });
      }
      return m;
    }
    let HIST_SEL = [];
    async function openHistory(r) {
      HIST_ROOM = r;
      HIST_SEL = [];
      const m = histModal();
      m.querySelector("#hmTitle").textContent = r.name + " \u2014 Version History";
      m.querySelector("#hmSub").textContent = r.address + " \u00b7 " + r.project;
      m.querySelector("#hmBody").innerHTML = skLines(3);
      m.classList.add("on");
      try {
        HIST_LIST = await listRoomVersions({ data: { room_id: r.id } });
      } catch (e) {
        HIST_LIST = [];
      }
      paintHistory();
    }
    function paintHistory() {
      const m = histModal(),
        body = m.querySelector("#hmBody");
      if (!HIST_LIST.length) {
        body.innerHTML =
          '<p style="font-size:.79rem;color:var(--mute-2)">No Saved Versions On This Room Yet.</p>';
        return;
      }
      body.innerHTML =
        HIST_LIST.map((v, i) => {
          const st = ST_PILL(v.status);
          const cost =
            v.total_low != null ? kfmt(v.total_low) + " to " + kfmt(v.total_high) : "Not priced";
          const when = new Date(v.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });
          return `<div class="rowi" style="padding:10px 0;align-items:center;gap:10px">
<img data-hphoto="${v.after_path || v.before_path || ""}" alt="" style="width:52px;height:38px;object-fit:cover;border-radius:6px;background:#EFEDE8" hidden>
<div class="rowt" style="flex:1"><b>v${v.version_no}${i === 0 ? " \u00b7 Latest" : ""}</b><span class="mono">${cost} \u00b7 ${when}${v.style ? " \u00b7 " + v.style : ""}</span></div>
<span class="pill ${st[0]}">${st[1]}</span>
<button class="btn btn-ghost btn-xs" data-hopen="${v.id}">Open</button>
<button class="btn btn-ghost btn-xs" data-happ="${v.id}">${v.status === "approved" ? "Unapprove" : "Approve"}</button>
<label style="display:flex;align-items:center;gap:4px;font-size:.72rem;color:var(--mute-2)"><input type="checkbox" data-hcmp="${v.id}" ${HIST_SEL.indexOf(v.id) > -1 ? "checked" : ""}>Compare</label></div>`;
        }).join("") +
        `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px">
<span style="font-size:.75rem;color:var(--mute-2)">${HIST_SEL.length} of 2 selected</span>
<button class="btn btn-primary btn-xs" id="hmCmp" ${HIST_SEL.length === 2 ? "" : "disabled"}>Compare Versions</button></div>`;
      body.querySelectorAll("[data-hphoto]").forEach(async (img) => {
        const p = img.getAttribute("data-hphoto");
        if (!p) return;
        const url = await resolvePhotoUrl(p);
        if (url) {
          img.src = url;
          img.hidden = false;
        }
      });
      body.querySelectorAll("[data-hopen]").forEach((b) =>
        b.addEventListener("click", () => {
          const v = HIST_LIST.find((x) => x.id === b.getAttribute("data-hopen"));
          if (!v || !HIST_ROOM) return;
          m.classList.remove("on");
          openInStudio({
            ...HIST_ROOM,
            before_path: v.before_path,
            after_path: v.after_path,
            version_no: v.version_no,
          });
        }),
      );
      body.querySelectorAll("[data-happ]").forEach((b) =>
        b.addEventListener("click", async () => {
          const v = HIST_LIST.find((x) => x.id === b.getAttribute("data-happ"));
          if (!v) return;
          b.disabled = true;
          try {
            const next = v.status === "approved" ? "draft" : "approved";
            await setVersionStatus({ data: { version_id: v.id, status: next } });
            v.status = next;
            paintHistory();
            window.dispatchEvent(new Event("rd:saved"));
          } catch (e) {
            b.disabled = false;
          }
        }),
      );
      body.querySelectorAll("[data-hcmp]").forEach((cb) =>
        cb.addEventListener("change", () => {
          const id = cb.getAttribute("data-hcmp");
          const i = HIST_SEL.indexOf(id);
          if (i > -1) HIST_SEL.splice(i, 1);
          else {
            HIST_SEL.push(id);
            if (HIST_SEL.length > 2) HIST_SEL.shift();
          }
          paintHistory();
        }),
      );
      const cmpBtn = body.querySelector("#hmCmp");
      if (cmpBtn) cmpBtn.addEventListener("click", paintCompare);
      lucide.createIcons();
    }
    async function paintCompare() {
      const m = histModal(),
        body = m.querySelector("#hmBody");
      const picks = HIST_SEL.map((id) => HIST_LIST.find((v) => v.id === id)).filter(Boolean);
      if (picks.length !== 2) {
        paintHistory();
        return;
      }
      picks.sort((a, b) => a.version_no - b.version_no);
      const [a, b] = picks;
      const money = (v) =>
        v.total_low != null ? kfmt(v.total_low) + " to " + kfmt(v.total_high) : "Not priced";
      const delta =
        a.total_low != null && b.total_low != null
          ? (() => {
              const d = Number(b.total_low) - Number(a.total_low);
              const sign = d > 0 ? "+" : d < 0 ? "\u2212" : "";
              return sign + kfmt(Math.abs(d)) + " on the low end";
            })()
          : "Only one of these versions is priced";
      body.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
${picks
  .map(
    (
      v,
    ) => `<div><img data-cphoto="${v.after_path || v.before_path || ""}" alt="Version ${v.version_no}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;background:#EFEDE8" hidden>
<div style="margin-top:6px"><b style="font-size:.82rem">v${v.version_no}</b>
<div class="mono" style="font-size:.75rem;color:var(--mute-2)">${money(v)}</div>
<div style="font-size:.75rem;color:var(--mute-2)">${v.style || "No style noted"} \u00b7 ${new Date(v.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div></div></div>`,
  )
  .join("")}
</div>
<div class="rowi" style="margin-top:10px"><div class="rowt"><b>Difference</b><span class="mono">v${a.version_no} to v${b.version_no}: ${delta}</span></div></div>
<button class="btn btn-ghost btn-block" style="margin-top:10px" id="hmBack">Back To History</button>`;
      body.querySelectorAll("[data-cphoto]").forEach(async (img) => {
        const p = img.getAttribute("data-cphoto");
        if (!p) return;
        const url = await resolvePhotoUrl(p);
        if (url) {
          img.src = url;
          img.hidden = false;
        }
      });
      const bk = body.querySelector("#hmBack");
      if (bk) bk.addEventListener("click", paintHistory);
      lucide.createIcons();
    }
    const DFILT = ["all", "approved", "review", "archived"];
    document.querySelectorAll("#designTabs button").forEach((b, i) =>
      b.addEventListener("click", () => {
        document.querySelectorAll("#designTabs button").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
        DESIGN_FILTER = DFILT[i] || "all";
        paintDesigns();
      }),
    );

    /* ---------- batch ---------- */
    let BATCH_ROOMS = [];
    let BATCH_PROP = null;
    let batchBusy = false;
    function batchStateEl() {
      return document.getElementById("batchState");
    }
    function paintBatch() {
      mountBatchSource();
      const sel = document.getElementById("batchProp"),
        list = document.getElementById("batchList");
      if (!sel || !list) return;
      const runBtn = document.getElementById("batchRun");
      if (!PROP_TREE.length) {
        sel.innerHTML = '<option value="">No Properties Yet</option>';
        list.innerHTML =
          '<p style="font-size:.79rem;color:var(--mute-2)">Add a property and upload room photos to build a batch.</p>';
        BATCH_ROOMS = [];
        BATCH_PROP = null;
        batchLaunchState();
        const st0 = batchStateEl();
        if (st0) {
          st0.className = "pill p-gray";
          st0.textContent = "Nothing To Run";
        }
        if (runBtn) runBtn.disabled = true;
        return;
      }
      const keep = sel.value;
      sel.innerHTML = PROP_TREE.map((p) => `<option value="${p.id}">${p.address}</option>`).join(
        "",
      );
      const roomsOf = (p) => p.projects.reduce((n, pr) => n + pr.rooms.length, 0);
      const photosOf = (p) =>
        p.projects.reduce((n, pr) => n + pr.rooms.filter((r) => !!r.before_path).length, 0);
      const best = [...PROP_TREE].sort(
        (a, b) => photosOf(b) - photosOf(a) || roomsOf(b) - roomsOf(a),
      )[0];
      const prop = (keep && PROP_TREE.find((p) => p.id === keep)) || best || PROP_TREE[0];
      sel.value = prop.id;
      if (sel.dataset.selSync !== prop.id) {
        sel.dataset.selSync = prop.id;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const rooms = [];
      prop.projects.forEach((pr) => pr.rooms.forEach((r) => rooms.push(r)));
      BATCH_ROOMS = rooms.filter((r) => !!r.before_path);
      BATCH_PROP = prop;
      /* Batch shares the app's one selected property, so Properties, Media and the
     builders all stay on the same address the user is batching. */
      const pi = PROP_TREE.indexOf(prop);
      if (pi > -1 && SEL.p !== pi) SEL = { p: pi, pr: 0 };
      batchLaunchState();
      const sub = document.getElementById("batchSub");
      if (sub)
        sub.textContent = rooms.length
          ? rooms.length +
            (rooms.length === 1 ? " room" : " rooms") +
            " on file, " +
            BATCH_ROOMS.length +
            " with a photo"
          : "No Rooms On This Property Yet";
      const st = batchStateEl();
      if (st) {
        st.className = "pill " + (BATCH_ROOMS.length ? "p-ok" : "p-gray");
        st.textContent = BATCH_ROOMS.length
          ? BATCH_ROOMS.length + " Ready · " + BATCH_ROOMS.length + " Credits"
          : "Nothing To Run";
      }
      if (runBtn) runBtn.disabled = !BATCH_ROOMS.length || batchBusy;
      list.innerHTML = rooms.length
        ? rooms
            .map((r) => {
              const done = (r.versions || 0) > 0;
              const ready = !!r.before_path;
              return `<div class="rowi" data-broom="${r.id}"><div class="rowt"><b>${r.name}</b><span data-bmsg>${ready ? (done ? "v" + (r.version_no || 1) + " saved" : "ready to stage") : "no photo on file"}</span></div>
          <span class="pill ${ready ? (done ? "p-ok" : "p-gray") : "p-amb"}" data-bpill>${ready ? (done ? "Designed" : "Queued") : "No Photo"}</span></div>`;
            })
            .join("")
        : `<div style="text-align:center;padding:22px 10px">
        <p style="font-size:.82rem;color:var(--mute-2);margin:0 0 12px">This property has no room photos yet.<br>Upload a shoot and every room lands here, ready to batch.</p>
        <button class="btn btn-dark btn-xs" data-propupload="1"><i data-lucide="upload-cloud"></i>Upload Property Photos</button>
      </div>`;
      if (!rooms.length) lucide.createIcons();
    }
    var batchPicker = null;
    function mountBatchSource() {
      const slot = document.getElementById("batchSource");
      if (!slot || batchPicker) return;
      batchPicker = mountSourcePicker(slot, {
        context: "batch",
        esc: (v) =>
          String(v == null ? "" : v).replace(
            /[&<>"]/g,
            (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
          ),
        lucide: {
          createIcons: () => {
            try {
              lucide.createIcons();
            } catch (_) {}
          },
        },
        properties: () =>
          PROP_TREE.map((p) => {
            const n =
              p.projects.reduce(
                (t, pr) => t + (pr.rooms || []).filter((r) => !!r.before_path).length,
                0,
              ) || Number(p.asset_count || 0);
            return { address: p.address, meta: n === 1 ? "1 Photo" : n + " Photos" };
          }),
        onPick: (picked) => {
          try {
            openPropertyUpload({ files: picked.map((x) => x.file) });
          } catch (_) {}
        },
        onProperty: (address) => {
          const p = PROP_TREE.find((x) => x.address === address);
          const sel = document.getElementById("batchProp");
          if (p && sel) {
            sel.value = p.id;
            paintBatch();
          }
        },
        showAlert: (m) => {
          try {
            window.rdToast && window.rdToast(m);
          } catch (_) {}
        },
      });
    }
    const batchProp = document.getElementById("batchProp");
    if (batchProp) batchProp.addEventListener("change", paintBatch);

    /* Batch starts builders through the one handoff contract every other surface
   uses, so the property and its photos travel with the project. */
    function batchLaunchState() {
      const ready = BATCH_ROOMS.length && !batchBusy;
      ["batchDesign", "batchVideo"].forEach((id) => {
        const b = document.getElementById(id);
        if (b) b.disabled = !ready;
      });
    }
    function batchHandoff(target) {
      if (!BATCH_ROOMS.length || !BATCH_PROP) return null;
      return setHandoff({
        target,
        origin: "batch",
        propertyId: BATCH_PROP.id || null,
        propertyAddress: BATCH_PROP.address || null,
        assets: BATCH_ROOMS.map((r) => ({
          path: r.before_path,
          name: r.name,
          room: r.room_type || r.name,
          id: r.id,
        })),
      });
    }
    function batchBuild(target) {
      const h = batchHandoff(target);
      if (!h) {
        try {
          window.rdToast && window.rdToast("Add Photos To This Property First.");
        } catch (_) {}
        return;
      }
      if (target === "video") {
        try {
          window.__rdAllowReveal && window.__rdAllowReveal();
        } catch (_) {}
        openVideoWorkflow({
          from: "batch",
          propertyId: h.propertyId,
          propertyAddress: h.propertyAddress,
          assets: h.assets.map((a, i) => ({
            id: a.id,
            storage_path: a.path,
            file_name: a.name,
            original_filename: a.name,
            room_group: a.room || a.name,
            sort_order: i,
          })),
        });
        return;
      }
      openStagingReview({
        photos: h.assets.map((a) => ({ path: a.path, name: a.name, room: a.room })),
        address: h.propertyAddress || "",
        propertyId: h.propertyId,
      });
      try {
        window.__rdGo && window.__rdGo("studio");
      } catch (_) {}
    }
    const batchDesignBtn = document.getElementById("batchDesign");
    if (batchDesignBtn) batchDesignBtn.addEventListener("click", () => batchBuild("design"));
    const batchVideoBtn = document.getElementById("batchVideo");
    if (batchVideoBtn) batchVideoBtn.addEventListener("click", () => batchBuild("video"));

    function batchRowSet(roomId, pillCls, pillText, msg) {
      const row = document.querySelector(`[data-broom="${roomId}"]`);
      if (!row) return;
      const pill = row.querySelector("[data-bpill]"),
        m = row.querySelector("[data-bmsg]");
      if (pill) {
        pill.className = "pill " + pillCls;
        pill.textContent = pillText;
      }
      if (m && msg) m.textContent = msg;
    }

    async function runBatch() {
      if (batchBusy || !BATCH_ROOMS.length) return;
      batchBusy = true;
      batchLaunchState();
      const runBtn = document.getElementById("batchRun");
      const dirSel = document.querySelector("#v-listings select:not(#batchProp)");
      const direction = ((dirSel && dirSel.value) || "Warm Minimal").replace(/,.*$/, "");
      const st = batchStateEl();
      if (runBtn) {
        runBtn.disabled = true;
        runBtn.innerHTML = '<i data-lucide="loader"></i>Running Batch';
        lucide.createIcons();
      }
      let done = 0,
        failed = 0;
      const queue = BATCH_ROOMS.slice();
      for (const room of queue) {
        if (st) {
          st.className = "pill p-amb";
          st.textContent = "Staging " + (done + failed + 1) + " Of " + queue.length;
        }
        batchRowSet(room.id, "p-amb", "Staging", "rendering in " + direction);
        try {
          const src = await resolvePhotoUrl(room.before_path);
          const image = await toDataUrl(src, 1100);
          const r = await renderDesign({
            data: {
              image,
              room_type: room.room_type || "living room",
              direction,
              style_id: resolveStyle(direction).id,
              project_type: "interior",
              intensity: "Makeover",
              grade: "Retail Grade",
              notes: null,
              keep: [],
              replace: [],
              remove: [],
            },
          });
          const afterPath = await uploadRenderDataUrl(r.image);
          const v = await saveRoomVersion({
            data: {
              room_id: room.id,
              before_path: room.before_path,
              after_path: afterPath,
              style: direction,
            },
          });
          done++;
          track("design_rendered", {
            surface: "batch",
            room_type: room.room_type || "living room",
          });
          batchRowSet(room.id, "p-ok", "Designed", "v" + v.version_no + " saved · " + direction);
          window.dispatchEvent(new Event("rd:credits-changed"));
        } catch (e) {
          failed++;
          const gated = creditGate(e);
          batchRowSet(
            room.id,
            "p-amb",
            gated ? "Paused" : "Failed",
            (e && e.message) || "could not render this room",
          );
          if (gated) break;
        }
      }
      if (st) {
        st.className = "pill " + (failed ? "p-amb" : "p-ok");
        st.textContent = done + " Staged" + (failed ? ", " + failed + " Skipped" : "");
      }
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.innerHTML = '<i data-lucide="play"></i>Run Batch';
        lucide.createIcons();
      }
      batchBusy = false;
      batchLaunchState();
      try {
        window.dispatchEvent(new CustomEvent("rd:saved"));
      } catch (e) {}
      try {
        PROP_TREE = await getPropertyTree();
      } catch (e) {}
    }
    const batchRun = document.getElementById("batchRun");
    if (batchRun) batchRun.addEventListener("click", runBatch);

    /* ---------- scope: live pricing from the cost database ---------- */
    const SCOPE_ITEMS = [
      { label: "demolition" },
      { label: "flooring", material: "lvp" },
      { label: "wall_paint", material: "paint" },
      { label: "baseboard" },
      { label: "recessed_light", qty: 6 },
      { label: "light_fixture", qty: 2 },
      { label: "interior_door", qty: 2 },
    ];
    const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
    const scopeRowsEl = document.getElementById("scopeRows");
    let scopeMarkets = [];
    (function () {
      const rs = document.getElementById("fRoom");
      if (rs) rs.addEventListener("change", paintStudioSub);
    })();
    function scopeContext() {
      const sp = PROP_TREE[SEL.p] || null,
        sj = sp ? sp.projects[SEL.pr] || null : null;
      const roomSel = document.getElementById("fRoom");
      const room = roomSel ? roomSel.value : "Room";
      return (
        (sp ? sp.address + (sj ? " \u00b7 " + sj.name : "") : "Unsaved room") + " \u00b7 " + room
      );
    }
    let lastScope = null;

    const K = (n) =>
      "$" + (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K" : Math.round(n));
    function fitClass(f) {
      if (!f) return "p-gray";
      const s = f.toLowerCase();
      return s.indexOf("within") >= 0 ? "p-ok" : s.indexOf("over") >= 0 ? "p-red" : "p-amb";
    }

    function renderScope(r) {
      lastScope = r;
      try {
        window.dispatchEvent(new CustomEvent("rd:priced"));
      } catch (e) {}
      showAlert("");
      /* group priced lines by trade, with a subtotal per trade */
      const groups = [];
      const idx = {};
      r.lines.forEach((l) => {
        if (idx[l.trade] === undefined) {
          idx[l.trade] = groups.length;
          groups.push({ trade: l.trade, lines: [] });
        }
        groups[idx[l.trade]].lines.push(l);
      });
      scopeRowsEl.innerHTML =
        r.lines.length === 0
          ? '<tr><td colspan="5">No Priceable Items In This Selection. Add Or Change Budget Items, Then Run The Estimate Again.</td></tr>'
          : groups
              .map((g) => {
                const low = g.lines.reduce((a, l) => a + l.line_low, 0),
                  high = g.lines.reduce((a, l) => a + l.line_high, 0);
                return (
                  `<tr class="trade-h"><td colspan="3">${g.trade}</td><td class="n">${money(low)}</td><td class="n">${money(high)}</td></tr>` +
                  g.lines
                    .map(
                      (
                        l,
                      ) => `<tr><td><b>${l.description}</b>${l.is_fallback ? ' <span class="pill p-amb">Fallback</span>' : ""}<span class="src">${l.price_source}</span></td>
<td>${l.trade}</td><td class="n">${l.qty} ${l.uom}</td><td class="n">${money(l.line_low)}</td><td class="n">${money(l.line_high)}</td></tr>`,
                    )
                    .join("")
                );
              })
              .join("") +
            `<tr><td><b>Contingency At ${r.contingency_pct}%</b></td><td>General</td><td class="n">1 ls</td>
<td class="n">${money(r.contingency_low)}</td><td class="n">${money(r.contingency_high)}</td></tr>`;
      document.getElementById("scopeTotLow").textContent = money(r.total_low);
      document.getElementById("scopeTotHigh").textContent = money(r.total_high);
      document.getElementById("scopeTotLab").textContent =
        "Estimated Total" + (r.budget_fit ? " · " + r.budget_fit : "");
      const _sp = PROP_TREE[SEL.p],
        _sj = _sp ? _sp.projects[SEL.pr] : null;
      const _addr = _sp ? String(_sp.address || "").trim() : "";
      const _scx = _sp
        ? (/^untitled property$/i.test(_addr) || !_addr ? "Unsorted Uploads" : _addr) +
          (_sj ? " · " + _sj.name : "")
        : "Unsaved room";

      document.getElementById("scopeSub").textContent =
        `${_scx} · ${r.grade[0].toUpperCase() + r.grade.slice(1)} Grade · ${r.market.name}`;
      document.getElementById("scopeNote").textContent =
        `${r.disclaimer} Quantities are derived from the measurements above and should be field verified.`;

      /* summary header */
      const ss = document.getElementById("scopeSummary");
      if (ss)
        ss.innerHTML = summaryHTML({
          primaryLabel: "Planning Range",
          primaryValue: money(r.total_low) + "–" + money(r.total_high),
          metrics: [
            metric("Budget Fit", r.budget_fit || "No Target Set"),
            metric("Layout", r.layout_conf, "neutral"),
            metric(
              "Pricing",
              r.pricing_conf,
              r.pricing_conf && /high/i.test(r.pricing_conf) ? "neutral" : undefined,
            ),
          ],
        });
      const target = parseFloat(document.getElementById("scBudget").value);
      const wrap = document.getElementById("esMeterWrap");
      if (Number.isFinite(target) && target > 0) {
        wrap.style.display = "";
        const pct = Math.max(4, Math.min(100, (r.total_high / target) * 100));
        const bar = document.getElementById("esMeter");
        bar.style.width = pct + "%";
        bar.className = r.total_high <= target ? "ok" : r.total_low > target ? "over" : "near";
        document.getElementById("esTarget").textContent = "Target " + K(target);
      } else {
        wrap.style.display = "none";
      }
      const dims = dimsProposal
        ? dimsConfirmed
          ? "Dimensions Confirmed"
          : "Dimensions Proposed, Not Confirmed"
        : "Dimensions Entered By You";
      document.getElementById("esChips").innerHTML = [
        ["Layout Confidence", r.layout_conf],
        ["Pricing Confidence", r.pricing_conf],
        ["Cost Records Matched", r.matched_pct + "%"],
        ["Material", money(r.material_low) + " to " + money(r.material_high)],
        ["Labor", money(r.labor_low) + " to " + money(r.labor_high)],
        ["Measurements", dims],
      ]
        .map(([k, v]) => `<span class="es-chip"><span>${k}</span><b>${v}</b></span>`)
        .join("");
      const dm = document.getElementById("dmRehab");
      if (dm) dm.textContent = K(r.total_low) + " to " + K(r.total_high);
      const brief = document.getElementById("scBrief");
      if (brief) brief.disabled = false;
      renderAllowance(r);
    }

    function showAlert(msg) {
      const a = document.getElementById("estAlert");
      if (!a) return;
      a.style.display = msg ? "" : "none";
      a.textContent = msg || "";
    }

    /* ---------- phase 5: materials allowance list, derived from the priced scope ---------- */
    function renderAllowance(r) {
      const rows = document.getElementById("allowRows");
      if (!rows) return;
      const note = document.getElementById("allowNote"),
        sub = document.getElementById("allowSub");
      if (!r) {
        rows.innerHTML = '<tr><td colspan="5">No Priced Budget Yet.</td></tr>';
        note.textContent =
          "The Allowance List Turns On With Budgets, Once Verified Local Cost Data Is Licensed For Your Market.";
        return;
      }
      const mat = r.lines.filter((l) => l.material_high > 0);
      if (!mat.length) {
        rows.innerHTML =
          '<tr><td colspan="5">This scope is labor only, so there is no material allowance.</td></tr>';
        note.textContent = "No material lines in the current scope.";
        return;
      }
      rows.innerHTML =
        mat
          .map(
            (
              l,
            ) => `<tr><td><b>${l.description}</b>${l.is_fallback ? ' <span class="pill p-amb">Fallback</span>' : ""}<div class="sub">${l.price_source}</div></td>
<td>${l.trade}</td><td class="n">${l.qty} ${l.uom}</td><td class="n">${money(l.material_low)}</td><td class="n">${money(l.material_high)}</td></tr>`,
          )
          .join("") +
        `<tr><td colspan="3"><b>Material Allowance Total</b></td><td class="n"><b>${money(r.material_low)}</b></td><td class="n"><b>${money(r.material_high)}</b></td></tr>`;
      sub.textContent = `${mat.length} material lines · ${r.market.name} · ${r.grade[0].toUpperCase() + r.grade.slice(1)} grade`;
      note.textContent =
        "Planning allowances per line, not product prices. Fit to your space is not asserted until dimensions are confirmed.";
    }
    function allowanceCsv() {
      const r = lastScope;
      if (!r) return;
      const rows = [
        ["Material Line", "Trade", "Qty", "UOM", "Allowance Low", "Allowance High", "Price Source"],
      ].concat(
        r.lines
          .filter((l) => l.material_high > 0)
          .map((l) => [
            l.description,
            l.trade,
            l.qty,
            l.uom,
            l.material_low,
            l.material_high,
            l.price_source,
          ]),
      );
      const csv = rows
        .map((r2) => r2.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = "real-designs-materials-allowance.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    }

    let scopeBusy = false;
    async function runScope() {
      if (scopeBusy) return;
      /* Budgets are gated: never call the priced preview while it is coming soon. */
      try {
        if (!(await budgetAvailability()).available) return;
      } catch (_) {
        return;
      }
      scopeBusy = true;

      const sel = document.getElementById("scMarket");
      const runBtn = document.getElementById("scRun");
      const val = (id, d) => {
        const v = parseFloat((document.getElementById(id) || {}).value);
        return Number.isFinite(v) && v > 0 ? v : d;
      };
      runBtn.disabled = true;
      runBtn.classList.add("is-busy");
      document.getElementById("estSum").classList.add("is-loading");
      scopeRowsEl.innerHTML = Array.from({ length: 5 })
        .map(
          () =>
            '<tr class="sk"><td><i></i></td><td><i></i></td><td><i></i></td><td><i></i></td><td><i></i></td></tr>',
        )
        .join("");
      try {
        const r = await priceScopePreview({
          data: {
            market_id: sel && sel.value ? sel.value : undefined,
            grade: document.getElementById("scGrade").value,
            floor_area_sf: val("scFloor", 340),
            wall_area_sf: val("scWall", 780),
            perimeter_lf: val("scPerim", 76),
            dims_source: dimsProposal ? (dimsConfirmed ? "user" : "depth_estimate") : "user",
            budget_target: val("scBudget", null),
            items: scopeItems,
          },
        });
        if (scopeMarkets.length !== r.markets.length) {
          scopeMarkets = r.markets;
          sel.innerHTML = r.markets
            .map(
              (m) =>
                `<option value="${m.id}"${m.id === r.market.id ? " selected" : ""}>${m.name}</option>`,
            )
            .join("");
        }
        renderScope(r);
      } catch (e) {
        scopeRowsEl.innerHTML = '<tr><td colspan="5">No priced lines.</td></tr>';
        if (!creditGate(e))
          showAlert(
            "Could not price this scope. " + ((e && e.message) || "Try again in a moment."),
          );
      } finally {
        scopeBusy = false;
        runBtn.disabled = false;
        runBtn.classList.remove("is-busy");
        document.getElementById("estSum").classList.remove("is-loading");
      }
    }

    let scopeItems = SCOPE_ITEMS.slice();

    function currentRoomType() {
      const el = document.getElementById("svType");
      const v = el && el.value ? el.value.trim() : "";
      return v || "living room";
    }

    function studioSrc(which) {
      const el = document.querySelector(which === "after" ? "#cAfter img" : "#cBefore img");
      if (el && el.src) return el.src;
      return which === "after" ? lastRender || null : null;
    }

    async function toDataUrl(src, max) {
      /* Without a photo the browser would request "/null" and fail with an opaque
     decode error, so surface a readable message instead. */
      if (!src) throw new Error("Add a photo in Studio first, then run this again.");
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      await img.decode();
      const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * sc);
      c.height = Math.round(img.naturalHeight * sc);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.72);
    }

    async function detectScopeChanges() {
      const btn = document.getElementById("scDetect");
      const note = document.getElementById("scopeNote");
      btn.disabled = true;
      const lab = btn.innerHTML;
      btn.textContent = "Reading Photos\u2026";
      try {
        const bSrc = studioSrc("before"),
          aSrc = lastRender || studioSrc("after");
        if (!bSrc || !aSrc)
          throw new Error("Add a before and after photo in Studio first, then run this again.");
        const [before, after] = await Promise.all([toDataUrl(bSrc, 900), toDataUrl(aSrc, 900)]);
        const r = await detectChanges({
          data: { before, after, grade: document.getElementById("scGrade").value },
        });
        window.dispatchEvent(new Event("rd:credits-changed"));
        if (r.priceable.length) {
          scopeItems = r.priceable;
        }
        await runScope();
        if (r.summary) note.textContent = r.summary + " " + note.textContent;
      } catch (e) {
        if (!creditGate(e)) showAlert("Could not read the photos. " + ((e && e.message) || ""));
      } finally {
        btn.disabled = false;
        btn.innerHTML = lab;
      }
    }

    /* ---------- phase 3: dimensions proposed by AI, confirmed by a person ---------- */
    let dimsConfirmed = false,
      dimsProposal = null;
    function setDimsSource() {
      const b = document.getElementById("scDimsBadge");
      if (!dimsProposal) {
        b.style.display = "none";
        return;
      }
      b.style.display = "";
      b.className = "pill " + (dimsConfirmed ? "p-ok" : "p-amb");
      b.textContent = dimsConfirmed
        ? "Dimensions Confirmed"
        : "Proposed \u00b7 " +
          dimsProposal.confidence[0].toUpperCase() +
          dimsProposal.confidence.slice(1) +
          " Confidence";
      document.getElementById("scDimsOk").style.display = dimsConfirmed ? "none" : "";
    }
    async function runDims() {
      const btn = document.getElementById("scDims");
      const note = document.getElementById("scopeNote");
      btn.disabled = true;
      const lab = btn.innerHTML;
      btn.textContent = "Measuring\u2026";
      try {
        const bSrc = studioSrc("before");
        if (!bSrc) throw new Error("Add a photo in Studio first, then run this again.");
        const image = await toDataUrl(bSrc, 900);
        const r = await estimateDimensions({ data: { image, room_type: currentRoomType() } });
        dimsProposal = r;
        dimsConfirmed = false;
        document.getElementById("scFloor").value = r.floor_area_sf;
        document.getElementById("scWall").value = r.wall_area_sf;
        document.getElementById("scPerim").value = r.perimeter_lf;
        setDimsSource();
        await runScope();
        note.textContent = r.basis + " " + r.disclaimer + " " + note.textContent;
      } catch (e) {
        if (!creditGate(e)) showAlert("Could not measure this photo. " + ((e && e.message) || ""));
      } finally {
        btn.disabled = false;
        btn.innerHTML = lab;
      }
    }

    /* ---------- phase 4: contractor brief, rendered from the priced scope ---------- */
    /* The brief is generated server side as a real PDF file, so it downloads on a
   phone and never depends on pop-ups or a print dialog. */
    async function briefDoc(r) {
      const divs = {};
      r.lines.forEach((l) => {
        (divs[l.csi_division] = divs[l.csi_division] || { trade: l.trade, lines: [] }).lines.push(
          l,
        );
      });
      const sections = Object.keys(divs)
        .sort()
        .map((d) => {
          const g = divs[d];
          const low = g.lines.reduce((a, l) => a + l.line_low, 0),
            high = g.lines.reduce((a, l) => a + l.line_high, 0);
          return {
            heading: d + " - " + g.trade,
            columns: [
              { label: "Item", width: 34 },
              { label: "Qty", align: "right", width: 11 },
              { label: "Material", align: "right", width: 16 },
              { label: "Labor", align: "right", width: 16 },
              { label: "Low", align: "right", width: 11 },
              { label: "High", align: "right", width: 12 },
            ],
            rows: g.lines
              .map((l) => [
                l.description +
                  (l.is_fallback ? " (fallback cost record)" : "") +
                  "\n" +
                  l.price_source,
                l.qty + " " + l.uom,
                money(l.material_low) + "-" + money(l.material_high),
                money(l.labor_low) + "-" + money(l.labor_high),
                money(l.line_low),
                money(l.line_high),
              ])
              .concat([["Division Subtotal", "", "", "", money(low), money(high)]]),
            emphasizeRows: [g.lines.length],
          };
        });
      const dimLine = `${document.getElementById("scFloor").value} SF floor - ${document.getElementById("scWall").value} SF wall - ${document.getElementById("scPerim").value} LF perimeter`;
      const [before, after] = await Promise.all([
        imageForPdf(PHOTOS.before),
        imageForPdf(PHOTOS.after),
      ]);
      const images = [];
      if (before) images.push({ url: before, caption: "EXISTING CONDITION" });
      if (after) images.push({ url: after, caption: "PROPOSED DESIGN" });
      return {
        title: "Contractor Brief",
        subtitle: scopeContext() + " - " + (r.grade[0].toUpperCase() + r.grade.slice(1)) + " Grade",
        metaRight: [
          r.market.name,
          new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        ],
        images,
        sections: [
          {
            heading: "Room Measurements",
            text:
              dimLine +
              " - Layout confidence " +
              r.layout_conf +
              (dimsProposal && !dimsConfirmed
                ? " - dimensions proposed from a photo and not yet confirmed"
                : ""),
          },
        ].concat(sections),
        totals: [
          { label: "Material", value: money(r.material_low) + " - " + money(r.material_high) },
          { label: "Labor", value: money(r.labor_low) + " - " + money(r.labor_high) },
          { label: "Subtotal", value: money(r.subtotal_low) + " - " + money(r.subtotal_high) },
          {
            label: "Contingency At " + r.contingency_pct + "%",
            value: money(r.contingency_low) + " - " + money(r.contingency_high),
          },
          {
            label: "Estimated Planning Range" + (r.budget_fit ? " - " + r.budget_fit : ""),
            value: money(r.total_low) + " - " + money(r.total_high),
            strong: true,
          },
        ],
        notes: [
          "Confidence Statement. Layout confidence " +
            r.layout_conf +
            ". Pricing confidence " +
            r.pricing_conf +
            ", with " +
            r.matched_pct +
            "% of lines matched to an exact cost record for this market and finish grade. Costs are adjusted to " +
            r.market.name +
            " labor and material factors.",
          "Disclosure. " +
            r.disclaimer +
            " Quantities derive from the measurements above; verify in the field before ordering material or committing to a schedule. Line items exclude permits, structural work, abatement, and any condition not visible in the photographs.",
        ],
        signatures: ["Contractor Signature & Date", "Owner Signature & Date"],
      };
    }
    async function exportBrief() {
      if (!lastScope) return;
      const btn = document.getElementById("scBrief");
      const lab = btn ? btn.innerHTML : "";
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Building PDF…";
      }
      try {
        await downloadPdf(await briefDoc(lastScope), "contractor-brief-" + scopeContext());
        try {
          (window as any).rdToast && (window as any).rdToast("Contractor Brief Downloaded");
        } catch (_) {}
      } catch (e) {
        showAlert("Could not build the contractor brief. " + ((e && e.message) || ""));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = lab;
        }
      }
    }

    document.getElementById("scBrief").addEventListener("click", exportBrief);
    document.getElementById("scBrief").disabled = true;
    document.getElementById("allowBuild").addEventListener("click", () => {
      lastScope ? renderAllowance(lastScope) : runScope();
    });
    document.getElementById("allowCsv").addEventListener("click", allowanceCsv);
    renderAllowance(null);
    document.getElementById("scDims").addEventListener("click", runDims);

    document.getElementById("scDimsOk").addEventListener("click", async () => {
      dimsConfirmed = true;
      setDimsSource();
      await runScope();
    });
    ["scFloor", "scWall", "scPerim"].forEach((id) =>
      document.getElementById(id).addEventListener("input", () => {
        if (dimsProposal) {
          dimsConfirmed = false;
          setDimsSource();
        }
      }),
    );
    document.getElementById("scDetect").addEventListener("click", detectScopeChanges);
    document.getElementById("scRun").addEventListener("click", runScope);
    ["scGrade", "scMarket"].forEach((id) =>
      document.getElementById(id).addEventListener("change", runScope),
    );
    let bTimer = null;
    document.getElementById("scBudget").addEventListener("input", () => {
      clearTimeout(bTimer);
      bTimer = setTimeout(runScope, 500);
    });
    runScope();

    /* ---------- budget bands: each one reprices the same room ---------- */
    const BAND_ITEMS = {
      refresh: [
        { label: "wall_paint", material: "paint" },
        { label: "light_fixture", qty: 2 },
      ],
      makeover: SCOPE_ITEMS.slice(),
      renovation: SCOPE_ITEMS.concat([
        { label: "base_cabinet" },
        { label: "countertop", material: "quartz" },
      ]),
      remodel: SCOPE_ITEMS.concat([
        { label: "base_cabinet" },
        { label: "countertop", material: "quartz" },
        { label: "wall_tile", material: "ceramic" },
        { label: "vanity", qty: 1 },
        { label: "sink_faucet", qty: 1 },
      ]),
    };
    const bands = [
      ["refresh", "Refresh", "Paint & Lighting Only", "rental", 5000],
      ["makeover", "Makeover", "Adds Flooring, Casing, Doors", "retail", 15000],
      ["renovation", "Renovation", "Adds Cabinetry & Countertops", "retail", 35000],
      ["remodel", "Full Remodel", "Adds Tile, Vanity, Plumbing Fixtures", "premium", 62000],
    ];
    let bandOn = "makeover";
    function paintBands() {
      document.getElementById("bandList").innerHTML = bands
        .map(
          ([k, n, d]) => `
<button class="rowi band-row${k === bandOn ? " on" : ""}" data-band="${k}"><div class="rowt"><b>${n}</b><span>${d}</span></div>
<div style="text-align:right">${k === bandOn ? '<span class="pill p-ink">Selected</span>' : '<span class="pill p-gray">Price It</span>'}</div></button>`,
        )
        .join("");
      document.querySelectorAll("#bandList .band-row").forEach((b) =>
        b.addEventListener("click", async () => {
          const k = b.getAttribute("data-band");
          if (k === bandOn || scopeBusy) return;
          bandOn = k;
          paintBands();
          const row = bands.find((x) => x[0] === k);
          scopeItems = BAND_ITEMS[k].slice();
          document.getElementById("scGrade").value = row[3];
          document.getElementById("scBudget").value = row[4];
          document.getElementById("bandSub").textContent =
            "Same Room, Same Photo · " + row[1] + " Priced";
          await runScope();
        }),
      );
    }
    paintBands();

    /* ---------- product board ---------- */
    const RETAIL = [
      [/floor|tile|carpet|lvp|hardwood/i, "Home Depot", "https://www.homedepot.com/s/"],
      [/paint|drywall|texture|primer/i, "Home Depot", "https://www.homedepot.com/s/"],
      [
        /light|fixture|sconce|recessed|electrical/i,
        "Lowes",
        "https://www.lowes.com/search?searchTerm=",
      ],
      [
        /cabinet|counter|vanity|door|casing|baseboard|trim|hardware/i,
        "Home Depot",
        "https://www.homedepot.com/s/",
      ],
      [/sink|faucet|toilet|shower|plumb/i, "Ferguson", "https://www.ferguson.com/search/"],
      [
        /sofa|chair|rug|table|bed|lamp|art|decor|furnish|stag/i,
        "Wayfair",
        "https://www.wayfair.com/keyword.php?keyword=",
      ],
    ];
    function boardSearch(desc, grade) {
      const q = String(desc || "")
        .replace(/,\s*installed/i, "")
        .trim();
      const term = (grade && grade !== "retail" ? grade + " " : "") + q;
      for (const [re, name, base] of RETAIL) {
        if (re.test(q)) return { name, url: base + encodeURIComponent(term) };
      }
      return {
        name: "Google Shopping",
        url: "https://www.google.com/search?tbm=shop&q=" + encodeURIComponent(term),
      };
    }
    function boardLines(r) {
      return r ? r.lines.filter((l) => l.material_high > 0) : [];
    }

    /* purchase tracking, per material line, saved on this device */
    const BUY_KEY = "rd.board.buy";
    const BUY_STATES = [
      ["todo", "To Buy", "p-gray"],
      ["ordered", "Ordered", "p-amb"],
      ["received", "Received", "p-ok"],
    ];
    function buyMap() {
      try {
        return JSON.parse(localStorage.getItem(BUY_KEY) || "{}") || {};
      } catch (e) {
        return {};
      }
    }
    function buyKey(l) {
      return (l.trade + "|" + l.description).toLowerCase().replace(/[^a-z0-9|]+/g, "-");
    }
    function buyStatus(l) {
      const v = buyMap()[buyKey(l)];
      return v === "ordered" || v === "received" ? v : "todo";
    }
    function buySet(k, v) {
      const m = buyMap();
      if (v === "todo") delete m[k];
      else m[k] = v;
      try {
        localStorage.setItem(BUY_KEY, JSON.stringify(m));
      } catch (e) {}
    }
    function buyLabel(s) {
      const f = BUY_STATES.find((x) => x[0] === s) || BUY_STATES[0];
      return f[1];
    }
    function buyPill(s) {
      const f = BUY_STATES.find((x) => x[0] === s) || BUY_STATES[0];
      return f[2];
    }
    let BOARD_FILTER = "all";

    function renderProductBoard(r) {
      const g = document.getElementById("prodGrid");
      if (!g) return;
      const sub = document.getElementById("shopSub");
      const mat = boardLines(r);
      const bar = document.getElementById("boardTrack");
      if (!mat.length) {
        g.innerHTML =
          '<div class="card" style="grid-column:1/-1"><div class="card-b">' +
          '<b style="display:block;margin-bottom:5px">No Material Lines Yet</b>' +
          '<span style="font-size:.8rem;color:var(--mute-2)">Price a budget in Budget and every material line lands here as a shoppable card with its allowance.</span>' +
          "</div></div>";
        if (sub) sub.textContent = "Price a scope to build the board";
        if (bar) bar.remove();
        return;
      }
      renderBoardTrack(mat);
      const shown = mat.filter((l) => BOARD_FILTER === "all" || buyStatus(l) === BOARD_FILTER);
      g.innerHTML =
        (shown.length ? shown : [])
          .map((l) => {
            const s = boardSearch(l.description, r.grade);
            const st = buyStatus(l),
              k = buyKey(l);
            return `<div class="card"><div class="card-b">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="font-family:'DM Mono',monospace;font-size:.6rem;letter-spacing:.13em;text-transform:uppercase;color:var(--mute-2)">${esc(l.trade)}</div>
        <span class="pill ${buyPill(st)}">${buyLabel(st)}</span></div>
      <b style="display:block;margin:4px 0 6px">${esc(l.description)}</b>
      <div style="font-size:.78rem;color:var(--mute-2);margin-bottom:10px">${l.qty} ${esc(l.uom)} &middot; ${esc(l.price_source)}</div>
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:11px">
        <span style="font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--mute-2)">Allowance</span>
        <b style="font-family:'DM Mono',monospace">${money(l.material_low)} to ${money(l.material_high)}</b></div>
      <div class="notif-tabs" style="margin:0 0 9px">${BUY_STATES.map(
        ([v, lab]) =>
          `<button class="notif-tab${st === v ? " on" : ""}" data-buy="${k}" data-buyv="${v}">${lab}</button>`,
      ).join("")}</div>
      <a class="btn btn-ghost btn-xs" style="width:100%;justify-content:center" href="${s.url}" target="_blank" rel="noopener"><i data-lucide="external-link"></i>Shop On ${esc(s.name)}</a>
    </div></div>`;
          })
          .join("") ||
        '<div class="card" style="grid-column:1/-1"><div class="card-b"><b>Nothing In This Status</b><div class="sub">Switch the filter to see the rest of the board.</div></div></div>';
      if (sub)
        sub.textContent = `${mat.length} shoppable lines · ${r.market.name} · ${r.grade[0].toUpperCase() + r.grade.slice(1)} grade allowances`;
      lucide.createIcons();
    }

    function renderBoardTrack(mat) {
      const g = document.getElementById("prodGrid");
      if (!g) return;
      let bar = document.getElementById("boardTrack");
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "card";
        bar.id = "boardTrack";
        bar.style.marginBottom = "16px";
        g.parentNode.insertBefore(bar, g);
      }
      const counts = { todo: 0, ordered: 0, received: 0 };
      mat.forEach((l) => {
        counts[buyStatus(l)]++;
      });
      const done = counts.received,
        pct = Math.round((done / mat.length) * 100);
      const tabs = [["all", "All", mat.length]].concat(
        BUY_STATES.map(([v, lab]) => [v, lab, counts[v]]),
      );
      bar.innerHTML = `<div class="card-h"><div><h3>Purchase Tracking</h3>
      <div class="sub">${done} of ${mat.length} lines received &middot; ${counts.ordered} ordered &middot; saved on this device</div></div>
      <button class="btn btn-ghost btn-xs" id="boardReset"><i data-lucide="rotate-ccw"></i>Reset Statuses</button></div>
    <div class="card-b" style="padding-top:2px">
      <div class="meter" style="margin-bottom:10px"><i style="width:${Math.max(2, pct)}%"></i></div>
      <div class="notif-tabs" id="boardTabs">${tabs
        .map(
          ([v, lab, n]) =>
            `<button class="notif-tab${BOARD_FILTER === v ? " on" : ""}" data-bf="${v}">${lab} ${n}</button>`,
        )
        .join("")}</div>
    </div>`;
    }

    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-buy]");
      if (b) {
        buySet(b.getAttribute("data-buy"), b.getAttribute("data-buyv"));
        renderProductBoard(lastScope);
        return;
      }
      const f = e.target.closest("[data-bf]");
      if (f) {
        BOARD_FILTER = f.getAttribute("data-bf");
        renderProductBoard(lastScope);
        return;
      }
      if (e.target.closest("#boardReset")) {
        try {
          localStorage.removeItem(BUY_KEY);
        } catch (_) {}
        renderProductBoard(lastScope);
      }
    });

    function boardCsv() {
      const r = lastScope;
      if (!r) return;
      const rows = [
        [
          "Item",
          "Trade",
          "Qty",
          "UOM",
          "Allowance Low",
          "Allowance High",
          "Status",
          "Retailer",
          "Search Link",
        ],
      ].concat(
        boardLines(r).map((l) => {
          const s = boardSearch(l.description, r.grade);
          return [
            l.description,
            l.trade,
            l.qty,
            l.uom,
            l.material_low,
            l.material_high,
            buyLabel(buyStatus(l)),
            s.name,
            s.url,
          ];
        }),
      );

      const csv = rows
        .map((r2) => r2.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = "real-designs-product-board.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    }
    function boardPdfDoc(title, sub, grade, lines, totals) {
      const rows = lines.map((l) => {
        const s = boardSearch(l.description, grade);
        return [
          l.description + (l.price_source ? "\n" + l.price_source : ""),
          l.trade,
          l.qty + " " + l.uom,
          presMoney(l.material_low) + " - " + presMoney(l.material_high),
          buyLabel(buyStatus(l)),
          s.name,
        ];
      });
      if (!rows.length) rows.push(["No material lines.", "", "", "", "", ""]);
      return {
        title,
        subtitle: sub,
        metaRight: [
          "Product Board",
          new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
        ],
        sections: [
          {
            columns: [
              { label: "Item", width: 30 },
              { label: "Trade", width: 14 },
              { label: "Quantity", align: "right", width: 12 },
              { label: "Allowance", align: "right", width: 18 },
              { label: "Status", width: 12 },
              { label: "Where To Buy", width: 14 },
            ],
            rows,
          },
        ],
        totals: totals
          ? [
              {
                label: "Material Allowance Total",
                value: presMoney(totals[0]) + " - " + presMoney(totals[1]),
                strong: true,
              },
            ]
          : [],
        notes: [
          "Allowances are planning figures per line at the selected finish grade, not quoted product prices. Retailer links are searches, not endorsements or reserved stock.",
        ],
      };
    }
    async function boardPrint() {
      const r = lastScope;
      if (!r) {
        showAlert("This Board Exports Once Budgets Are Live In Your Market.");
        return;
      }
      const sp = PROP_TREE[SEL.p],
        sj = sp ? sp.projects[SEL.pr] : null;
      const btn = document.getElementById("boardPrint");
      const lab = btn ? btn.innerHTML : "";
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Building PDF…";
      }
      try {
        await downloadPdf(
          boardPdfDoc(
            "Product Board",
            (sp ? sp.address + (sj ? " - " + sj.name : "") : "Unsaved room") +
              " - " +
              r.market.name +
              " - " +
              r.grade +
              " grade",
            r.grade,
            boardLines(r),
            [r.material_low, r.material_high],
          ),
          "product-board",
        );
        try {
          (window as any).rdToast && (window as any).rdToast("Product Board Downloaded");
        } catch (_) {}
      } catch (e) {
        showAlert("Could not build the product board. " + ((e && e.message) || ""));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = lab;
        }
      }
    }

    renderProductBoard(lastScope);
    function paintSelectedProducts() {
      try {
        renderSelectedProducts(document.getElementById("selProducts"), go);
      } catch (_) {}
    }
    paintSelectedProducts();
    window.addEventListener("rd:products", paintSelectedProducts);
    window.addEventListener("rd:priced", () => renderProductBoard(lastScope));
    const boardCsvBtn = document.getElementById("boardCsv");
    if (boardCsvBtn) boardCsvBtn.addEventListener("click", boardCsv);
    const boardPrintBtn = document.getElementById("boardPrint");
    if (boardPrintBtn) boardPrintBtn.addEventListener("click", boardPrint);

    /* ---------- presentations ---------- */
    import("@/content/rd-present")
      .then((m) => {
        try {
          m.mountPresent();
        } catch (_) {}
      })
      .catch(() => {});

    const PRES_STATUS = {
      sent: ["p-gray", "Sent"],
      viewed: ["p-blue", "Opened"],
      approved: ["p-ok", "Approved"],
      changes: ["p-amb", "Changes Requested"],
    };
    let PRES_ROWS = [];

    function presAgo(iso) {
      if (!iso) return "never";
      const d = (Date.now() - new Date(iso).getTime()) / 1000;
      if (d < 60) return "just now";
      if (d < 3600) return Math.floor(d / 60) + "m ago";
      if (d < 86400) return Math.floor(d / 3600) + "h ago";
      return Math.floor(d / 86400) + "d ago";
    }

    function presLink(token) {
      return location.origin + "/p/" + token;
    }

    let PRES_FILTER = "all";
    const PRES_TABS = [
      ["all", "All"],
      ["due", "Follow Up"],
      ["sent", "Awaiting"],
      ["viewed", "Opened"],
      ["approved", "Approved"],
      ["changes", "Changes"],
    ];

    /* A link needs a nudge once it has been out for three days with no decision,
   and again three days after the last reminder. Approved links never nag. */
    const PRES_NUDGE_MS = 3 * 86400000;
    function presDue(r) {
      const st = r.status || "sent";
      if (st === "approved") return false;
      const since = new Date(r.reminded_at || r.created_at || Date.now()).getTime();
      return Date.now() - since > PRES_NUDGE_MS;
    }

    function presMatch(r) {
      if (PRES_FILTER === "all") return true;
      if (PRES_FILTER === "due") return presDue(r);
      return (r.status || "sent") === PRES_FILTER;
    }

    function renderPresRows() {
      const el = document.getElementById("linkList");
      if (!el) return;
      const counts = PRES_TABS.map(([k]) =>
        k === "all"
          ? PRES_ROWS.length
          : k === "due"
            ? PRES_ROWS.filter(presDue).length
            : PRES_ROWS.filter((r) => (r.status || "sent") === k).length,
      );
      const tabs =
        `<div class=\"notif-tabs\" id=\"presTabs\" style=\"margin:0 0 10px\">` +
        PRES_TABS.map(
          ([k, l], i) =>
            `<button class=\"notif-tab${PRES_FILTER === k ? " on" : ""}\" data-pf=\"${k}\">${l} ${counts[i]}</button>`,
        ).join("") +
        `</div>`;
      const rows = PRES_ROWS.filter(presMatch);
      const body = rows.length
        ? rows
            .map((r) => {
              const [cls, lab] = PRES_STATUS[r.status] || PRES_STATUS.sent;
              const who = r.client_name ? "Sent to " + esc(r.client_name) : "No recipient named";
              const seen = r.view_count
                ? r.view_count === 1
                  ? "opened once"
                  : "opened " + r.view_count + " times"
                : "not opened";
              const ctx = [r.address, r.room_name].filter(Boolean).map(esc).join(" &middot; ");
              const dropped =
                r.excluded_count || 0
                  ? `<span class="pill warn" style="margin-left:6px">${r.excluded_count} Line${r.excluded_count === 1 ? "" : "s"} Removed</span>`
                  : "";
              const notesPill =
                r.note_count || 0
                  ? `<span class="pill" style="margin-left:6px">${r.note_count} Line Comment${r.note_count === 1 ? "" : "s"}</span>`
                  : "";
              const duePill = presDue(r) ? `<span class="pill warn">Follow Up Due</span>` : "";
              const remind =
                r.reminder_count || 0
                  ? ` &middot; ${r.reminder_count} reminder${r.reminder_count === 1 ? "" : "s"} sent`
                  : "";
              const lineNotes =
                r.note_count || 0
                  ? Object.values(r.line_notes || {})
                      .slice(0, 3)
                      .map(
                        (t: any) =>
                          `<div class=\"rowi\" style=\"border-top:0;padding-top:0\"><div class=\"rowt\" style=\"padding-left:2px\"><span style=\"color:var(--mute-2)\"><i>&ldquo;${esc(String(t))}&rdquo;</i></span></div></div>`,
                      )
                      .join("")
                  : "";
              const note =
                r.decision_note || r.excluded_count || r.note_count
                  ? `<div class=\"rowi\" style=\"border-top:0;padding-top:0\"><div class=\"rowt\" style=\"padding-left:2px\"><span style=\"color:var(--mute-2)\">${r.decision_note ? `<i>&ldquo;${esc(r.decision_note)}&rdquo;</i> &mdash; ${esc(r.client_name || "client")}` : r.excluded_count ? `${esc(r.client_name || "The client")} trimmed the scope` : `${esc(r.client_name || "The client")} left notes on the scope`}</span>${dropped}${notesPill}</div></div>` +
                    lineNotes
                  : "";
              return `<div class=\"rowi\" data-pid=\"${r.id}\" data-tok=\"${r.token}\">
      <div class="rowt"><b>${esc(r.title)}</b><span>${ctx ? ctx + " &middot; " : ""}${who} &middot; ${seen} &middot; ${presAgo(r.last_viewed_at || r.created_at)}${remind}</span></div>
      ${duePill}
      <span class="pill ${cls}">${lab}</span>
      <button class="icon-btn" data-hist title="Activity history"><i data-lucide="history"></i></button>
      <button class="icon-btn" data-remind title="Send approval reminder"><i data-lucide="bell-ring"></i></button>
      <button class="icon-btn" data-send title="Send to client"><i data-lucide="send"></i></button>
      <button class="icon-btn" data-copy title="Copy link"><i data-lucide="copy"></i></button>
      <button class="icon-btn" data-pdf title="Branded PDF"><i data-lucide="file-text"></i></button>
      <button class="icon-btn" data-board title="Product board"><i data-lucide="shopping-bag"></i></button>
      <button class="icon-btn" data-reel title="Social reel, 9x16"><i data-lucide="clapperboard"></i></button>
      <button class="icon-btn" data-del title="Delete link"><i data-lucide="trash-2"></i></button></div>${note}<div class="pres-hist" data-hist-for="${r.id}" hidden></div>`;
            })
            .join("")
        : '<p style="font-size:.79rem;color:var(--mute-2)">No Links With That Status Yet.</p>';

      el.innerHTML = tabs + body;
      lucide.createIcons();
    }

    async function paintPresentations() {
      const el = document.getElementById("linkList");
      if (!el) return;
      if (!el.innerHTML.trim()) el.innerHTML = skList(3);
      try {
        PRES_ROWS = await listPresentations();
      } catch (e) {
        PRES_ROWS = [];
      }
      updateSearchMeta();
      if (!PRES_ROWS.length) {
        el.innerHTML =
          '<p style="font-size:.79rem;color:var(--mute-2)">No Client Links Yet. Save a design in Studio, then use New Link to share it for approval.</p><div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-primary btn-sm" data-goto="studio"><i data-lucide="wand-2"></i>Open Studio</button><button class="btn btn-ghost btn-sm" id="emptyNewLink"><i data-lucide="link"></i>New Link</button></div>';
        el.querySelectorAll("[data-goto]").forEach((b) =>
          b.addEventListener("click", () => go(b.dataset.goto)),
        );
        const enl = el.querySelector("#emptyNewLink");
        if (enl) enl.addEventListener("click", presModal);
        lucide.createIcons();
        return;
      }
      renderPresRows();
    }

    const HIST_META = {
      created: ["plus-circle", "Link Created"],
      viewed: ["eye", "Opened"],
      approved: ["check-circle-2", "Approved"],
      changes: ["refresh-cw", "Changes Requested"],
      reminded: ["bell-ring", "Reminder Sent"],
      comments: ["message-square", "Line Comments"],
    };

    function presHistWhen(iso) {
      try {
        return new Date(iso).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      } catch (_) {
        return "";
      }
    }

    async function togglePresHistory(pid) {
      const box = document.querySelector('[data-hist-for="' + pid + '"]');
      if (!box) return;
      if (!box.hidden) {
        box.hidden = true;
        return;
      }
      box.hidden = false;
      box.innerHTML = '<div class="pres-hist-i">' + skLines(2) + "</div>";
      let rows = [];
      try {
        rows = await listPresentationActivity({ data: { id: pid } });
      } catch (_) {
        rows = [];
      }
      const meta = PRES_ROWS.find((x) => x.id === pid);
      if (meta && meta.created_at)
        rows = rows.concat([
          {
            id: "created",
            kind: "created",
            detail: "Share link created",
            note: null,
            excluded_count: 0,
            note_count: 0,
            created_at: meta.created_at,
          },
        ]);
      if (!rows.length) {
        box.innerHTML =
          '<div class="pres-hist-i"><span>No Activity Yet. The timeline fills in once the client opens the link.</span></div>';
        return;
      }
      box.innerHTML = rows
        .map((ev) => {
          const m = HIST_META[ev.kind] || HIST_META.viewed;
          const extras = [];
          if (ev.excluded_count)
            extras.push(
              ev.excluded_count + " line" + (ev.excluded_count === 1 ? "" : "s") + " removed",
            );
          if (ev.note_count)
            extras.push(ev.note_count + " line comment" + (ev.note_count === 1 ? "" : "s"));
          const quote = ev.note ? `<em>&ldquo;${esc(ev.note)}&rdquo;</em>` : "";
          return `<div class="pres-hist-i"><i data-lucide="${m[0]}"></i><div><b>${m[1]}</b><span>${esc(ev.detail || "")}${extras.length ? " &middot; " + extras.join(" &middot; ") : ""}</span>${quote}</div><span class="tm">${presHistWhen(ev.created_at)}</span></div>`;
        })
        .join("");
      lucide.createIcons();
    }

    /* jump to one client link from the dashboard attention list */
    async function focusPresentation(pid) {
      if (!PRES_ROWS.length) await paintPresentations();
      if (PRES_FILTER !== "all") {
        PRES_FILTER = "all";
        renderPresRows();
      }
      const row = document.querySelector('#linkList [data-pid="' + pid + '"]');
      if (!row) return;
      row.scrollIntoView({ block: "center", behavior: "smooth" });
      row.classList.remove("rd-flash");
      void row.offsetWidth;
      row.classList.add("rd-flash");
      setTimeout(() => row.classList.remove("rd-flash"), 2400);
    }

    const esc = (s) =>
      String(s == null ? "" : s).replace(
        /[&<>"]/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
      );
    const presMoney = (n) => "$" + Math.round(n || 0).toLocaleString("en-US");

    /* ---------- reports ---------- */
    /* Implemented in @/content/rd-reports; mounted when the view opens. */

    async function presPdfDoc(p) {
      const when = new Date(p.created_at || Date.now()).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      const lines = p.lines || [];
      const rows = lines.map((l) => [
        l.description,
        l.trade,
        l.qty + " " + l.uom,
        presMoney(l.low) + " - " + presMoney(l.high),
      ]);
      if (!rows.length) rows.push(["No Priced Line Items On This Version Yet.", "", "", ""]);
      const range =
        p.total_low != null
          ? presMoney(p.total_low) + " - " + presMoney(p.total_high)
          : "Not priced yet";
      const byTrade = {};
      lines.forEach((l) => {
        const k = l.trade || "Other";
        byTrade[k] = byTrade[k] || { low: 0, high: 0, n: 0 };
        byTrade[k].low += Number(l.low || 0);
        byTrade[k].high += Number(l.high || 0);
        byTrade[k].n++;
      });
      const trades = Object.keys(byTrade)
        .sort((a, b) => byTrade[b].high - byTrade[a].high)
        .slice(0, 6);
      const [before, after] = await Promise.all([
        p.before_url ? imageForPdf(p.before_url) : null,
        p.after_url ? imageForPdf(p.after_url) : null,
      ]);
      const images = [];
      if (before) images.push({ url: before, caption: "BEFORE" });
      if (after) images.push({ url: after, caption: "AFTER" });
      const sections = [];
      if (trades.length)
        sections.push({
          heading: "Where The Budget Sits",
          columns: [
            { label: "Trade", width: 40 },
            { label: "Items", align: "right", width: 16 },
            { label: "Range", align: "right", width: 44 },
          ],
          rows: trades.map((t) => [
            t,
            String(byTrade[t].n),
            presMoney(byTrade[t].low) + " - " + presMoney(byTrade[t].high),
          ]),
        });
      sections.push({
        heading: "Scope Detail",
        columns: [
          { label: "Scope Item", width: 44 },
          { label: "Trade", width: 18 },
          { label: "Quantity", align: "right", width: 16 },
          { label: "Range", align: "right", width: 22 },
        ],
        rows,
      });
      return {
        title: p.title,
        subtitle: [p.address, p.project_name, p.room_name, "v" + p.version_no]
          .filter(Boolean)
          .join(" - "),
        metaRight: [
          when,
          p.client_name || "Client copy",
          p.status === "approved" ? "Approved By Client" : "",
        ].filter(Boolean),
        images,
        sections,
        totals: [
          {
            label: (p.style || "Style on file") + " - " + (p.grade || "retail") + " grade finishes",
            value: "",
          },
          { label: "Estimated Planning Range", value: range, strong: true },
        ],
        notes: [
          "Planning estimates derived from the approved design and local cost data. Not a construction bid, subcontractor pricing governs. Rendered images are design visualisations of the same space.",
        ],
        signatures: p.status === "approved" ? [] : ["Client Signature", "Date"],
      };
    }

    async function exportPresentationPdf(id, btn) {
      const old = btn ? btn.innerHTML : null;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader"></i>';
        lucide.createIcons();
      }
      try {
        const p = await getPresentationPackage({ data: { id } });
        await downloadPdf(await presPdfDoc(p), p.title || "presentation");
        try {
          (window as any).rdToast && (window as any).rdToast("PDF Downloaded");
        } catch (_) {}
      } catch (e) {
        showAlert("Could not build that PDF. " + ((e && e.message) || ""));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = old;
          lucide.createIcons();
        }
      }
    }

    async function exportPresentationBoard(id, btn) {
      const old = btn ? btn.innerHTML : null;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader"></i>';
        lucide.createIcons();
      }
      try {
        const p = await getPresentationPackage({ data: { id } });
        const lines = (p.lines || []).map((l) => ({
          description: l.description,
          trade: l.trade,
          qty: l.qty,
          uom: l.uom,
          material_low: l.low,
          material_high: l.high,
          price_source: "From the approved scope",
        }));
        const tl = lines.reduce((a, l) => a + l.material_low, 0),
          th = lines.reduce((a, l) => a + l.material_high, 0);
        await downloadPdf(
          boardPdfDoc(
            p.title,
            [p.address, p.project_name, p.room_name, (p.grade || "retail") + " grade"]
              .filter(Boolean)
              .join(" - "),
            p.grade,
            lines,
            lines.length ? [tl, th] : null,
          ),
          (p.title || "product") + "-board",
        );
        try {
          (window as any).rdToast && (window as any).rdToast("Product Board Downloaded");
        } catch (_) {}
      } catch (e) {
        showAlert("Could not build that board. " + ((e && e.message) || ""));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = old;
          lucide.createIcons();
        }
      }
    }

    async function exportSocialReel(id, btn) {
      const old = btn ? btn.innerHTML : null;
      const setLab = (t) => {
        if (btn) btn.innerHTML = '<span style="font-size:.66rem;font-weight:700">' + t + "</span>";
      };
      if (btn) btn.disabled = true;
      setLab("0%");
      try {
        const p = await getPresentationPackage({ data: { id } });
        if (!p.before_url || !p.after_url)
          throw new Error("This version needs both a before photo and a finished render.");
        const range =
          p.total_low != null
            ? presMoney(p.total_low) + " \u2013 " + presMoney(p.total_high)
            : null;
        const { blob, ext } = await buildSocialReel(
          p.before_url,
          p.after_url,
          {
            room: p.room_name,
            address: p.address,
            style: p.style ? p.style + " \u00b7 " + (p.grade || "retail") + " grade" : null,
            range,
          },
          (pct) => setLab(Math.round(pct * 100) + "%"),
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          String(p.room_name || "real-designs")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-") +
          "-reel." +
          ext;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } catch (e) {
        showAlert("Could not build that reel. " + ((e && e.message) || ""));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = old;
          lucide.createIcons();
        }
      }
    }

    const linkList = document.getElementById("linkList");
    if (linkList)
      linkList.addEventListener("click", async (e) => {
        const tab = e.target.closest("[data-pf]");
        if (tab) {
          PRES_FILTER = tab.getAttribute("data-pf");
          renderPresRows();
          return;
        }
        const row = e.target.closest("[data-pid]");
        if (!row) return;
        if (e.target.closest("[data-hist]")) {
          togglePresHistory(row.dataset.pid);
          return;
        }
        if (e.target.closest("[data-remind]")) {
          presSendModal(
            PRES_ROWS.find((x) => x.id === row.dataset.pid),
            true,
          );
          return;
        }
        if (e.target.closest("[data-send]")) {
          presSendModal(PRES_ROWS.find((x) => x.id === row.dataset.pid));
          return;
        }

        if (e.target.closest("[data-copy]")) {
          const url = presLink(row.dataset.tok);
          try {
            await navigator.clipboard.writeText(url);
          } catch (_) {}
          const pill = row.querySelector(".pill");
          const old = pill.textContent;
          pill.textContent = "Link Copied";
          setTimeout(() => {
            pill.textContent = old;
          }, 1400);
          return;
        }
        if (e.target.closest("[data-pdf]")) {
          exportPresentationPdf(row.dataset.pid, e.target.closest("[data-pdf]"));
          return;
        }
        if (e.target.closest("[data-board]")) {
          exportPresentationBoard(row.dataset.pid, e.target.closest("[data-board]"));
          return;
        }
        if (e.target.closest("[data-reel]")) {
          exportSocialReel(row.dataset.pid, e.target.closest("[data-reel]"));
          return;
        }
        if (e.target.closest("[data-del]")) {
          try {
            await deletePresentation({ data: { id: row.dataset.pid } });
          } catch (_) {}
          paintPresentations();
        }
      });

    /* ---------- send a client link ----------
   No mail server is wired up, so we hand the pro a finished message they can
   send from their own inbox. Wording changes with the status of the link so a
   follow up never reads like the first email. */
    function presMessage(r, reminder) {
      const url = presLink(r.token);
      const who = r.client_name || "there";
      const what = r.title || "your design";
      const place = [r.address, r.room_name].filter(Boolean).join(", ");
      const st = r.status || "sent";
      const opened = (r.view_count || 0) > 0;
      if (reminder && st !== "approved") {
        const n = r.reminder_count || 0;
        const lead =
          n >= 1
            ? "I know things get busy, so this is my last nudge on " + (place || what) + "."
            : opened
              ? "You had a look at the design for " +
                (place || what) +
                ", so I wanted to check where you landed."
              : "Circling back on the design I sent for " + (place || what) + ".";
        return {
          subject: (n >= 1 ? "Last Check On " : "Quick Reminder: ") + what,
          body:
            "Hi " +
            who +
            ",\n\n" +
            lead +
            "\n\nEverything sits on one page, the before and after and the scope:\n\n" +
            url +
            "\n\nApprove it there when you are ready, or leave a note on any line you want changed and I will rework it.\n\nThank you",
        };
      }
      if (st === "changes") {
        return {
          subject: "Updated: " + what,
          body:
            "Hi " +
            who +
            ",\n\nI made the changes you asked for on " +
            (place || what) +
            ". Same link, updated design:\n\n" +
            url +
            "\n\nTake a look and approve it there, or tell me what to adjust next.\n\nThank you",
        };
      }
      if (opened && st !== "approved") {
        return {
          subject: "Following Up On " + what,
          body:
            "Hi " +
            who +
            ",\n\nJust checking in on the design I sent for " +
            (place || what) +
            ". Everything you need is on one page, the before and after and the scope:\n\n" +
            url +
            "\n\nApprove it there when you are ready, or leave a note with what you want changed.\n\nThank you",
        };
      }
      if (st === "approved") {
        return {
          subject: "Approved: " + what,
          body:
            "Hi " +
            who +
            ",\n\nThanks for approving " +
            (place || what) +
            ". Here is the page again for your records:\n\n" +
            url +
            "\n\nI will get the next steps moving and follow up with timing.\n\nThank you",
        };
      }
      return {
        subject: "Your Design Is Ready: " + what,
        body:
          "Hi " +
          who +
          ",\n\nHere is the design for " +
          (place || what) +
          ". One page, no login. You will see the before and after photo and what is being changed:\n\n" +
          url +
          "\n\nApprove it right on the page, or leave a note with anything you want changed.\n\nThank you",
      };
    }

    function presSendModal(r, reminder) {
      if (!r) return;
      const msg = presMessage(r, reminder);
      const sent = r.reminder_count || 0;
      let m = document.getElementById("sendModal");
      if (!m) {
        m = document.createElement("div");
        m.id = "sendModal";
        m.className = "up-modal";
        (document.querySelector(".rd-app") || document.body).appendChild(m);
      }
      m.innerHTML =
        '<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true" style="width:min(560px,calc(100vw - 32px))">' +
        "<h3>" +
        (reminder ? "Send Approval Reminder" : "Send To Client") +
        "</h3>" +
        "<p>" +
        (reminder
          ? "This link has been out since " +
            presHistWhen(r.reminded_at || r.created_at) +
            (sent
              ? " and " +
                sent +
                " reminder" +
                (sent === 1 ? " has" : "s have") +
                " gone out already"
              : " with no decision yet") +
            ". Send this from your own inbox and the reminder is logged on the activity timeline."
          : "Edit anything you like, then send it from your own inbox so the reply comes back to you. The link works without a login and updates as you change the design.") +
        "</p>" +
        '<div class="field"><label>To</label><input id="sndTo" type="email" placeholder="client@email.com" value="' +
        esc(r.client_email || "") +
        '"></div>' +
        '<div class="field"><label>Subject</label><input id="sndSub" type="text" value="' +
        esc(msg.subject) +
        '"></div>' +
        '<div class="field"><label>Message</label><textarea id="sndBody" rows="9">' +
        esc(msg.body) +
        "</textarea></div>" +
        '<div class="up-act"><button class="btn btn-ghost btn-sm" data-close>Cancel</button>' +
        '<button class="btn btn-ghost btn-sm" id="sndCopy"><i data-lucide="copy"></i>Copy Message</button>' +
        '<button class="btn btn-primary btn-sm" id="sndMail"><i data-lucide="send"></i>Open In Email App</button></div></div>';
      m.classList.add("on");
      lucide.createIcons();
      const close = () => m.classList.remove("on");
      m.addEventListener("click", (e) => {
        if (e.target.closest("[data-close]")) close();
      });
      const logged = { done: false };
      const logReminder = async () => {
        if (!reminder || logged.done) return;
        logged.done = true;
        try {
          await markPresentationReminded({ data: { id: r.id } });
          await paintPresentations();
        } catch (_) {}
      };
      const vals = () => ({
        to: (document.getElementById("sndTo") || { value: "" }).value.trim(),
        sub: (document.getElementById("sndSub") || { value: "" }).value,
        body: (document.getElementById("sndBody") || { value: "" }).value,
      });
      document.getElementById("sndCopy").addEventListener("click", async (ev) => {
        const v = vals();
        try {
          await navigator.clipboard.writeText(v.sub + "\n\n" + v.body);
        } catch (_) {}
        const b = ev.currentTarget;
        const old = b.innerHTML;
        b.textContent = "Copied";
        setTimeout(() => {
          b.innerHTML = old;
          lucide.createIcons();
        }, 1400);
        logReminder();
      });
      document.getElementById("sndMail").addEventListener("click", () => {
        const v = vals();
        window.location.href =
          "mailto:" +
          encodeURIComponent(v.to) +
          "?subject=" +
          encodeURIComponent(v.sub) +
          "&body=" +
          encodeURIComponent(v.body);
        logReminder();
        close();
      });
    }

    function presModal() {
      let m = document.getElementById("presModal");
      if (!m) {
        m = document.createElement("div");
        m.id = "presModal";
        m.className = "up-modal";
        m.innerHTML =
          '<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true">' +
          "<h3>New Client Approval Link</h3>" +
          "<p>Pick a saved design. The client opens a branded page with the before and after and the scope, then approves or asks for changes. No login needed.</p>" +
          '<div class="field"><label>Design</label><select id="plVer"></select></div>' +
          '<div class="field"><label>Title</label><input id="plTitle" type="text" placeholder="Living Room Refresh"></div>' +
          '<div class="field"><label>Client Name</label><input id="plName" type="text" placeholder="Keisha C."></div>' +
          '<div class="field"><label>Client Email (Optional)</label><input id="plMail" type="email" placeholder="client@email.com"></div>' +
          '<div id="plErr" style="display:none;font-size:.78rem;color:var(--red);margin-bottom:8px"></div>' +
          '<div id="plOut" style="display:none;margin-bottom:10px"><div class="rowi"><div class="rowt"><b>Link Ready</b><span id="plUrl" style="word-break:break-all"></span></div></div></div>' +
          '<button class="btn btn-primary btn-block" id="plGo"><i data-lucide="link"></i>Create Link</button>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:8px" data-close>Close</button></div>';
        (document.querySelector(".rd-app") || document.body).appendChild(m);
        m.addEventListener("click", (e) => {
          if (e.target.hasAttribute && e.target.hasAttribute("data-close"))
            m.classList.remove("on");
        });
        m.querySelector("#plGo").addEventListener("click", async () => {
          const err = m.querySelector("#plErr"),
            out = m.querySelector("#plOut"),
            go = m.querySelector("#plGo");
          const version_id = m.querySelector("#plVer").value;
          const title = (m.querySelector("#plTitle").value || "").trim();
          if (!version_id) {
            err.style.display = "block";
            err.textContent = "Save a room in Studio first, then come back.";
            return;
          }
          if (!title) {
            err.style.display = "block";
            err.textContent = "Give the package a title your client will recognise.";
            return;
          }
          err.style.display = "none";
          go.disabled = true;
          try {
            const bk = (PREFS && PREFS.brand) || {};
            const accent = /^#[0-9a-f]{6}$/i.test(bk.color || "") ? bk.color : undefined;
            const res = await createPresentation({
              data: {
                version_id,
                title,
                client_name: (m.querySelector("#plName").value || "").trim() || undefined,
                client_email: (m.querySelector("#plMail").value || "").trim() || undefined,
                brand_name: (bk.company || "").trim() || undefined,
                brand_accent: accent,
              },
            });
            const url = presLink(res.token);
            out.style.display = "block";
            m.querySelector("#plUrl").textContent = url;
            try {
              await navigator.clipboard.writeText(url);
            } catch (_) {}
            paintPresentations();
          } catch (e) {
            err.style.display = "block";
            err.textContent =
              (e && e.message) || "We could not create that link. Check the details and try again.";
          }
          go.disabled = false;
        });
      }
      const sel = m.querySelector("#plVer");
      const plGo = m.querySelector("#plGo");
      m.querySelector("#plErr").style.display = "none";
      m.querySelector("#plOut").style.display = "none";
      m.classList.add("on");
      sel.innerHTML = '<option value="">Loading Your Saved Designs</option>';
      plGo.disabled = true;
      lucide.createIcons();
      (async () => {
        let versions = [];
        try {
          versions = (await listShareableVersions()) || [];
        } catch (_) {
          versions = [];
        }
        if (!versions.length) {
          /* fall back to whatever the loaded tree knows about */
          PROP_TREE.forEach((p) =>
            p.projects.forEach((pr) =>
              pr.rooms.forEach((r) => {
                if (r.version_id)
                  versions.push({ id: r.version_id, label: p.address + " \u00b7 " + r.name });
              }),
            ),
          );
        }
        if (!versions.length) {
          sel.innerHTML = '<option value="">No Saved Designs Yet</option>';
          const err = m.querySelector("#plErr");
          err.style.display = "block";
          err.textContent =
            "Save a design in Studio first. Approval links are built from a saved before and after.";
          plGo.disabled = true;
          let jump = m.querySelector("#plStudio");
          if (!jump) {
            jump = document.createElement("button");
            jump.id = "plStudio";
            jump.className = "btn btn-primary btn-block";
            jump.textContent = "Open Studio";
            jump.addEventListener("click", () => {
              m.classList.remove("on");
              go("studio");
            });
            plGo.parentNode.insertBefore(jump, plGo);
          }
          jump.hidden = false;
          plGo.hidden = true;
          return;
        }
        const jump = m.querySelector("#plStudio");
        if (jump) jump.hidden = true;
        plGo.hidden = false;
        plGo.disabled = false;
        sel.innerHTML = versions
          .map((v) => `<option value="${v.id}">${esc(v.label)}</option>`)
          .join("");
        const t = m.querySelector("#plTitle");
        if (t && !t.value) t.value = (versions[0].room ? versions[0].room : "Design") + " Approval";
      })();
    }

    const newLinkBtn = document.getElementById("newLinkBtn");
    if (newLinkBtn) newLinkBtn.addEventListener("click", presModal);
    paintPresentations();
    window.addEventListener("rd:saved", () => paintPresentations());

    /* ---------- team ---------- */
    const ROLE_ORDER = ["viewer", "member", "admin"];
    const ROLE_LABEL = { viewer: "Viewer", member: "Member", admin: "Admin" };
    const ROLE_HELP = {
      viewer:
        "Viewer: Can view properties, designs, budgets and presentations, and leave comments. Cannot upload, generate or spend credits.",
      member:
        "Member: Everything a Viewer can do, plus upload photos, create designs, budgets, videos and presentations. Spends workspace credits. Cannot invite people or change billing.",
      admin:
        "Admin: Everything a Member can do, plus invite teammates, change roles, delete any work and edit Brand Kit, Defaults and CRM Sync. Cannot manage the plan or billing.",
    };
    async function paintTeam() {
      const list = document.getElementById("teamList");
      if (!list) return;
      let name = "You",
        mail = "",
        av = "YOU";
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          mail = user.email || "";
          name =
            (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
            mail.split("@")[0] ||
            "You";
          av =
            name
              .split(/[\s._-]+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0].toUpperCase())
              .join("") || "YOU";
        }
      } catch (_) {}
      let team = { sent: [], received: [] };
      try {
        team = await listTeam();
      } catch (_) {}
      const esc = (s) =>
        String(s || "").replace(
          /[<>&"]/g,
          (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c],
        );
      const invites = (team.sent || [])
        .map(
          (
            i,
          ) => `<div class="seat"><span class="av">${esc((i.email || "?")[0].toUpperCase())}</span>
      <div class="rowt"><b>${esc(i.email)}</b><span>${i.status === "accepted" ? "Accepted" : i.status === "declined" ? "Declined" : "Invite Pending"} \u00b7 ${esc(ROLE_LABEL[i.role] || i.role)}</span></div>
      <select class="seat-role" data-setrole="${i.id}" title="Change Role" style="width:120px;border:1px solid var(--line,#e6e6e6);border-radius:10px;padding:6px 8px;background:#fff;font-size:12px;margin-left:8px">${ROLE_ORDER.map((r) => `<option value="${r}"${i.role === r ? " selected" : ""}>${ROLE_LABEL[r]}</option>`).join("")}</select>
      <span class="pill ${i.status === "accepted" ? "p-green" : "p-gray"}">${i.status === "accepted" ? "Active" : i.status === "declined" ? "Declined" : "Pending"}</span>
      ${i.status === "pending" ? `<button class="btn btn-g" data-copyinv="${esc(i.email)}" style="margin-left:8px">Copy Invite Link</button>` : ""}
      <button class="btn btn-g" data-revoke="${i.id}" style="margin-left:8px">Remove</button></div>`,
        )
        .join("");

      const inbound = (team.received || [])
        .map(
          (i) => `<div class="seat"><span class="av">IN</span>
      <div class="rowt"><b>You Were Invited To Another Workspace</b><span>Role: ${esc(i.role)}</span></div>
      <button class="btn btn-g" data-decline="${i.id}">Decline</button>
      <button class="btn btn-p" data-accept="${i.id}" style="margin-left:8px">Accept</button></div>`,
        )
        .join("");
      list.innerHTML = `<div class="seat"><span class="av">${av}</span><div class="rowt"><b>${name}</b><span>${mail || "Signed in"}</span></div>
    <span class="pill p-ink">Owner</span></div>${invites}${inbound}
    ${invites ? "" : '<p style="font-size:.79rem;color:var(--mute-2);margin:10px 0 0">No Teammates Yet. Invite one below. They sign in with that email, accept the invite, and then share this workspace with you.</p>'}`;
      const seatEl = document.getElementById("seatCount");
      if (seatEl) {
        const n = 1 + (team.sent || []).length;
        seatEl.textContent = n + (n === 1 ? " Seat" : " Seats");
      }
      list.querySelectorAll("[data-copyinv]").forEach((b) =>
        b.addEventListener("click", async () => {
          const link =
            window.location.origin + "/app?invite=" + encodeURIComponent(b.dataset.copyinv);
          try {
            await navigator.clipboard.writeText(link);
          } catch (_) {}
          const t = b.textContent;
          b.textContent = "Link Copied";
          setTimeout(() => {
            b.textContent = t;
          }, 1600);
        }),
      );
      list.querySelectorAll("[data-setrole]").forEach((sel) =>
        sel.addEventListener("change", async () => {
          sel.disabled = true;
          try {
            await updateInviteRole({ data: { id: sel.dataset.setrole, role: sel.value } });
          } catch (_) {}
          paintTeam();
        }),
      );
      list.querySelectorAll("[data-revoke]").forEach((b) =>
        b.addEventListener("click", async () => {
          b.disabled = true;
          try {
            await revokeInvite({ data: { id: b.dataset.revoke } });
          } catch (_) {}
          paintTeam();
        }),
      );

      list.querySelectorAll("[data-accept]").forEach((b) =>
        b.addEventListener("click", async () => {
          b.disabled = true;
          try {
            await acceptInvite({ data: { id: b.dataset.accept } });
          } catch (_) {}
          /* Joining a workspace changes the data, not the page: refresh what the
       accepted invite affects instead of reloading the whole app. */
          paintTeam();
          paintInviteBanner();
          refreshAfterInvite();
        }),
      );
      list.querySelectorAll("[data-decline]").forEach((b) =>
        b.addEventListener("click", async () => {
          b.disabled = true;
          try {
            await declineInvite({ data: { id: b.dataset.decline } });
          } catch (_) {}
          paintTeam();
          paintInviteBanner();
        }),
      );

      const rows = document.getElementById("usageRows");
      if (rows) {
        let designs = 0,
          scopes = 0;
        try {
          const hist = await listCreditHistory();
          hist.forEach((h) => {
            if (h.action === "design") designs++;
            if (h.action === "scope") scopes++;
          });
        } catch (_) {}
        rows.innerHTML =
          `<tr><td><b>${name}</b></td><td>Owner</td><td class="n">${designs}</td><td class="n">${scopes}</td><td class="n">Now</td></tr>` +
          (team.sent || [])
            .map(
              (i) =>
                `<tr><td><b>${esc(i.email)}</b></td><td>${esc(i.role)}</td><td class="n">0</td><td class="n">0</td><td class="n">${i.status === "accepted" ? "Joined" : "Pending"}</td></tr>`,
            )
            .join("");
      }
      lucide.createIcons();
    }
    paintTeam();
    window.addEventListener("rd:credits-changed", () => paintTeam());

    /** Refresh workspace-scoped data after an invite is accepted. */
    function refreshAfterInvite() {
      try {
        reloadTree();
      } catch (_) {}
      try {
        window.dispatchEvent(new CustomEvent("rd:credits-changed"));
      } catch (_) {}
    }

    /* Pending workspace invites: shown at the top of the app until answered. */
    async function paintInviteBanner() {
      const host = document.querySelector(".content") || document.querySelector(".main");
      if (!host) return;
      let team = { received: [] };
      try {
        team = await listTeam();
      } catch (_) {
        return;
      }
      const inv = team.received || [];
      let bar = document.getElementById("inviteBar");
      if (!inv.length) {
        if (bar) bar.remove();
        return;
      }
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "inviteBar";
        bar.className = "invite-bar";
        host.prepend(bar);
      }
      const i = inv[0];
      bar.innerHTML =
        '<i data-lucide="user-plus"></i><div class="ib-t"><b>You Have Been Invited To Join A Workspace</b>' +
        "<span>Accept to share their properties, designs, scopes and presentations. Role: " +
        String(i.role || "member") +
        "</span></div>" +
        '<button class="btn btn-ghost btn-xs" id="ibNo">Decline</button>' +
        '<button class="btn btn-primary btn-xs" id="ibYes">Accept Invite</button>';
      lucide.createIcons();
      const done = () => {
        paintInviteBanner();
        paintTeam();
        refreshAfterInvite();
      };
      const yes = document.getElementById("ibYes"),
        no = document.getElementById("ibNo");
      if (yes)
        yes.addEventListener("click", async () => {
          yes.disabled = true;
          try {
            await acceptInvite({ data: { id: i.id } });
          } catch (_) {}
          done();
        });
      if (no)
        no.addEventListener("click", async () => {
          no.disabled = true;
          try {
            await declineInvite({ data: { id: i.id } });
          } catch (_) {}
          paintInviteBanner();
        });
    }
    paintInviteBanner();

    (function () {
      const rl = document.getElementById("tmRole"),
        help = document.getElementById("tmRoleHelp");
      if (!rl || !help) return;
      const paint = () => {
        help.textContent = ROLE_HELP[rl.value] || "";
      };
      rl.addEventListener("change", paint);
      paint();
    })();

    const tmSend = document.getElementById("tmSend");
    if (tmSend)
      tmSend.addEventListener("click", async () => {
        const em = document.getElementById("tmEmail"),
          rl = document.getElementById("tmRole"),
          msg = document.getElementById("tmMsg");
        const email = ((em && em.value) || "").trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          if (msg) {
            msg.textContent = "Enter a valid email address.";
            msg.style.color = "var(--red)";
          }
          return;
        }
        tmSend.disabled = true;
        if (msg) {
          msg.textContent = "Sending";
          msg.style.color = "var(--mute)";
        }
        try {
          const r = await inviteMember({ data: { email, role: (rl && rl.value) || "member" } });
          if (r && r.ok) {
            if (msg) {
              msg.textContent =
                "Invite Added. " +
                email +
                " can accept it after signing in as a " +
                (ROLE_LABEL[(rl && rl.value) || "member"] || "Member") +
                ".";
              msg.style.color = "var(--mute-2)";
            }
            if (em) em.value = "";
            paintTeam();
          } else if (msg) {
            msg.textContent = (r && r.error) || "Could not send that invite.";
            msg.style.color = "var(--red)";
          }
        } catch (e) {
          if (msg) {
            msg.textContent =
              "We could not send that invite. Double-check the email address and try again.";
            msg.style.color = "var(--red)";
          }
        }
        tmSend.disabled = false;
      });

    /* ---------- workspace preferences ---------- */
    function pfSet(id, v) {
      const el = document.getElementById(id);
      if (el && v != null) el.value = v;
    }
    async function loadPrefs() {
      try {
        PREFS = await getPrefs();
      } catch (_) {
        PREFS = { ...DEFAULT_PREFS };
      }
      paintNotifPrefs();
      pfSet("bkCompany", PREFS.brand.company);
      pfSet("bkColor", PREFS.brand.color);
      pfSet("bkMark", PREFS.brand.watermark);
      (async () => {
        const sel = document.getElementById("dfMarket");
        if (!sel) return;
        const note = document.getElementById("dfMarketNote");
        let a = { markets: [] };
        try {
          a = await budgetAvailability();
        } catch (_) {}
        const list = (a && a.markets) || [];
        if (!list.length) {
          sel.innerHTML = '<option value="">No Markets Available Yet</option>';
          sel.disabled = true;
          if (note)
            note.textContent =
              "Budgets Turn On Once Verified Local Cost Data Is Licensed For A Market.";
          return;
        }
        sel.disabled = false;
        sel.innerHTML = list.map((m) => "<option>" + m + "</option>").join("");
        if (note) note.textContent = "";
        pfSet("dfMarket", PREFS.defaults.market);
      })();
      pfSet("dfGrade", PREFS.defaults.grade);
      pfSet("dfBand", PREFS.defaults.band);
      pfSet("dfDisc", PREFS.defaults.disclosure);
      try {
        buildNotifs();
      } catch (_) {}
    }
    function wireSave(btnId, msgId, collect, key) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener("click", async () => {
        const msg = document.getElementById(msgId);
        btn.disabled = true;
        if (msg) {
          msg.textContent = "Saving";
          msg.style.color = "var(--mute)";
        }
        try {
          PREFS = await savePrefs({ [key]: collect() });
          if (msg) {
            msg.textContent = "Saved";
            msg.style.color = "var(--ok,#0a7b3e)";
          }
        } catch (err) {
          if (msg) {
            msg.textContent = (err && err.message) || "Could not save";
            msg.style.color = "var(--red,#CC0000)";
          }
        }
        btn.disabled = false;
      });
    }
    const val = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : "";
    };
    wireSave(
      "bkSave",
      "bkMsg",
      () => ({ company: val("bkCompany"), color: val("bkColor"), watermark: val("bkMark") }),
      "brand",
    );
    wireSave(
      "dfSave",
      "dfMsg",
      () => ({
        market: val("dfMarket"),
        grade: val("dfGrade"),
        band: val("dfBand"),
        disclosure: val("dfDisc"),
      }),
      "defaults",
    );
    loadPrefs();

    /* ---------- collapse the left menu ----------
   The rail keeps the icons visible and only then shows tooltips, since the
   labels are already on screen when the menu is open. */
    (function () {
      const shell = document.querySelector(".rd-app .app");
      const tog = document.getElementById("sideToggle");
      if (!shell || !tog) return;
      const KEY = "rd.sidemin";
      // No view forces the rail closed anymore; the user's preference always wins.
      const FORCED: string[] = [];
      function apply(min) {
        shell.classList.toggle("sidemin", min);
        tog.setAttribute("aria-label", min ? "Expand Menu" : "Collapse Menu");
        /* the rail draws its own tooltip from data-tip, so the shared data-tt
       hint is removed there to avoid a stale, duplicated label */
        if (min) {
          tog.setAttribute("data-tip", "Expand Menu");
          tog.removeAttribute("data-tt");
        } else {
          tog.removeAttribute("data-tip");
          tog.setAttribute("data-tt", "Collapse Menu");
        }
        tog.removeAttribute("title");
        tog.innerHTML = '<i data-lucide="' + (min ? "chevrons-right" : "chevrons-left") + '"></i>';
        try {
          lucide.createIcons();
        } catch (_) {}
      }

      let min = false;
      try {
        min = localStorage.getItem(KEY) === "1";
      } catch (_) {}
      function currentView() {
        const on = document.querySelector(".rd-app .view.on");
        return on ? on.id.replace(/^v-/, "") : "";
      }
      function applyForView(v) {
        apply(FORCED.indexOf(v || currentView()) >= 0 ? true : min);
      }
      window.__rdRailForView = applyForView;
      applyForView("");
      /* Workflows such as the listing-video builder can borrow the rail for the
     duration of the flow. The borrowed state is never written to storage, and a
     manual toggle during the flow wins until the flow ends. */
      let borrowed = false,
        prevMin = null,
        manual = false;
      window.__rdRailBorrow = {
        collapse() {
          if (manual) return;
          if (prevMin === null) prevMin = shell.classList.contains("sidemin");
          borrowed = true;
          apply(true);
        },
        release() {
          if (prevMin !== null) apply(prevMin);
          prevMin = null;
          borrowed = false;
          manual = false;
        },
      };
      function toggle() {
        const next = !shell.classList.contains("sidemin");
        if (borrowed) {
          manual = true;
        } else {
          min = next;
          try {
            localStorage.setItem(KEY, min ? "1" : "0");
          } catch (_) {}
        }
        apply(next);
      }
      tog.addEventListener("click", toggle);
      /* leaving the workflow via the main menu also hands the rail back */
      document.addEventListener(
        "click",
        (e) => {
          if (e.target.closest && e.target.closest(".rd-app .nav-i")) {
            window.__rdCanvasRail = false;
            if (borrowed) window.__rdRailBorrow.release();
          }
        },
        true,
      );
      const brand = document.querySelector(".rd-app .side-top .logo");
      if (brand) {
        brand.setAttribute("role", "button");
        brand.setAttribute("tabindex", "0");
        brand.setAttribute("aria-label", "Expand menu");
        brand.addEventListener("click", () => {
          if (shell.classList.contains("sidemin")) toggle();
        });
        brand.addEventListener("keydown", (e) => {
          if ((e.key === "Enter" || e.key === " ") && shell.classList.contains("sidemin")) {
            e.preventDefault();
            toggle();
          }
        });
      }
    })();

    /* ---------- help menu ---------- */
    const helpBtn = document.getElementById("helpBtn"),
      helpMenu = document.getElementById("helpMenu");
    function closeHelp() {
      if (helpMenu) {
        helpMenu.classList.remove("on");
        helpBtn.setAttribute("aria-expanded", "false");
      }
    }
    if (helpBtn && helpMenu) {
      helpBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAcct();
        closeSch();
        try {
          window.rdCloseCreateMenu && window.rdCloseCreateMenu();
        } catch (_) {}
        const open = !helpMenu.classList.contains("on");
        helpMenu.classList.toggle("on", open);
        helpBtn.setAttribute("aria-expanded", String(open));
      });
      helpMenu.addEventListener("click", (e) => {
        if (e.target.closest(".acct-i")) closeHelp();
      });
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".help-wrap")) closeHelp();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeHelp();
      });
    }

    /* ---------- help center ---------- */
    const HELP_POP = [
      "Getting Started",
      "Photos",
      "Reality Lock",
      "Credits",
      "Budget",
      "Client Links",
    ];
    document.getElementById("helpPop").innerHTML = HELP_POP.map(
      (t) => `<span class="chip">${t}</span>`,
    ).join("");
    document.getElementById("helpQuick").innerHTML = [
      [
        "1",
        "Add Your First Property",
        "Open Studio, upload a room photo, and save the version to create the property and room record.",
      ],
      [
        "2",
        "Design A Room",
        "Pick a direction and intensity, generate a version for 1 credit, and keep the one that lands.",
      ],
      ["3", "Send A Client Link", "Package approved rooms and share one link for approval."],
    ]
      .map(
        ([n, t, b]) =>
          `<div class="qs-card"><span class="n">STEP ${n}</span><b>${t}</b><span>${b}</span></div>`,
      )
      .join("");

    /* Each article is real written help. [icon, title, body, optional view to open] */
    let BUDGET_LIVE = false;
    function helpCatsData() {
      const budgetCat = BUDGET_LIVE
        ? [
            "calculator",
            "Budget & Pricing",
            [
              [
                "dollar-sign",
                "How Pricing Is Built",
                "A budget compares the original photo to the approved version, lists what actually changed, then prices those lines by trade at your market and finish grade. It returns a low to high planning range with a contingency, not a bid.",
                "scope",
              ],
              [
                "sliders-horizontal",
                "Budget Bands And Grades",
                "Finish grade (rental, retail, premium) and budget band set the allowance level used for every line. Change either and the range recalculates against the same change list.",
                "scope",
              ],
              [
                "shopping-bag",
                "Product Board",
                "The Products board turns each material line into a card with quantity, allowance range and a search link at the right retailer for that trade. Links are searches, not quoted prices.",
                "products",
              ],
              [
                "triangle-alert",
                "What A Budget Is Not",
                "Every figure is a planning estimate. Subcontractor pricing governs. Always confirm with a bid before committing a client to a number.",
              ],
            ],
          ]
        : [
            "calculator",
            "Budget & Pricing",
            [
              [
                "clock",
                "Budget & Scope — Coming Soon",
                "Budgeting is paused for now while we finish licensing verified local contractor cost data for your market. Nothing is priced or estimated in the meantime; this turns on automatically once that data is in place.",
              ],
            ],
          ];
      return [
        [
          "rocket",
          "Getting Started",
          [
            [
              "image-up",
              "Upload Room Photos",
              "Use a straight-on shot of the room with the widest angle you can get, taken in daylight if possible. JPG or PNG up to about 10MB. Photos are stored privately against your account and are only visible to you until you share a client link.",
              "studio",
            ],
            [
              "map-pin",
              "Add A Property",
              "Properties are created from the work you save. Save a room version in Studio with an address and the property, project and room records appear in the Properties tree.",
              "props",
            ],
            [
              "wand-sparkles",
              "Your First Design",
              "In Studio choose a style direction and an intensity (Refresh, Makeover, Renovation, Reimagine), then generate. Each design render costs 1 credit and lands beside the original photo.",
              "studio",
            ],
            [
              "coins",
              "How Credits Work",
              BUDGET_LIVE
                ? "One balance covers everything: a design render is 1 credit, a priced budget is 3, a 2D to 3D plan is 6 and a walkthrough video is 40. If a job fails, the credits are returned automatically. Your balance and every charge are listed in Billing And Credits."
                : "One balance covers everything: a design render is 1 credit, a 2D to 3D plan is 6 and a walkthrough video is 40. If a job fails, the credits are returned automatically. Your balance and every charge are listed in Billing And Credits.",
              "billing",
            ],
          ],
        ],
        [
          "palette",
          "Designing",
          [
            [
              "lock",
              "Reality Lock Explained",
              "Reality Lock holds the walls, window and door openings, ceiling line and floor plane from your photo in place, so a version is a redesign of the same room rather than a new room. Finishes, fixtures, furniture and paint change; the building does not.",
            ],
            [
              "layers",
              "Styles And Intensity",
              "Style sets the look (for example Japandi, Coastal, Midcentury). Intensity sets how far the work goes, from a Refresh that is paint and styling through a Reimagine that assumes full replacement. Intensity is what moves the budget most.",
              "studio",
            ],
            [
              "history",
              "Versions",
              "Every generation is saved as a numbered version on the room, so you can compare, keep several options alive, and send the one the client approved.",
              "designs",
            ],
            [
              "images",
              "Listing Batch",
              "Listing Batch runs every room on a property through the same direction in one pass, one credit per room, and saves each result to its room.",
              "listings",
            ],
          ],
        ],
        budgetCat,
        [
          "share-2",
          "Client Delivery",
          [
            [
              "presentation",
              "Building A Presentation",
              "Pick a version, add a title and the client name, and generate a link. The client sees the before and after, the change list and the planning range on a branded page.",
              "present",
            ],
            [
              "link",
              "Approval Links",
              "Links are read-only for the client and can be opened without an account. Approvals and decision notes come back into Presentations, and view counts update as the link is opened.",
              "present",
            ],
            [
              "printer",
              "PDF And Board Exports",
              "Presentations export a print-ready branded PDF, and the product board prints separately for a contractor or supplier.",
              "present",
            ],
            [
              "palette",
              "Brand Kit",
              "Company name, accent color and watermark from Account, Brand Kit are applied to client pages and exports.",
              "account",
            ],
          ],
        ],
        [
          "user-round",
          "Account & Workspace",
          [
            [
              "bell",
              "Notifications",
              "Notifications are in-app. The three toggles in Account, Notifications control which categories reach your feed. We do not send marketing email.",
              "notifications",
            ],
            [
              "sliders-horizontal",
              "Defaults",
              BUDGET_LIVE
                ? "Market, finish grade, budget band and disclosure ruleset set the starting point for every new budget. They are saved to your account."
                : "Finish grade and disclosure ruleset set the starting point for every new design. They are saved to your account.",
              "account",
            ],
            [
              "users",
              "Team Seats",
              "Invite teammates from Account, Team. They accept the invite with their own login and then share your properties, designs, budgets and presentations. You can copy an invite link to send it yourself, and revoke access at any time.",
              "team",
            ],
            [
              "download",
              "Export And Delete",
              "You can download a JSON of every property, room, version, budget and credit entry, or delete the account and all of its data, from Account, Data And Privacy.",
              "account",
            ],
          ],
        ],
      ];
    }

    const helpCatsEl = document.getElementById("helpCats");
    function renderCats(q) {
      const s = (q || "").trim().toLowerCase();
      const match = (a, name) =>
        !s || name.toLowerCase().includes(s) || (a[1] + " " + a[2]).toLowerCase().includes(s);
      const list = helpCatsData()
        .map(([ic, name, arts]) => [ic, name, arts.filter((a) => match(a, name))])
        .filter((c) => c[2].length);
      helpCatsEl.innerHTML = list.length
        ? list
            .map(
              ([ic, name, arts]) => `<div class="card"><div class="card-b">
    <div class="help-cat"><i data-lucide="${ic}"></i>${name}</div>
    ${arts
      .map(
        ([
          ai,
          label,
          body,
          view,
        ]) => `<button class="help-a" type="button"><i data-lucide="${ai}"></i>${label}</button>
      <div class="help-ans" style="padding:0 8px 10px">${body}${view ? `<div style="margin-top:8px"><button class="btn btn-ghost btn-xs" data-open="${view}"><i data-lucide="arrow-right"></i>Open</button></div>` : ""}</div>`,
      )
      .join("")}
  </div></div>`,
            )
            .join("")
        : `<div class="card"><div class="card-b sub">No articles match that search.</div></div>`;
      lucide.createIcons();
    }
    document.addEventListener("click", (e) => {
      if (e.__rdHelpHandled) return; // init can run twice (StrictMode); handle each click once
      if (!e.target.closest || !e.target.closest("#helpCats,#tutGrid,#tutPaths")) return;
      e.__rdHelpHandled = true;
      const open = e.target.closest("[data-open]");
      if (open) {
        go(open.dataset.open);
        return;
      }
      const b = e.target.closest(".help-a");
      if (!b) return;
      const ans = b.nextElementSibling;
      if (ans && ans.classList.contains("help-ans")) ans.classList.toggle("on");
    });
    function helpFaqData() {
      const list = [
        [
          "Do The Designs Change The Structure Of The Room?",
          "No. Reality Lock holds walls, windows, ceiling lines and the floor plane in place, so every version is a redesign of the same space.",
        ],
        [
          "Can I Upload My Own Photos?",
          "Yes. Any straight-on room photo works. Better light and a wider angle produce better versions.",
        ],
      ];
      if (BUDGET_LIVE) {
        list.splice(1, 0, [
          "How Accurate Is The Budget?",
          "A budget is a planning range built from the change list, your market and your finish grade. It is not a bid, and subcontractor pricing governs.",
        ]);
        list.push([
          "What Does Each Action Cost?",
          "Design render 1 credit, priced budget 3, 2D to 3D plan 6, walkthrough video 40. Failed jobs are refunded automatically.",
        ]);
      } else {
        list.push([
          "What Does Each Action Cost?",
          "Design render 1 credit, 2D to 3D plan 6, walkthrough video 40. Failed jobs are refunded automatically.",
        ]);
        list.push([
          "When Will Budgets Be Available?",
          "Budgeting is paused until verified local contractor cost data is licensed for your market. It will turn on automatically once that data is in place.",
        ]);
      }
      list.push([
        "What Happens When I Run Out Of Credits?",
        "Nothing is deleted. New generations pause until your allowance resets or you top up, and all existing work stays available.",
      ]);
      list.push([
        "Can Clients See My Work Before I Share It?",
        "No. Photos, versions and scopes are private to your account until you create a client link for a specific version.",
      ]);
      return list;
    }
    const helpFaqEl = document.getElementById("helpFaq");
    function renderFaq(q) {
      const s = (q || "").trim().toLowerCase();
      const list = helpFaqData().filter((f) => !s || (f[0] + f[1]).toLowerCase().includes(s));
      helpFaqEl.innerHTML = list.length
        ? list
            .map(
              ([q2, a], i) =>
                `<button class="help-q" data-f="${i}">${q2}<i data-lucide="chevron-down"></i></button><div class="help-ans" data-a="${i}">${a}</div>`,
            )
            .join("")
        : `<div class="sub">Nothing matches that search.</div>`;
      lucide.createIcons();
    }
    helpFaqEl.addEventListener("click", (e) => {
      const b = e.target.closest(".help-q");
      if (!b) return;
      const a = helpFaqEl.querySelector(`[data-a="${b.dataset.f}"]`);
      b.classList.toggle("on");
      a.classList.toggle("on");
    });
    renderCats("");
    renderFaq("");
    const helpQ = document.getElementById("helpQ");
    helpQ.addEventListener("input", () => {
      renderCats(helpQ.value);
      renderFaq(helpQ.value);
    });
    document.getElementById("helpPop").addEventListener("click", (e) => {
      const c = e.target.closest(".chip");
      if (!c) return;
      helpQ.value = c.textContent;
      renderCats(helpQ.value);
      renderFaq(helpQ.value);
    });

    /* ---------- walkthroughs ---------- */
    /* Written step-by-step guides that open the matching view. No Video Library Yet. */
    function tutsData() {
      const list = [
        [
          "Add Your First Property",
          "Getting Started",
          "studio",
          [
            "Open Studio and upload a straight-on photo of the room.",
            "Enter the address so the room is filed under a property.",
            "Generate a version and save it. The property, project and room appear in Properties.",
          ],
        ],
        [
          "Photos That Render Well",
          "Getting Started",
          "studio",
          [
            "Shoot from a doorway or corner so two walls and the floor are visible.",
            "Turn on the lights and open the blinds. Avoid heavy backlight.",
            "Keep the camera level. Tilted shots distort the ceiling line.",
          ],
        ],
        [
          "Reality Lock In Practice",
          "Designing",
          "studio",
          [
            "Generate a version, then flip between before and after.",
            "Check the window and door openings line up. They should not move.",
            "If a version drifts, regenerate. Only finishes and furnishings should change.",
          ],
        ],
        [
          "Choosing Style And Intensity",
          "Designing",
          "studio",
          [
            "Pick a style for the look.",
            "Pick an intensity: Refresh, Makeover, Renovation or Reimagine.",
            "Intensity drives the budget more than direction does, so set it against the money first.",
          ],
        ],
        [
          "Staging A Whole Listing",
          "Listing Batch",
          "listings",
          [
            "Open Listing Batch and select the property.",
            "Choose one direction for the whole listing.",
            "Run the batch. Each room costs 1 credit and saves to its own room record.",
          ],
        ],
      ];
      if (BUDGET_LIVE)
        list.push([
          "Building A Budget",
          "Budget",
          "scope",
          [
            "Open a saved version and request a budget for 3 credits.",
            "Set market, finish grade and budget band.",
            "Review the change list and the low to high planning range, then export or share it.",
          ],
        ]);
      list.push([
        "Working The Product Board",
        "Products",
        "products",
        [
          "Open Products after a budget has been priced.",
          "Each material line becomes a card with quantity and allowance range.",
          "Use Shop On to search the right retailer, or export the board as CSV or print.",
        ],
      ]);
      list.push([
        "Sending A Client Link",
        "Delivery",
        "present",
        [
          "Open Presentations and pick an approved version.",
          "Add a title and the client name, then generate the link.",
          "Share the link. Views, approvals and notes come back into the same row.",
        ],
      ]);
      list.push([
        "Tracking Approvals",
        "Delivery",
        "present",
        [
          "Watch the status pill on each presentation row.",
          "View counts update as the client opens the link.",
          "Approval decisions and client notes appear inline and in your notification feed.",
        ],
      ]);
      return list;
    }
    function tutPathsData() {
      const list = [["Agent Fast Track", "Photo to client link for one listing", "studio"]];
      if (BUDGET_LIVE)
        list.push([
          "Investor Scope Deep Dive",
          "Version to priced scope to product board",
          "scope",
        ]);
      list.push([
        "Delivery And Approvals",
        "Presentations, PDF export and approval tracking",
        "present",
      ]);
      return list;
    }
    function renderTuts() {
      const grid = document.getElementById("tutGrid");
      if (grid)
        grid.innerHTML = tutsData()
          .map(
            ([t, tag, view, steps]) => `<div class="card"><div class="card-b">
  <div class="help-cat"><i data-lucide="list-checks"></i>${t}</div>
  <div class="sub" style="margin:-4px 0 8px">${tag}</div>
  <ol style="margin:0 0 10px 18px;padding:0;list-style:decimal;font-size:.83rem;color:var(--mute);line-height:1.55">${steps.map((s) => `<li style="margin-bottom:4px">${s}</li>`).join("")}</ol>
  <button class="btn btn-ghost btn-xs" data-open="${view}"><i data-lucide="arrow-right"></i>Open ${tag === "Getting Started" ? "Studio" : ""}</button>
</div></div>`,
          )
          .join("");
      const paths = document.getElementById("tutPaths");
      if (paths)
        paths.innerHTML = tutPathsData()
          .map(
            ([n, m, v]) => `<div class="rowi"><div class="rowt"><b>${n}</b><span>${m}</span></div>
<button class="btn btn-ghost btn-xs" data-open="${v}"><i data-lucide="arrow-right"></i>Start</button></div>`,
          )
          .join("");
      try {
        lucide.createIcons();
      } catch (_) {}
    }
    renderTuts();

    /* ---------- feedback modal ---------- */
    const FB_CATS = ["Bug", "Design", "Accuracy", "Feature Request", "Billing", "Other"];
    const fbModal = document.getElementById("fbModal");
    const fbEl = (id) => document.getElementById(id);
    fbEl("fbCats").innerHTML = FB_CATS.map(
      (c) =>
        `<button type="button" class="fb-cat" role="radio" aria-checked="false" data-cat="${c}">${c}</button>`,
    ).join("");
    let fbAttachPath = null;
    let fbAttachMeta = null;
    let fbOriginalBody = null;
    let fbPolishedBody = null;
    let fbSending = false;
    let fbLastFocus = null;

    function fbSelectedCat() {
      const el = document.querySelector("#fbCats .fb-cat.on");
      return el ? el.getAttribute("data-cat") : null;
    }
    function fbBodyOk() {
      return fbEl("fbBody").value.replace(/\s/g, "").length >= 10;
    }
    function fbSync() {
      const body = fbEl("fbBody").value;
      fbEl("fbCount").textContent =
        body.trim().length + (body.trim().length === 1 ? " Character" : " Characters");
      fbEl("fbPolish").disabled = !body.trim().length || fbSending;
      const ok = !!fbSelectedCat() && fbBodyOk();
      fbEl("fbSend").disabled = !ok || fbSending;
    }
    fbEl("fbCats").addEventListener("click", (e) => {
      const c = e.target.closest(".fb-cat");
      if (!c) return;
      document.querySelectorAll("#fbCats .fb-cat").forEach((x) => {
        x.classList.remove("on");
        x.setAttribute("aria-checked", "false");
      });
      c.classList.add("on");
      c.setAttribute("aria-checked", "true");
      fbEl("fbCatErr").hidden = true;
      fbSync();
    });
    fbEl("fbBody").addEventListener("input", () => {
      if (fbBodyOk()) fbEl("fbBodyErr").hidden = true;
      fbSync();
    });

    function fbClearAttachment() {
      fbAttachPath = null;
      fbAttachMeta = null;
      fbEl("fbAttachRow").hidden = true;
      fbEl("fbFileName").textContent = "";
      fbEl("fbFileSize").textContent = "";
    }
    function fbFileError(msg) {
      const f = fbEl("fbFile");
      f.hidden = false;
      f.textContent = msg;
    }
    function openFb() {
      fbLastFocus = document.activeElement;
      fbEl("fbForm").hidden = false;
      fbEl("fbDone").hidden = true;
      fbEl("fbBody").value = "";
      fbEl("fbBodyErr").hidden = true;
      fbEl("fbCatErr").hidden = true;
      fbEl("fbSendErr").hidden = true;
      fbEl("fbFile").hidden = true;
      fbClearAttachment();
      fbOriginalBody = null;
      fbPolishedBody = null;
      fbSending = false;
      const send = fbEl("fbSend");
      send.innerHTML = '<i data-lucide="send"></i>Send Feedback';
      document.querySelectorAll("#fbCats .fb-cat").forEach((x) => {
        x.classList.remove("on");
        x.setAttribute("aria-checked", "false");
      });
      const ctx = feedbackContext();
      const ctxEl = fbEl("fbCtx");
      if (ctxEl) {
        ctxEl.innerHTML = [
          ["Page", ctx.page],
          ["Workflow", ctx.workflow],
          ["Diagnostic ID", ctx.diagnosticId],
          ["App Version", ctx.appVersion],
          ["Timestamp", new Date(ctx.timestamp).toLocaleString()],
        ]
          .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`)
          .join("");
      }
      fbModal.classList.add("on");
      fbSync();
      lucide.createIcons();
      setTimeout(() => fbEl("fbBody").focus(), 30);
    }
    function feedbackContext() {
      const view = ((document.querySelector(".view.on") || {}).id || "").replace(/^v-/, "") || "app";
      const WF = {
        studio: "Photo Design",
        reveal: "Video Builder",
        media: "Media",
        props: "Properties",
        designs: "Designs",
        present: "Presentations",
      };
      const workflow = window.rdWorkflow || WF[view] || "General";
      let appVersion = "Beta";
      try {
        appVersion = "Beta \u00b7 " + (navigator.userAgentData?.platform || navigator.platform || "Web");
      } catch (_) {}
      return {
        page: view,
        workflow: workflow,
        diagnosticId: diagnosticId(),
        appVersion: appVersion,
        timestamp: new Date().toISOString(),
      };
    }
    function closeFb() {
      if (fbSending) return;
      fbModal.classList.remove("on");
      try {
        if (fbLastFocus && document.contains(fbLastFocus)) fbLastFocus.focus();
      } catch (_) {}
    }
    fbEl("fbBtn").addEventListener("click", () => {
      closeHelp();
      openFb();
    });
    fbEl("helpFbBtn").addEventListener("click", openFb);
    fbEl("fbClose").addEventListener("click", closeFb);
    fbEl("fbDoneClose").addEventListener("click", () => {
      fbModal.classList.remove("on");
      try {
        if (fbLastFocus && document.contains(fbLastFocus)) fbLastFocus.focus();
      } catch (_) {}
    });
    fbModal.addEventListener("click", (e) => {
      if (e.target === fbModal) closeFb();
    });
    fbModal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeFb();
        return;
      }
      if (e.key !== "Tab") return;
      const f = fbModal.querySelectorAll(
        'button:not([disabled]), textarea, summary, [href], input, select',
      );
      if (!f.length) return;
      const first = f[0],
        last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    const FB_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
    const FB_MAX = 10 * 1024 * 1024;
    function fbSize(n) {
      return n < 1024 * 1024
        ? Math.max(1, Math.round(n / 1024)) + " KB"
        : (n / (1024 * 1024)).toFixed(1) + " MB";
    }
    fbEl("fbRemove").addEventListener("click", () => {
      fbClearAttachment();
      fbEl("fbFile").hidden = true;
    });
    fbEl("fbAttach").addEventListener("click", () => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "image/png,image/jpeg,image/webp,image/heic,image/heif";
      inp.addEventListener("change", async () => {
        const file = inp.files && inp.files[0];
        if (!file) return;
        fbEl("fbFile").hidden = true;
        if (!FB_TYPES.includes(file.type)) {
          fbFileError("That file type is not supported. Use a JPG, PNG, WebP or HEIC image.");
          return;
        }
        if (file.size > FB_MAX) {
          fbFileError("That image is larger than 10 MB. Try a smaller screenshot.");
          return;
        }
        const row = fbEl("fbAttachRow");
        row.hidden = false;
        fbEl("fbFileName").textContent = file.name;
        fbEl("fbFileSize").textContent = "Uploading\u2026";
        try {
          fbAttachPath = await uploadRoomPhoto(file);
          fbAttachMeta = { name: file.name, size: file.size };
          fbEl("fbFileSize").textContent = fbSize(file.size);
        } catch (_) {
          fbClearAttachment();
          fbFileError("We could not attach that screenshot. Try again or send without it.");
        }
      });
      inp.click();
    });

    fbEl("fbPolish").addEventListener("click", async () => {
      const b = fbEl("fbBody");
      if (!b.value.trim()) return;
      const btn = fbEl("fbPolish");
      const prev = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = "Polishing\u2026";
      fbEl("fbFile").hidden = true;
      try {
        const res = await polishFeedback({
          data: { body: b.value, category: fbSelectedCat() },
        });
        if (res && res.text) {
          fbOriginalBody = b.value;
          fbPolishedBody = res.text;
          b.value = res.text;
        } else {
          fbFileError("We could not polish that right now. Your text is unchanged.");
        }
      } catch (_) {
        fbFileError("We could not polish that right now. Your text is unchanged.");
      } finally {
        btn.innerHTML = prev;
        fbSync();
        lucide.createIcons();
      }
    });

    fbEl("fbSend").addEventListener("click", async () => {
      if (fbSending) return;
      const b = fbEl("fbBody");
      const cat = fbSelectedCat();
      if (!cat) {
        fbEl("fbCatErr").hidden = false;
        return;
      }
      if (!fbBodyOk()) {
        fbEl("fbBodyErr").hidden = false;
        b.focus();
        return;
      }
      fbEl("fbSendErr").hidden = true;
      const send = fbEl("fbSend");
      fbSending = true;
      send.disabled = true;
      send.innerHTML = '<span class="fb-spin"></span>Sending\u2026';
      try {
        const fctx = feedbackContext();
        await submitFeedback({
          category: cat,
          body: b.value,
          originalBody: fbPolishedBody ? fbOriginalBody : null,
          polishedBody: fbPolishedBody && b.value === fbPolishedBody ? fbPolishedBody : null,
          viewContext: fctx.page,
          attachmentPath: fbAttachPath,
          page: fctx.page,
          workflow: fctx.workflow,
          diagnosticId: fctx.diagnosticId,
          appVersion: fctx.appVersion,
          clientTimestamp: fctx.timestamp,
        });
        fbSending = false;
        fbEl("fbForm").hidden = true;
        fbEl("fbDone").hidden = false;
        lucide.createIcons();
      } catch (_) {
        fbSending = false;
        send.innerHTML = '<i data-lucide="send"></i>Retry Sending Feedback';
        const e = fbEl("fbSendErr");
        e.hidden = false;
        e.textContent = "We could not send that just now. Your message is still here—try again.";
        fbSync();
        lucide.createIcons();
      }
    });


    /* ---------- product tour ---------- */
    const TOUR = [
      [
        ".sidebar .nav-i",
        "Navigation",
        "Every part of the workspace lives here, from properties through client presentations.",
      ],
      [
        ".search-wrap",
        "Search Anything",
        "Find a property, room, design or scope. The caret narrows the search or filters it.",
      ],
      ["#helpBtn", "Help Is Here", "Help center, tutorials and feedback, always one click away."],
      [
        ".acct-wrap",
        "Your Account",
        "Profile, team, billing and preferences moved into this menu.",
      ],
      [
        ".topbar .btn-primary",
        "Start Designing",
        "New Design takes a room from photo to buildable version in a couple of minutes.",
      ],
    ];
    let ti = -1,
      tEl = null;
    const veil = document.getElementById("tourVeil"),
      pop = document.getElementById("tourPop");
    function clearHi() {
      if (tEl) {
        tEl.classList.remove("tour-hi");
        tEl = null;
      }
    }
    function endTour() {
      clearHi();
      veil.classList.remove("on");
      pop.classList.remove("on");
      ti = -1;
    }
    function showStep(i) {
      clearHi();
      if (i >= TOUR.length) {
        endTour();
        return;
      }
      ti = i;
      const [sel, title, body] = TOUR[i];
      const el = document.querySelector(sel);
      document.getElementById("tourStep").textContent = `STEP ${i + 1} OF ${TOUR.length}`;
      document.getElementById("tourTitle").textContent = title;
      document.getElementById("tourBody").textContent = body;
      document.getElementById("tourNext").textContent = i === TOUR.length - 1 ? "Done" : "Next";
      veil.classList.add("on");
      pop.classList.add("on");
      if (el) {
        el.classList.add("tour-hi");
        tEl = el;
        const r = el.getBoundingClientRect();
        let top = r.bottom + 12,
          left = r.left;
        if (top + 180 > window.innerHeight) top = Math.max(12, r.top - 180);
        left = Math.min(Math.max(12, left), window.innerWidth - 274);
        pop.style.top = top + "px";
        pop.style.left = left + "px";
      } else {
        pop.style.top = "50%";
        pop.style.left = "50%";
      }
    }
    function startTour() {
      closeHelp();
      showStep(0);
    }
    document.getElementById("tourBtn").addEventListener("click", startTour);
    document.getElementById("helpTourBtn").addEventListener("click", startTour);
    document.getElementById("apiFbBtn").addEventListener("click", openFb);
    document
      .querySelectorAll("[data-pane-go]")
      .forEach((b) => b.addEventListener("click", () => acctPane(b.dataset.paneGo)));
    document.getElementById("tourNext").addEventListener("click", () => showStep(ti + 1));
    document.getElementById("tourSkip").addEventListener("click", endTour);
    veil.addEventListener("click", endTour);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        endTour();
        closeFb();
      }
    });

    /* ---------- notifications (derived from real account activity) ---------- */
    let NOTIFS = [];
    const NOTIF_READ_KEY = "rd.notif.read";
    function notifRead() {
      try {
        return new Set(JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || "[]"));
      } catch (e) {
        return new Set();
      }
    }
    function notifMarkRead(ids) {
      const s = notifRead();
      ids.forEach((i) => s.add(i));
      try {
        localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...s]));
      } catch (e) {}
      NOTIFS.forEach((n) => {
        if (s.has(n.id)) n.unread = false;
      });
    }
    function nAgo(iso) {
      const s = (Date.now() - new Date(iso).getTime()) / 1000;
      if (s < 90) return "now";
      if (s < 5400) return Math.round(s / 60) + "m";
      if (s < 172800) return Math.round(s / 3600) + "h";
      return Math.round(s / 86400) + "d";
    }
    const ACTION_LABEL = {
      design: "Design",
      scope: "Budget",
      plan_3d: "3D Plan",
      video: "Video",
      topup: "Top Up",
      grant: "Credits Granted",
      refund: "Refund",
    };
    async function buildNotifs() {
      const read = notifRead();
      const out = [];
      try {
        const vers = await listSavedEstimates();
        (vers || []).slice(0, 10).forEach((v) => {
          out.push({
            id: "v:" + v.version_id,
            ic: v.status === "approved" ? "check-circle-2" : "wand-sparkles",
            cat: v.status === "approved" ? "approvals" : "designs",
            t:
              v.room_name +
              " v" +
              (v.version_no || 1) +
              (v.status === "approved" ? " Approved" : " Saved"),
            b: (v.address ? v.address + " \u00b7 " : "") + (v.project_name || "Project"),
            at: v.created_at,
            tm: nAgo(v.created_at),
          });
        });
      } catch (e) {}
      try {
        const led = await listCreditHistory();
        (led || []).slice(0, 10).forEach((l) => {
          const spent = l.delta < 0;
          out.push({
            id: "c:" + l.id,
            ic: spent ? "gauge" : "credit-card",
            cat: "billing",
            t:
              (ACTION_LABEL[l.action] || l.action) +
              (spent
                ? " used " + Math.abs(l.delta) + (Math.abs(l.delta) === 1 ? " credit" : " credits")
                : l.delta > 0
                  ? " +" + l.delta + " credits"
                  : ""),
            b: (l.note || "Credit activity") + " \u00b7 Balance " + l.balance_after,
            at: l.created_at,
            tm: nAgo(l.created_at),
          });
        });
      } catch (e) {}
      try {
        const pres = await listPresentations();
        (pres || []).slice(0, 12).forEach((p) => {
          const who = p.client_name || p.client_email || "Your client";
          const where =
            (p.address ? p.address + " \u00b7 " : "") + p.room_name + " v" + (p.version_no || 1);
          if (p.status === "approved") {
            out.push({
              id: "pa:" + p.id,
              ic: "badge-check",
              cat: "approvals",
              go: "present",
              pres: p.id,
              t: who + " Approved " + p.title,
              b: (p.decision_note ? "\u201c" + p.decision_note + "\u201d \u00b7 " : "") + where,
              at: p.decided_at || p.last_viewed_at || p.created_at,
              tm: nAgo(p.decided_at || p.created_at),
            });
          } else if (p.status === "changes") {
            out.push({
              id: "pc:" + p.id,
              ic: "message-square-warning",
              cat: "approvals",
              go: "present",
              pres: p.id,
              t: who + " Requested Changes On " + p.title,
              b: (p.decision_note ? "\u201c" + p.decision_note + "\u201d \u00b7 " : "") + where,
              at: p.decided_at || p.created_at,
              tm: nAgo(p.decided_at || p.created_at),
            });
          } else if (p.status === "viewed" && p.last_viewed_at) {
            out.push({
              id: "pv:" + p.id + ":" + p.view_count,
              ic: "eye",
              cat: "approvals",
              go: "present",
              pres: p.id,
              t: who + " Opened " + p.title,
              b:
                p.view_count +
                (p.view_count === 1 ? " view" : " views") +
                " \u00b7 no decision yet \u00b7 " +
                where,
              at: p.last_viewed_at,
              tm: nAgo(p.last_viewed_at),
            });
          }
        });
      } catch (e) {}
      try {
        const c = await getMyCredits();
        CREDITS = c;
        if (c && c.plan !== "free" && c.balance <= 20)
          out.push({
            id: "low:" + c.balance,
            ic: "triangle-alert",
            cat: "billing",
            t: "Credits Running Low",
            b: c.balance + " credits left on your " + c.plan + " plan.",
            at: new Date().toISOString(),
            tm: "now",
          });
      } catch (e) {}
      try {
        const tm = await listTeam();
        (tm.received || []).forEach((i) => {
          out.push({
            id: "ti:" + i.id,
            ic: "user-plus",
            cat: "team",
            go: "account",
            t: "You Were Invited To Another Workspace",
            b:
              "Accept in Account, Team to share their properties, designs and scopes. Role: " +
              String(i.role || "member"),
            at: i.created_at,
            tm: nAgo(i.created_at),
          });
        });
        (tm.sent || [])
          .filter((i) => i.status === "accepted")
          .slice(0, 8)
          .forEach((i) => {
            out.push({
              id: "tj:" + i.id,
              ic: "users",
              cat: "team",
              go: "account",
              t: i.email + " Joined Your Workspace",
              b:
                "Role: " +
                String(i.role || "member") +
                " \u00b7 they can now see shared properties and designs.",
              at: i.accepted_at || i.created_at,
              tm: nAgo(i.accepted_at || i.created_at),
            });
          });
      } catch (e) {}
      out.sort((a, b) => new Date(b.at) - new Date(a.at));
      const np = (PREFS && PREFS.notifs) || {};
      const kept = out.filter((n) => np[n.cat] !== false);
      NOTIFS = kept.slice(0, 20).map((n) => ({ ...n, unread: !read.has(n.id) }));
      renderNotifs();
    }
    function notifFilter(tab) {
      return NOTIFS.filter((n) =>
        tab === "all" ? true : tab === "unread" ? n.unread : n.cat === tab,
      );
    }
    function notifRow(n) {
      return `<button class="notif-i${n.unread ? " unread" : ""}" data-nid="${n.id}"${n.go ? ` data-ngo="${n.go}"` : ""}${n.pres ? ` data-npres="${n.pres}"` : ""}>
 <span class="notif-ic"><i data-lucide="${n.ic}"></i></span>
 <span class="tx"><b>${n.t}</b><span>${n.b}</span></span>
 <span class="tm">${n.tm}</span>${n.unread ? '<span class="dot"></span>' : ""}</button>`;
    }
    function renderNotifs() {
      const unread = NOTIFS.filter((n) => n.unread).length;
      const dot = document.getElementById("notifDot");
      if (dot) dot.style.display = unread ? "block" : "none";
      const empty =
        '<div class="notif-empty">Nothing here yet. Save a design to start your activity feed.</div>';
      const list = document.getElementById("notifList");
      if (list) {
        const t = document.querySelector("#notifTabs .notif-tab.on")?.dataset.t || "all";
        const r = notifFilter(t);
        list.innerHTML = r.length ? r.map(notifRow).join("") : empty;
      }
      const page = document.getElementById("notifPage");
      if (page) {
        const t2 = document.querySelector("#notifTabs2 .notif-tab.on")?.dataset.t || "all";
        const r2 = notifFilter(t2);
        page.innerHTML = r2.length ? r2.map(notifRow).join("") : empty;
      }
      const cnt = document.getElementById("notifCount");
      if (cnt)
        cnt.textContent = NOTIFS.length
          ? unread
            ? unread + " unread of " + NOTIFS.length + " notifications"
            : "All caught up, " + NOTIFS.length + " notifications"
          : "No Activity Yet";
      lucide.createIcons();
    }
    const notifBtn = document.getElementById("notifBtn"),
      notifMenu = document.getElementById("notifMenu");
    function closeNotif() {
      if (notifMenu) {
        notifMenu.classList.remove("on");
        notifBtn.setAttribute("aria-expanded", "false");
      }
    }
    if (notifBtn && notifMenu) {
      notifBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAcct();
        closeSch();
        closeHelp();
        try {
          window.rdCloseCreateMenu && window.rdCloseCreateMenu();
        } catch (_) {}
        const open = !notifMenu.classList.contains("on");
        notifMenu.classList.toggle("on", open);
        notifBtn.setAttribute("aria-expanded", String(open));
        if (open) buildNotifs();
      });
      document.addEventListener("click", (e) => {
        if (!e.target.closest(".notif-wrap")) closeNotif();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeNotif();
      });
    }
    document.querySelectorAll("#notifTabs .notif-tab,#notifTabs2 .notif-tab").forEach((b) =>
      b.addEventListener("click", () => {
        b.parentElement
          .querySelectorAll(".notif-tab")
          .forEach((x) => x.classList.toggle("on", x === b));
        renderNotifs();
      }),
    );
    document.addEventListener("click", (e) => {
      const row = e.target.closest(".notif-i");
      if (!row) return;
      const inMenu = !!row.closest("#notifList");
      notifMarkRead([row.dataset.nid]);
      const dest = row.dataset.ngo;
      if (inMenu) closeNotif();
      if (dest) go(dest);
      else if (inMenu) go("notifications");
      const pid = row.dataset.npres;
      if (pid)
        setTimeout(() => {
          try {
            focusPresentation(pid);
          } catch (_) {}
        }, 60);
      renderNotifs();
    });
    ["notifRead", "notifReadAll"].forEach((id) => {
      const b = document.getElementById(id);
      if (b)
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          notifMarkRead(NOTIFS.map((n) => n.id));
          renderNotifs();
        });
    });
    buildNotifs();
    window.addEventListener("rd:saved", buildNotifs);
    window.addEventListener("rd:credits-changed", buildNotifs);

    window.addEventListener("rd:prefs", () => {
      try {
        buildNotifs();
      } catch (_) {}
    });
    try {
      paintNotifPrefs();
    } catch (_) {}

    renderNotifs();

    /* ---------- studio: tool rows with plan badges ---------- */
    const toolRows = Array.from(document.querySelectorAll(".toolrow"));
    const toolInfo = document.getElementById("toolInfo");
    const LIVE_TOOLS = {
      "2D To 3D Plan": run3dPlan,
      "Walkthrough Video": runWalkthrough,
      "Virtual Stage": () => runRoomToolFlow("stage", "Virtual Stage", false),
      Declutter: () => runRoomToolFlow("declutter", "Declutter", false),
      "Material Swap": () => runRoomToolFlow("materials", "Material Swap", true),
      "Sketch To Render": () => runRoomToolFlow("sketch", "Sketch To Render", false),
      "Multi Angle": () => runRoomToolFlow("angle", "Multi Angle", true),
    };
    const TOOL_COST = {
      Redesign: 1,
      "Virtual Stage": 1,
      Declutter: 1,
      "Material Swap": 1,
      "Sketch To Render": 1,
      Budget: 3,
      "Multi Angle": 1,
      "Walkthrough Video": 40,
      "2D To 3D Plan": 6,
    };
    toolRows.forEach((r) => {
      const nm = r.getAttribute("data-tool") || "";
      /* Budget is Coming Soon, so it never advertises a credit price. */
      const c = nm === "Budget" && !budgetsLive() ? 0 : TOOL_COST[nm];
      r.title =
        nm +
        (c ? " \u00b7 " + c + " credit" + (c > 1 ? "s" : "") : "") +
        "\n" +
        (r.getAttribute("data-desc") || "");
    });

    /* ---------- studio: visual style selection ---------- */
    let CANVAS_STYLE: any = null;
    function activeToolName() {
      const r = document.querySelector("#fTool .toolrow.on") as any;
      return (r && r.getAttribute("data-tool")) || "Redesign";
    }
    function canvasStyleSelected() {
      try {
        return !!(CANVAS_STYLE && CANVAS_STYLE.selection());
      } catch (_) {
        return false;
      }
    }
    /** Mirror the chosen style into the legacy control every payload already reads. */
    function syncStyleControl(sel: any) {
      const el = document.getElementById("fStyle") as any;
      if (!el) return;
      if (!sel) {
        return;
      }
      const name = sel.style.displayName;
      let opt: any = Array.from(el.options).find(
        (o: any) => o.value === name || (o.dataset && o.dataset.styleId === sel.style.id),
      );
      if (!opt) {
        opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        opt.dataset.styleId = sel.style.id;
        el.insertBefore(opt, el.firstChild);
      }
      opt.dataset.styleId = sel.style.id;
      if (el.value !== opt.value) {
        el.value = opt.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    function currentStyleSelection(): any {
      try {
        return (CANVAS_STYLE && CANVAS_STYLE.selection()) || null;
      } catch (_) {
        return null;
      }
    }
    /**
     * The footer style chip is retired: style is chosen from the visual cards
     * or View All Styles, and the footer keeps a single primary action.
     */
    function paintStyleChip(_sel: any, _prompt: string | null) {
      const btn = document.getElementById("genStyleBtn") as any;
      if (btn) btn.hidden = true;
    }

    /**
     * One authoritative read of what the panel has actually selected. Every
     * summary, warning and payload reads this instead of scraping card text.
     */
    (window as any).__rdCanvasState = () => {
      const tool = activeToolName();
      const need = styleNeedForTool(tool);
      const sel = need ? currentStyleSelection() : null;
      const roomEl = document.getElementById("fRoom") as any;
      return {
        selectedRoomType: ((roomEl && roomEl.value) || "").trim(),
        needsStyle: !!need,
        selectedStyleId: (sel && sel.styleId) || "",
        selectedStyleName: (sel && sel.style && sel.style.displayName) || "",
      };
    };


    function paintGenGate() {
      const btn = document.getElementById("genBtn") as any;
      if (!btn) return;
      const tool = activeToolName();
      const space = currentSpace();
      const need = styleNeedForTool(tool);
      const support = toolSupport(tool, space);
      const missing = (!!need && !canvasStyleSelected()) || !support.ok;
      /* The cost chip always states the real price of this run. */
      const cost = document.getElementById("genCost");
      if (cost) cost.textContent = costLabel(toolCost(tool));
      /* The confirm button always states what this exact click will do. */
      const CONFIRM_LABEL = {
        Redesign: "Generate Design",
        "Virtual Stage": "Stage Room",
        Declutter: "Declutter Room",
        "Material Swap": "Apply Material",
        "Sketch To Render": "Render Sketch",
        "Multi Angle": "Generate Angles",
        "Walkthrough Video": "Render Walkthrough",
        "2D To 3D Plan": "Generate 3D Plan",
      };
      const genLabel = document.getElementById("genLabel");
      if (genLabel) genLabel.textContent = CONFIRM_LABEL[tool] || "Generate Design";

      if (missing) {
        btn.disabled = true;
        btn.dataset.csGate = "1";
        btn.setAttribute(
          "data-tt",
          support.ok
            ? "Choose " + sectionTitle(need as any, space) + " First"
            : (support.reason as string),
        );
        btn.setAttribute("aria-disabled", "true");
        paintStyleChip(null, support.ok ? "Choose " + sectionTitle(need as any, space) : null);
      } else {
        if (btn.dataset.csGate === "1") {
          btn.dataset.csGate = "";
          btn.disabled = !!busy;
          btn.removeAttribute("data-tt");
          btn.setAttribute("aria-disabled", "false");
        }
        paintStyleChip(need ? currentStyleSelection() : null, null);
      }
    }

    /** Canonical space for the Studio chips. */
    function currentSpace() {
      return normalizeSpace(currentProjectType());
    }

    /**
     * Space-aware tool interface. One pass repaints every label, description,
     * disabled state and tooltip; nothing is decided in a click handler.
     */
    function paintSpaceTools() {
      const space = currentSpace();
      /* Only the Studio tool list: other views keep their own rows. */
      const rows = Array.from(document.querySelectorAll("#fTool .toolrow"));
      rows.forEach((r: any) => {
        const nm = r.getAttribute("data-tool") || "";
        /* A tool already gated elsewhere (Budget "Coming Soon", plan locks)
           keeps that state and its explanation: space rules never re-enable
           it and never overwrite its tooltip. */
        if (r.classList.contains("is-disabled")) return;
        const support = toolSupport(nm, space);
        const label = toolLabel(nm, space);
        const desc = toolDescription(nm, space);
        const b = r.querySelector("b");
        if (b) b.textContent = label;
        r.setAttribute("data-desc", desc);
        r.disabled = !support.ok;
        r.classList.toggle("off", !support.ok);
        r.setAttribute("aria-disabled", support.ok ? "false" : "true");
        const c = toolCost(nm);
        /* Branded tooltips read data-tt; a title attribute is stripped at
           init, so setting one here would show nothing. */
        r.setAttribute(
          "data-tt",
          support.ok ? label + " \u00b7 " + costLabel(c) : (support.reason as string),
        );
        r.removeAttribute("title");
        if (!support.ok) r.classList.remove("on");
      });
      if (!document.querySelector("#fTool .toolrow.on")) {
        const fb = document.querySelector(
          '#fTool .toolrow[data-tool="' + fallbackTool(space) + '"]',
        ) as any;
        if (fb) fb.classList.add("on");
      }
      const note = document.getElementById("agentNote") as any;
      if (note) note.placeholder = instructionPlaceholder(space);
      const ctx = document.getElementById("setupCtx");
      if (ctx) {
        (ctx as any).hidden = false;
        const sp = document.getElementById("setupCtxSpace");
        const rm = document.getElementById("setupCtxRoom");
        const tl = document.getElementById("setupCtxTool");
        if (sp)
          sp.textContent = space === "garden" ? "Garden" : space === "exterior" ? "Exterior" : "Interior";
        if (rm)
          rm.textContent = String(currentRoomType() || "")
            .replace(/\b\w/g, (m) => m.toUpperCase());
        if (tl) tl.textContent = toolLabel(activeToolName(), space);
      }
      try {
        CANVAS_STYLE && CANVAS_STYLE.refresh();
      } catch (_) {}
      paintGenGate();
    }
    (window as any).__rdPaintSpaceTools = paintSpaceTools;
    function promptForStyle(tool: string) {
      const need = styleNeedForTool(tool);
      const host = document.getElementById("canvasStyleField");
      try {
        CANVAS_STYLE && CANVAS_STYLE.refresh();
      } catch (_) {}
      if (host) {
        host.scrollIntoView({ behavior: "smooth", block: "center" });
        host.classList.add("cs-flash");
        setTimeout(() => host.classList.remove("cs-flash"), 1200);
      }
      /* The visual cards live in Setup: bring the user to them instead of
         stacking a modal on top of controls they can already see. */
      if (!host) {
        try {
          CANVAS_STYLE && CANVAS_STYLE.open();
        } catch (_) {}
        return;
      }
      try {
        (host.querySelector(".cs-qtile") as HTMLElement | null)?.focus();
      } catch (_) {}
      try {
        window.rdToast &&
          window.rdToast("Choose A " + sectionTitle((need || "design") as any));
      } catch (_) {}
    }
    try {
      CANVAS_STYLE = mountCanvasStyle(
        "canvasStyleField",
        () => {
          const m: any = (() => {
            try {
              return (window as any).__rdStudioMode && (window as any).__rdStudioMode();
            } catch (_) {
              return null;
            }
          })();
          return {
            tool: activeToolName(),
            projectType: currentProjectType(),
            room: currentRoomType(),
            draftId: (m && m.draftId) || null,
            photoKey: (m && m.photoKey) || null,
            propertyId: (STUDIO_CTX && STUDIO_CTX.address) || null,
            photoKeys: (() => {
              try {
                return (
                  ((window as any).__rdCanvasPhotoKeys && (window as any).__rdCanvasPhotoKeys()) ||
                  []
                );
              } catch (_) {
                return [];
              }
            })(),
          };
        },
        (sel) => {
          syncStyleControl(sel);
          paintGenGate();
        },
      );
      (window as any).__rdCanvasStyle = CANVAS_STYLE;
      window.addEventListener("rd:photo", () => {
        try {
          CANVAS_STYLE.refresh();
        } catch (_) {}
      });
      paintGenGate();
      paintSpaceTools();
    } catch (_) {}

    /* The Studio attribute is deliberately NOT data-plan: that name belongs to
       the Billing plan buttons, and sharing it once let a tool click fire a
       subscription mutation. Selecting a locked tool explains the requirement;
       only Billing can change a plan. */
    function requiredPlanFor(row) {
      return normalizePlan(row && row.getAttribute("data-required-plan"));
    }
    function showToolGate(row, name, need) {
      if (!toolInfo) {
        window.rdToast && window.rdToast(name + " Is On The " + planName(need) + " Plan");
        return;
      }
      document.getElementById("toolInfoName").textContent =
        name + " is on the " + planName(need) + " plan";
      const cst = TOOL_COST[name];
      document.getElementById("toolInfoDesc").textContent =
        (row.getAttribute("data-desc") || "") +
        (cst ? " Costs " + cst + " credit" + (cst > 1 ? "s" : "") + " per run." : "") +
        " Upgrade from Billing to unlock it.";
      toolInfo.hidden = false;
    }
    toolRows.forEach((r) =>
      r.addEventListener("click", () => {
        const nm0 = r.getAttribute("data-tool") || "";
        /* Budget never selects, never checks credits and never generates. */
        if (nm0 === "Budget" && !budgetsLive()) {
          openBudgetPopover(r as HTMLElement);
          return;
        }
        const sup = toolSupport(nm0, currentSpace());
        if (!sup.ok) {
          window.rdToast && window.rdToast(sup.reason as string);
          return;
        }
        toolRows.forEach((x) => x.classList.remove("on"));
        r.classList.add("on");
        paintSpaceTools();
        const name = r.getAttribute("data-tool");
        const need = requiredPlanFor(r);
        try {
          CANVAS_STYLE && CANVAS_STYLE.refresh();
        } catch (_) {}
        paintGenGate();
        if (need && !planAllows(window.__rdPlan, need)) {
          showToolGate(r, name, need);
          return;
        }
        /* Selecting a tool NEVER generates and NEVER spends a credit. It only
           activates the tool, opens its settings and, when the tool needs a
           direction, points at the style cards. Generation happens exclusively
           from the confirm button in the panel footer. */
        if (styleNeedForTool(name) && !canvasStyleSelected()) {
          if (toolInfo) toolInfo.hidden = true;
          promptForStyle(name);
          return;
        }

        if (need && toolInfo) {
          showToolGate(r, name, need);
        } else if (toolInfo) {
          toolInfo.hidden = true;
        }
      }),
    );

    /* ---------- studio: canvas surround (dark, fixed) ---------- */

    /* ---------- accounts: signed-in identity + saved projects ---------- */
    const initials = (s) =>
      s
        .split(/[.@\s_-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((x) => x[0].toUpperCase())
        .join("") || "RD";
    // Avatar initials always use the REAL DESIGNS brand red so the mark stays on-brand.
    function avTone(_seed) {
      return "#CC0000";
    }
    function paintAvatars(av, seed) {
      const tone = avTone(seed || av);
      window.__rdAv = { av: av, tone: tone };
      if (!window.__rdAvObs) {
        window.__rdAvObs = new MutationObserver(() => {
          const a = window.__rdAv;
          if (!a) return;
          document.querySelectorAll(".av").forEach((e) => {
            if (e.dataset.avDone) return;
            e.dataset.avDone = "1";
            if (!e.style.backgroundImage) {
              e.textContent = a.av;
              e.style.background = a.tone;
            }
            e.style.color = "#fff";
          });
        });
        window.__rdAvObs.observe(document.body, { childList: true, subtree: true });
      }
      document.querySelectorAll(".av").forEach((e) => {
        e.dataset.avDone = "1";
        if (!e.style.backgroundImage) {
          e.textContent = av;
          e.style.background = tone;
        }
        e.style.color = "#fff";
      });
    }
    const $id = (x) => document.getElementById(x);
    supabase.auth
      .getUser()
      .then(({ data }) => {
        const u = data && data.user;
        if (!u) return;
        const m = u.user_metadata || {};
        const name = m.full_name || m.name || u.email.split("@")[0];
        const av = initials(name);
        paintAvatars(av, u.email || name);
        const head = document.querySelector(".acct-head b");
        if (head) head.textContent = name;
        const mail = document.querySelector(".acct-head div span");
        if (mail) mail.textContent = u.email;
        const n = $id("pfName");
        if (n) n.value = name;
        const ph = $id("pfPhone");
        if (ph) ph.value = m.phone || "";
        const em = $id("pfEmail");
        if (em) em.value = u.email;
        const co = $id("pfCompany");
        if (co) co.value = m.company || "";
        const ro = $id("pfRole");
        if (ro && m.role) ro.value = m.role;
        const se = $id("secEmail");
        if (se) se.textContent = u.email;
      })
      .catch(() => {});

    /* ---------- account side card + data & privacy ---------- */
    async function paintAcctSide() {
      try {
        const { data } = await supabase.auth.getUser();
        const u = data && data.user;
        if (!u) return;
        const m = u.user_metadata || {};
        const name = m.full_name || m.name || u.email.split("@")[0];
        const sn = $id("sideName");
        if (sn) sn.textContent = name;
        const sm = $id("sideMail");
        if (sm) sm.textContent = u.email;
        const sr = $id("sideRole");
        if (sr) sr.textContent = m.role || "Owner";
        const sv = $id("sideVerified");
        if (sv) {
          const ok = !!u.email_confirmed_at;
          sv.textContent = ok ? "Verified" : "Unverified";
          sv.className = "pill " + (ok ? "p-ok" : "p-amb");
        }
      } catch (_) {}
      try {
        const c = await getMyCredits();
        if (!c) return;
        const sp = $id("sidePlan");
        if (sp)
          sp.textContent =
            c.plan === "free" ? "Free" : c.plan.charAt(0).toUpperCase() + c.plan.slice(1);
        const sc = $id("sideCredit"),
          sb = $id("sideCreditBar"),
          ss = $id("sideCreditSub");
        if (c.plan === "free") {
          /* Server returns remainingToday, not a used-count. */
          const left = Math.max(0, Math.min(5, c.remainingToday ?? 5));
          if (sc) sc.textContent = left + " Of 5 Free Designs Left Today";
          if (sb) {
            sb.style.width = (left / 5) * 100 + "%";
            sb.className = left <= 1 ? "low" : "";
          }
          if (ss) ss.textContent = "Free Plan Resets Every Day";
        } else {
          if (sc)
            sc.textContent = c.balance + (c.balance === 1 ? " Credit" : " Credits") + " Available";
          if (sb) {
            const pl = Math.min(100, (c.balance / 200) * 100);
            sb.style.width = pl + "%";
            sb.className = pl <= 10 ? "low" : "";
          }
          if (ss) ss.textContent = "One Balance Covers Designs, Budgets, Plans And Video";
        }
      } catch (_) {}
    }
    paintAcctSide();
    window.addEventListener("rd:credits-changed", paintAcctSide);

    const dpExport = $id("dpExport");
    if (dpExport)
      dpExport.addEventListener("click", async () => {
        const msg = $id("dpMsg");
        const set = (t) => {
          if (msg) msg.textContent = t;
        };
        dpExport.disabled = true;
        set("Building your export");
        try {
          const payload = await exportMyData();
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "real-designs-export-" + new Date().toISOString().slice(0, 10) + ".json";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          set(
            "Export downloaded. It contains every property, room, design, scope and presentation on your account.",
          );
        } catch (e) {
          set("Could not build the export: " + (e && e.message ? e.message : "unknown error"));
        }
        dpExport.disabled = false;
      });

    const dpDelete = $id("dpDelete");
    if (dpDelete)
      dpDelete.addEventListener("click", async () => {
        const msg = $id("dpMsg");
        const set = (t) => {
          if (msg) msg.textContent = t;
        };
        const typed = window.prompt(
          "This permanently deletes your workspace, every design, scope and client link, and your sign in. Type DELETE to confirm.",
        );
        if ((typed || "").trim().toUpperCase() !== "DELETE") {
          set("Deletion cancelled. Nothing was removed.");
          return;
        }
        dpDelete.disabled = true;
        set("Deleting your account");
        try {
          await deleteMyAccount();
          try {
            await supabase.auth.signOut();
          } catch (_) {}
          window.location.href = "/";
        } catch (e) {
          set("Could not delete the account: " + (e && e.message ? e.message : "unknown error"));
          dpDelete.disabled = false;
        }
      });

    const pfSave = $id("pfSave");
    if (pfSave)
      pfSave.addEventListener("click", async () => {
        const msg = $id("pfMsg");
        const name = ($id("pfName").value || "").trim();
        if (!name) {
          if (msg) {
            msg.textContent = "Add your name first";
            msg.style.color = "var(--red)";
          }
          return;
        }
        pfSave.disabled = true;
        if (msg) {
          msg.textContent = "Saving";
          msg.style.color = "var(--mute)";
        }
        const { error } = await supabase.auth.updateUser({
          data: {
            full_name: name,
            phone: ($id("pfPhone").value || "").trim(),
            company: ($id("pfCompany").value || "").trim(),
            role: $id("pfRole") ? $id("pfRole").value : "Owner",
          },
        });
        pfSave.disabled = false;
        if (msg) {
          msg.textContent = error ? "Could not save: " + error.message : "Saved";
          msg.style.color = error ? "var(--red)" : "var(--ok)";
        }
        if (!error) {
          const av = initials(name);
          paintAvatars(av, u.email || name);
          const head = document.querySelector(".acct-head b");
          if (head) head.textContent = name;
          paintAcctSide();
          setTimeout(() => {
            if (msg) msg.textContent = "";
          }, 2500);
        }
      });

    // ---- Signup questionnaire summary (Profile pane) ----
    async function paintSurveySummary() {
      const box = $id("surveySummary");
      if (!box) return;
      try {
        const mod = await import("@/lib/signup-survey.functions");
        const out = await mod.getSignupSurvey();
        const r = (out && out.row) || null;
        if (!r || (!r.completed && !r.skipped)) {
          box.innerHTML =
            '<div class="mono" style="font-size:.72rem;color:var(--mute)">You Have Not Answered The Signup Questionnaire Yet.</div>';
          return;
        }
        if (r.skipped && !r.completed) {
          box.innerHTML =
            '<div class="mono" style="font-size:.72rem;color:var(--mute)">You Skipped The Signup Questionnaire.</div>';
          return;
        }
        const rows = [
          ["Full Name", r.full_name],
          ["Phone", r.phone],
          ["Company", r.company],
          ["Role", r.role],
          [
            "Heard About Us",
            r.how_heard ? r.how_heard + (r.how_heard_detail ? " · " + r.how_heard_detail : "") : "",
          ],
          ["Listings Per Year", r.listings_per_year],
          ["Team Size", r.team_size],
          ["Primary Goal", r.primary_goal],
          ["Marketing Emails", r.marketing_opt_in ? "Yes" : "No"],
        ].filter(function (x) {
          return x[1] !== null && x[1] !== undefined && x[1] !== "";
        });
        // Fill blank profile fields from the questionnaire answers
        var fill = function (id, v) {
          var el = $id(id);
          if (el && !el.value && v) el.value = v;
        };
        fill("pfName", r.full_name);
        fill("pfPhone", r.phone);
        fill("pfCompany", r.company);
        box.innerHTML = rows
          .map(function (x) {
            return (
              '<div class="rowi"><div class="rowt"><b>' +
              x[0] +
              "</b><span>" +
              String(x[1]) +
              "</span></div></div>"
            );
          })
          .join("");
      } catch (_) {
        box.innerHTML =
          '<div class="mono" style="font-size:.72rem;color:var(--mute)">Those Answers Could Not Be Loaded.</div>';
      }
    }
    const surveyEdit = $id("surveyEdit");
    if (surveyEdit)
      surveyEdit.addEventListener("click", async () => {
        try {
          const mod = await import("@/lib/rd-survey-ui");
          await mod.editSignupSurvey();
        } catch (_) {}
      });
    document.addEventListener("rd:survey-saved", function () {
      paintSurveySummary();
    });
    paintSurveySummary();

    const pwSave = $id("pwSave");
    if (pwSave)
      pwSave.addEventListener("click", async () => {
        const msg = $id("pwMsg"),
          a = $id("pwNew").value,
          b = $id("pwConfirm").value;
        const set = (t, ok) => {
          if (msg) {
            msg.textContent = t;
            msg.style.color = ok ? "var(--ok)" : "var(--red)";
          }
        };
        if (a.length < 10) return set("Use at least 10 characters", false);
        if (a !== b) return set("Passwords do not match", false);
        pwSave.disabled = true;
        if (msg) {
          msg.textContent = "Updating";
          msg.style.color = "var(--mute)";
        }
        const { error } = await supabase.auth.updateUser({ password: a });
        pwSave.disabled = false;
        if (error) return set("Could not update: " + error.message, false);
        $id("pwNew").value = "";
        $id("pwConfirm").value = "";
        set("Password updated", true);
        setTimeout(() => {
          if (msg) msg.textContent = "";
        }, 2500);
      });

    document.querySelectorAll(".btn-logout").forEach((b) =>
      b.addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "/auth";
      }),
    );

    // Wrap every table so wide tables scroll horizontally instead of stretching the page.
    document.querySelectorAll(".rd-app table, .app table").forEach((t) => {
      if (t.parentElement && t.parentElement.classList.contains("tscroll")) return;
      const w = document.createElement("div");
      w.className = "tscroll";
      t.parentNode.insertBefore(w, t);
      w.appendChild(t);
    });

    // Mobile drawer: hamburger in the topbar toggles the sidebar off-canvas.
    (function mobileNav() {
      const bar = document.querySelector(".topbar");
      const side = document.querySelector(".side");
      if (!bar || !side || document.getElementById("navBurger")) return;
      const burger = document.createElement("button");
      burger.className = "nav-burger";
      burger.id = "navBurger";
      burger.setAttribute("aria-label", "Open navigation");
      burger.innerHTML = '<i data-lucide="menu"></i>';
      bar.insertBefore(burger, bar.firstChild);
      const scrim = document.createElement("div");
      scrim.className = "side-scrim";
      (document.querySelector(".rd-app") || document.body).appendChild(scrim);
      const close = () => {
        side.classList.remove("open");
        scrim.classList.remove("on");
        burger.setAttribute("aria-expanded", "false");
      };
      burger.addEventListener("click", () => {
        const open = !side.classList.contains("open");
        side.classList.toggle("open", open);
        scrim.classList.toggle("on", open);
        burger.setAttribute("aria-expanded", String(open));
      });
      scrim.addEventListener("click", close);
      side.querySelectorAll(".nav-i").forEach((b) => b.addEventListener("click", close));
      window.addEventListener("resize", () => {
        if (window.innerWidth > 900) close();
      });
    })();

    const scopeGrid = document.getElementById("scopeGrid");
    let savedCard = null;
    if (scopeGrid && !document.getElementById("scSave")) {
      const briefBtn = document.getElementById("scBrief");
      const saveBtn = document.createElement("button");
      saveBtn.className = "btn btn-ghost btn-xs";
      saveBtn.id = "scSave";
      saveBtn.innerHTML = '<i data-lucide="save"></i>Save To My Projects';
      briefBtn.parentNode.insertBefore(saveBtn, briefBtn);

      /* remember the last property the user typed so the next save is one click */
      const LS = "rd.saveMeta";
      const meta = (() => {
        try {
          return JSON.parse(localStorage.getItem(LS) || "{}") || {};
        } catch (e) {
          return {};
        }
      })();
      let uploadPath = null;

      const saveCard = document.createElement("div");
      saveCard.className = "card";
      saveCard.style.gridColumn = "1 / -1";
      saveCard.innerHTML =
        '<div class="card-h"><div><h3>Save This Room</h3><div class="sub">Your photo and priced scope are stored on your account</div></div></div>' +
        '<div class="card-b"><div class="save-form">' +
        '<label>Property Address<input id="svAddress" type="text" placeholder="206 N MacDill Ave, Tampa FL"></label>' +
        '<label>Project Title<input id="svProject" type="text" maxlength="160" placeholder="Living Room Staging"></label>' +
        '<label>Room Name<input id="svRoom" type="text" placeholder="Living Room"></label>' +
        '<label>Room Type<input id="svType" type="text" placeholder="living room"></label>' +
        "</div>" +
        '<div class="save-photo"><label class="btn btn-ghost btn-xs" for="svPhoto"><i data-lucide="image-up"></i>Upload Room Photo</label>' +
        '<input id="svPhoto" type="file" accept="image/*" hidden>' +
        '<span class="sub" id="svPhotoNote">No Photo Uploaded Yet. Add the room photo before saving.</span>' +
        '<img id="svThumb" alt="" hidden></div></div>';
      scopeGrid.appendChild(saveCard);

      const $ = (id) => document.getElementById(id);
      $("svAddress").value = meta.address || "";
      $("svProject").value = meta.project || "";
      $("svRoom").value = meta.room || "";
      $("svType").value = meta.type || "";

      $("svPhoto").addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const note = $("svPhotoNote");
        note.textContent = "Uploading…";
        try {
          uploadPath = await uploadRoomPhoto(file);
          const url = await roomPhotoUrl(uploadPath);
          const thumb = $("svThumb");
          if (url) {
            thumb.src = url;
            thumb.hidden = false;
          }
          note.textContent = "Photo stored on your account.";
          try {
            window.dispatchEvent(new CustomEvent("rd:photo"));
          } catch (e2) {}
        } catch (err) {
          uploadPath = null;
          note.textContent = (err && err.message) || "Could not upload that photo.";
        }
      });

      savedCard = document.createElement("div");
      savedCard.className = "card";
      savedCard.style.gridColumn = "1 / -1";
      savedCard.innerHTML =
        '<div class="card-h"><div><h3>Saved Estimates</h3><div class="sub" id="savedSub">Your saved rooms and priced scopes</div></div>' +
        '<button class="btn btn-ghost btn-xs" id="savedRefresh"><i data-lucide="refresh-cw"></i>Refresh</button></div>' +
        '<div class="card-b"><table><thead><tr><th>Property</th><th>Room</th><th>Grade</th><th style="text-align:right">Low</th><th style="text-align:right">High</th><th></th></tr></thead>' +
        '<tbody id="savedRows">' +
        skRows(6, 3) +
        "</tbody></table></div>";
      scopeGrid.appendChild(savedCard);

      async function loadSaved() {
        const rows = document.getElementById("savedRows");
        try {
          const list = await listSavedEstimates();
          if (!list.length) {
            rows.innerHTML =
              '<tr><td colspan="6">Nothing saved yet. Price a scope, then use Save To My Projects.</td></tr>';
            return;
          }
          rows.innerHTML = list
            .map(
              (
                v,
              ) => `<tr><td><div class="saved-prop"><img class="saved-thumb" data-photo="${v.before_path || ""}" alt="" hidden><div><b>${v.address}</b><div class="sub">${v.project_name}</div></div></div></td><td>${v.room_name}</td>
<td>${v.grade[0].toUpperCase() + v.grade.slice(1)}</td>
<td class="n">${v.total_low == null ? "—" : money(v.total_low)}</td>
<td class="n">${v.total_high == null ? "—" : money(v.total_high)}</td>
<td class="n"><button class="btn btn-ghost btn-xs" data-del="${v.version_id}">Delete</button></td></tr>`,
            )
            .join("");
          document.getElementById("savedSub").textContent =
            list.length + " saved " + (list.length === 1 ? "room" : "rooms");
          rows.querySelectorAll("[data-del]").forEach((b) =>
            b.addEventListener("click", async () => {
              b.disabled = true;
              try {
                await deleteSavedEstimate({ data: { version_id: b.getAttribute("data-del") } });
                await loadSaved();
              } catch (e) {
                b.disabled = false;
              }
            }),
          );
          rows.querySelectorAll(".saved-thumb").forEach(async (img) => {
            const p = img.getAttribute("data-photo");
            if (!p) return;
            const url = await resolvePhotoUrl(p);
            if (url) {
              img.src = url;
              img.hidden = false;
            }
          });
          lucide.createIcons();
        } catch (e) {
          rows.innerHTML =
            '<tr><td colspan="6">Could not load saved estimates. ' +
            ((e && e.message) || "") +
            "</td></tr>";
        }
      }
      document.getElementById("savedRefresh").addEventListener("click", loadSaved);
      loadSaved();

      saveBtn.addEventListener("click", async () => {
        const note = document.getElementById("scopeNote");
        if (!lastScope) {
          note.textContent = "Price the scope first, then save it.";
          return;
        }
        const address = ($("svAddress").value || "").trim();
        const room = ($("svRoom").value || "").trim() || "Living Room";
        /* The title answers "which project?"; only suggest one when it is blank. */
        const project =
          ($("svProject").value || "").trim().slice(0, 160) ||
          suggestDesignTitle(address, room) ||
          "Untitled Design";
        const type = ($("svType").value || "").trim() || "living room";
        if (address.length < 3) {
          note.textContent = "Add the property address before saving.";
          $("svAddress").focus();
          return;
        }
        const srcPath = uploadPath || window.rdPendingPhotoPath || null;
        if (!srcPath) {
          note.textContent =
            "Upload the room photo before saving. Sample imagery is never saved to your projects.";
          return;
        }
        const num = (id, d) => {
          const v = parseFloat((document.getElementById(id) || {}).value);
          return Number.isFinite(v) && v > 0 ? v : d;
        };
        saveBtn.disabled = true;
        const lab = saveBtn.innerHTML;
        saveBtn.textContent = "Saving…";
        try {
          await saveEstimate({
            data: {
              address,
              project_name: project,
              room_name: room,
              room_type: type,
              grade: document.getElementById("scGrade").value,
              market_id: lastScope.market.id,
              budget_target: num("scBudget", null),
              floor_area_sf: num("scFloor", 340),
              wall_area_sf: num("scWall", 780),
              perimeter_lf: num("scPerim", 76),
              ceiling_ht_in: dimsProposal ? dimsProposal.ceiling_ht_in : 96,
              dims_source: dimsProposal ? (dimsConfirmed ? "user" : "depth_estimate") : "user",
              dims_confirmed: !dimsProposal || dimsConfirmed,
              before_path: srcPath,
              after_path: lastRenderPath || null,
              items: scopeItems,
            },
          });
          try {
            localStorage.setItem(LS, JSON.stringify({ address, project, room, type }));
          } catch (e) {}
          note.textContent = "Saved to your projects.";
          try {
            window.dispatchEvent(new CustomEvent("rd:saved"));
          } catch (e2) {}
          await loadSaved();
        } catch (e) {
          note.textContent = "Could not save this estimate. " + ((e && e.message) || "");
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = lab;
          lucide.createIcons();
        }
      });
    }

    /* ---------- dashboard greeting ---------- */
    (async function dashGreeting() {
      try {
        const t = document.getElementById("dashHelloT");
        const sub = document.getElementById("dashHelloS");
        if (!t) return;

        const { data } = await supabase.auth.getUser();
        const u = data && data.user;
        if (!u) return;
        const m = u.user_metadata || {};
        const full = String(m.full_name || m.name || (u.email || "").split("@")[0] || "").trim();
        const first = full.split(/\s+/)[0] || "There";
        const h = new Date().getHours();
        const part = h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening";
        t.textContent = part + ", " + first.charAt(0).toUpperCase() + first.slice(1);
        try {
          const { getSignupSurvey } = await import("@/lib/signup-survey.functions");
          const r = await getSignupSurvey({} as any);
          const goal = r && r.row && r.row.primary_goal;
          if (goal && sub)
            sub.textContent = "Your Goal: " + goal + ". Here Is Where Your Workspace Stands Today.";
        } catch (_) {}
      } catch (_) {}
    })();

    /* ---------- signup questionnaire (once per member) ---------- */
    (async function signupQuestionnaire() {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data || !data.user) return;
        const mod = await import("@/lib/rd-survey-ui");
        try {
          await mod.maybeOpenSignupSurvey();
        } catch (_) {}
      } catch (_) {}
    })();

    /* ---------- first run onboarding ---------- */

    (async function onboarding() {
      const dash = document.getElementById("v-dash");
      if (!dash) return;
      document.querySelectorAll("#onbCard,#onbModal").forEach((n) => n.remove());

      const STEPS = [
        {
          k: "photo",
          t: "Upload A Room Photo",
          b: "One clear photo of the space you want to redesign.",
          i: "image-up",
          cta: "Upload Photo",
        },
        {
          k: "saved",
          t: "Save Your First Room",
          b: "Store the photo and property on your account.",
          i: "save",
          cta: "Save Room",
        },
        {
          k: "design",
          t: "Create Your First Design",
          b: "Generate a design and keep it on the saved room.",
          i: "wand-sparkles",
          cta: "Open Studio",
        },
        {
          k: "brand",
          t: "Add Your Brand Kit",
          b: "Your company name and accent color on every export.",
          i: "palette",
          cta: "Set Brand",
        },

        {
          k: "shared",
          t: "Share A Presentation",
          b: "Send a client a branded link they can approve.",
          i: "presentation",
          cta: "Open Presentations",
        },
      ];
      /* insert synchronously so a double init cannot duplicate the card */
      const card = document.createElement("div");
      card.className = "card onb";
      card.id = "onbCard";
      card.style.marginBottom = "16px";
      card.hidden = true;
      card.innerHTML =
        '<div class="card-h"><div><h3>Get Started</h3><div class="sub" id="onbSub"></div></div>' +
        '<button class="btn btn-ghost btn-xs" id="onbHide"><i data-lucide="x"></i>Dismiss</button></div>' +
        '<div class="card-b"><div class="onb-bar"><i id="onbFill"></i></div><div class="onb-steps" id="onbSteps"></div></div>';
      dash.insertBefore(card, dash.firstChild);

      let uid = "anon";
      try {
        const { data } = await supabase.auth.getUser();
        if (data && data.user) uid = data.user.id;
      } catch (e) {}
      const KEY = "rd.onb." + uid;
      const readState = () => {
        try {
          return JSON.parse(localStorage.getItem(KEY) || "{}") || {};
        } catch (e) {
          return {};
        }
      };
      const state = readState();
      /* merge on write so a second init cannot drop flags written by the first */
      const save = () => {
        try {
          localStorage.setItem(KEY, JSON.stringify(Object.assign(readState(), state)));
        } catch (e) {}
      };
      if (state.done) {
        card.remove();
        return;
      }

      /* Completion is derived from what is actually stored on the account, not
         from local flags: a saved room means a room record exists, and an
         uploaded photo means a room or a design carries one. */
      let stats = { rooms: 0, designs: 0, properties: 0 };
      try {
        stats = await getRoomStats();
      } catch (e) {}
      if (stats.rooms > 0) {
        state.saved = true;
        state.photo = true;
      }
      if (stats.designs > 0) {
        state.photo = true;
        state.design = true;
      }

      save();
      card.hidden = false;
      const dup = document.getElementById("obCard");
      if (dup) dup.remove();

      function act(k) {
        if (k === "brand") {
          go("branding");
          return;
        }
        if (k === "shared") {
          go("present");
          return;
        }
        /* Everything left is a Studio task: upload a photo, save the room. */
        go("studio");
        if (k === "saved") {
          /* Save Room really saves: with a photo on the canvas open the save
             dialog, otherwise start a clean session so one can be added. */
          setTimeout(() => {
            try {
              const btn = document.getElementById("stSaveRoom");
              if (btn && !btn.hidden && !btn.disabled) window.rdStudioSaveRoom();
              else window.rdStudioNewRoom && window.rdStudioNewRoom();
            } catch (_) {}
          }, 260);
        }
      }

      /* Re-reads the account after any save so the checklist cannot drift. */
      async function refresh() {
        let changed = false;
        try {
          const st = await getRoomStats();
          if (st.rooms > 0 && !state.saved) {
            state.saved = true;
            changed = true;
          }
          if ((st.rooms > 0 || st.designs > 0) && !state.photo) {
            state.photo = true;
            changed = true;
          }
          if (st.designs > 0 && !state.design) {
            state.design = true;
            changed = true;
          }

        } catch (e) {}
        if (changed) {
          save();
          render();
        }
      }
      window.rdRefreshOnboarding = refresh;
      window.addEventListener("rd:rooms", refresh);
      window.addEventListener("rd:saved", refresh);

      function render() {
        /* The card is removed on dismiss/completion; late async re-renders must no-op. */
        if (!card.isConnected) return;
        const sub = document.getElementById("onbSub"),
          fill = document.getElementById("onbFill"),
          steps = document.getElementById("onbSteps");
        if (!sub || !fill || !steps) return;
        const done = STEPS.filter((s) => state[s.k]).length;
        sub.textContent = done + " of " + STEPS.length + " complete";
        fill.style.width = Math.round((done / STEPS.length) * 100) + "%";
        steps.innerHTML = STEPS.map(
          (s, n) =>
            '<div class="onb-step' +
            (state[s.k] ? " on" : "") +
            '">' +
            '<span class="onb-ic"><i data-lucide="' +
            (state[s.k] ? "check" : s.i) +
            '"></i></span>' +
            '<div class="onb-tx"><b>' +
            (n + 1) +
            ". " +
            s.t +
            "</b><span>" +
            s.b +
            "</span></div>" +
            (state[s.k]
              ? '<span class="pill p-ok">Done</span>'
              : '<button class="btn btn-ghost btn-xs" data-onb="' +
                s.k +
                '">' +
                s.cta +
                "</button>") +
            "</div>",
        ).join("");
        document
          .querySelectorAll("[data-onb]")
          .forEach((b) => b.addEventListener("click", () => act(b.getAttribute("data-onb"))));
        lucide.createIcons();
        if (done === STEPS.length) {
          state.done = true;
          save();
          setTimeout(() => {
            card.remove();
            try {
              window.dispatchEvent(new CustomEvent("rd:saved"));
            } catch (_) {}
          }, 2400);
        }
      }
      render();

      /* reflect real account state for the two account-level steps */
      (async () => {
        let changed = false;
        try {
          if ((await getPrefs()).brand.company.trim() && !state.brand) {
            state.brand = true;
            changed = true;
          }
        } catch (e) {}
        try {
          if ((await listPresentations()).length && !state.shared) {
            state.shared = true;
            changed = true;
          }
        } catch (e) {}
        if (changed) {
          save();
          render();
        }
      })();

      document.getElementById("onbHide")?.addEventListener("click", () => {
        state.done = true;
        save();
        card.remove();
      });
      ["photo", "priced", "saved", "brand", "shared"].forEach((k) =>
        window.addEventListener("rd:" + k, () => {
          if (!state[k]) {
            state[k] = true;
            save();
            render();
          }
        }),
      );

      /* The welcome step now lives in the full page signup flow at /welcome,
     so the old welcome modal is gone. Only mark the account as welcomed. */
      if (!(state.welcomed || readState().welcomed)) {
        state.welcomed = true;
        save();
      }
      document.querySelectorAll("#onbModal").forEach((n) => n.remove());
    })();

    lucide.createIcons();

    /* ---------- live credit meter, billing pane and upgrade prompts ---------- */
    const COST_ROWS = [
      ["Design", "1 Credit", "A photoreal redesign of one photo"],
      ["Budget", "3 Credits", "Line items, quantities and local rates"],
      ["3D Plan", "6 Credits", "A furnished plan from your photo"],
      ["Video", "40 Credits", "A cinematic walkthrough clip"],
    ];
    const PLAN_NAME = { free: "Free", starter: "Starter", pro: "Pro", studio: "Studio" };
    const PLAN_CAP = { free: 5, starter: 200, pro: 2000, studio: 4000 };

    function upgradeModal(title, body) {
      let m = document.getElementById("upModal");
      if (!m) {
        m = document.createElement("div");
        m.id = "upModal";
        m.className = "up-modal";
        m.innerHTML =
          '<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true">' +
          '<h3 id="upTitle"></h3><p id="upBody"></p>' +
          '<div id="upCosts" class="up-costs"></div>' +
          '<button class="btn btn-primary btn-block" id="upGo"><i data-lucide="zap"></i>See Plans & Credits</button>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:8px" data-close>Not Now</button></div>';
        (document.querySelector(".rd-app") || document.body).appendChild(m);
        m.addEventListener("click", (e) => {
          if (e.target.hasAttribute && e.target.hasAttribute("data-close"))
            m.classList.remove("on");
        });
        m.querySelector("#upGo").addEventListener("click", () => {
          m.classList.remove("on");
          try {
            go("billing");
          } catch (_) {
            const b = document.querySelector('[data-goto="account"]');
            if (b) b.click();
          }
          setTimeout(() => {
            const rail = document.querySelector('[data-pane="billing"]');
            if (rail) rail.click();
          }, 40);
        });
      }
      m.querySelector("#upTitle").textContent = title;
      m.querySelector("#upBody").textContent = body;
      m.querySelector("#upCosts").innerHTML = COST_ROWS.map(
        (r) => "<div><span>" + r[0] + '</span><b class="mono">' + r[1] + "</b></div>",
      ).join("");
      m.classList.add("on");
      lucide.createIcons();
    }

    /** Turn a server refusal into an upgrade prompt instead of a raw error. */
    function creditGate(e) {
      const msg = (e && e.message) || "";
      if (isPlanBlocked(msg)) {
        upgradeModal(planBlockTitle(msg), msg);
        return true;
      }
      return false;
    }
    window.rdCreditGate = creditGate;
    try {
      (window as any).rdUpgradeModal = upgradeModal;
    } catch (_) {}

    async function loadCreditHistory() {
      const el = document.getElementById("billHist");
      if (!el) return;
      try {
        const rows = await listCreditHistory();
        if (!rows.length) return;
        el.innerHTML = rows
          .slice(0, 15)
          .map((r) => {
            const when = new Date(r.created_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            const label = (r.action || "")
              .replace("plan_3d", "3D Plan")
              .replace(/^./, (c) => c.toUpperCase());
            const delta = r.delta > 0 ? "+" + r.delta : r.delta < 0 ? String(r.delta) : "Free";
            return (
              '<div class="rowi"><div class="rowt"><b>' +
              label +
              "</b><span>" +
              when +
              (r.note ? " \u00b7 " + r.note : "") +
              "</span></div>" +
              '<div class="mono" style="font-size:.78rem">' +
              delta +
              "</div></div>"
            );
          })
          .join("");
      } catch (e) {
        /* signed out */
      }
    }

    function paintBilling(c) {
      const sub = document.getElementById("billSub");
      if (!sub) return;
      const name = PLAN_NAME[c.plan] || c.plan;
      sub.textContent =
        c.plan === "free"
          ? "Free plan \u00b7 5 designs a day"
          : name + " plan \u00b7 billed annually";
      const st = document.getElementById("billStatus");
      if (st) {
        st.textContent = c.plan === "free" ? "Free" : "Active";
        st.className = "pill " + (c.plan === "free" ? "p-ink" : "p-ok");
      }
      const lab = document.getElementById("billMeterLab"),
        val = document.getElementById("billMeterVal"),
        bar = document.getElementById("billMeterBar"),
        note = document.getElementById("billMeterNote");
      if (c.plan === "free") {
        const leftToday = Math.max(0, Math.min(5, c.remainingToday ?? 5));
        lab.textContent = "Free Designs Used Today";
        val.textContent = 5 - leftToday + " / 5 Used";
        bar.style.width = ((5 - leftToday) / 5) * 100 + "%";
        bar.className = leftToday <= 1 ? "low" : "";
        note.textContent = "Resets at midnight. Budgets, 3D plans and video need a paid plan.";
      } else {
        lab.textContent = "Credit Balance";
        val.textContent = c.balance.toLocaleString();
        const pctLeft = Math.min(100, (c.balance / (PLAN_CAP[c.plan] || 2000)) * 100);
        bar.style.width = pctLeft + "%";
        bar.className = pctLeft <= 10 ? "low" : "";
        note.textContent = "One balance across every tool. Credits refresh each billing cycle.";
      }
      const costs = document.getElementById("billCosts");
      if (costs)
        costs.innerHTML = COST_ROWS.map(
          (r) =>
            '<div class="rowi"><div class="rowt"><b>' +
            r[0] +
            "</b><span>" +
            r[2] +
            "</span></div>" +
            '<div class="mono" style="font-size:.78rem">' +
            r[1] +
            "</div></div>",
        ).join("");
    }

    let CREDITS = null;
    /** Pre-flight credit check so a run is blocked before it starts. */
    function ensureCredits(cost, label) {
      if (!CREDITS) return true;
      if (CREDITS.plan === "free") {
        if (cost > 1) {
          upgradeModal(
            "Upgrade To Use " + label,
            label +
              " costs " +
              cost +
              " credits and needs a paid plan. The free plan covers 5 designs a day.",
          );
          return false;
        }
        if ((CREDITS.remainingToday ?? 0) <= 0) {
          upgradeModal(
            "You Have Used Today\u2019s Free Designs",
            "Free designs reset at midnight. A paid plan adds a credit balance you can spend on any tool.",
          );
          return false;
        }
        return true;
      }
      if ((CREDITS.balance ?? 0) < cost) {
        upgradeModal(
          "You Need More Credits",
          label +
            " costs " +
            cost +
            " credits and your balance is " +
            (CREDITS.balance ?? 0) +
            ". Top up or move to a bigger plan.",
        );
        return false;
      }
      return true;
    }

    async function refreshCredits() {
      const lab = document.getElementById("credLab");
      if (!lab) return;
      const box = lab.closest(".credit-box");
      const bar = box && box.querySelector(".meter i");
      const foot = box && box.querySelectorAll(".lab")[1];
      try {
        const c = await getMyCredits();
        const title = box && box.querySelector(".lab span");
        const gc = document.getElementById("genCost");
        if (gc && !gc.textContent) gc.textContent = "1 Credit";
        /* One compact block: what you have, how much is left, one action. */
        if (c.plan === "free") {
          if (title) title.textContent = "Free Designs";
          const left = Math.max(0, Math.min(5, c.remainingToday ?? 5));
          lab.textContent = left + " Of 5 Left";
          if (bar) {
            bar.style.width = (left / 5) * 100 + "%";
            bar.className = left <= 1 ? "low" : "";
          }
          if (foot)
            foot.innerHTML =
              '<span></span><b class="cred-up" role="button" tabindex="0">Upgrade</b>';
        } else {
          if (title) title.textContent = (PLAN_NAME[c.plan] || c.plan) + " Credits";
          lab.textContent = c.balance.toLocaleString();
          if (bar) {
            const pctLeft = Math.min(100, (c.balance / (PLAN_CAP[c.plan] || 2000)) * 100);
            bar.style.width = pctLeft + "%";
            bar.className = pctLeft <= 10 ? "low" : "";
          }
          if (foot) foot.innerHTML = "";
        }

        if (box && !box.dataset.wired) {
          box.dataset.wired = "1";
          box.addEventListener("click", (e) => {
            if (e.target.classList && e.target.classList.contains("cred-up"))
              upgradeModal(
                "Upgrade For A Credit Balance",
                "The free plan covers 5 designs a day. Paid plans add scopes, 3D plans and video from one shared balance.",
              );
          });
        }
        paintBilling(c);
        loadCreditHistory();
      } catch (e) {
        /* signed out or not provisioned yet */
      }
    }
    refreshCredits();
    window.addEventListener("rd:credits-changed", refreshCredits);

    /* ---------- plan lifecycle: request, downgrade, cancel, monthly refill ---------- */
    const PLAN_LIST = [
      ["free", "Free", "5 designs a day, nothing else"],
      ["starter", "Starter", "200 credits a month"],
      ["pro", "Pro", "2,000 credits a month"],
      ["studio", "Studio", "4,000 credits a month"],
    ];
    const PLAN_RANK = { free: 0, starter: 1, pro: 2, studio: 3 };
    const STATE_PILL = {
      active: ["Active", "p-ok"],
      canceled: ["Canceled", "p-ink"],
      past_due: ["Renewal Due", "p-amb"],
    };
    let SUB = null;

    function fmtDate(d) {
      return d
        ? new Date(d).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "";
    }

    function paintPlan(s) {
      const renew = document.getElementById("planRenew");
      if (!renew) return;
      const state = document.getElementById("planState");
      const pill = STATE_PILL[s.status] || ["\u2014", "p-ink"];
      if (state) {
        state.textContent = s.plan === "free" ? "Free" : pill[0];
        state.className = "pill " + (s.plan === "free" ? "p-ink" : pill[1]);
      }
      if (s.plan === "free") {
        renew.textContent = "Free plan \u00b7 5 designs a day, no card on file";
      } else if (s.cancel_at_period_end) {
        renew.textContent = (PLAN_NAME[s.plan] || s.plan) + " \u00b7 ends " + fmtDate(s.period_end);
      } else if (s.status === "past_due") {
        renew.textContent =
          (PLAN_NAME[s.plan] || s.plan) + " \u00b7 renewal was due " + fmtDate(s.period_end);
      } else {
        renew.textContent =
          (PLAN_NAME[s.plan] || s.plan) +
          " \u00b7 renews " +
          fmtDate(s.period_end) +
          (s.next_refill_on
            ? " \u00b7 next " +
              s.monthly_credits.toLocaleString() +
              " credits on " +
              fmtDate(s.next_refill_on)
            : "");
      }

      const pend = document.getElementById("planPending");
      if (pend) {
        if (s.pending_request) {
          pend.style.display = "";
          document.getElementById("planPendingTxt").textContent =
            (PLAN_NAME[s.pending_request.plan] || s.pending_request.plan) +
            " requested on " +
            fmtDate(s.pending_request.created_at) +
            ". It starts once checkout is switched on and your payment clears.";
        } else pend.style.display = "none";
      }

      const rows = document.getElementById("planRows");
      if (rows) {
        rows.innerHTML = PLAN_LIST.map((p) => {
          const cur = p[0] === s.plan;
          const up = PLAN_RANK[p[0]] > PLAN_RANK[s.plan];
          const btn = cur
            ? '<span class="pill p-ok">Current</span>'
            : '<button class="btn ' +
              (up ? "btn-primary" : "btn-ghost") +
              ' btn-xs" data-plan="' +
              p[0] +
              '">' +
              (up ? "Request" : p[0] === "free" ? "Move To Free" : "Downgrade") +
              "</button>";
          return (
            '<div class="rowi"><div class="rowt"><b>' +
            p[1] +
            "</b><span>" +
            p[2] +
            "</span></div>" +
            btn +
            "</div>"
          );
        }).join("");
      }

      const acts = document.getElementById("planActions");
      if (acts) {
        acts.innerHTML =
          s.plan === "free"
            ? ""
            : s.cancel_at_period_end
              ? '<button class="btn btn-ghost btn-xs" id="planResume"><i data-lucide="rotate-ccw"></i>Keep My Plan</button>'
              : '<button class="btn btn-ghost btn-xs" id="planCancel"><i data-lucide="x"></i>Cancel At Period End</button>';
      }
      lucide.createIcons();
    }

    async function refreshPlan() {
      if (!document.getElementById("planRows")) return;
      try {
        SUB = await getSubscription();
        /* Feature gating elsewhere in the app reads the normalised tier. */
        window.__rdPlan = resolveSubscriptionPlan(SUB && SUB.plan);
        paintPlan(SUB);
        paintBillingEvents();
      } catch (e) {
        /* signed out */
      }
    }

    /* Scoped to the billing pane on purpose. A bare [data-plan] selector also
       matched the Studio tool rows (which record the plan a tool needs), so
       clicking Redesign posted an empty plan into the enum validator. */
    document.addEventListener("click", async (e) => {
      const rows = document.getElementById("planRows");
      if (!rows || !e.target.closest) return;
      const t = e.target.closest(
        "#p-billing [data-plan],#p-billing #planCancel,#p-billing #planResume,#p-billing #planWithdraw",
      );
      if (!t) return;
      t.disabled = true;
      try {
        if (t.id === "planCancel" || t.id === "planResume") {
          await setCancelAtPeriodEnd({ data: { cancel: t.id === "planCancel" } });
        } else if (t.id === "planWithdraw") {
          await withdrawPlanRequest();
        } else {
          const plan = normalizePlan(t.getAttribute("data-plan"));
          if (!plan) {
            /* Never send "" into the plan enum: that is a bug, not a user error. */
            console.error("[billing] plan button without a valid tier", {
              value: t.getAttribute("data-plan"),
              currentPlan: (SUB && SUB.plan) || null,
            });
            window.rdToast && window.rdToast("We Couldn't Verify That Plan. Please Try Again.");
            t.disabled = false;
            return;
          }
          if (planRank(plan) < planRank((SUB && SUB.plan) || "free") || plan === "free") {
            if (
              !window.confirm(
                "Moving to " +
                  planName(plan) +
                  " takes effect now. Your remaining credits stay on the account.",
              )
            ) {
              t.disabled = false;
              return;
            }
          }
          await changePlan({ data: { plan } });
        }
        await refreshPlan();
        window.dispatchEvent(new Event("rd:credits-changed"));
      } catch (err) {
        console.error("[billing] plan change failed", err);
        window.rdToast
          ? window.rdToast("That Change Did Not Go Through. Please Try Again.")
          : console.error(err);
      }
      t.disabled = false;
    });


    refreshPlan();
    window.addEventListener("rd:credits-changed", refreshPlan);

    /* ---------- property Design DNA, scenarios, approval, avatar ---------- */

    function miniModal(title, intro, bodyHtml, onGo, goLabel) {
      let m = document.getElementById("miniModal");
      if (!m) {
        m = document.createElement("div");
        m.id = "miniModal";
        m.className = "up-modal";
        m.innerHTML =
          '<div class="up-scrim" data-close></div><div class="up-card" role="dialog" aria-modal="true">' +
          '<h3 id="mmTitle"></h3><p id="mmIntro"></p><div id="mmBody"></div>' +
          '<div id="mmErr" style="display:none;font-size:.78rem;color:var(--red);margin-bottom:8px"></div>' +
          '<button class="btn btn-primary btn-block" id="mmGo"></button>' +
          '<button class="btn btn-ghost btn-block" style="margin-top:8px" data-close>Close</button></div>';
        (document.querySelector(".rd-app") || document.body).appendChild(m);
        m.addEventListener("click", (e) => {
          if (e.target.hasAttribute && e.target.hasAttribute("data-close"))
            m.classList.remove("on");
        });
      }
      m.querySelector("#mmTitle").textContent = title;
      m.querySelector("#mmIntro").textContent = intro;
      m.querySelector("#mmBody").innerHTML = bodyHtml;
      const err = m.querySelector("#mmErr");
      err.style.display = "none";
      const go = m.querySelector("#mmGo");
      go.textContent = goLabel || "Save";
      const fresh = go.cloneNode(true);
      go.parentNode.replaceChild(fresh, go);
      fresh.addEventListener("click", async () => {
        fresh.disabled = true;
        try {
          await onGo(m);
          m.classList.remove("on");
        } catch (e) {
          err.style.display = "block";
          err.textContent = (e && e.message) || "That did not save.";
        }
        fresh.disabled = false;
      });
      m.classList.add("on");
      lucide.createIcons();
      return m;
    }

    function curProp() {
      return PROP_TREE[SEL.p] || null;
    }
    async function reloadTree() {
      try {
        PROP_TREE = await getPropertyTree();
      } catch (e) {}
      paintTree();
    }

    const dnaEditBtn = document.getElementById("dnaEdit");
    if (dnaEditBtn)
      dnaEditBtn.addEventListener("click", () => {
        const prop = curProp();
        if (!prop) {
          showAlert("Select a property in the tree first.");
          return;
        }
        const items = (
          prop.dna && prop.dna.length ? prop.dna : [{ label: "", color: "#E8E2D6" }]
        ).slice(0, 8);
        const rows = items
          .concat(
            Array.from({ length: Math.max(0, 5 - items.length) }, () => ({
              label: "",
              color: "#E8E2D6",
            })),
          )
          .map(
            (it, i) => `<div class="field" style="display:flex;gap:8px;align-items:center">
      <input type="color" data-dnac="${i}" value="${it.color || "#E8E2D6"}" style="width:38px;height:32px;padding:0;border:1px solid var(--line);border-radius:6px">
      <input type="text" data-dnal="${i}" value="${(it.label || "").replace(/"/g, "&quot;")}" placeholder="White Oak LVP" style="flex:1"></div>`,
          )
          .join("");
        miniModal(
          "Design DNA",
          "These finish decisions travel with the property, so every room you design stays in the same language. Leave a line blank to drop it.",
          rows,
          async (m) => {
            const out = [];
            m.querySelectorAll("[data-dnal]").forEach((inp) => {
              const label = (inp.value || "").trim();
              if (!label) return;
              const c = m.querySelector('[data-dnac="' + inp.dataset.dnal + '"]');
              out.push({ label, color: (c && c.value) || "#E8E2D6" });
            });
            await setPropertyDna({ data: { property_id: prop.id, items: out } });
            await reloadTree();
          },
          "Lock Design DNA",
        );
      });

    const dnaCopyBtn = document.getElementById("dnaCopy");
    if (dnaCopyBtn)
      dnaCopyBtn.addEventListener("click", () => {
        const prop = curProp();
        if (!prop) {
          return;
        }
        const others = PROP_TREE.filter((p) => p.id !== prop.id);
        if (!others.length) {
          miniModal(
            "Copy Design DNA",
            "You only have one property so far. Save a room under a second address and you can copy this DNA onto it.",
            "",
            async () => {},
            "Got It",
          );
          return;
        }
        const body =
          '<div class="field"><label>Copy Onto</label><select id="dnaTo">' +
          others.map((p) => `<option value="${p.id}">${p.address}</option>`).join("") +
          "</select></div>";
        miniModal(
          "Copy Design DNA",
          "The palette and finish choices locked on " +
            prop.address +
            " will replace whatever the other property has.",
          body,
          async (m) => {
            await copyPropertyDna({
              data: { from_id: prop.id, to_id: m.querySelector("#dnaTo").value },
            });
            await reloadTree();
          },
          "Copy DNA",
        );
      });

    const newScenarioBtn = document.getElementById("newScenario");
    if (newScenarioBtn)
      newScenarioBtn.addEventListener("click", () => {
        const prop = curProp();
        if (!prop) return;
        const body =
          '<div class="field"><label>Scenario Name</label><input id="scnName" type="text" placeholder="Rental Grade Pass"></div>' +
          '<div class="field"><label>Finish Grade</label><select id="scnGrade"><option value="rental">Rental Grade</option><option value="retail" selected>Retail Grade</option><option value="premium">Premium Grade</option></select></div>';
        miniModal(
          "New Scenario",
          "A scenario is a second run at the same property, priced at its own finish grade. Rooms you save can go under either one.",
          body,
          async (m) => {
            const name = (m.querySelector("#scnName").value || "").trim();
            if (!name) throw new Error("Give the scenario a name.");
            await createProject({
              data: {
                property_id: prop.id,
                name,
                finish_grade: m.querySelector("#scnGrade").value,
              },
            });
            await reloadTree();
          },
          "Create Scenario",
        );
      });

    /* Studio: approve the latest saved version, and download the render on screen. */
    function latestRoom() {
      const prop = curProp();
      const proj = prop ? prop.projects[SEL.pr] : null;
      const rooms = proj ? proj.rooms.filter((r) => r.version_id) : [];
      return rooms.length ? rooms[rooms.length - 1] : null;
    }
    /* Shop the Design: launch the sourcing workspace from Studio or any saved design. */
    async function shopCtxFromRoom(room, image) {
      const prop = curProp();
      const proj = prop ? prop.projects[SEL.pr] : null;
      let img = image || null;
      if (!img && room) {
        const p = room.after_path || room.before_path || "";
        img = p ? await resolvePhotoUrl(p) : null;
      }
      return {
        go,
        image: img || "",
        roomType: (room && (room.room_type || room.name)) || "Living Room",
        roomId: String((room && room.id) || "room-current"),
        roomLabel: (room && room.name) || "Current Room",
        propertyId: String((prop && prop.id) || "prop-current"),
        propertyLabel: (prop && prop.address) || "No Property Selected",
        designId: String((room && room.version_id) || "design-current"),
        designLabel:
          ((room && room.name) || "Current Design") +
          (room && room.version_no ? " v" + room.version_no : ""),
        budgetMax: (proj && proj.budget_target) || null,
      };
    }
    async function shopFromStudio() {
      const img = document.querySelector("#cAfter img");
      const src = lastRender || (img && img.src) || null;
      const room = latestRoom();
      if (!src && !room) {
        showAlert("Generate or open a design first, then shop it.");
        return;
      }
      openShop(await shopCtxFromRoom(room, src));
    }
    const stShop = document.getElementById("stShop");
    if (stShop) stShop.addEventListener("click", shopFromStudio);
    window.rdShopDesign = async function (d) {
      if (!d) return;
      const url = d.path ? await resolvePhotoUrl(d.path) : "";
      if (d.room) return openShop(await shopCtxFromRoom(d.room, url));
      openShop({
        go,
        image: url,
        roomType: d.cat || "Living Room",
        roomId: "sample-" + d.id,
        roomLabel: d.name,
        propertyId: "sample",
        propertyLabel: "Sample Design",
        designId: String(d.id),
        designLabel: d.name,
      });
    };

    const stApprove = document.getElementById("stApprove");
    if (stApprove)
      stApprove.addEventListener("click", async () => {
        /* Approval always targets the version actually on the canvas; only when
           nothing was generated this session does it fall back to the latest. */
        if (window.rdVersionSaving && window.rdVersionSaving()) {
          showAlert("That design is still saving. Try again in a moment.");
          return;
        }
        const shown = window.rdDisplayedVersion && window.rdDisplayedVersion();
        const room = shown
          ? { version_id: shown.id, version_no: shown.version_no, status: "draft" }
          : latestRoom();
        if (!room) {
          showAlert("Save a room first. Approval applies to a saved version.");
          return;
        }
        const approved = room.status === "approved";
        stApprove.disabled = true;
        try {
          await setVersionStatus({
            data: { version_id: room.version_id, status: approved ? "draft" : "approved" },
          });
          await reloadTree();
          stApprove.dataset.approved = approved ? "" : "1";
          stApprove.innerHTML =
            '<i data-lucide="check"></i>' +
            (approved
              ? "Approve Version " + (room.version_no || 1)
              : "Version " + (room.version_no || 1) + " Approved");


          lucide.createIcons();
          try {
            window.dispatchEvent(new CustomEvent("rd:saved"));
          } catch (e) {}
        } catch (e) {
          showAlert((e && e.message) || "Could not update that version.");
        }
        stApprove.disabled = false;
      });

    const stDownload = document.getElementById("stDownload");
    if (stDownload)
      stDownload.addEventListener("click", async () => {
        const img = document.querySelector("#cAfter img");
        const src = lastRender || (img && img.src);
        if (!src) {
          showAlert("Generate a design first, then download it.");
          return;
        }
        try {
          const data = await toDataUrl(src, 1600);
          const a = document.createElement("a");
          a.href = data;
          a.download = "real-designs-" + Date.now() + ".jpg";
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (e) {
          showAlert("Could not prepare that image for download.");
        }
      });

    const scSend = document.getElementById("scSend");
    if (scSend)
      scSend.addEventListener("click", () => {
        go("present");
        presModal();
      });

    /* Account: profile photo, stored small on the account and shown on every avatar. */
    function paintAvatar(url) {
      document.querySelectorAll(".av").forEach((el) => {
        if (url) {
          el.style.backgroundImage = "url(" + url + ")";
          el.style.backgroundSize = "cover";
          el.style.backgroundPosition = "center";
          el.dataset.hadText = el.dataset.hadText || el.textContent;
          el.textContent = "";
        } else {
          el.style.backgroundImage = "";
          if (el.dataset.hadText) el.textContent = el.dataset.hadText;
        }
      });
    }
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const u = user && user.user_metadata && user.user_metadata.avatar_data;
        if (u) paintAvatar(u);
      } catch (e) {}
    })();
    const avPhoto = document.getElementById("avPhoto");
    if (avPhoto)
      avPhoto.addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const data = await toDataUrl(URL.createObjectURL(file), 160);
          const { error } = await supabase.auth.updateUser({ data: { avatar_data: data } });
          if (error) throw new Error(error.message);
          paintAvatar(data);
        } catch (err) {
          showAlert((err && err.message) || "Could not save that photo.");
        }
      });

    /* ---------- website handoff ----------
   A visitor who uploaded a photo on the marketing site and then signed up
   lands here with their photo and builder choices waiting in localStorage.
   Load it straight into Studio so nothing has to be entered twice. */
    (async function pickUpHandoff() {
      const KEY = "rd.handoff";
      let h = null;
      try {
        h = JSON.parse(localStorage.getItem(KEY) || "null");
      } catch (e) {
        h = null;
      }
      try {
        localStorage.removeItem(KEY);
      } catch (e) {}
      if (!h || !h.photo) return;
      window.rdHandoffPending = true;
      if (Date.now() - (h.ts || 0) > 1000 * 60 * 60 * 24 * 7) return; // stale, ignore

      try {
        go("studio");
      } catch (e) {}
      setStudioSource("website_handoff", h.photo, "The space you uploaded on the website", {
        caption: "Choose what you want to create, then generate your first version.",
      });

      const sp = document.querySelector(
        '#spChips .chip[data-sp="' + (h.space || "interior") + '"]',
      );
      if (sp) {
        document.querySelectorAll("#spChips .chip").forEach((x) => x.classList.remove("on"));
        sp.classList.add("on");
      }
      const b = document.querySelector('.bchip[data-b="' + (h.budget ?? 1) + '"]');
      if (b) {
        document.querySelectorAll(".bchip").forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
      }
      const sel = document.getElementById("fStyle");
      if (sel && h.style) {
        const opt = [...sel.options].find(
          (o) => o.text.toLowerCase() === String(h.style).toLowerCase(),
        );
        if (opt) sel.value = opt.value;
      }
      const note = document.getElementById("agentNote");
      if (note && h.notes) note.value = h.notes;

      const card = document.getElementById("canvasCard");
      if (card && !document.getElementById("hoBanner")) {
        const bn = document.createElement("div");
        bn.id = "hoBanner";
        bn.className = "note";
        bn.innerHTML =
          '<i data-lucide="image-up"></i><span>Loaded from the website: <b>' +
          esc(h.name || "your photo") +
          "</b>, " +
          esc(h.budgetName || "Makeover") +
          " intensity" +
          (h.style ? ", " + esc(h.style) : "") +
          ". Generate when you are ready.</span>";
        card.appendChild(bn);
        lucide.createIcons();
      }

      /* Store it on the account so Save To My Projects keeps the real photo. */
      try {
        window.rdPendingPhotoPath = await uploadRenderDataUrl(h.photo);
      } catch (e) {}
    })();

    /* ---------- keyboard shortcuts ---------- */
    (function () {
      const SC = [
        [
          "Navigate",
          [
            ["G then D", "Dashboard"],
            ["G then P", "Properties"],
            ["G then S", "Studio"],
            ["G then I", "Designs"],
            BUDGET_LIVE ? ["G then B", "Budget"] : null,
            ["G then R", "Reports"],
            ["G then A", "Account"],
          ].filter(Boolean),
        ],
        [
          "Actions",
          [
            ["⌘ K", "Search Workspace"],
            ["⌘ B", "Collapse Or Expand Menu"],
            ["N", "New Design"],
            ["?", "Keyboard Shortcuts"],
            ["Esc", "Close Menus & Dialogs"],
          ],
        ],
      ];
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
      function key(k) {
        return isMac ? k : k.replace("⌘", "Ctrl");
      }
      let m = null;
      function build() {
        m = document.createElement("div");
        m.id = "kbdModal";
        m.className = "rd-modal";
        m.innerHTML =
          '<div class="rd-modal-card" role="dialog" aria-modal="true" aria-label="Keyboard Shortcuts">' +
          '<button class="rd-modal-x" aria-label="Close"><i data-lucide="x"></i></button>' +
          '<h3 style="margin:0 0 4px">Keyboard Shortcuts</h3>' +
          '<div class="sub" style="margin-bottom:14px">Works anywhere outside a text field.</div>' +
          SC.map(
            ([g, rows]) =>
              '<div class="acct-group">' +
              g +
              "</div>" +
              rows
                .map(
                  ([k, l]) =>
                    '<div class="rowi"><div class="rowt"><b>' +
                    l +
                    '</b></div><kbd class="kbd">' +
                    key(k) +
                    "</kbd></div>",
                )
                .join(""),
          ).join("") +
          "</div>";
        (document.querySelector(".rd-app") || document.body).appendChild(m);
        m.addEventListener("click", (e) => {
          if (e.target === m || e.target.closest(".rd-modal-x")) close();
        });
        try {
          lucide.createIcons();
        } catch (_) {}
      }
      function open() {
        if (!m) build();
        m.classList.add("on");
      }
      function close() {
        if (m) m.classList.remove("on");
      }
      window.rdShortcuts = open;
      document.querySelectorAll("[data-kbd]").forEach((b) =>
        b.addEventListener("click", () => {
          open();
        }),
      );

      let gPending = 0;
      const GO_BASE = {
        d: "dash",
        p: "props",
        s: "studio",
        i: "designs",
        b: "scope",
        r: "reports",
        a: "account",
      };
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          close();
          return;
        }
        const t = e.target;
        if (
          t &&
          (t.tagName === "INPUT" ||
            t.tagName === "TEXTAREA" ||
            t.tagName === "SELECT" ||
            t.isContentEditable)
        )
          return;
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
          e.preventDefault();
          const tg = document.getElementById("sideToggle");
          if (tg) tg.click();
          return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const k = e.key.toLowerCase();
        const GO = BUDGET_LIVE
          ? GO_BASE
          : Object.fromEntries(Object.entries(GO_BASE).filter(([kk]) => kk !== "b"));
        if (Date.now() < gPending && GO[k]) {
          gPending = 0;
          e.preventDefault();
          go(GO[k]);
          return;
        }
        if (k === "g") {
          gPending = Date.now() + 1400;
          return;
        }
        gPending = 0;
        if (e.key === "?") {
          e.preventDefault();
          open();
          return;
        }
        if (k === "n") {
          e.preventDefault();
          go("studio");
        }
      });
    })();

    /* ---------- first use experience and adaptive post-login routing ---------- */
    (async function firstUse() {
      let fuUid = "anon";
      try {
        const { data } = await supabase.auth.getUser();
        if (data && data.user) fuUid = data.user.id;
      } catch (_) {}
      /* Closed beta: label the workspace and gate held-back navigation. The
     server re-checks every held-back action, this is only the visible half. */
      try {
        await initBeta();
        lucide.createIcons();
      } catch (_) {}
      try {
        /* Startup routing is only allowed to move the user while the route it was
       queued against is still current and no Photo Design Canvas is open. */
        const fuToken = __navSeq;
        /* A click inside first-use is an intentional navigation and always wins.
       The asynchronous start-page decision is different: it may only move the
       user while the route it was queued against is still the visible one and
       no Photo Design Canvas has been opened in the meantime. */
        const fuStartGo = (v) => {
          if (!isCurrentNavigation(fuToken)) return;
          if (inPhotoCanvas()) return;
          go(v);
        };
        mountFirstUse({
          go,
          startGo: fuStartGo,
          startCurrent: () => isCurrentNavigation(fuToken) && !inPhotoCanvas(),
          lucide,
          esc,
          photos: PHOTOS,
          uid: fuUid,
          track,
          getSummary: () => getWorkspaceSummary(),
          uploadPhoto: (f) => uploadRoomPhoto(f),
          prefsStart: async () => {
            try {
              const p = await getPrefs();
              return (p && p.start && p.start.page) || "smart";
            } catch (_) {
              return "smart";
            }
          },
          saveStart: async (page) => {
            PREFS = await savePrefs({ start: { page } });
          },
        });
      } catch (e) {
        /* onboarding is additive, never block the app */
      }
    })();

    /* Escape closes any open lightweight modal (.up-modal.on) */
    function closeTopUpModal() {
      const open = [...document.querySelectorAll(".up-modal.on")];
      if (!open.length) return false;
      open[open.length - 1].classList.remove("on");
      return true;
    }
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      closeTopUpModal();
    });
    /* Changing views must never leave a modal scrim covering the app.
   Some modals open asynchronously, so sweep again briefly after the switch. */
    window.addEventListener("hashchange", () => {
      const sweep = () => {
        document.querySelectorAll(".up-modal.on").forEach((m) => m.classList.remove("on"));
        document.body.style.overflow = "";
      };
      sweep();
      [250, 700, 1500].forEach((ms) => timers.push(window.setTimeout(sweep, ms)));
    });
  } catch (e) {
    console.error(e);
  }

  return () => {
    timers.forEach((t) => {
      window.clearInterval(t);
      window.clearTimeout(t);
    });
  };
}
