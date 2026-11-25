import argparse
import json
import os
import re
from pathlib import Path

from sqlalchemy import text

from database import SessionLocal
from models import Categories, Topics

TOPICS_DIR = Path(os.getenv("TOPICS_DIR", Path(__file__).resolve().parent.parent / "topics"))
NUMBERED = re.compile(r"^(\d+)-(.+)$")
LANGUAGES = ("en", "uk")


def numbered(name: str) -> tuple[int, str]:
    match = NUMBERED.match(name)
    if match is None:
        raise ValueError(f"{name!r} must start with a number, e.g. '01-references'")
    return int(match.group(1)), match.group(2)


def read_topic_file(path: Path) -> tuple[str, str]:
    lines = path.read_text(encoding="utf-8").lstrip("﻿").splitlines()
    if not lines or not lines[0].startswith("# "):
        raise ValueError(f"{path} must start with a '# Title' line")
    title = lines[0][2:].strip()
    if not 0 < len(title) <= 200:
        raise ValueError(f"{path} has a title longer than 200 characters")
    return title, "\n".join(lines[1:]).strip() + "\n"


def topic_stems(root: Path, category_dir: str) -> list[str]:
    stems = {
        language: sorted(path.stem for path in (root / language / category_dir).glob("*.md"))
        for language in LANGUAGES
    }
    if len({tuple(names) for names in stems.values()}) != 1:
        raise ValueError(f"{category_dir} has different topic files per language: {stems}")
    if not stems[LANGUAGES[0]]:
        raise ValueError(f"{category_dir} has no topics")
    return stems[LANGUAGES[0]]


def load_catalog(root: Path) -> list[dict]:
    catalog = []
    for entry in json.loads((root / "categories.json").read_text(encoding="utf-8")):
        position, slug = numbered(entry["dir"])
        topics = []
        for stem in topic_stems(root, entry["dir"]):
            topic_position, topic_slug = numbered(stem)
            topic = {"slug": f"{slug}/{topic_slug}", "position": topic_position}
            for language in LANGUAGES:
                path = root / language / entry["dir"] / f"{stem}.md"
                topic[f"title_{language}"], topic[f"content_{language}"] = read_topic_file(path)
            topics.append(topic)
        catalog.append({
            "slug": slug,
            "position": position,
            "title_en": entry["title_en"],
            "title_uk": entry["title_uk"],
            "topics": topics,
        })
    return catalog


def upsert(db, model, slug: str, values: dict):
    instance = db.query(model).filter(model.slug == slug).first()
    if instance is None:
        instance = model(slug=slug, **values)
        db.add(instance)
        db.flush()
        return instance, True
    for key, value in values.items():
        setattr(instance, key, value)
    return instance, False


def seed(reset: bool):
    catalog = load_catalog(TOPICS_DIR)
    counts = {"categories": [0, 0], "topics": [0, 0]}
    db = SessionLocal()
    try:
        if reset:
            db.execute(text("TRUNCATE notes, topics, categories RESTART IDENTITY"))
        for entry in catalog:
            topics = entry.pop("topics")
            category, created = upsert(db, Categories, entry.pop("slug"), entry)
            counts["categories"][0 if created else 1] += 1
            for topic in topics:
                _, created = upsert(db, Topics, topic.pop("slug"), {**topic, "category_id": category.id})
                counts["topics"][0 if created else 1] += 1
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    for name, (created, updated) in counts.items():
        print(f"{name}: {created} created, {updated} updated")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load topics from Markdown files into the database.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="delete all notes, topics and categories before loading",
    )
    seed(parser.parse_args().reset)
