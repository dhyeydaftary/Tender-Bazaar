import assert from 'node:assert/strict';

import { escapeHtml, renderHighlight, serializeJsonLd } from '../safe-html';

/**
 * The web app hands a string to the DOM as markup in exactly two places:
 * the tender card's title (an Elasticsearch highlight fragment, which is
 * markup by design) and the JSON-LD script tag. Both carry SCRAPED tender
 * text, which no part of the pipeline escapes: Elasticsearch's highlighter
 * inserts `<mark>` into the stored field value and returns the surrounding
 * text verbatim, so a title harvested from a portal arrives intact at
 * `dangerouslySetInnerHTML`.
 *
 * These tests pin that only `<mark>` survives, and that nothing can close the
 * JSON-LD script element.
 */

console.log('--- Starting Safe HTML Tests ---');

// 1. Escaping covers every character that can change HTML meaning.
{
  assert.equal(
    escapeHtml(`<img src=x onerror="alert(1)">`),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
  );
  assert.equal(escapeHtml("it's & <that>"), 'it&#39;s &amp; &lt;that&gt;');
  assert.equal(escapeHtml('plain title'), 'plain title', 'ordinary text is untouched');

  console.log('✓ escapeHtml neutralises <, >, &, " and \'');
}

// 2. A highlight fragment keeps its <mark> tags and nothing else.
{
  assert.equal(
    renderHighlight('Construction of <mark>bridge</mark> works'),
    'Construction of <mark>bridge</mark> works',
  );

  console.log('✓ The <mark> tags the search service inserts are preserved');
}

// 3. Script injection through the scraped title is neutralised, highlighted or not.
{
  const payload = '<script>alert(document.cookie)</script>';
  const rendered = renderHighlight(payload);
  assert.ok(!rendered.includes('<script'), 'no live script tag may survive');
  assert.equal(rendered, '&lt;script&gt;alert(document.cookie)&lt;/script&gt;');

  const mixed = renderHighlight('<mark>NHAI</mark> <img src=x onerror=alert(1)> tender');
  assert.ok(mixed.startsWith('<mark>NHAI</mark>'), 'the real highlight still renders');
  assert.ok(!mixed.includes('<img'), 'an injected tag must not survive beside it');

  console.log('✓ A scraped title carrying markup cannot inject a tag or handler');
}

// 4. A forged <mark> with attributes does not become a tag.
{
  const forged = renderHighlight('<mark onmouseover="alert(1)">x</mark>');
  assert.ok(
    !forged.includes('<mark onmouseover'),
    'only the bare <mark> form is restored, never one carrying attributes',
  );
  assert.ok(forged.includes('&lt;mark onmouseover'), 'it stays escaped as text');

  console.log('✓ A <mark> carrying an event handler is not restored as a tag');
}

// 5. An unbalanced or partial tag cannot escape.
{
  for (const input of ['<', '</', '<mark', 'a < b > c', '<<mark>>']) {
    const out = renderHighlight(input);
    const stripped = out.replace(/<\/?mark>/g, '');
    assert.ok(!stripped.includes('<'), `an unescaped < survived for input ${JSON.stringify(input)}`);
  }

  console.log('✓ Partial and unbalanced tags leave no unescaped <');
}

// 6. JSON-LD cannot be closed by a value, and stays valid JSON.
{
  const data = { name: 'Tender </script><script>alert(1)</script>', value: 10 };
  const out = serializeJsonLd(data);

  assert.ok(!out.includes('</script'), 'the script element must not be closable');
  assert.ok(!out.includes('<'), 'no raw < may appear in the script body');
  assert.deepEqual(
    JSON.parse(out),
    data,
    'the escapes must be invisible to a JSON parser, so the structured data still works',
  );

  console.log('✓ JSON-LD values cannot close the script element and still parse as JSON');
}

// 7. The JavaScript line terminators that are legal inside a JSON string are escaped.
{
  const out = serializeJsonLd({ name: 'a\u2028b\u2029c' });
  assert.ok(!out.includes('\u2028') && !out.includes('\u2029'));
  assert.equal(JSON.parse(out).name, 'a\u2028b\u2029c');

  console.log('✓ U+2028 and U+2029 are escaped without changing the parsed value');
}

console.log('--- All Safe HTML Tests Passed ---');
