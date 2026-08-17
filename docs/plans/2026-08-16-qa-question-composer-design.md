# Q/A Question Composer Design

## Decision

Selecting `Soru` in the global feed composer opens a structured question form: a centered modal on
desktop and a near-full-height bottom sheet on mobile. The inline composer remains compact.

The form contains, in order:

1. QA community audience
2. Required title
3. Constrained rich-text content
4. Up to three optional curated tags
5. Existing image/file attachments
6. Submit action

Question type is intentionally not introduced. Curated tags cover discovery without creating a
second overlapping taxonomy. Free-form tag creation is out of scope for this iteration.

## Content format

Lexical owns the editing experience but exports Markdown on every change. The existing `body:
string` API and database column remain unchanged. The first toolbar supports bold, italic, bullet
and ordered lists, quote, link, inline code, undo, and redo. Raw HTML is not accepted or rendered.

Question reads use `react-markdown` with `remark-gfm`; the renderer does not enable raw HTML.
Existing mention rendering is retained for text nodes. Feed previews derive readable plain text from
Markdown rather than exposing formatting markers.

## State and responsive behavior

Question state is isolated from the normal post draft. Closing the dialog preserves the question
draft for the current page session. A successful submit clears it and refreshes the feed. Escape and
backdrop close the form when it is not submitting. The desktop panel is centered; below the small
breakpoint the same semantic dialog is anchored to the bottom and sized for the software keyboard.

## Validation and scope

The existing shared thread schema remains authoritative: title 5–200 characters, body 1–4000
characters, at most three active tag IDs, and existing attachment limits. No question-type field,
schema migration, new endpoint, or LaTeX support is added. Math formatting remains a follow-up.
