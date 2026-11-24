from fastapi import FastAPI, Depends
import models
from models import Topics
from database import engine, SessionLocal
from typing import Annotated
from routes import topics, notes, auth
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

models.Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", "http://127.0.0.1:5500"],
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(topics.router)
app.include_router(notes.router)
app.include_router(auth.router)

