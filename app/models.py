
from database import Base
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

class Users(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique = True)
    username = Column(String, unique=True)
    first_name = Column(String)
    last_name = Column(String)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    role = Column(String, nullable = False, default="user", server_default="user")

class Topics(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False, default="")
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    notes = relationship(
        "Notes",
        back_populates="topic",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

class Notes(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True)
    topic_id = Column(
        Integer,
        ForeignKey("topics.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False, default="")
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    topic = relationship("Topics", back_populates="notes")
    owner_id = Column(Integer, ForeignKey("users.id"))
