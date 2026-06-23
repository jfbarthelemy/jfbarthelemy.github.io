# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal academic website for Jean-François Barthélémy (Cerema / UMR MCD), built with **Quarto**. Deployed automatically to GitHub Pages via GitHub Actions on every push to `main`.

## Commands

```bash
quarto preview    # local dev server with hot-reload
quarto render     # full build → _site/
```

No package.json, Makefile, or Python requirements — pure Quarto project.

## Architecture

### Content files
- `index.qmd` — home page (Quarto "trestles" about template with social links)
- `publications.qmd` — publications listing using the multibib filter
- `about.qmd` — short about page
- `files/` — static assets (PDF CV, etc.)
- `images/` — photos and logos

### Configuration
- `_quarto.yml` — main config: site metadata, navbar, bibliography keys, theme, filters
- `_config/customjfb.scss` / `customjfb-dark.scss` — custom SCSS (light/dark themes blending Julia + Cerema color palettes)

### Bibliography system
`_biblio/` holds 13 `.bib` files organized by publication type (ACL, ACLN, OS, conferences, reports, patents, software, …). The **multibib** Quarto filter maps each file to a named key in `_quarto.yml` and renders them in separate sections in `publications.qmd` via `{#refs-<key>}` divs and per-section `nocite` YAML.

### Deployment
`.github/workflows/publish.yml` — builds with Quarto and pushes to the `gh-pages` branch. Also mirrors to `origin` (private git server at git.bart.casa).

## Key conventions

- Icons use `{{< iconify … >}}` (Iconify) and `{{< ai … >}}` (Academicons) shortcodes.
- `execute: freeze: auto` in `_quarto.yml` — only changed sources are re-rendered.
- `citeproc: false` + remote CSL from Zotero — let multibib handle citation rendering.
- `validate-yaml: false` is intentional (multibib adds non-standard YAML keys).
