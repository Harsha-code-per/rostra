from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.permissions import get_current_user, require_roles, role_value
from app.models.profile import Profile
from app.models.leave import LeaveStatus
from app.schemas.leave import (
    LeaveApplyRequest,
    LeaveReviewRequest,
    LeaveRequestOut,
    LeaveBalanceResponse,
)
from app.services.leave_service import (
    apply_for_leave,
    review_leave_request,
    get_leave_balances,
    list_leave_requests,
)

router = APIRouter(prefix="/leaves", tags=["Leaves & Time-Off"])


@router.post("", response_model=LeaveRequestOut, status_code=status.HTTP_201_CREATED)
async def apply_leave(
    req: LeaveApplyRequest,
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee profile required to apply for leave",
        )

    leave_req = await apply_for_leave(
        db=db,
        employee=current_user.employee,
        company_id=current_user.company_id,
        leave_type_enum=req.leave_type,
        start_date=req.start_date,
        end_date=req.end_date,
        reason=req.reason,
        total_days=req.total_days,
        attachment_url=str(req.attachment_url) if req.attachment_url else None,
    )

    items = await list_leave_requests(db, company_id=current_user.company_id, leave_id=leave_req.id)
    return items[0] if items else {
        "id": leave_req.id,
        "employee_id": current_user.employee.employee_id,
        "employee_name": f"{current_user.employee.first_name} {current_user.employee.last_name}",
        "department": current_user.employee.department,
        "avatar_url": current_user.employee.avatar_url,
        "leave_type": req.leave_type.value,
        "start_date": req.start_date,
        "end_date": req.end_date,
        "total_days": leave_req.total_days,
        "reason": req.reason,
        "attachment_url": req.attachment_url,
        "status": leave_req.status.value,
        "hr_comments": None,
        "reviewed_by": None,
        "reviewed_at": None,
        "created_at": leave_req.created_at,
    }


@router.get("/me", response_model=LeaveBalanceResponse)
async def get_my_leaves(
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not current_user.employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee profile not found",
        )

    balances = await get_leave_balances(db, current_user.employee.id, current_user.company_id)
    requests = await list_leave_requests(db, company_id=current_user.company_id, employee_id=current_user.employee.id)

    return LeaveBalanceResponse(
        balances=balances,
        requests=requests,
    )


@router.get("", response_model=List[LeaveRequestOut])
async def list_all_leaves(
    status_filter: Optional[LeaveStatus] = Query(None, alias="status"),
    employee_id: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: Profile = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_role = role_value(current_user.role)
    if user_role == "EMPLOYEE":
        if not current_user.employee:
            return []
        target_emp_id = current_user.employee.id
    else:
        target_emp_id = employee_id

    return await list_leave_requests(
        db,
        company_id=current_user.company_id,
        employee_id=target_emp_id,
        status_filter=status_filter,
        limit=limit,
        offset=offset,
    )


@router.patch("/{leave_id}/approve", response_model=LeaveRequestOut)
async def approve_leave(
    leave_id: str,
    req: Optional[LeaveReviewRequest] = None,
    current_user: Profile = Depends(require_roles(["ADMIN", "HR"])),
    db: AsyncSession = Depends(get_db),
):
    hr_comments = req.hr_comments if req else "Approved"
    reviewed = await review_leave_request(
        db=db,
        leave_id=leave_id,
        company_id=current_user.company_id,
        new_status=LeaveStatus.APPROVED,
        hr_comments=hr_comments,
        reviewer=current_user,
    )

    return (await list_leave_requests(db, company_id=current_user.company_id, leave_id=reviewed.id))[0]


@router.patch("/{leave_id}/reject", response_model=LeaveRequestOut)
async def reject_leave(
    leave_id: str,
    req: Optional[LeaveReviewRequest] = None,
    current_user: Profile = Depends(require_roles(["ADMIN", "HR"])),
    db: AsyncSession = Depends(get_db),
):
    hr_comments = req.hr_comments if req else "Rejected"
    reviewed = await review_leave_request(
        db=db,
        leave_id=leave_id,
        company_id=current_user.company_id,
        new_status=LeaveStatus.REJECTED,
        hr_comments=hr_comments,
        reviewer=current_user,
    )

    return (await list_leave_requests(db, company_id=current_user.company_id, leave_id=reviewed.id))[0]

