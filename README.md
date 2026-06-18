# MIRL Aftermath

**A condition dossier for damaged heritage.**

MIRL Aftermath is a free, local-first tool that turns a folder of loose
before-and-after photographs into a standardized condition dossier: the kind
of document a court, a tribunal, or a UNESCO or ALIPH submission can rest on,
rather than a folder of images and a memory of what changed. One dossier
documents one **site**: what it is, the **events** that harmed it, and a series
of dated **assessments**, each a condition report on one part of the site with
a **before and after photograph**, optionally registered so the two sit at the
same viewpoint and the damage reads plainly.

It was built for the people who do this work at the single-scholar and
single-mission scale, the scale the large damage-assessment programs do not
reach: heritage professionals, conservators, field surveyors, community
documentarians, human-rights researchers, and students. **You do not need to
know how to code to use it.**

The tool opens with a small sample already loaded, the dossier of an entirely
fictional damaged shrine, so you can see how everything works before you add
anything of your own. The easiest way to use it is the live copy at
[mirl-ucsb.github.io/mirl-aftermath](https://mirl-ucsb.github.io/mirl-aftermath/):
open it and begin. It is a static page that receives nothing; your dossier
stays in your browser and in the files you save. If you would rather run your
own copy, this repository is a template (see [Making it your own](#making-it-your-own)).

It is a sibling to [MIRL Rephoto](https://github.com/mirl-ucsb/mirl-rephoto),
which aligns a then-and-now pair and measures from it, and to
[MIRL Lacuna](https://github.com/mirl-ucsb/mirl-lacuna), which catalogues works
that no longer exist. Where Lacuna records what is gone, Aftermath documents
damage to what still stands.

---

## What you might use it for

- A **post-strike condition survey**: a church, mosque, shrine, library, or
  museum wing recorded room by room and element by element after shelling, an
  airstrike, or a fire.
- **Disaster documentation**: the state of a monument after an earthquake or a
  flood, with the recommendation for each part written beside its photograph.
- A **legal or accountability record**: damage tied to a dated event, each
  source photograph carrying its provenance and a sha-256 fingerprint of the
  original file, so the figure stays tethered to the evidence it came from.
- A **funding or intervention case**: the standardized dossier a conservation
  proposal or an emergency grant needs, severity graded and figures numbered.
- **Teaching** condition assessment and the ethics of documenting loss, with a
  worked example to start from.

---

## The three sheets

The dossier is a small set of survey sheets, numbered like folios and headed
by a title block (SITE / REFERENCE / ASSESSOR / DATE), in the manner of a
drawing set.

**S-01 Site.** The cover of the dossier: what the site is and where, its
designation and identifier, the dossier's own metadata (reference, assessor,
organization, contact), and the **events** that harmed it, each a dated cause
(shelling or airstrike, fire, earthquake, flood, deliberate demolition,
looting, neglect) with its source. The title block above fills in as you type.

**S-02 Schedule.** A ruled register of every assessment: number, area, date,
assessor, damage type, and a stamped severity grade. Click any line to open
it; begin a new assessment from here or from anywhere.

**S-03 Assessment.** One condition report, rendered above its working form. The
report carries the assessment number, a severity stamp, the damage type, the
before-and-after figure, the condition summary, the recommendation, and the two
source photographs with their fingerprints. Below it sits **the assessor's
desk**, the working form, and everything you set there appears in the report
above as you type it, so what you will print is always in view.

---

## What an assessment records

- **The element assessed**: the part of the site this report is about (a north
  aisle, an apse mosaic, a foundation inscription), with the date of assessment
  and the assessor.
- **A damage typology**, from a controlled vocabulary in the manner of ICOMOS
  and ICCROM post-event condition surveys: structural collapse, structural
  damage, ballistic or blast, fire or smoke, water or moisture, looting or
  theft, vandalism or defacement, material loss or detachment, cracking or
  deformation, biological or vegetation, weathering or surface.
- **A severity grade**, escalating in the manner of a satellite or field damage
  assessment: none, minor, moderate, severe, destroyed. It is stamped like a
  checking-pencil mark, blue at the clean end and a filled oxide-red block at
  the worst.
- **The cause**: which recorded event harmed this element.
- **Findings**: the condition and damage in your own words, and the
  recommendation (emergency stabilization, salvage, documentation, monitoring).
- **A before and an after photograph**, each with its own date, provenance, and
  consent state.

---

## The before-and-after figure

The figure is the heart of an assessment. At its simplest it is the two
photographs side by side, labelled, captioned, and numbered like a plate in a
book. That alone tells the story, and it is what prints if you do nothing more.

When the before and after were taken from different viewpoints, you can
**register** them so the change reads cleanly. Click a feature on the before
image, then the same feature on the after, four or more times (corners of
windows, doorframes, and string courses work well). Aftermath fits a
projective transform (a homography) and shows a running pixel-fit error, so you
know how good the registration is. Then the **compare** view lays the change
bare:

- **Curtain** drags a divider across the registered pair.
- **Onion skin** fades the before over the after.
- **Blink** flips between them, which makes the change jump.

The same registration, drawn flat, prints a **registered overlay** into the
dossier, beneath the pair: the after photograph with the before warped onto its
frame and split down the middle, so a reader sees both states in one image, at
one viewpoint. The mathematics is the same projective transform MIRL Rephoto
uses, vendored here as pure JavaScript with no dependency.

---

## Photographs, provenance, and consent

Documenting damage means handling photographs that are not always yours to
publish, of places that are not always safe to locate. The ethics are defaults
here, not options to remember.

- Every source photograph carries its **provenance** (who made it, when, and
  how it came to you) and a **sha-256 fingerprint** computed in your browser
  from the original file, so the figure stays tethered to the exact image it
  came from. The file itself never leaves your machine; the dossier keeps a
  downsized copy for the figure and the hash of the original.
- Every photograph has a **consent state**, public or restricted.
  **Restricted photographs never enter an export.** Not the printed dossier,
  not the public data, not the self-contained HTML. Their image data, and even
  their hash, stay only in your working file. A community photograph held back
  shows in the dossier as withheld, and the sources appendix says how many are
  held, which is itself a statement.
- The site's **coordinates** are withheld from every export unless you mark
  them safe to publish. Coordinates can guide looters and targeting; nothing is
  located until you say so.
- **Arabic and other right-to-left text** is handled throughout. Each string
  sets its own direction, and Arabic is set in Noto Naskh Arabic, vendored
  alongside the Latin faces.

The one file that keeps everything is the **working dossier** you save for
yourself. Exports are publications, and the consent model governs all of them.

---

## The printed dossier, and other exports

Your dossier is **one JSON file**, edited in the browser and autosaved locally
as you work. From the **Dossier** menu you can save it to disk and open it again
anywhere; nothing is uploaded, ever.

From the **Export** menu:

- **Print the dossier (PDF)**: the court- and UNESCO-ready artifact, through the
  browser's print dialog (choose *Save as PDF*). A cover sheet (site,
  designation, dossier metadata, the events), a site summary with the reckoning
  by severity, then the numbered figures, each a before-and-after pair with its
  caption, summary, and recommendation, and finally a **sources appendix**
  listing every photograph with its sha-256, date, provenance, and consent.
- **Dossier as one HTML file**: the same document as a single self-contained
  page, with the fonts embedded, ready for a website, an email attachment, or a
  USB stick.
- **Public data (.json)**: the machine-readable dossier with consent applied.
- **Print this sheet**, for a paper copy of whatever is on screen.

Every export but the working save is built from a **public clone** of the data,
so restricted photographs and unsafe coordinates are withheld by construction,
not by remembering to.

---

## Running it

MIRL Aftermath is a plain web page with no build step and nothing to install.

- The simplest way: **double-click `index.html`** to open it in your browser.
- If your browser is cautious about local files, or you want to share it on the
  web, serve the folder instead. From the Aftermath folder:

  ```bash
  python3 -m http.server 8000
  ```

  then visit `http://localhost:8000`. It also runs as-is on **GitHub Pages**;
  to put your own copy there, see the next section.

---

## Making it your own

For most people the [hosted copy](https://mirl-ucsb.github.io/mirl-aftermath/)
is all they need, and it is the simplest place to start. Because Aftermath is a
static page with no server behind it, using the hosted copy is exactly as
private as running your own: it receives nothing, and your dossier stays on
your machine.

1. **Just open it.** Use the hosted copy, or download this repository and
   double-click `index.html`. Your dossier lives in your browser and in the
   files you save. Nothing is sent anywhere, on either path.
2. **Your own copy of the tool.** Use the template to put Aftermath under your
   account, then turn it on at **Settings → Pages → Deploy from branch →
   main / root**. Your copy runs at `your-name.github.io/your-repo/` with no
   edits; the paths are already relative.
3. **Publish a dossier.** When a dossier is ready to be seen, use **Export →
   Print the dossier** for the PDF, or **Export → Dossier as one HTML file** for
   a self-contained page, and put that wherever you like. Only what consent
   allows travels.

**Where your data lives, and where it must not.** The dossier you build lives in
your browser and in the files you save. It does **not** become part of your
GitHub copy, and it should not. A working dossier can hold restricted
photographs, the identities behind a provenance line, and coordinates unsafe to
publish; committing it to a repository, even a private one, copies all of that
onto servers you do not control, which is exactly what the consent model exists
to prevent. Keep the working file local, and let only the consent-filtered
exports go out.

If you publish your copy under your own name, edit
[`CITATION.cff`](CITATION.cff) to credit yourself.

---

## The sample dossier

The bundled sample records the damage to the **Shrine of the Two Springs** at
the fictional town of Tell Sumra: a small domed shrine struck during an
invented February exchange. The town, the shrine, its assessor, and every harm
recorded are invented, and the sample says so on its own cover; any resemblance
to a real place or event is coincidental. The six photographs (a before and an
after for each of three assessments) are rendered from scratch with Pillow, with
procedural stone texture, directional light, and synthetic blast damage, so they
read like field photographs without using any real imagery; their sha-256 hashes
are true hashes of the shipped files. One assessment
ships already registered; one before photograph is marked restricted; the site's
coordinates are left unsafe to publish, so the consent defaults are visible from
the first export.

To regenerate the sample, run `python3 samples/make-samples.py` (needs
[Pillow](https://python-pillow.org)).

---

## Technical reference

- **One JSON document per dossier**: `{ format: "mirl-aftermath", version: 1,
  project: {...} }`. The project carries the `site` (name, place, lat/lon and a
  `safe` flag, designation, identifier, description), the `dossier` cover
  metadata, a list of `events` (`{ id, date, type, source, note }`), and a list
  of `assessments`. Each assessment carries an `id` (A-001, A-002, ...), the
  area, date, and assessor, a `category` and `severity` from the controlled
  vocabularies, an `eventId`, the summary and recommendation, a `before` and an
  `after` photograph, and an `align` record. A photograph is `{ id, name,
  dataUrl, natW, natH, sha256, date, provenance, consent }`: the `dataUrl` is a
  downsized JPEG embedded so the dossier is self-contained and prints, while the
  `sha256` is computed from the original file. The `align` record is
  `{ beforePts, afterPts, H, rms }`: the matched control-point pairs and the
  fitted homography mapping before-pixels onto the after's frame.
- **Hashing** uses WebCrypto's SHA-256 with a small pure-JS fallback. Embedded
  copies are made on a canvas at up to 1600 px and stored as compact JPEG data
  URLs inside the dossier file.
- **The homography** is fitted by a normalized Direct Linear Transform with
  Gaussian elimination, in vendored pure JavaScript adapted from MIRL Rephoto
  (`js/homography.js`). The live compare warps the before image with a CSS
  `matrix3d`; the printed overlay is composed on a canvas by a triangle-mesh
  warp, so it needs no live transform.
- **Autosave** uses `localStorage`, debounced; the dossier file on disk is the
  durable copy. Hand-edited or older files are normalized on load.
- **Exports** are filtered through a public clone of the data: restricted
  photographs are reduced to a withheld stub (no image data, no hash);
  coordinates are removed unless the site is marked safe to publish. The
  self-contained HTML dossier inlines the stylesheet and embeds the fonts as
  data URLs, so the single file stands alone.
- **Right-to-left scripts** are handled with `dir="auto"` on inputs and
  per-string direction detection in the rendered sheets; Arabic is set in Noto
  Naskh Arabic, vendored alongside Spectral and IBM Plex Mono in `fonts/`.
- **No data leaves your machine.** Everything runs in the browser. The tool
  makes no network requests of its own.

### Layout

```
mirl-aftermath/
├── index.html          # the page
├── css/style.css       # the survey-report design system
├── js/
│   ├── homography.js   # the projective transform (vendored, pure JS)
│   ├── model.js        # vocabularies, state, autosave, sha-256
│   ├── figure.js       # the before/after figure: control points + compare
│   ├── sheets.js       # the site, schedule, and assessment sheets
│   ├── exporters.js    # the printed dossier, HTML dossier, public JSON
│   └── app.js          # routes, menus, dossier open and save, wiring
├── fonts/              # Spectral, IBM Plex Mono, Noto Naskh Arabic (woff2)
└── samples/            # the fictional shrine dossier + its generator
```

---

## Citing this tool

This repository carries a [`CITATION.cff`](CITATION.cff) file, so GitHub's
**Cite this repository** button (in the sidebar of the repo page) will give you
a reference in APA or BibTeX form. Each release is archived on
[Zenodo](https://zenodo.org) with a DOI; once minted, the DOI is recorded here
and in the [`CHANGELOG`](CHANGELOG.md). In a note, cite it as:

> Jeff O'Brien, *MIRL Aftermath: a condition dossier for damaged heritage*,
> version 1.0.1, Material / Image Research Lab, UC Santa Barbara, 2026.

---

Built at the [Material / Image Research Lab](https://mirl.arthistory.ucsb.edu),
Department of History of Art & Architecture, UC Santa Barbara. Released under
the MIT License. Spectral, IBM Plex Mono, and Noto Naskh Arabic are under the
SIL Open Font License.
