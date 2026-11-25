from pydantic import BaseModel, ConfigDict

class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    position: int
    title_en: str
    title_uk: str
