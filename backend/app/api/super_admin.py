from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.permissions import require_roles
from app.models.profile import Profile
from app.schemas.super_admin import (
    CompanyTenantOut,
    CompanyProvisionRequest,
    CompanyProvisionResponse,
    CompanyStatusUpdateRequest,
    InquiryOut,
    InquiryStatusUpdate,
)
from app.services.super_admin_service import (
    provision_new_tenant,
    list_all_tenants,
    update_tenant_status,
    list_inquiries,
    update_inquiry_status,
)

router = APIRouter(tags=["Super Admin Platform Console"])


# Companies Management
@router.get("/super-admin/companies", response_model=List[CompanyTenantOut])
@router.get("/companies", response_model=List[CompanyTenantOut])
async def get_all_companies(
    current_user: Profile = Depends(require_roles(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    return await list_all_tenants(db)


@router.post("/super-admin/companies", response_model=CompanyProvisionResponse, status_code=status.HTTP_201_CREATED)
@router.post("/companies", response_model=CompanyProvisionResponse, status_code=status.HTTP_201_CREATED)
async def provision_company(
    req: CompanyProvisionRequest,
    current_user: Profile = Depends(require_roles(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    try:
        company_out, temp_password = await provision_new_tenant(db, req)
        return CompanyProvisionResponse(
            company=company_out,
            temporaryPassword=temp_password,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.patch("/super-admin/companies/{company_id}/status", response_model=CompanyTenantOut)
@router.patch("/companies/{company_id}/status", response_model=CompanyTenantOut)
async def change_company_status(
    company_id: str,
    req: CompanyStatusUpdateRequest,
    current_user: Profile = Depends(require_roles(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await update_tenant_status(db, company_id, req.status)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# Inquiries Management for Super Admin
@router.get("/super-admin/inquiries", response_model=List[InquiryOut])
@router.get("/inquiries", response_model=List[InquiryOut])
async def get_all_inquiries(
    current_user: Profile = Depends(require_roles(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    return await list_inquiries(db)


@router.patch("/super-admin/inquiries/{inquiry_id}/status", response_model=InquiryOut)
@router.patch("/inquiries/{inquiry_id}/status", response_model=InquiryOut)
async def update_inquiry(
    inquiry_id: str,
    req: InquiryStatusUpdate,
    current_user: Profile = Depends(require_roles(["SUPER_ADMIN"])),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await update_inquiry_status(db, inquiry_id, req.status)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
