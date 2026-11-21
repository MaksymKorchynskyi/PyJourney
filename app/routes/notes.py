from fastapi import APIRouter, HTTPException, Path, Query
from database import db_dependency
from models import Notes, Topics
from starlette import status
from schemas.notes import NoteRequest, NoteResponse

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/", status_code=status.HTTP_200_OK, response_model=list[NoteResponse])
async def read_all_notes(db: db_dependency, skip: int = Query(0, ge=0), limit: int = Query(10, ge=1, le=100)):
    return db.query(Notes).order_by(Notes.id).offset(skip).limit(limit).all()

@router.get("/notes/{notes_id}", status_code=status.HTTP_200_OK, response_model=list[NoteResponse])
async def read_note(db: db_dependency, notes_id: int = Path(gt=0)):
    notes_model = db.query(Notes).filter(Notes.id == notes_id).first()
    if notes_model is not None:
        return notes_model
    raise HTTPException(status_code=404, detail="Note not found.")

@router.post("/notes", status_code= status.HTTP_201_CREATED, response_model=list[NoteResponse])
async def create_note(db : db_dependency, note_request: NoteRequest):
    notes_model = Notes(**note_request.model_dump())

    db.add(notes_model)
    db.commit()

@router.put("/notes/{notes_id}", status_code=status.HTTP_200_OK, response_model=list[NoteResponse])
async def update_note(db: db_dependency, note_request: NoteRequest, notes_id: int = Path(gt=0)):
    notes_model = db.query(Notes).filter(Notes.id == notes_id).first()
    if notes_model is None:
        raise HTTPException(status_code=404, detail="Note not found. ")
    
    notes_model.title = note_request.title
    notes_model.content = note_request.content

    db.add(notes_model)
    db.commit()
    db.refresh(notes_model)
    return notes_model

@router.delete("/notes/{notes_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(db: db_dependency, notes_id: int = Path(gt=0)):
    notes_model = db.query(Notes).filter(Notes.id == notes_id).first()
    if notes_model is None:
        raise HTTPException(status_code=404, detail="Note not found. ")

    db.query(Notes).filter(Notes.id == notes_id).delete()
    db.commit()