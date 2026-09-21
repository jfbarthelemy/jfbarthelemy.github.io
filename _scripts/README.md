# `_scripts/` — generated content

Two sections of the site are **generated**, each from a single source of truth. You never edit
the generated files by hand.

| Generator | Source of truth | Needs |
|---|---|---|
| `build_publications.py` | `_biblio/*.bib` (+ `postprints_data.py` for the postprint links) | standard library + the pandoc bundled with Quarto |
| `build_postprints.py` | `postprints_data.py` | PyMuPDF (`fitz`) for the thumbnails |

`make data` runs both, in the right order (the timeline reads `postprints_data.py`).

## Publications (`build_publications.py`)

Each of the thirteen `.bib` files is converted by `quarto pandoc -f biblatex -t csljson`, which
resolves LaTeX escapes to Unicode and normalizes dates. Every field written out comes verbatim
from that conversion — the only derived values are the author initials and the badges declared
in `publications_meta.py`. An entry is classified by **the file it comes from**, not by its CSL
type: `8_actn.bib` holds one `@article` among eight `@inproceedings`, and `11_rapp.bib` mixes
three reports with the PhD thesis.

The script refuses to write anything if the bibliography is inconsistent — an entry without a
year, a title or an author, or a file whose `@record` count does not match what pandoc converted.

Generated (do **not** edit by hand):

- `_includes/_publications_timeline.qmd` — the whole timeline, grouped by year.
- `_includes/_publications_stats.qmd` — the four figures on the home page.
- `_includes/_publications_recent.qmd` — the five most recent journal articles, for the home page.
- `files/publications.bib` — the thirteen files aggregated, for the "Download BibTeX" button.

The filter chips, the search box and the live count are added by
`_config/publications-filters.html`, included after the body of `publications.qmd` only. It is
progressive enhancement: with JavaScript off, the complete list is still rendered and readable.
**The family keys and labels in that script must match `FAMILIES` in `publications_meta.py`.**

## Postprints (`build_postprints.py`)

| File | Role |
|---|---|
| `postprints_data.py` | **Single source of truth** — one entry per postprint (`dir, slug, key, title, authors, journal, year, doi`). |
| `build_postprints.py` | Deploys the rendered bundles + thumbnails, then regenerates the card includes. |

Generated (do **not** edit by hand):

- `postprints/<slug>/` — the deployed postprint (`index.html`, `<slug>.pdf`, `thumb.png`,
  `figures/`, `<slug>_files/`, `cc-by-nc-nd.png`). Only the **rendered** outputs are copied —
  never the sources.
- `_includes/_postprints_cards.qmd` — card grid, included by `postprints.qmd`.
- `_includes/_postprints_featured.qmd` — "Open-access postprints" block, included by `publications.qmd`.

`make postprints-derived` regenerates just the two includes, without recopying the 34 MB of bundles.

## Add or update a postprint (the whole workflow)

1. (Re)render the article's Quarto project so that `~/articles/<dir>/Webpublish/web/` is current.
2. Add or edit **one entry** in [`postprints_data.py`](postprints_data.py).
   The bib `key` must match the entry in `_biblio/1_acl.bib` — that is how the "Postprint" and
   "PDF" links get attached to the right reference on the Publications timeline.
3. `make data` (deploys the postprint, then rebuilds the timeline so the new links appear).
4. `quarto preview` to check, then commit and push (a push to `main` deploys to GitHub Pages).

## Add a publication

Add the entry to the right `_biblio/<n>_<key>.bib`, then `make publications`. Nothing else: the
year section, the badge, the filter counts and the aggregated BibTeX all follow.

## Regenerate the derived images

```bash
magick _assets/originals/id_jfb_cartoon.png -resize 420x420 -strip -colors 192 images/portrait.png
magick _assets/originals/id_jfb_cartoon.png -resize 180x180 -strip -colors 128 images/apple-touch-icon.png
magick _assets/originals/id_jfb_cartoon.png -resize 256x256\! -background transparent \
       -define icon:auto-resize=64,48,32,24,16 images/favicon.ico
magick _assets/originals/LogoCerema_horizontal.jpg -resize x160 -strip images/logo-cerema.jpg
magick "_assets/originals/UMR MCD-couleur-300dpi.png" -resize x160 -strip images/logo-umr-mcd.png
```

## Notes

- URLs are `https://jfbarthelemy.github.io/postprints/<slug>/`. If you change a slug, the QR codes
  in the companion talk (`~/articles/Postprints_ClaudeCode/_data/qrcodes.py`) must be regenerated too.
- `postprints/` and `files/` are declared under `project: resources:` in `_quarto.yml` so Quarto
  copies them verbatim (it does not crawl the bundles' internal assets otherwise).
