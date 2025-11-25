from typing import Optional, Dict
from sqlmodel import SQLModel, Field, Column, JSON
from datetime import datetime

class Survey(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Response(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    survey_id: int
    payload_json: Dict = Field(sa_column=Column(JSON))
    status: str = "pending"  # 'pending'|'approved'|'rejected'
    created_at: datetime = Field(default_factory=datetime.utcnow)

