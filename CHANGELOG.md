# Changelog

MIRL Aftermath keeps its history the way a survey keeps its record: nothing
erased, each change dated. Versions follow [semantic versioning](https://semver.org);
dossier files from any earlier version load cleanly in any later one.

## 1.1.0 (2026-11-05)

Aftermath takes the lab's own identity. Nothing about how a dossier is kept,
registered, or released changes; dossier files from every earlier version open
as before.

- **The MIRL identity.** Familjen Grotesk for names and headings and Epilogue
  for everything you read and operate, the same faces as the Material /
  Image Research Lab's site, on the lab's paper white. Aftermath's key is the
  teal of the MIRL Risograph mark, shown as a soft bloom beside its name;
  red stays reserved for damage, and in every figure blue is before and red is
  after. Both typefaces are vendored in `fonts/` under the SIL Open Font
  License, with their licence texts.
- **Plain words.** Labels, buttons, and severity grades are set in sentence
  case; the sheet codes (S-01 to S-03) and the stamped capitals are gone. The
  sheets are simply Site, Schedule, and Assessment.
- **Severity you can read.** Each grade is a tinted tag that says its name,
  escalating from blue through grey and amber to red, with Destroyed in deep
  red under a heavier outline that survives printing without backgrounds.
  Every text colour meets WCAG AA (4.5 to 1 or better).
- **A clearer bar.** One sticky line carries the mark, the sheets, and the
  actions, with New assessment as the single filled button.
- **The exports follow.** The self-contained HTML dossier, the printed
  dossier, and the registration-evidence image are set in the new faces.
- **Phones.** The schedule scrolls within itself, the source lines stack, and
  the bar wraps into a row of sheets.

## 1.0.2 (2026-09-10)

- **The DESTROYED stamp is struck as a heavy outline**, not a filled block: the
  deep red and the weight stay, and the grade survives printers that drop
  background colour. The severity picker still fills a stamp when pressed.
- **A cause or a damage in your own words**: the event vocabulary grows
  (explosion, military use or occupation, storm, landslide, vandalism,
  unauthorized construction, structural failure), and choosing *other* on
  either the event type or the damage type opens a field for the assessor's
  own wording, which is what the report and every export then print.
- **A release preview before every public export**: what will and will not
  publish is listed for confirmation first, and *Print this sheet* runs through
  the same consent-applied path as the other exports.
- **A standalone registration-evidence image**: the control points and the
  pixel-fit error drawn over the pair, exportable on its own.
- Registration hardening: the printed overlay registers against the embedded
  before-image size, degenerate homographies are guarded, and the transient
  registered overlay stays out of saved and public files.
- Accessibility: dialog roles and focus management on the release preview,
  pressed and current states announced to assistive technology, and a visible
  keyboard focus ring.

## 1.0.1 (2026-06-17)

- The repository is archived on [Zenodo](https://zenodo.org) from this release
  onward: each release mints a DOI, and the concept DOI
  [10.5281/zenodo.20750368](https://doi.org/10.5281/zenodo.20750368) always
  resolves to the latest version, so the tool can be cited the way it asks
  others to cite their dossiers.

## 1.0.0 (2026-06-17)

First release: a local-first tool that turns loose before-and-after photographs
into a standardized condition dossier.

- **Three survey sheets**, numbered like folios and headed by a title block:
  **S-01 Site** (the site, the dossier metadata, and the events that harmed it),
  **S-02 Schedule** (a ruled register of every assessment), and **S-03
  Assessment** (a condition report rendered live above its working form).
- **Controlled vocabularies**: a damage typology in the manner of ICOMOS and
  ICCROM condition surveys, and an escalating severity grade (none, minor,
  moderate, severe, destroyed) stamped like a checking-pencil mark, the worst
  grade a filled stamp.
- **The before-and-after figure**: the pair side by side, or registered by
  placing four or more control points and fitting a homography, with a running
  pixel-fit error and a curtain / onion skin / blink compare view. The
  registration prints a flat registered overlay into the dossier.
- **Evidence on the contributors' terms**: every source photograph carries its
  provenance and a sha-256 fingerprint of the original file; a consent state
  keeps restricted photographs (their data and their hash) out of every export;
  the site's coordinates are withheld unless marked safe to publish.
- **Exports**: a printed dossier (cover, site summary, numbered figures, and a
  sources appendix) for PDF, a self-contained HTML dossier with the fonts
  embedded, and consent-applied public data, all built from a public clone of
  the data.
- **Arabic and right-to-left support** throughout, and an entirely fictional
  sample dossier, generated from scratch with true file hashes.
