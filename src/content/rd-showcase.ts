// Animated feature showcase grid. Twelve cards, animated only while in view.
/* eslint-disable */
// @ts-nocheck
import { PHOTOS, photo } from "@/content/rd-photos";

const im = (src: string, alt: string) => photo(src, alt);

const cursor = `<span class="sc-cur"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 2l14 9-6.4 1.3L15 19l-2.6 1-2.4-6.6L5 17z" fill="#fff" stroke="#111" stroke-width="1.2" stroke-linejoin="round"/></svg></span>`;

function wipeCard(n: number, cat: string, title: string, body: string, before: string, after: string, l1: string, l2: string) {
  return card(n, cat, title, body, `
    <div class="sc-wipe">
      <div class="sc-lyr">${im(before, title + " before")}</div>
      <div class="sc-lyr sc-aft">${im(after, title + " after")}</div>
      <span class="sc-div"></span>
      <span class="sc-lab l">${l1}</span><span class="sc-lab r">${l2}</span>
    </div>`);
}

function card(n: number, cat: string, title: string, body: string, media: string, badge = false) {
  return `<article class="sc-card" data-sc="${n}">
    <div class="sc-media">${media}${badge ? '<span class="sc-new mono">New</span>' : ""}</div>
    <div class="sc-body">
      <span class="sc-pill mono">${cat}</span>
      <h3>${title}</h3>
      <p>${body}</p>
    </div>
  </article>`;
}

const SCOPE_ROWS: [string, string, string][] = [
  ["LVP Flooring, Installed", "340 sf", "$1,700 to $2,100"],
  ["Paint, Walls And Ceiling", "1 rm", "$580 to $760"],
  ["Recessed Lighting", "6 ea", "$1,020 to $1,380"],
  ["Baseboard And Casing", "76 lf", "$430 to $620"],
  ["Drywall Repair", "1 rm", "$340 to $520"],
];

const BOXES: [string, string][] = [
  ["Sofa", "left:26%;top:52%;width:40%;height:26%"],
  ["Rug", "left:22%;top:74%;width:52%;height:18%"],
  ["Wall Art", "left:40%;top:16%;width:20%;height:22%"],
  ["Floor Lamp", "left:76%;top:34%;width:14%;height:38%"],
  ["Coffee Table", "left:38%;top:70%;width:24%;height:14%"],
  ["Armchair", "left:6%;top:50%;width:18%;height:28%"],
];

const BUDGETS: [string, string, string][] = [
  ["Refresh", "$3.2K to $5K", PHOTOS.neutral],
  ["Makeover", "$11.4K to $14.9K", PHOTOS.after],
  ["Renovation", "$26K to $35K", PHOTOS.luxury],
  ["Reimagine", "$41K to $62K", PHOTOS.midcentury],
];


export const showcaseHtml = `
<!-- ============ SHOWCASE GRID ============ -->
<section class="alt" id="showcase">
  <div class="wrap sc-wrap">
    <div class="sec-head rv">
      <span class="eyebrow">Twelve Tools, One Running Total</span>
      <h2>Every Tool Feeds <em class="ann-underline">The Same Number.</em></h2>
      <p class="lede">Restyle, stage, price, shop, film and plan. Each one runs on the photo you uploaded, and each one adds to a single project budget you can hand a contractor.</p>
    </div>
    <div class="sc-grid" id="scGrid">

      ${wipeCard(2, "Exterior Redesign", "Price The Curb Appeal First",
        "Test siding, paint, roofing and curb appeal before a contractor quotes a square foot.",
        PHOTOS.exteriorBefore, PHOTOS.exteriorAfter, "Before", "After")}

      ${wipeCard(1, "Interior Redesign", "Restyle A Room You Actually Own",
        "Take a dated room to a finished design on the same walls. Furniture, lighting and decor, fully redone.",
        PHOTOS.before, PHOTOS.after, "Before", "After")}

      ${wipeCard(3, "Landscape Design", "See The Yard Before You Break Ground",
        "Add a patio, fire pit or fresh planting. See it standing in the dirt before you dig.",
        PHOTOS.yardBefore, PHOTOS.yardAfter, "Before", "After")}

      ${card(5, "Declutter", "Clear The Room, Keep The Architecture",
        "Pull every piece of furniture out and keep the walls, windows and floor exactly where they are. Restage from a clean slate.", `
        <div class="sc-fade sc-declut">
          <div class="sc-lyr">${im(PHOTOS.stageClutter, "Furnished room")}</div>
          <div class="sc-lyr sc-f2">${im(PHOTOS.stageEmpty, "Emptied room")}</div>
          <button class="sc-btn-pill">Empty Room</button>
          ${cursor}
          <span class="sc-lab l">Interior</span>
        </div>`)}

      ${card(4, "Virtual Staging", "Furnish A Vacant Listing By Lunch",
        "Furnish a bare listing before the photographer books a reshoot. No rented furniture, no delivery window.", `
        <div class="sc-fade">
          <div class="sc-lyr">${im(PHOTOS.stageEmpty, "Empty room")}</div>
          <div class="sc-lyr sc-f2">${im(PHOTOS.stageStaged, "Staged room")}</div>
          <span class="sc-lab l">Empty</span><span class="sc-lab r">Staged</span>
        </div>`)}

      ${card(6, "Reality Lock", "Lock What Stays, Change What Does Not",
        "Tag the sofa you already bought and the floor you already paid for. They survive every regeneration untouched, and every locked decision carries into the next version.", `
        <div class="sc-detect">
          <div class="sc-lyr">${im(PHOTOS.after, "Detected objects in a living room")}</div>
          ${BOXES.map(([n, pos], i) => `<span class="sc-box" style="${pos};--d:${i * 0.18}s"><b>${n}</b></span>`).join("")}
          <div class="sc-menu"><span>Keep</span><span>Replace</span><span>Remove</span></div>
          ${cursor}
        </div>`)}

      ${card(7, "Scope And Budget", "Price The Job, Not Just The Furniture",
        "Line items, quantities, trades and local labour rates. A planning range you can hand a contractor, not a ballpark.", `
        <div class="sc-scope">
          <div class="sc-lyr">${im(PHOTOS.after, "Priced room")}</div>
          <div class="sc-panel">
            ${SCOPE_ROWS.map(([d, q, p], i) =>
              `<div class="sc-row" style="--d:${0.25 + i * 0.2}s"><span>${d}</span><i class="mono">${q}</i><b class="mono">${p}</b></div>`).join("")}
            <div class="sc-total" style="--d:1.45s"><span class="mono">Planning Range</span><b class="mono">$11.4K to $14.9K</b></div>
            <span class="sc-ok mono" style="--d:1.75s">Within Target</span>
          </div>
        </div>`)}

      ${card(8, "Budget Mode", "Design To The Money You Have",
        "Set the number before you generate. The AI only proposes work that plausibly fits it.", `
        <div class="sc-budget">
          ${BUDGETS.map(([n, , src], i) => `<div class="sc-lyr sc-b${i}">${im(src, n + " finish level")}</div>`).join("")}
          <div class="sc-chips">${BUDGETS.map(([n], i) => `<span class="sc-chip sc-c${i}">${n}</span>`).join("")}</div>
          <div class="sc-range mono">${BUDGETS.map(([, r], i) => `<b class="sc-r${i}">${r}</b>`).join("")}</div>
        </div>`)}

      ${card(9, "Shop The Design", "Every Piece Priced Three Ways",
        "Each item matched to something you can actually order, at a best price, a closest match and a premium pick, with a check that it physically fits.", `
        <div class="sc-shop">
          <div class="sc-lyr">${im(PHOTOS.after, "Shoppable render")}</div>
          ${[["19%", "29%"], ["34%", "34%"], ["57%", "47%"], ["52%", "58%"], ["40%", "71%"], ["69%", "47%"], ["88%", "40%"]].map(([l, t], i) =>
            `<span class="sc-hot${i === 2 ? " sc-hot-main" : ""}" style="left:${l};top:${t};--d:${i * 0.16}s"></span>`).join("")}
          <span class="sc-click"></span>
          <div class="sc-prod">
            <b>Low Profile Sofa</b>
            <span><i>Best Price</i><em class="mono">$690</em></span>
            <span class="on"><i>Closest Match</i><em class="mono">$1,240</em></span>
            <span><i>Premium Pick</i><em class="mono">$2,480</em></span>
          </div>
          <span class="sc-toast mono">Added To Project</span>
          ${cursor}
        </div>`)}

      ${card(10, "Commercial License", "Own Everything You Make",
        "Full commercial rights on every paid plan. Your renders stay yours if you cancel, downgrade or ask for a refund.", `
        <div class="sc-lic">
          <div class="sc-lyr">${im(PHOTOS.after, "Licensed commercial render")}</div>
          <span class="sc-wm">REAL DESIGNS</span>
          <span class="sc-licchip mono">Licensed &middot; Commercial Use</span>
        </div>`)}

      ${card(11, "Walkthrough Video", "Post It Before The Listing Goes Live",
        "One click, no editing. Horizontal, square or vertical, branded or clean.", `
        <div class="sc-video">
          <div class="sc-lyr sc-ken">${im(PHOTOS.luxury, "Walkthrough video frame")}</div>
          <span class="sc-rec mono"><i></i>Rec <b class="sc-clock">00:14</b></span>
        </div>`, true)}

      ${card(12, "MLS Disclosure", "The Disclosure Nobody Else Automates",
        "Staged photos labelled automatically to your MLS and state rules, with an audit trail.", `
        <div class="sc-mls">
          <div class="sc-lyr">${im(PHOTOS.coastal, "Virtually staged listing photo")}</div>
          <span class="sc-vs mono">Virtually Staged</span>
          <span class="sc-shield mono">Compliant &middot; FL Stellar MLS</span>
        </div>`, true)}

    </div>
  </div>
</section>
`;

export function initShowcase(timers: number[]) {
  const grid = document.getElementById("scGrid");
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll<HTMLElement>(".sc-card"));
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  const pending = new WeakMap<Element, number>();

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const el = e.target as HTMLElement;
        const prev = pending.get(el);
        if (prev) { window.clearTimeout(prev); pending.delete(el); }
        if (e.isIntersecting && e.intersectionRatio >= 0.4) {
          const stagger = (cards.indexOf(el) % 3) * 300;
          const id = window.setTimeout(() => el.classList.add("play"), stagger);
          pending.set(el, id);
          timers.push(id);
        } else {
          el.classList.remove("play");
        }
      });
    },
    { threshold: [0, 0.4, 0.6] },
  );
  cards.forEach((c) => io.observe(c));

  // Recording timer on card 11, only while that card is playing.
  const clock = grid.querySelector<HTMLElement>(".sc-clock");
  const vidCard = grid.querySelector<HTMLElement>('[data-sc="11"]');
  let t = 8;
  timers.push(
    window.setInterval(() => {
      if (!clock || !vidCard || !vidCard.classList.contains("play")) return;
      t = t >= 24 ? 8 : t + 1;
      clock.textContent = "00:" + String(t).padStart(2, "0");
    }, 1000),
  );
}
