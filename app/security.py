from pwdlib import PasswordHash
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException
from typing import Annotated
from datetime import datetime, timedelta, timezone
import jwt
from jwt.exceptions import InvalidTokenError
from models import Users
import os
from database import db_dependency
from starlette import status

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"

oauth2_bearer = OAuth2PasswordBearer(tokenUrl='auth/token')

password_hash = PasswordHash.recommended()

def hash_password(password: str) -> str:
    return password_hash.hash(password)

def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)

def create_acces_token(user_id: int, expires_delta: timedelta = timedelta(minutes=30)) -> str:
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: Annotated[str, Depends(oauth2_bearer)], db: db_dependency) -> Users:
    try: 
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Could not validate user.')
        
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Could not validate user.')

    user = db.query(Users).filter(Users.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Could not validate user.')   
    return user

user_dependency = Annotated[Users, Depends(get_current_user)]

def get_current_admin(user: user_dependency) -> Users:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not access. You need to be admin.")
    return user

admin_dependency = Annotated[Users, Depends(get_current_admin)]
