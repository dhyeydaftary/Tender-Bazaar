import json
import logging

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)


class TenderSummarizer:
    """Generate concise AI-powered summaries of Indian government tenders."""

    async def summarize(
        self,
        title: str,
        description: str,
        organization: str = "",
        category: str = "",
    ) -> dict:
        if not settings.ANTHROPIC_API_KEY:
            logger.warning("ANTHROPIC_API_KEY not set; returning fallback summary")
            return self._fallback(description)

        try:
            client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

            system_prompt = (
                "You are an expert analyst of Indian government tenders. "
                "Given tender information, produce a concise analysis.\n\n"
                "Return ONLY a JSON object with these fields:\n"
                '  - "summary": 2-3 sentence plain-English summary of the tender\n'
                '  - "key_requirements": array of 3-7 short strings listing key eligibility/submission requirements\n'
                '  - "suggested_bidder_profile": one sentence describing the ideal bidder\n\n'
                "Return ONLY the JSON object, no other text."
            )

            parts = [f"Title: {title}"]
            if organization:
                parts.append(f"Organization: {organization}")
            if category:
                parts.append(f"Category: {category}")
            parts.append(f"Description:\n{description}")

            user_prompt = "\n".join(parts)

            message = await client.messages.create(
                model=settings.AI_MODEL,
                max_tokens=1024,
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

            return {
                "summary": result.get("summary", description[:200]),
                "key_requirements": result.get("key_requirements", []),
                "suggested_bidder_profile": result.get("suggested_bidder_profile", ""),
            }

        except Exception:
            logger.exception("Tender summarization failed")
            return self._fallback(description)

    @staticmethod
    def _fallback(description: str) -> dict:
        return {
            "summary": description[:200].strip() + ("..." if len(description) > 200 else ""),
            "key_requirements": [],
            "suggested_bidder_profile": "",
        }
