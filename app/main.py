from fastapi import FastAPI, Depends
import models
from models import Topics
from database import engine, SessionLocal
from typing import Annotated
from routes import topics, notes

app = FastAPI()

models.Base.metadata.create_all(bind=engine)

app.include_router(topics.router)
app.include_router(notes.router)

