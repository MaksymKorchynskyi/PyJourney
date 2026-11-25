from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import func
from database import db_dependency
from models import Categories, Topics
from starlette import status
from schemas.topics import TopicRequest, TopicResponse, TopicSummaryResponse
from schemas.notes import NoteResponse
from models import Notes
from security import admin_dependency

router = APIRouter(prefix="/topics", tags=["topics"])

def ensure_category(db, category_id: int):
    if db.query(Categories).filter(Categories.id == category_id).first() is None:
        raise HTTPException(status_code=404, detail="Category not found.")

def next_position(db, category_id: int):
    current = db.query(func.max(Topics.position)).filter(Topics.category_id == category_id).scalar()
    return (current or 0) + 1

@router.get("/", status_code=status.HTTP_200_OK, response_model=list[TopicSummaryResponse])
async def read_all_topics(db: db_dependency, skip: int = Query(0, ge=0), limit: int = Query(200, ge=1, le=500), category_id: int | None = Query(None, gt=0)):
    query = db.query(Topics).outerjoin(Categories, Topics.category_id == Categories.id)
    if category_id is not None:
        query = query.filter(Topics.category_id == category_id)
    return (
        query.order_by(Categories.position.asc().nulls_last(), Topics.position, Topics.id)
        .offset(skip)
        .limit(limit)
        .all())

@router.get("/topics/{topics_id}", status_code=status.HTTP_200_OK, response_model=TopicResponse)
async def read_topic(db: db_dependency, topics_id: int = Path(gt=0)):
    topics_model = db.query(Topics).filter(Topics.id == topics_id).first()
    if topics_model is not None:
        return topics_model
    raise HTTPException(status_code=404, detail="Topic not found.")

@router.get("/{topic_id}/notes", status_code=status.HTTP_200_OK, response_model=list[NoteResponse])
async def read_topic_notes(db: db_dependency, topic_id: int, skip: int = Query(0, ge=0), limit: int = Query(10, ge=1, le=100)):
    topic_model = db.query(Topics).filter(Topics.id == topic_id).first()
    if topic_model is None:
        raise HTTPException(status_code=404, details="Topic not found.")
    return (db.query(Notes).filter(Topics.id == topic_id).order_by(Notes.id).offset(skip).limit(limit).all())

@router.post("/topics", status_code= status.HTTP_201_CREATED, response_model=TopicResponse)
async def create_topic(db : db_dependency, admin: admin_dependency, topic_request: TopicRequest):
    ensure_category(db, topic_request.category_id)
    data = topic_request.model_dump()
    if data["position"] is None:
        data["position"] = next_position(db, topic_request.category_id)
    topics_model = Topics(**data)

    db.add(topics_model)
    db.commit()
    db.refresh(topics_model)
    return topics_model

@router.put("/topics/{topics_id}", status_code=status.HTTP_200_OK, response_model=TopicResponse)
async def update_topic(db: db_dependency, admin: admin_dependency, topic_request: TopicRequest, topics_id: int = Path(gt=0)):
    topics_model = db.query(Topics).filter(Topics.id == topics_id).first()
    if topics_model is None:
        raise HTTPException(status_code=404, detail="Topic not found. ")
    ensure_category(db, topic_request.category_id)

    if topic_request.position is not None:
        topics_model.position = topic_request.position
    elif topics_model.category_id != topic_request.category_id:
        topics_model.position = next_position(db, topic_request.category_id)
    topics_model.category_id = topic_request.category_id
    topics_model.title_en = topic_request.title_en
    topics_model.title_uk = topic_request.title_uk
    topics_model.content_en = topic_request.content_en
    topics_model.content_uk = topic_request.content_uk

    db.add(topics_model)
    db.commit()
    db.refresh(topics_model)
    return topics_model

@router.delete("/topics/{topics_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(db: db_dependency, admin: admin_dependency, topics_id: int = Path(gt=0)):
    topics_model = db.query(Topics).filter(Topics.id == topics_id).first()
    if topics_model is None:
        raise HTTPException(status_code=404, detail="Topic not found. ")

    db.query(Topics).filter(Topics.id == topics_id).delete()
    db.commit()
