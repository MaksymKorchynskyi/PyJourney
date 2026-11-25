
from database import Base
from markdown_text import excerpt, reading_minutes
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

class Categories(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True)
    slug = Column(String(100), nullable=False, unique=True)
    position = Column(Integer, nullable=False, default=0, server_default="0")
    title_en = Column(String(200), nullable=False)
    title_uk = Column(String(200), nullable=False)

    topics = relationship("Topics", back_populates="category")

class Topics(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True)
    category_id = Column(
        Integer,
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=True,
        index=True
    )
    slug = Column(String(150), unique=True, nullable=True)
    position = Column(Integer, nullable=False, default=0, server_default="0")
    title_en = Column(String(200), nullable=False)
    title_uk = Column(String(200), nullable=False)
    content_en = Column(Text, nullable=False, default="")
    content_uk = Column(Text, nullable=False, default="")
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

    category = relationship("Categories", back_populates="topics")
    notes = relationship(
        "Notes",
        back_populates="topic",
        cascade="all, delete-orphan",
        passive_deletes=True
    )

    @property
    def excerpt_en(self):
        return excerpt(self.content_en)

    @property
    def excerpt_uk(self):
        return excerpt(self.content_uk)

    @property
    def reading_minutes_en(self):
        return reading_minutes(self.content_en)

    @property
    def reading_minutes_uk(self):
        return reading_minutes(self.content_uk)

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
