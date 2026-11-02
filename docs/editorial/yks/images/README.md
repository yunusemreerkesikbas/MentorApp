# YKS cover photographs

Seven internet-sourced representative photographs for the YKS article package. These images
are editorial illustrations, not ÖSYM screenshots, exam documentation, student testimonials
or an endorsement by the depicted people or photographers.

| Article | Photographer | Provider | Source |
| --- | --- | --- | --- |
| Session selection | Tima Miroshnichenko | Pexels | [6550408](https://www.pexels.com/photo/notebook-and-books-on-wooden-desk-6550408/) |
| Application steps | Brett Wharton | Unsplash | [c_TURbyrRic](https://unsplash.com/photos/a-pair-of-hands-typing-on-a-laptop-keyboard-c_TURbyrRic) |
| Application form | RDNE Stock project | Pexels | [7821682](https://www.pexels.com/photo/close-up-shot-of-a-person-filling-out-a-form-7821682/) |
| Exam day | Berna Elif | Pexels | [19064004](https://www.pexels.com/photo/empty-classroom-with-white-desks-19064004/) |
| Net calculation | PNW Production | Pexels | [8250947](https://www.pexels.com/photo/close-up-of-an-open-notebook-calculator-and-a-pen-8250947/) |
| OBP | Tima Miroshnichenko | Pexels | [6550119](https://www.pexels.com/photo/a-close-up-shot-of-a-person-writing-on-a-notebook-6550119/) |
| Accessible learning | Eren Li | Pexels | [7188604](https://www.pexels.com/photo/close-up-photo-of-person-using-braille-7188604/) |

The source pages marked the selected photographs free under the
[Pexels License](https://www.pexels.com/license/) or
[Unsplash License](https://unsplash.com/license/), checked on 2026-11-03. Both permit
the intended editorial use and modification. These are licensed photographs, not public-domain
claims. No purchased asset, account signup or attribution waiver was required. Voluntary
photographer/source/license credits are included in every article body.

Files were resized/cropped to 1200 × 630 and encoded as WebP at quality 80. The classroom photo
uses a lower crop to keep the desks visible. There are no generated faces, added exam details,
text overlays or altered documents. Original download URLs, hashes, dimensions, alternative
text and deployed object keys are recorded in [media-sources.json](../media-sources.json).
Optimized files total 271,788 bytes; each is below 50 KB. Original downloads remain temporary.

The local application is configured to use the existing R2 development bucket `mentor-public`.
Only seven new content-addressed keys under `content/articles/cover/yks/` were added there.
Article records were updated only in `localhost:5433/mentor`; neither Neon database nor the
separate production media buckets were changed. Existing publication times and official-source
verification metadata were preserved. The initial text-only publication receipt remains a
historical record; [media-publication-local.json](../media-publication-local.json) contains the
subsequent body hashes and media update receipt.

Validation: seven uploaded public objects returned HTTP 200 with matching SHA-256 hashes and
WebP content type. All seven API details returned the expected cover, dimensions and Turkish alt
text. All seven article pages returned HTTP 200 with cover URLs, source credits and Open Graph
image metadata; the blog index HTML contained all seven object keys. These were content/media
checks, not a workspace-wide application test run.
