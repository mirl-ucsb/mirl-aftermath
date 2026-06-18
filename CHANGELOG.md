# Changelog

MIRL Aftermath keeps its history the way a survey keeps its record: nothing
erased, each change dated. Versions follow [semantic versioning](https://semver.org);
dossier files from any earlier version load cleanly in any later one.

## 1.0.1 (2026-06-17)

- The repository is archived on [Zenodo](https://zenodo.org) from this release
  onward: each release mints a DOI, and a concept DOI resolves to the latest
  version, so the tool can be cited the way it asks others to cite their
  dossiers.

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
