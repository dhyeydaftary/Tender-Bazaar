import json
import logging

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

# Valid top-level categories
VALID_CATEGORIES = {"WORKS", "GOODS", "SERVICES", "CONSULTANCY"}


class TenderClassifier:
    """Classify Indian government tenders by category, keywords, and industries."""

    async def classify(self, title: str, description: str = "") -> dict:
        if not settings.ANTHROPIC_API_KEY:
            logger.warning("ANTHROPIC_API_KEY not set; returning default classification")
            return self._default()

        try:
            client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

            system_prompt = (
                "You are an expert classifier of Indian government tenders.\n\n"
                "Given a tender title and optional description, return a JSON object with:\n"
                '  - "category": exactly one of "WORKS", "GOODS", "SERVICES", "CONSULTANCY"\n'
                '  - "keywords": array of 3-8 relevant keywords for search indexing (lowercase)\n'
                '  - "industries": array of 1-4 industry sectors this tender belongs to '
                "(e.g. Construction, IT, Healthcare, Defence, Education, Transport, Energy, Agriculture)\n\n"
                "Return ONLY the JSON object, no other text."
            )

            user_prompt = f"Title: {title}"
            if description:
                user_prompt += f"\nDescription: {description}"

            message = await client.messages.create(
                model=settings.AI_MODEL,
                max_tokens=512,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )

            raw_text = message.content[0].text.strip()
            # Strip markdown code fences if present
            if raw_text.startswith("```"):
                raw_text = raw_text.split("\n", 1)[1] if "\n" in raw_text else raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3].strip()

            result = json.loads(raw_text)

            category = result.get("category", "WORKS").upper()
            if category not in VALID_CATEGORIES:
                category = "WORKS"

            return {
                "category": category,
                "keywords": result.get("keywords", []),
                "industries": result.get("industries", []),
            }

        except Exception:
            logger.exception("Tender classification failed")
            return self._default()

    @staticmethod
    def _default() -> dict:
        return {
            "category": "WORKS",
            "keywords": [],
            "industries": [],
        }
