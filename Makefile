# Convenience targets for the website.
#
# PYTHON must have PyMuPDF (fitz) for postprint thumbnails — the fenicsx-env works:
PYTHON ?= $(HOME)/miniconda3/envs/fenicsx-env/bin/python

.PHONY: postprints preview render clean-postprints help

help:
	@echo "make postprints  - (re)deploy postprints + regenerate cards/featured/link-map from _scripts/postprints_data.py"
	@echo "make preview     - quarto preview (local dev server)"
	@echo "make render      - quarto render (full build -> _site/)"

# Rebuild everything that derives from _scripts/postprints_data.py
postprints:
	$(PYTHON) _scripts/build_postprints.py

preview:
	quarto preview

render:
	quarto render

# Remove the generated postprint deployment (sources in ~/articles are untouched)
clean-postprints:
	rm -rf postprints/*/ _includes/_postprints_cards.qmd _includes/_postprints_featured.qmd \
	       _extensions/postprint-links/postprint_map.lua
