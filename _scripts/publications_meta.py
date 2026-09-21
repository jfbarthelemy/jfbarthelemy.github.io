"""Static description of the publication sections.

Single source of truth for how the thirteen `.bib` files of `_biblio/` map onto
the site: which filter family each belongs to, how its entries are labelled, and
in which order the sections were historically enumerated (the HCERES/CNU
numbering the file names carry).

Nothing here is derived from the bibliography; the bibliography stays the source
of truth for the references themselves.
"""

# (key, bib file, filter family, entry badge, long section name)
GROUPS = [
    ("acl", "1_acl.bib", "journal", "Peer-reviewed article",
     "Articles in peer-reviewed journals listed in databases"),
    ("acln", "2_acln.bib", "journal", "Peer-reviewed article",
     "Articles in peer-reviewed journals not listed in databases"),
    ("ascl", "3_ascl.bib", "journal", "Journal article",
     "Articles in non-peer-reviewed journals"),
    ("os", "5_os.bib", "chapter", "Book chapter",
     "Scientific books or chapters"),
    ("inv", "6_inv.bib", "conference", "Invited lecture",
     "Invited lectures at international or national conferences"),
    ("acti", "7_acti.bib", "conference", "International conference paper",
     "Communications with proceedings at an international conference"),
    ("actn", "8_actn.bib", "conference", "National conference paper",
     "Communications with proceedings at a national conference"),
    ("com", "9_com.bib", "talk", "Oral communication",
     "Oral communications without proceedings at an international or national conference"),
    ("aff", "10_aff.bib", "talk", "Poster",
     "Poster communications at an international or national conference"),
    ("rapp", "11_rapp.bib", "report", "Research report",
     "Research reports"),
    ("rappex", "12_rappex.bib", "report", "Expert report",
     "Expert reports"),
    ("brev", "14_brev.bib", "report", "Patent",
     "Patents"),
    ("log", "15_log.bib", "software", "Software",
     "Software and numerical libraries"),
]

# (family key, chip label) — filter chips, in display order.
FAMILIES = [
    ("journal", "Journal articles"),
    ("chapter", "Book chapters"),
    ("conference", "Conference papers"),
    ("talk", "Talks & posters"),
    ("report", "Reports & patents"),
    ("software", "Software"),
]

FAMILY_ORDER = {key: i for i, (key, _) in enumerate(FAMILIES)}

# A few CSL types deserve a more precise badge than their section's default:
# `11_rapp.bib` holds the PhD thesis alongside three research reports, and
# `14_brev.bib` is a patent filed under the "reports" family.
BADGE_BY_CSL_TYPE = {
    "thesis": "PhD thesis",
    "patent": "Patent",
}
