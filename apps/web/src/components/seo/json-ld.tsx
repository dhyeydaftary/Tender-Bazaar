import { serializeJsonLd } from '@/lib/safe-html';

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Not JSON.stringify: a value containing `</script>` would end the
      // element and inject markup. See serializeJsonLd.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
