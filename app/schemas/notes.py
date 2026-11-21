from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class NoteRequest(BaseModel):
    title: str = Field(min_length=1)
    content: str = Field(min_length=1)
    topic_id: int = Field(gt=0)

class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    topic_id: int
    created_at: datetime
    updated_at: datetime

