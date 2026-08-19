# Beta Test Checklist

Run every row with a **brand-new account** that has no sample data. Record the
diagnostic ID for any failure.

Widths to test each flow at: **1440** (desktop), **1280**, **1024** (small
laptop), **834** (tablet), **390** (phone).

## A. Access And Onboarding

| #   | Check                                                                | Pass |
| --- | -------------------------------------------------------------------- | ---- |
| A1  | Sign up with email, confirm, land in workspace                       | ☐    |
| A2  | Google sign-in                                                       | ☐    |
| A3  | First-use onboarding appears once and routes to the chosen workflow  | ☐    |
| A4  | Empty Dashboard, Properties, Designs, Media show honest empty states | ☐    |
| A5  | Beta badge and Send Feedback visible in topbar at every width        | ☐    |
| A6  | Held-back nav shows Coming Soon and explains itself on click         | ☐    |
| A7  | Non-allowlisted account cannot reach held-back server actions        | ☐    |

## B. Core Flows

| #   | Check                                                                   | Pass |
| --- | ----------------------------------------------------------------------- | ---- |
| B1  | Upload **1 photo**, classify, design, view result                       | ☐    |
| B2  | Upload **8 photos**, bulk Design Photos, all complete                   | ☐    |
| B3  | Upload **30 photos**, grid stays responsive, no horizontal scroll       | ☐    |
| B4  | Canvas: change room, style, format, autosave indicator, exit and return | ☐    |
| B5  | Video Builder: scenes, transitions, ending, render, playback            | ☐    |
| B6  | Media: assets appear, assign to property, reuse in a builder            | ☐    |
| B7  | Save a property/project, sign out, sign in, everything is still there   | ☐    |
| B8  | Presentation build + share link opens for a signed-out viewer           | ☐    |
| B9  | Photo persistence after 1h idle (signed URLs re-sign, no broken tiles)  | ☐    |

## C. Failure And Edge Conditions

| #   | Check                                                                      | Pass |
| --- | -------------------------------------------------------------------------- | ---- |
| C1  | Slow connection (throttle to Slow 3G): loading skeletons, no dead UI       | ☐    |
| C2  | Expired session: user is told, sent to sign-in, work context preserved     | ☐    |
| C3  | Failed generation: honest failure state, retry offered, reference shown    | ☐    |
| C4  | Insufficient credits: blocked before charge, clear message, no partial job | ☐    |
| C5  | Duplicate submit (double-click Generate) charges once                      | ☐    |
| C6  | Refresh mid-flow returns to the same project and step                      | ☐    |
| C7  | Unsupported file type is rejected with a readable reason                   | ☐    |

## D. States

Every list, builder and modal must have all four: **empty**, **loading**,
**success**, **failure**. Spot-check Dashboard, Properties, Designs, Media,
Studio grid, Video grid, Presentations.

## E. Responsive

| #   | Check                                                      | Pass |
| --- | ---------------------------------------------------------- | ---- |
| E1  | Sidebar collapses to rail; tooltips only in rail mode      | ☐    |
| E2  | No horizontal scroll anywhere at 390px                     | ☐    |
| E3  | Modal footers stay reachable and sticky at 834px and below | ☐    |
| E4  | Card grids reflow without overlapping transition controls  | ☐    |
