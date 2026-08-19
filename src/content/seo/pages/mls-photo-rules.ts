import type { LandingPage } from "@/content/seo/types";

export const page: LandingPage = {
  slug: "/mls-photo-rules",
  tier: "D",
  intent:
    "Someone editing listing photos wants to know what kinds of edits MLS rules typically allow versus restrict.",

  metaTitle: "MLS Rules For Edited Listing Photos",
  metaDescription:
    "General guidance on enhancement versus alteration, sky replacement, watermarks, and photo ownership under typical MLS photo rules. Not legal advice.",

  eyebrow: "Compliance",
  h1: "MLS Rules For Edited Listing Photos",
  lede: "General guidance on where enhancement typically ends and alteration begins, and who owns a listing photo once it is edited.",

  spaceType: "exterior",
  roomType: "exterior",
  budgetBand: 0,

  intro: [
    "Rules governing edited listing photos vary by state and by individual MLS, and they are updated periodically, so this page is general information and not legal advice about any specific board's policy. What is consistent across most MLS frameworks is a rough distinction between enhancement, brightening, cropping, correcting lens distortion, and alteration, changing what the photo shows to be true about the property. Sky replacement, removing cars or trash bins, and virtual renovation images each sit at different points along that line, and the right move before publishing any of them is to check your specific MLS's current photo policy rather than assume the same rule applies everywhere.",
    "This page also covers a question that has nothing to do with disclosure: who owns the photo once it has been edited. Photo copyright and MLS rules are two separate things, and confusing them is a common source of disputes between agents, photographers and brokerages.",
  ],

  beforePhoto: "exteriorBefore",
  afterPhoto: "exteriorAfter",
  beforeCaption: "Original exterior photo, overcast sky, cars visible on the street.",
  afterCaption: "Edited exterior photo with sky replaced and vehicles removed.",

  steps: [
    {
      title: "Sort The Edit By Type",
      text: "Decide whether the change is a correction, an enhancement, or an alteration of what the photo shows.",
    },
    {
      title: "Apply Any Required Label",
      text: "Attach disclosure language for edits your MLS treats as alterations rather than simple corrections.",
    },
    {
      title: "Confirm Ownership Before Publishing",
      text: "Check the photographer's license terms before an edited image goes to the MLS or a third party site.",
    },
  ],

  showcase: ["mls", "exterior", "staging", "reality-lock"],

  sections: [
    {
      h2: "Enhancement Versus Alteration",
      body: [
        "Most MLS photo policies draw some version of a line between enhancement and alteration, even where the exact wording differs. Enhancement generally covers things like brightness, contrast, white balance, cropping and correcting the barrel distortion that comes out of a wide angle lens, edits that make the photo a more accurate representation of what the space looks like to the eye. Alteration generally covers changes that add, remove or move something that was or was not physically present, which is a different kind of edit entirely because it changes what the photo is evidence of.",
        "The reason this distinction matters practically is that many boards allow enhancement without any disclosure requirement while requiring disclosure, or in some cases prohibiting outright, edits that fall on the alteration side. Where a specific edit lands on that spectrum is not always obvious, and boards do not always agree with each other, which is exactly why the safest approach is checking your specific MLS's photo policy for the edit you are considering rather than assuming a category from a general guide like this one applies uniformly.",
        "A useful gut check is asking whether the edit changes what a buyer would see standing in the same spot as the camera. Correcting color temperature does not. Erasing a satellite dish from the roof might, depending on how your board treats exterior alterations. When in doubt, ask before publishing.",
      ],
    },
    {
      h2: "Sky Replacement & Removing Cars Or Trash Bins",
      body: [
        "Sky replacement is one of the more common edits agents ask about, since a gray overcast sky can make an otherwise strong exterior photo look flat. Many boards treat sky replacement more leniently than other alterations because the sky is not a feature of the property itself, but this is exactly the kind of assumption that needs local confirmation rather than treatment as a universal rule, since some MLS policies do restrict it as a form of alteration regardless of what it depicts.",
        "Removing a car parked on the street or a trash bin at the curb sits in a similar category for many boards, treated as tidying up a temporary object rather than altering the property. But temporary objects can shade into something else quickly, removing a neighbor's fence, a utility box, or a permanent structure on an adjacent lot crosses from tidying into altering what the photo represents about the property and its surroundings, and that is squarely the kind of edit that needs a disclosure check against your specific MLS policy before you publish it.",
      ],
      bullets: [
        "Sky replacement: leniency varies by MLS, confirm before publishing",
        "Removing a parked car or trash bin: often treated as tidying, not universal",
        "Removing a permanent structure or fixture: more likely to require disclosure or be restricted",
        "When uncertain, ask your MLS compliance desk before the photo goes live",
      ],
    },
    {
      h2: "Virtual Renovation Photos",
      body: [
        "A virtual renovation image, a rendering that shows a kitchen or bathroom with finishes it does not currently have, is treated by most boards as a category distinct from both enhancement and standard staging, because it depicts construction work that has not happened rather than furniture that could be moved into the room. Where boards allow this kind of image at all, it typically comes with a stronger and more explicit disclosure requirement than furniture staging does, often specifying that the rendering must be clearly labeled as a concept or a virtual renovation and not confused with the current condition of the property.",
        "Some boards restrict virtual renovation images to marketing materials outside the MLS entirely rather than allowing them in the primary listing photo set. This is a meaningful enough difference in practice that it is worth confirming directly with your board before commissioning renderings for a listing that has not actually been renovated, rather than assuming the same disclosure that covers furniture staging will also cover a rendered kitchen remodel.",
      ],
    },
    {
      h2: "Watermarks, Branding, & Photo Ownership",
      body: [
        "Watermark and branding rules are a separate layer from disclosure rules, and many boards have specific policies restricting or prohibiting brokerage logos, contact information, or other branding overlaid on MLS photos, sometimes independent of whatever other listings in the same market do. Confirm your board's current watermark policy before adding a logo or phone number to an image headed for the MLS feed, since this is one of the more commonly enforced technical rules and one of the easier ones to get flagged for.",
        "Photo ownership and copyright generally rest with the photographer who took the original image, not with the agent, the brokerage, or the seller, unless a specific license agreement transfers those rights. Editing a photo, whether that is staging, sky replacement, or a virtual renovation rendering, does not change who owns the underlying image, and using a photographer's work beyond the terms of the license you were given, including on a different listing or after the listing has expired, is a licensing question separate from any MLS photo rule. Check the terms of your photography agreement, not just your MLS policy, before an edited image gets reused.",
      ],
    },
  ],

  faqs: [
    {
      q: "Is Sky Replacement Allowed On MLS Photos?",
      a: "It depends on the specific MLS. Some boards treat it as a minor enhancement with no disclosure needed, others restrict it. Rules vary and change over time. Confirm your current MLS photo policy before replacing a sky on a listing photo rather than assuming a general rule applies.",
    },
    {
      q: "Can I Remove A Parked Car From An Exterior Photo?",
      a: "Many boards treat removing a temporary object like a parked car or a trash bin as tidying rather than alteration, but this varies. Removing anything that could be read as a permanent feature of the property or its surroundings is more likely to require disclosure. Check with your MLS.",
    },
    {
      q: "Do Virtual Renovation Renderings Need A Disclosure Label?",
      a: "Most boards that allow virtual renovation images at all require a clear label identifying the image as a rendering or concept, not the property's current condition. Some restrict these images to marketing materials outside the MLS. Confirm your specific board's policy before commissioning renderings.",
    },
    {
      q: "Who Owns A Listing Photo After It Has Been Edited?",
      a: "Ownership typically stays with the original photographer unless a license agreement transfers it. Editing the photo, through staging, sky replacement, or rendering, does not change that ownership. Check the terms of your photography agreement before reusing an edited image beyond its original license.",
    },
    {
      q: "Are Watermarks And Brokerage Logos Allowed On MLS Photos?",
      a: "Many boards restrict or prohibit watermarks, logos, and contact information on MLS photos, and this is one of the more actively enforced technical rules. Confirm your specific MLS's current watermark and branding policy before submitting images that include any overlay.",
    },
  ],

  relatedSlugs: [
    "/virtual-staging-disclosure-rules",
    "/ai-exterior-design",
    "/ai-virtual-staging",
    "/for-real-estate-agents",
    "/declutter-photo",
    "/for-property-managers",
  ],

  ctaTitle: "Edit Listing Photos With Labels Attached",
  ctaBody:
    "Sky, staging and cosmetic edits export with the metadata and captions you need to move quickly through MLS review.",
  ctaLabel: "Edit A Listing Photo",
};
