/**
 * Escaping helpers for the two places this app hands a string to the DOM as
 * markup rather than as text.
 *
 * Tender titles and descriptions are SCRAPED from 50+ external government
 * portals. Nothing in the pipeline strips markup from them, and Elasticsearch's
 * highlighter does not escape the text it wraps — it inserts `<mark>` into the
 * stored field value and returns the rest verbatim. So a title containing
 * `<img src=x onerror=...>` reaches `dangerouslySetInnerHTML` intact, from a
 * source outside this project's control.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes every character that can change the meaning of HTML text content. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]!);
}

/**
 * Renders an Elasticsearch highlight fragment as markup, allowing ONLY the
 * `<mark>` tags the search service asked for (`pre_tags`/`post_tags` in
 * `modules/tenders/service.ts`).
 *
 * Everything is escaped first and the two marker tags are restored afterwards,
 * so no attribute, no other tag and no unbalanced `<` can survive. Passing a
 * plain unhighlighted title through it is safe and is the intended use when
 * the search returned no fragment.
 */
export function renderHighlight(fragment: string): string {
  return escapeHtml(fragment)
    .replace(/&lt;mark&gt;/g, '<mark>')
    .replace(/&lt;\/mark&gt;/g, '</mark>');
}

/**
 * Serializes a value for embedding inside `<script type="application/ld+json">`.
 *
 * `JSON.stringify` alone is not enough: the HTML parser ends the script element
 * at the first `</script` in the text, so a string value containing one breaks
 * out of the script and into markup. The escapes below are invisible to a JSON
 * parser (`\u003c` is just `<`), and U+2028/U+2029 are escaped because they
 * terminate a line in JavaScript source but are legal inside a JSON string.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}