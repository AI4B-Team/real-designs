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


const BOXES: [string, string][] = [
  ["Sofa", "left:33%;top:53%;width:37%;height:20%"],
  ["Rug", "left:31%;top:70%;width:41%;height:21%"],
  ["Wall Art", "left:14%;top:21%;width:11%;height:41%"],
  ["Floor Lamp", "left:29%;top:37%;width:12%;height:44%"],
  ["Coffee Table", "left:39%;top:67%;width:26%;height:15%"],
  ["Potted Tree", "left:66%;top:38%;width:12%;height:39%"],
];



export const showcaseHtml = `
<!-- ============ SHOWCASE GRID ============ -->
<section class="alt" id="showcase">
  <div class="wrap sc-wrap">
    <div class="sec-head rv">
      <span class="eyebrow">Twelve Tools, One Running Total</span>
      <h2>Every Tool Feeds <em class="ann-underline">The Same Number.</em></h2>
      <p class="lede">Restyle, stage, enhance, shop, film and present. Each one runs on the photo you uploaded, ready to review or send to a client.</p>
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

      ${card(7, "Client Presentation", "Send A Link, Not A Zip File",
        "Branded before-and-after pages clients can open, favorite and approve without an account.", `
        <div class="sc-mls">
          <div class="sc-lyr">${im(PHOTOS.japandi, "Branded presentation preview")}</div>
          <span class="sc-vs mono">Client View</span>
          <span class="sc-shield mono">Shareable &middot; No Login Required</span>
        </div>`)}

      ${card(8, "Photo Enhancement", "Make Every Listing Photo Look Its Best",
        "Fix lighting, color and clarity on real photos without touching the walls, windows or layout.", `
        <div class="sc-fade">
          <div class="sc-lyr">${im(PHOTOS.exteriorBefore, "Original photo")}</div>
          <div class="sc-lyr sc-f2">${im(PHOTOS.exteriorAfter, "Enhanced photo")}</div>
          <span class="sc-lab l">Original</span><span class="sc-lab r">Enhanced</span>
        </div>`)}

      ${card(9, "Shop The Design", "Every Piece Priced Three Ways",
        "Each item matched to something you can actually order, at a best price, a closest match and a premium pick, with a check that it physically fits.", `
        <div class="sc-shop">
          <div class="sc-lyr">${im(PHOTOS.after, "Shoppable render")}</div>
          ${[["19%", "29%"], ["34%", "34%"], ["52%", "58%"], ["40%", "71%"], ["69%", "47%"]].map(([l, t], i) =>
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
