from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class TopicRequest(BaseModel):
    category_id: int = Field(gt=0)
    title_en: str = Field(min_length=1, max_length=200)
    title_uk: str = Field(min_length=1, max_length=200)
    content_en: str = Field(min_length=1)
    content_uk: str = Field(min_length=1)
    position: int | None = Field(default=None, ge=0)

class TopicSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int | None
    slug: str | None
    position: int
    title_en: str
    title_uk: str
    excerpt_en: str
    excerpt_uk: str
    reading_minutes_en: int
    reading_minutes_uk: int
    created_at: datetime
    updated_at: datetime

class TopicResponse(TopicSummaryResponse):
    content_en: str
    content_uk: str
