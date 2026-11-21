from fastapi import APIRouter, HTTPException, Path, Query
from database import db_dependency
from models import Topics
from starlette import status
from schemas.topics import TopicRequest, TopicResponse
from schemas.notes import NoteResponse
from models import Notes

router = APIRouter(prefix="/topics", tags=["topics"])

@router.get("/", status_code=status.HTTP_200_OK, response_model=list[TopicResponse])
async def read_all_topics(db: db_dependency, skip: int = Query(0, ge=0), limit: int = Query(10, ge=1, le=100)):
    return db.query(Topics).order_by(Topics.id).offset(skip).limit(limit).all()

@router.get("/topics/{topics_id}", status_code=status.HTTP_200_OK, response_model=list[TopicResponse])
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

@router.post("/topics", status_code= status.HTTP_201_CREATED, response_model=list[TopicResponse])
async def create_topic(db : db_dependency, topic_request: TopicRequest):
    topics_model = Topics(**topic_request.model_dump())

    db.add(topics_model)
    db.commit()

@router.put("/topics/{topics_id}", status_code=status.HTTP_200_OK, response_model=list[TopicResponse])
async def update_topic(db: db_dependency, topic_request: TopicRequest, topics_id: int = Path(gt=0)):
    topics_model = db.query(Topics).filter(Topics.id == topics_id).first()
    if topics_model is None:
        raise HTTPException(status_code=404, detail="Topic not found. ")
    
    topics_model.title = topic_request.title
    topics_model.content = topic_request.content

    db.add(topics_model)
    db.commit()
    db.refresh(topics_model)
    return topics_model

@router.delete("/topics/{topics_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(db: db_dependency, topics_id: int = Path(gt=0)):
    topics_model = db.query(Topics).filter(Topics.id == topics_id).first()
    if topics_model is None:
        raise HTTPException(status_code=404, detail="Topic not found. ")

    db.query(Topics).filter(Topics.id == topics_id).delete()
    db.commit()