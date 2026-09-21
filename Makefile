# Convenience targets for the website.
#
# build_publications.py needs nothing but the standard library and the pandoc
# bundled with Quarto. build_postprints.py additionally needs PyMuPDF (fitz) for
# the thumbnails — the fenicsx-env has it:
PYTHON  ?= $(HOME)/miniconda3/envs/fenicsx-env/bin/python
PYTHON3 ?= python3

.PHONY: data publications postprints postprints-derived preview render clean-postprints help

help:
	@echo "make data         - regenerate everything derived from the .bib files and from postprints_data.py"
	@echo "make publications - rebuild the timeline, stats, recent list and files/publications.bib"
	@echo "make postprints   - (re)deploy postprints + regenerate their cards"
	@echo "make preview      - quarto preview (local dev server)"
	@echo "make render       - quarto render (full build -> _site/)"

# Everything generated, in dependency order: the timeline reads postprints_data.py.
data: postprints publications

# Timeline, home-page statistics, recent list, aggregated BibTeX — from _biblio/*.bib
publications:
	$(PYTHON3) _scripts/build_publications.py

# Redeploy the postprint bundles from ~/articles and regenerate their cards
postprints:
	$(PYTHON) _scripts/build_postprints.py

# Regenerate only the card includes, without recopying the 34 MB of bundles
postprints-derived:
	$(PYTHON3) _scripts/build_postprints.py --derived-only

preview:
	quarto preview

render:
	quarto render

# Remove the generated postprint deployment (sources in ~/articles are untouched)
clean-postprints:
	rm -rf postprints/*/ _includes/_postprints_cards.qmd _includes/_postprints_featured.qmd
