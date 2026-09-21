# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal academic website for Jean-François Barthélémy (Cerema / UMR MCD), built with **Quarto**.
Deployed automatically to GitHub Pages (branch `gh-pages`) via GitHub Actions on every push to `main`.

**All prose is US English** — pages, SCSS comments, Python docstrings, commit messages. The two
exceptions are French course titles on the Teaching page (they are the real names of real courses)
and the cited publication titles in the generated bibliography: a reference is a quotation and is
never respelled.

## Commands

```bash
make data          # regenerate everything derived (postprints, then the publications timeline)
make publications  # rebuild the timeline, stats, recent list and files/publications.bib
make postprints    # (re)deploy the postprint bundles and their card includes
quarto preview     # local dev server with hot reload
quarto render      # full build -> _site/
```

## Content files

- `index.qmd` — home page. The `<h1>` is Quarto's own title block; the hero div holds only the
  intro, the action buttons, the identity links and the portrait.
- `publications.qmd` — a thin shell: the featured-postprints block, the filter mount point and the
  generated timeline.
- `postprints.qmd` — open-access manuscripts (generated card grid).
- `software.qmd` + `software/*.qmd` — three Quarto listings (core packages, backend packages,
  standalone) fed by the YAML front matter of the detail pages.
- `teaching.qmd`, `about.qmd`, `404.qmd`.
- `_assets/originals/` — master images, **not deployed** (Quarto ignores `_`-prefixed directories).

## Theme

`_config/` holds four SCSS files and one head partial:

- `_tokens.scss` — the shared scale (colors, fonts, radii, breakpoints, publication families).
  It sits in the **`scss:functions`** layer, not `scss:defaults`: Quarto merges `defaults` layers
  in *reverse* order, so a token file listed there lands after the theme that uses it. It is listed
  as its own layer in `_quarto.yml` rather than `@import`-ed, because Quarto's static check does not
  follow an `@import` and reports every token as "used before declaration".
- `theme-light.scss` / `theme-dark.scss` — the Bootstrap mapping plus one `:root` block of
  `--jfb-*` custom properties each.
- `_components.scss` — every shared rule, written against those custom properties. **Light and dark
  differ by their `:root` block alone; no rule is written twice.**
- `head.html` — Google Fonts preconnect and stylesheet (a CSS `@import` inside a Quarto rules layer
  lands after Bootstrap's rules and is silently ignored).

Palette: slate neutrals, cyan-teal accent (`#0e7c86` light / `#45c8d2` dark), violet secondary.
The four Julia logo colors are kept for the package logos only.

### Two Quarto traps this theme works around

- **A class on a markdown heading is merged onto the `<section>` Quarto wraps it in**, and inherited
  properties (`font-weight`, `font-size`) then leak onto everything inside. Never put a display class
  on a heading; style `.wrapper h2` instead. This is why `.pub-year` styles its `h2` through a
  descendant selector, and why the home page has no heading inside `.hero`.
- **A lone image with alt text becomes a figure with a visible caption.** Pass accessible text as
  `fig-alt="…"` and leave the markdown alt empty.

## Generated content

Two generators, both documented in [`_scripts/README.md`](_scripts/README.md):

- `_scripts/build_publications.py` — reads the thirteen `_biblio/*.bib` through
  `quarto pandoc -f biblatex -t csljson` and writes `_includes/_publications_{timeline,stats,recent}.qmd`
  plus `files/publications.bib`. Entries are classified by **source file**, not CSL type. It aborts
  on an inconsistent bibliography.
- `_scripts/build_postprints.py` — from `_scripts/postprints_data.py`; deploys `postprints/<slug>/`
  and writes `_includes/_postprints_{cards,featured}.qmd`. `--derived-only` skips the 34 MB copy.

Do **not** hand-edit anything under `_includes/` or `files/publications.bib`.

## Key conventions

- **No raw HTML in `.qmd` files.** Layout is expressed with Pandoc fenced divs (`::: {.class}`) and
  attribute spans, and styled from `_config/`. The only HTML lives in `_config/*.html`.
- Icons use `{{< iconify … >}}` (Iconify) and `{{< ai … >}}` (Academicons) shortcodes.
- The publications filter UI is progressive enhancement: with JavaScript off the full list renders.
  Its family keys must stay in sync with `FAMILIES` in `_scripts/publications_meta.py`.
- No citeproc, no `multibib`, no remote CSL — the timeline is generated, so nothing is fetched from
  the network at build time.
- `execute: freeze: auto` — there are no executable cells, so this is a no-op kept for safety.

## Deployment

`.github/workflows/publish.yml` builds with Quarto and pushes to `gh-pages`. The deploy runs
`quarto render` only: `make data` is a local authoring step, so the generated `postprints/`,
`_includes/` and `files/` must be committed.
