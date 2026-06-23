# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal academic website for Jean-François Barthélémy (Cerema / UMR MCD), built with **Quarto**. Deployed automatically to GitHub Pages via GitHub Actions on every push to `main`.

## Commands

```bash
quarto preview    # local dev server with hot-reload
quarto render     # full build → _site/
make postprints   # (re)build the Postprints section from its single source of truth
```

## Architecture

### Content files
- `index.qmd` — home page (Quarto "trestles" about template with social links)
- `publications.qmd` — publications listing using the multibib filter
- `postprints.qmd` — open-access postprints gallery (card grid, generated — see below)
- `about.qmd` — short about page
- `files/` — static assets (PDF CV, etc.)
- `images/` — photos and logos

### Configuration
- `_quarto.yml` — main config: site metadata, navbar, bibliography keys, theme, filters
- `_config/customjfb.scss` / `customjfb-dark.scss` — custom SCSS (light/dark themes blending Julia + Cerema color palettes)

### Bibliography system
`_biblio/` holds 13 `.bib` files organized by publication type (ACL, ACLN, OS, conferences, reports, patents, software, …). The **multibib** Quarto filter maps each file to a named key in `_quarto.yml` and renders them in separate sections in `publications.qmd` via `{#refs-<key>}` divs and per-section `nocite` YAML.

### Postprints section (generated)

Open-access author-accepted manuscripts live under `postprints/<slug>/` (rendered HTML + PDF + assets,
**no sources**), one folder per article, served at `/postprints/<slug>/`. Everything is generated from a
**single source of truth**, `_scripts/postprints_data.py`, by `_scripts/build_postprints.py` (`make postprints`):
- deploys each `~/articles/<dir>/Webpublish/web/` bundle into `postprints/<slug>/` (drops the `_config/`
  sources, keeps only the CC badge; renames the HTML to `index.html`; renders `thumb.png` from page 1);
- regenerates `_includes/_postprints_cards.qmd` (Postprints page), `_includes/_postprints_featured.qmd`
  (Publications "featured" block) and `_extensions/postprint-links/postprint_map.lua`.
- `postprints/` is declared in `project: resources:` so Quarto copies the standalone bundles verbatim.
- The Lua filter `_extensions/postprint-links/postprint-links.lua` (last in the `filters:` chain) injects
  inline "📄 Postprint" links into the matching bibliography entries, keyed by bib citekey.

To add/update a postprint: edit one entry in `_scripts/postprints_data.py`, run `make postprints`,
preview, commit. See `_scripts/README.md`. Do **not** hand-edit the generated files listed above.

### Deployment
`.github/workflows/publish.yml` — builds with Quarto and pushes to the `gh-pages` branch. Also mirrors to `origin` (private git server at git.bart.casa). **Note:** the deploy runs `quarto render` only; `make postprints` is a local authoring step, so commit the generated `postprints/` and `_includes/` files.

## Key conventions

- Icons use `{{< iconify … >}}` (Iconify) and `{{< ai … >}}` (Academicons) shortcodes.
- `execute: freeze: auto` in `_quarto.yml` — only changed sources are re-rendered.
- `citeproc: false` + remote CSL from Zotero — let multibib handle citation rendering.
- `validate-yaml: false` is intentional (multibib adds non-standard YAML keys).
