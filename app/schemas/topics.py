from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class TopicRequest(BaseModel):
    title: str = Field(min_length=1)
    content: str = Field(min_length=1)

class TopicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    created_at: datetime
    updated_at: datetime