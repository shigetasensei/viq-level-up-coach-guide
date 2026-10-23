# Level Up — The Coach's Field Manual

An unofficial, independent coaching guide for the **VEX IQ Robotics Competition 2026–27 game, Level Up**: scoring, the Match, 78 rules in plain English, an interactive 3D scoring lab, a first-season roadmap for new teams, and an event-day schedule planner.

**Live site:** https://shigetasensei.github.io/viq-level-up-coach-guide/

> Not affiliated with or endorsed by VEX Robotics, Innovation First, Inc. or the REC Foundation. Rule summaries are paraphrased and can go out of date. The official Game Manual and Q&A are the only authoritative sources. Content was checked against Game Manual v2.1 on 16 Oct 2026.

## Concept

The page is a climb. Chapters are the game's own Goal levels (L1 Start · L2 Play · L3 Master · L4 Compete) and the scroll HUD is a bean bag riding up the pole, scoring 3, 6, 12 and 16 as you go. The hero is a scripted loop of bags landing on the Goals, teaching the headline rules (matching colors, yellow is wild, L4 is yellow only) before a word is read.

## Structure

| File | Purpose |
| --- | --- |
| `index.html` | Home and hub: one-line purpose, "Who are you?" role cards, then the general guide (briefing, game, scoring, 3D lab, the Match, rules explorer, resources, manual updates) |
| `coaches.html` | Coach zone: new coaches, robot and inspection checklists, engineering notebook, coaching, events and rankings |
| `schedule.html` | Event schedule planner (generate a practice schedule or import the real one) |
| `students.html` | Student zone: team jobs table, student and inspection checklists, robot upgrade ideas |
| `timer.html`, `timer.js` | Match timer: full-screen 60 s clock with hand-off cues, sound/voice/vibration, 3-2-1 lead-in, Stop-early recorder, Skills mode |
| `referee.html` | Referee zone: volunteer referee guide with Match flow, watch list, scoring reading, tough moments, Skills differences and a printable checklist |
| `judges.html` | Judge zone (VEX IQ): what judges and Judge Advisors do, interviews, notebooks, awards, deliberations, protecting students, printable checklists; summarized from the Global Robotics & Science Foundation Library |
| `teachers.html` | Teacher intro (T2T): the 20-minute drive-a-robot session, what VEX is, why students compete, how the skills connect to school subjects, a session plan, FAQ |
| `host.html`, `host.js` | Host zone: who does what, Tournament rules, a dated to-do list with owners, "next up" and a preparation timeline, eight printable lead sheets, an event-day run sheet that shifts with the doors-open time (presets for the three Kobe events), equipment and school matters |
| `volunteers.html`, `volunteers.js` | Volunteer zone: twelve jobs for school staff and student volunteers, official game video (click to load), Field start-layout diagram, printable role sheets, and a VEX V5 Override volunteer section (game facts, event agendas, checklist) |
| `404.html` | "That bag doesn't score." |
| `styles.css` | Design system: ink + paper tokens, type, components, motion, print |
| `field3d.js` | Shared Three.js scene (Goals, pillow-shaped Bean Bags, lights, shadows) |
| `hero3d.js` | Scripted hero loop + live score counter |
| `lab.js` | Interactive 3D scoring lab: sandbox and quiz |
| `motion.js` | Header, full-screen menu, level HUD, GSAP reveals, match clock, size envelope, page curtain |
| `lists.js` | Shared checklists: saved ticks, print-one-checklist |
| `students.js` | Student zone job picker |
| `app.js` | Calculator, rules explorer, checklists, version table |
| `schedule.js` | Schedule generator, importer, timelines, field board, fairness report |
| `rules-data.js` | Plain-language summaries of every rule (SC1–T19) with links to the official text |

No build step. Plain HTML, CSS and JavaScript.

## Run locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Stack

- [Three.js](https://threejs.org/) r128 and OrbitControls (jsDelivr)
- [GSAP](https://gsap.com/) 3.12.5 + ScrollTrigger (cdnjs)
- Bricolage Grotesque, Instrument Sans and DM Mono (Google Fonts)

## Quality notes

- **Accessibility:** WCAG AA contrast verified in light and dark schemes, keyboard-operable menu with focus trap and `inert` background, visible focus rings, text equivalents for color-coded information, `prefers-reduced-motion` respected (static hero, no scroll animation, no cursor, no page curtain), content visible without JavaScript except the rules explorer (which links to the official online rules).
- **Performance:** hero text paints from pure CSS (no JS dependency), scripts are `defer`red, 3D loops pause when off-screen or the tab is hidden, zero layout shift, 60 fps hero in testing.
- **Responsive:** verified from 320 px to 1920 px.

## Sources

Rule text and changelog: the official online rules index and the VEX Forum manual-update thread. New-team guidance: VEX Education's *Competition 101: Level Up* unit. See the Resources section of the site for links.
