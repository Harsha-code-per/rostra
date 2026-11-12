from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.database import get_db
from app.schemas.super_admin import InquiryCreate, InquiryOut
from app.services.super_admin_service import create_inquiry

router = APIRouter(prefix="/inquiries", tags=["Public Inquiries & Pricing"])


@router.post("", response_model=InquiryOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def submit_public_inquiry(
    request: Request,
    req: InquiryCreate,
    db: AsyncSession = Depends(get_db),
):
    return await create_inquiry(db, req)
