import { createFileRoute } from "@tanstack/react-router";

import { Builder } from "@/components/seo/Builder";
import { FreeToolTemplate } from "@/components/seo/FreeToolTemplate";
import { PHOTOS } from "@/content/rd-photos";
import "@/styles/rd-site.css";

const TITLE = "Free AI Interior Design From A Photo | REAL DESIGNS";
const DESC =
  "Redesign a room from one photo, free and with no signup. Keep the walls where they are and see a planning range for the work before you commit.";

export const Route = createFileRoute("/free/ai-interior-design")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/free/ai-interior-design" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/free/ai-interior-design" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How To Redesign A Room From A Photo",
          step: [
            { "@type": "HowToStep", position: 1, name: "Upload One Photo", text: "Take a wide shot from a corner of the room so two walls and the floor are visible." },
            { "@type": "HowToStep", position: 2, name: "Choose An Intensity", text: "Refresh keeps the layout and changes surfaces. Renovation allows cabinetry, tile and fixtures to move." },
            { "@type": "HowToStep", position: 3, name: "Generate The Design", text: "Reality Lock holds the walls, windows and doors in place while finishes change." },
            { "@type": "HowToStep", position: 4, name: "Read The Planning Range", text: "Every design carries a cost range built from the work visible in the image." },
          ],
        }),
      },
    ],
  }),
  component: FreeInteriorTool,
});

function FreeInteriorTool() {
  return (
    <FreeToolTemplate
      eyebrow="Free Tool"
      h1="Free AI Interior Design From A Photo"
      lede="One photo in. A redesigned room and a planning range out. No account for your first design."
      intro={[
        "Upload a photo of a real room and get back a redesign of that same room, not a stock image of somebody else's house. The walls, windows, doors and ceiling height stay exactly where they are, because Reality Lock treats them as fixed. What changes is what you can actually change: paint, flooring, cabinetry, lighting, tile, fixtures and furniture.",
        "Your first design is free and needs no account. You will see the redesigned room at full size and a planning range for the work it implies, so the picture and the cost arrive together instead of the cost arriving later from a contractor.",
        "This tool is built for people about to spend money. A pretty render that quietly moves a load bearing wall is not a plan, it is a distraction. Everything here is anchored to the room you photographed.",
      ]}
      tool={
        <Builder
          spaceType="interior"
          roomType="living room"
          budgetBand={1}
          afterPhoto={PHOTOS.after}
          title="Redesign Your Room, Free"
          variant="free"
        />
      }
      sections={[
        {
          h2: "What A Good Source Photo Looks Like",
          body: [
            "Stand in a corner and shoot the opposite corner. That single habit fixes most bad results. A corner shot gives two wall planes, a floor plane and usually a window, which is everything needed to understand the geometry of the room and the direction the light comes from.",
            "Shoot in daylight with the room lights on and the blinds open. Avoid flash, which flattens the shadows that describe depth. Hold the camera at chest height and keep it level. Tilting up makes the walls converge and stretches the ceiling, and a stretched ceiling produces furniture at the wrong scale.",
            "You do not need to tidy the room first. Clutter can be removed as part of the design. What you should not do is hide a defect you intend to keep hidden, because the planning range prices what it can see and a covered up water stain becomes a surprise later.",
          ],
          bullets: [
            "Shoot from a corner, camera level, at chest height",
            "Daylight plus interior lights, no flash",
            "One room per photo, not a hallway view through three doorways",
            "Include the floor. Flooring is usually the largest single surface cost",
          ],
        },
        {
          h2: "Refresh, Makeover, Renovation Or Reimagine",
          body: [
            "Intensity is the single most important control on this page and the one most people skip. It decides whether you are looking at a weekend of painting or a permit.",
            "Refresh keeps everything structural and everything expensive. Paint, textiles, lighting and furniture change. Makeover adds flooring and fixtures. Renovation puts cabinetry, tile and plumbing fixtures in play, which is where kitchens and bathrooms get real. Reimagine is the only setting that treats the layout itself as negotiable, and it is the only one that should ever be shown to a structural engineer.",
            "Because the intensity is a control rather than a guess, the same room can be priced four ways in a few minutes. That is usually more useful than one beautiful answer, especially when you are deciding how much of your budget a single room deserves.",
          ],
        },
        {
          h2: "Why The Cost Arrives With The Picture",
          body: [
            "Design tools traditionally stop at the image. The number shows up weeks later, from a contractor, and it is usually a multiple of what the picture implied. That gap is where most projects die.",
            "Here the design is read as a list of work. Square feet of flooring, linear feet of cabinet run, number of fixtures, area of wall to be painted. Those quantities are multiplied against published unit rates for the finish grade you selected, and the result is presented as a planning range with a confidence level.",
            "It is a planning range and not a bid. It does not know your local labor market, your building's access restrictions, what is behind your walls or what your city charges for a permit. It is the number you use to decide whether to have the conversation, not the number you sign.",
          ],
        },
        {
          h2: "What This Tool Will Not Do",
          body: [
            "It will not produce construction documents. It will not size a beam, specify an electrical circuit, or tell you whether a wall is load bearing. It will not replace a licensed designer on a project with real complexity, and on a whole house renovation you should expect to hire one.",
            "It also will not invent a room. If the photo is dark, blurry, shot through a doorway or covers three spaces at once, the geometry is ambiguous and the output will show it. Reshoot rather than argue with the result.",
            "Being clear about the edges is the point. A tool that claims to do everything is a tool you cannot trust with anything.",
          ],
        },
      ]}
      faqs={[
        {
          q: "Is this actually free?",
          a: "Your first design costs nothing and requires no account. After that a free account gives you a small daily allowance, and paid plans exist for people running many properties or client projects. There is no card required to see your first result and no trial that quietly starts billing.",
        },
        {
          q: "Do you keep or train on my photos?",
          a: "Photos are processed to produce your design and are attached to your project if you create an account. You can delete a project and its images at any time. Do not upload photos containing other people's private information, since a listing photo and a personal photo are not the same thing.",
        },
        {
          q: "How accurate is the planning range?",
          a: "It is accurate enough to plan with and never accurate enough to sign. Ranges are built from published unit rates and the quantities visible in your photo, then presented with a confidence level. Local labor rates, hidden conditions and permit costs move real bids well outside the range, in both directions.",
        },
        {
          q: "Can I use the images in a listing or an advertisement?",
          a: "Any image showing furniture or finishes that do not exist must be labeled as a virtual rendering wherever your market requires it, and most do. Rules vary by state and by individual MLS. Confirm the wording with your brokerage and your MLS before publishing, and never present a redesign as the current condition of a property.",
        },
        {
          q: "Will the design move my walls?",
          a: "Not unless you choose the Reimagine intensity, which explicitly puts layout in play. At every other setting Reality Lock treats walls, window openings, door openings and ceiling height as fixed, so the room you get back is the room you photographed with different finishes in it.",
        },
      ]}
      related={[
        "/ai-interior-design",
        "/ai-kitchen-design",
        "/ai-bathroom-design",
        "/renovation-cost-estimator",
        "/free/virtual-staging",
        "/free/rehab-cost-calculator",
      ]}
      ctaTitle="Redesign The Room You Are Standing In."
      ctaBody="One photo, four intensities, a cost range on every version. No account needed for the first one."
    />
  );
}
