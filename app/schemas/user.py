from pydantic import BaseModel, Field, ConfigDict, EmailStr

class CreateUserRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    first_name :str
    last_name: str
    password: str = Field(min_length=8)

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    username: str
    first_name :str
    last_name: str
    role: str
    is_active: bool

class Token(BaseModel):
    access_token: str
    token_type: str