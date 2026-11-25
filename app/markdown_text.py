import re

WORDS_PER_MINUTE = 180
EXCERPT_LENGTH = 220

FENCED_CODE = re.compile(r"^\s*```.*?^\s*```", re.S | re.M)
INLINE_CODE = re.compile(r"`([^`]*)`")
LINK = re.compile(r"\[([^\]]*)\]\([^)]*\)")
SKIPPED_BLOCK = re.compile(r"^(#{1,6}\s|>|\||[-*+]\s|\d+\.\s|---)")


def reading_minutes(markdown: str) -> int:
    return max(1, round(len(markdown.split()) / WORDS_PER_MINUTE))


def _first_paragraph(markdown: str) -> str:
    text = FENCED_CODE.sub("\n\n", markdown)
    for block in re.split(r"\n\s*\n", text):
        block = block.strip()
        if block and not SKIPPED_BLOCK.match(block):
            return block
    return ""


def _plain(paragraph: str) -> str:
    parts = INLINE_CODE.split(LINK.sub(r"\1", paragraph))
    text = "".join(part if index % 2 else part.replace("*", "") for index, part in enumerate(parts))
    return " ".join(text.split())


def excerpt(markdown: str, limit: int = EXCERPT_LENGTH) -> str:
    text = _plain(_first_paragraph(markdown))
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(",.;:") + "…"
