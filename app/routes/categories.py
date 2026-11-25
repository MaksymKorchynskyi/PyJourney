from fastapi import APIRouter
from database import db_dependency
from models import Categories
from starlette import status
from schemas.categories import CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])

@router.get("/", status_code=status.HTTP_200_OK, response_model=list[CategoryResponse])
async def read_all_categories(db: db_dependency):
    return db.query(Categories).order_by(Categories.position, Categories.id).all()
