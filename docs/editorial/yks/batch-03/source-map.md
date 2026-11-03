# YKS batch 03 source map

Prepared on 2026-11-03. This batch covers preference, placement, programme conditions and enrolment.
It adds twelve distinct drafts to the eleven existing YKS articles/drafts. It does not change them.

## Source identity and official comparison

- Supplied file: `C:/Users/emreerkesikbas/Downloads/2026-yuksekogretim-programlari-ve-kontenjanlari-kilavuzu-90wzzd-04155310.pdf.pdf`.
- Title: *2026 Yükseköğretim Kurumları Sınavı (YKS), Yükseköğretim Programları ve Kontenjanları Kılavuzu*.
- Supplied size: 9,182,144 bytes; 775 PDF pages.
- Supplied SHA-256: `d82008bcd06b292d68a75324e11a181cd69d8875ef2e28b79f20bb4e3eb55c48`.
- [Official guide landing page](https://www.osym.gov.tr/2026-yuksekogretim-kurumlari-sinavi-yks-yuksekogretim-programlari-ve-kontenjanlari-kilavuzu)
  linked to the [official PDF](https://dokuman.osym.gov.tr/web/2026/8/2026-yuksekogretim-programlari-ve-kontenjanlari-kilavuzu-90wzzd-04155310.pdf).
- The official PDF was retrieved for comparison on 2026-11-03: 10,185,420 bytes; 775 pages;
  SHA-256 `7fc4d65a33328782bdd6737df0c777492ceb4353e1d3de15980d826b39b7309b`.
- Binary files differ. Text extracted with pypdf from all 775 corresponding pages matches after
  whitespace removal, with zero differing page positions. This establishes extracted-text agreement,
  not identical binary structure, graphics or an assurance that separate later announcements do not exist.
- Web searches for amendments were limited to official ÖSYM material for factual reliance. An older
  2025 law-ranking amendment was excluded from 2026 claims. The supplied/current-linked 2026 PDF says
  100,000 for law; the article labels it explicitly as the 2026 guide's value.

Page positions below are **one-based PDF pages**. Through printed page 671, printed page numbers are
two less than PDF positions. Later unnumbered appendices are referenced by PDF position and heading.

## Reading coverage

The full PDF text was extracted and its section boundaries mapped. Substantive reading focused on the
complete general-rule pages (PDF 3–21), the two-part conditions framework and relevant numbered clauses
(PDF 544–568), Table 6B.2 and its field/branch structure (PDF 617–621), the MEB notice (PDF 674), and the
introductory fee notes (PDF 707 and 756). Programme-table headers and appendix headings were surveyed
to establish scope. Individual programme rows were not all independently certified as a current dataset.

PDF 18 (Table 1B and Table 3 column explanations), PDF 19 (Table 4 explanations), and PDF 617
(Table 6B.2 field/branch merges) were rendered for layout checks. Table 1B values, its exception text,
and the two MTOK examples were checked visually against extracted text. Poppler warned about missing
Symbol/ArialUnicode fonts; the table numerals and inspected row/column relationships remained legible.

| PDF range | Section | Editorial use |
| --- | --- | --- |
| 1–2 | Cover, period information, contents | Identify year/version and section structure; omit old operational dates |
| 3–21 | General rules, preferences, special quotas, placement, enrolment, special ability, Tables 1A–1B and table explanations | Main procedural source |
| 22–141 | Table 3, associate programmes | Explain table structure; no new quota catalogue or invented programme codes |
| 142–543 | Table 4, undergraduate programmes | Explain structure, MEB and other quota columns; no placement predictions |
| 544–568 | Conditions, parts 1 and 2 | Preserve machine-checkable versus institution-applied distinction and relevant exceptions |
| 569–601 | Table 5 and conditions | Locate special-ability programmes; do not reproduce a complete admissions specification |
| 602–616 | Tables 6A and 6B.1 | Distinguish additional-score tables from MTOK; existing vocational article remains the hub |
| 617–621 | Table 6B.2 | MTOK priority and field/branch examples |
| 622–658 | Tables 6C and 6D | Associate additional-score scope; avoid duplicate article |
| 659–673 | School and field/branch codes | Explain using precise education records, not guessed school-to-programme matches |
| 674–706 | MEB/YÖK and other institutional notices, accreditation and service-specific admissions | Use complete MEB notice; defer the other specialised application guides |
| 707–771 | Foundation-university and KKTC fee tables | Use introductory scope/expense notes; no stale university price list |
| 772–775 | University websites and petition example | Reference navigation context; no generated individual application/petition |

## Claim map

| ID | Article slug | Source locations | Supported claims and retained boundaries |
| --- | --- | --- | --- |
| B3-TERCIH | `yks-tercih-listesi-nasil-hazirlanir` | §§1.1–1.4 PDF 3; §2.1 PDF 5–6; §3.2 PDF 9 | Electronic AİS submission, up to 24 choices, optional unused slots, highest eligible preference, submission confirmation, in-window changes/cancellation; exact tie hierarchy: placement score, relevant exam score, preference position, OBP, younger age |
| B3-TABLO | `yks-tercih-kilavuzu-tablo-okuma` | PDF 18–21; conditions introductions PDF 544 and 548 | Exact column positions, 2025 historical figures in a 2026 guide, dash/blank/star explanations, code-change caveat, MEB column meaning, two-part conditions |
| B3-SIRA | `yks-basari-sirasi-sarti-olan-bolumler` | Tables 1A–1B PDF 17–18; clauses 143, 144, 147, 148, 150, 155, 162 PDF 545; §5 PDF 15 | Year-specific thresholds, all Table 1B engineering exceptions, food-engineering inclusion, foundation-institution tighter thresholds, extra-score-free ranking notes, separate special-ability teaching rule |
| B3-BIRINCI | `yks-okul-birincisi-kontenjani` | §2.2 PDF 6; column explanations PDF 18–19; conditions PDF 544–545 | 2025–2026 school firsts, general-first assessment, no guarantee or exemption from programme conditions, unused first-of-school quota transfer |
| B3-KADIN | `yks-34-yas-ustu-kadin-kontenjani` | §2.2 PDF 6–7; PDF 18–19 | Exact 2026 age/reference-date criterion, prior-degree scope, complete excluded-programme list, current preference-screen declaration even if previously indicated, ÖSYM/YÖKSİS data timing, quota priority and non-transfer |
| B3-BURS | `yks-burslu-indirimli-program-farklari` | PDF 19–21; clause 21 PDF 550; fee section introductions PDF 707 and 756 | Tuition coverage and duration, compulsory/optional preparation distinction, attendance condition, institution-specific benefits and former-student rules, separate KKTC/dual-programme costs |
| B3-HAZIRLIK | `universite-zorunlu-hazirlik-ogretim-dili` | Clauses 21–24 and 34 PDF 550; clause 184 PDF 553; framework PDF 548 | Language versus percentage versus preparation, conditional exemption, preparation outside stated duration, two-year failure rule only as the relevant clause, conditional further routes, different campuses |
| B3-MTOK | `mtok-nedir-kimler-tercih-edebilir` | §3.1 PDF 9; clause 156 PDF 545; Table 6B.2 PDF 617–621 | Field/branch priority, other graduates considered if quota remains and preference submitted, exact two examples on PDF 617, no equation of priority with additional OBP or exam-free access |
| B3-KAYIT | `universite-kayit-e-kayit-gerekli-belgeler` | §4 PDF 11; §§4.1–4.2 PDF 12; electronic enrolment provisions and §4.3 PDF 13; clause 320 PDF 546 | Optional e-enrolment and exclusions, MEB verification, conditional documents/photos, same-level regular-enrolment restriction, temporary-enrolment scope, separate course registration; no deadline invented |
| B3-YETENEK | `ozel-yetenek-sinavi-ozyes-basvuru-farki` | §5 PDF 15–17; Table 5 location PDF 2 | University route versus ÖSYM sports route, calculated TYT and institutional minimums, 800,000 extra-score-free Y-TYT teaching requirement, disability-provision scope, no imported ÖZYES formula/parkour |
| B3-SEHITGAZI | `yks-sehit-gazi-yakini-kontenjani` | §2.2 PDF 6–8; columns PDF 18–19 | Exact relative groups, limited bursary quotas, general priority, SGK electronic records/correction workflow, single-use clause and its stated effective date, no personal legal classification |
| B3-MEB | `meb-ogretmenlik-bursu-tercih-sartlari` | Table 4 explanation PDF 19; clause 151 PDF 552; complete MEB notice PDF 674; §2.1 PDF 5 | First-five choice AND placement, definite registration, age/nationality and other conditions, programme bursary quota, full exclusion groups, separate e-Devlet bursary/loan application; no invented monthly amount |

## Editorial decisions

- Titles remain yearless for the agreed content structure; every body explicitly scopes rules to
  2026. Historical ranking columns are labelled 2025. No 2027 regulations are inferred.
- Operational application, preference, correction, enrolment and temporary-enrolment deadlines are
  omitted from prose. Eligibility/effective-date thresholds are labelled as dated source criteria
  in small tables where needed. Any operational date must come from a verified data card at publication.
- Examples are labelled: preference letters, the hypothetical 80,000 rank, and the hypothetical
  400,000 TL fee are explanatory, not programme data or predictions. MTOK examples are actual 2026
  table pairings and preserve their field/branch limits.
- The fee example is 400,000 × 0.50 = 200,000 and 400,000 × 0.75 = 300,000 remaining tuition. It does
  not model additional charges, future fees or combined institutional discounts.
- Do not promote search-interest estimates, expert credentials, admission guarantees, bursary amounts,
  personal legal/medical eligibility or an independent human fact-check that did not occur.
- Initial draft metadata used null author, verifier and publication timestamps. Draft schema validation
  used transient test-only verifier values in memory without database operations. On 2026-11-03 the
  articles were published locally with organisation author, explicitly automated source verification
  and real timestamps; see `publication-local.json` and `publication-verification-local.json`.
- Related articles are editorial plans. Add environment-appropriate full URLs only after the target
  pages exist; no dead links to unpublished drafts were added to bodies.
- The initial text delivery changed no application code, database, media storage or live site.
  Twelve licensed Pexels covers were subsequently added on 2026-11-03 in the existing development
  media bucket, with local assets, cover metadata and body credits. See `media-sources.json` and
  `images/README.md`. The image-preparation step kept drafts unpublished; a later local publication
  populated the real trust/publication fields and cover references. First-batch photos were not reused.

## Remaining source opportunities

The guide also contains material for a later, separately verified package: MEB/YÖK bursary distinctions,
international joint degrees, recognition/equivalence, work-based education, accreditation and programme
location. Recognition, institutional military/service admissions and disability-specific talent
eligibility need their current official companion regulations or application notices before detailed
guidance. A comprehensive additional-placement article requires the separate additional-placement
guide; a complete ÖZYES guide requires the separate ÖZYES document. Do not fill those gaps from memory.
