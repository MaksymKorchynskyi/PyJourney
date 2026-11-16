from fastapi import FastAPI, APIRouter
import models
from database import engine


app = FastAPI()

models.Base.metadata.create_all(bind=engine)




