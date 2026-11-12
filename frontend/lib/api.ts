import type {
  AttendanceRecord,
  AttendanceStatus,
  CompanyInquiry,
  CompanyTenant,
  Employee,
  LeaveBalance,
  LeaveRequest,
  NotificationItem,
  UserSession,
} from "./types";
import type { PayableSalaryResult, SalaryComponents } from "./salary-calculator";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
const SESSION_KEY = "rostra_session";
export const UNAUTHORIZED_EVENT = "rostra:unauthorized";
// Render's free tier sleeps when idle; the first request can take ~50s to wake it.
const REQUEST_TIMEOUT_MS = 60_000;

// shortcut: JWT lives in localStorage (readable by XSS); move to an httpOnly cookie once API and app share a domain.
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? (JSON.parse(saved).token ?? null) : null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function errorMessage(body: Json, fallback: string): string {
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) {
    const field = Array.isArray(detail[0].loc) ? detail[0].loc[detail[0].loc.length - 1] : "";
    return field ? `${field}: ${detail[0].msg}` : detail[0].msg;
  }
  return fallback;
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const token = auth ? getAuthToken() : null;
  const init: RequestInit = {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, init);
  } catch (e) {
    if (method === "GET") {
      // one retry for transient network errors / cold starts
      try {
        res = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      } catch {
        throw new ApiError("Cannot reach the server. Check your connection and try again.", 0);
      }
    } else {
      throw new ApiError(
        e instanceof DOMException && e.name === "TimeoutError"
          ? "The server took too long to respond. Please try again."
          : "Cannot reach the server. Check your connection and try again.",
        0
      );
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    // A 401 on an authenticated call means the session is dead; the layout listens and redirects to login.
    if (res.status === 401 && auth && typeof window !== "undefined") {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(errorMessage(data, `Request failed (${res.status})`), res.status);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// ---------------------------------------------------------------------------
// Mappers: backend snake_case -> frontend camelCase
// ---------------------------------------------------------------------------
function mapEmployee(e: Json): Employee {
  return {
    id: e.id,
    userId: e.user_id ?? "",
    employeeId: e.employee_id ?? "",
    firstName: e.first_name ?? "",
    lastName: e.last_name ?? "",
    email: e.email ?? "",
    phone: e.phone ?? "",
    department: e.department ?? "",
    designation: e.designation ?? "",
    joiningDate: e.joining_date ?? "",
    status: e.status ?? "ACTIVE",
    avatarUrl: e.avatar_url ?? "",
    address: e.address ?? "",
    emergencyContact: e.emergency_contact ?? { name: "", relationship: "", phone: "" },
    wage: e.wage ?? 0,
  };
}

function mapAttendance(a: Json): AttendanceRecord {
  return {
    id: a.id ?? `${a.employee_id}-${a.work_date}`,
    employeeId: a.employee_id ?? "",
    employeeName: a.employee_name,
    department: a.department,
    workDate: a.work_date,
    checkIn: a.check_in ?? null,
    checkOut: a.check_out ?? null,
    totalHours: a.total_hours ?? 0,
    status: a.status,
    notes: a.notes ?? undefined,
  };
}

function mapLeave(l: Json): LeaveRequest {
  return {
    id: l.id,
    employeeId: l.employee_id ?? "",
    employeeName: l.employee_name ?? "Employee",
    department: l.department ?? "",
    avatarUrl: l.avatar_url ?? "",
    leaveType: l.leave_type,
    startDate: l.start_date,
    endDate: l.end_date,
    totalDays: l.total_days,
    reason: l.reason ?? "",
    status: l.status,
    hrComments: l.hr_comments ?? undefined,
    reviewedBy: l.reviewed_by ?? undefined,
    reviewedAt: l.reviewed_at ?? undefined,
    createdAt: l.created_at ?? "",
  };
}

function mapCompany(c: Json): CompanyTenant {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    domain: c.domain || `${c.slug}.com`,
    plan: c.plan,
    adminName: c.adminName ?? "Admin",
    adminEmail: c.adminEmail ?? "",
    employeeCount: c.employeeCount ?? 0,
    status: c.status,
    maxEmployees: c.maxEmployees ?? null,
    createdAt: c.createdAt ?? "",
  };
}

function mapInquiry(i: Json): CompanyInquiry {
  return {
    id: i.id,
    companyName: i.companyName,
    contactName: i.contactName,
    workEmail: i.workEmail,
    phone: i.phone ?? "",
    teamSize: i.teamSize,
    planInterest: i.planInterest,
    message: i.message ?? "",
    status: i.status,
    createdAt: i.createdAt ?? "",
  };
}

/** Generates a strong one-time password for newly onboarded staff (shown to the HR admin once). */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `Rx-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}9!`;
}

export interface NewEmployeeInput {
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  designation: string;
  phone?: string;
  wage: number;
  role?: "HR" | "EMPLOYEE";
}

export interface AttendanceOverview {
  today: { checkedIn: boolean; checkedOut: boolean; checkInTime: string | null; checkOutTime: string | null; status: string };
  summary: { totalWorkingDays: number; presentDays: number; halfDays: number; leavesTaken: number; totalHoursWorked: number };
  records: AttendanceRecord[];
}

export interface PayrollView {
  structure: SalaryComponents;
  payableSummary: PayableSalaryResult;
  month: number;
  year: number;
}

export interface AnalyticsSummary {
  metrics: {
    totalEmployees: number;
    presentToday: number;
    absentToday: number;
    onLeaveToday: number;
    pendingLeaves: number;
    attendanceRate: number;
    monthlyPayrollTotal: number;
  };
  departmentDistribution: { name: string; count: number; payroll: number }[];
  attendanceTrends: { date: string; present: number; absent: number; leave: number }[];
}

export class RostraApi {
  // ---- auth -------------------------------------------------------------
  static async login(email: string, password: string): Promise<UserSession> {
    const data = await request<Json>("/auth/login", { method: "POST", body: { email, password }, auth: false });
    const u = data.user;
    const s = u.employee;
    const employee: Employee = s
      ? { ...mapEmployee({ ...s, user_id: u.id, email: u.email }), email: u.email }
      : mapEmployee({ id: u.id, user_id: u.id, email: u.email, first_name: u.email.split("@")[0], designation: u.role });
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      companyId: u.company_id ?? undefined,
      companyName: u.company_name ?? undefined,
      mustChangePassword: data.must_reset_password ?? false,
      employee,
      token: data.access_token,
    };
  }

  static async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await request("/auth/change-password", { method: "POST", body: { old_password: oldPassword, new_password: newPassword } });
  }

  static async forgotPassword(email: string): Promise<void> {
    await request("/auth/forgot-password", { method: "POST", body: { email }, auth: false });
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    await request("/auth/reset-password", { method: "POST", body: { token, new_password: newPassword }, auth: false });
  }

  // ---- platform admin ---------------------------------------------------
  static async getCompanies(): Promise<CompanyTenant[]> {
    return (await request<Json[]>("/super-admin/companies")).map(mapCompany);
  }

  static async provisionCompany(data: {
    name: string;
    domain?: string;
    adminName: string;
    adminEmail: string;
    plan: "Starter" | "Growth" | "Enterprise";
    maxEmployees?: number;
  }): Promise<{ company: CompanyTenant; temporaryPassword: string }> {
    const r = await request<Json>("/super-admin/companies", { method: "POST", body: data });
    return { company: mapCompany(r.company), temporaryPassword: r.temporaryPassword };
  }

  static async setCompanyStatus(id: string, status: CompanyTenant["status"]): Promise<CompanyTenant> {
    return mapCompany(await request(`/super-admin/companies/${id}/status`, { method: "PATCH", body: { status } }));
  }

  static async getInquiries(): Promise<CompanyInquiry[]> {
    return (await request<Json[]>("/super-admin/inquiries")).map(mapInquiry);
  }

  static async submitInquiry(i: Omit<CompanyInquiry, "id" | "status" | "createdAt">): Promise<CompanyInquiry> {
    return mapInquiry(await request("/inquiries", { method: "POST", body: i, auth: false }));
  }

  static async updateInquiryStatus(id: string, status: CompanyInquiry["status"]): Promise<void> {
    await request(`/super-admin/inquiries/${id}/status`, { method: "PATCH", body: { status } });
  }

  // ---- employees --------------------------------------------------------
  static async getEmployees(params: { department?: string; status?: string; search?: string } = {}): Promise<Employee[]> {
    const q = new URLSearchParams({ limit: "500" });
    if (params.department && params.department !== "all") q.set("department", params.department);
    if (params.status && params.status !== "all") q.set("status", params.status);
    if (params.search) q.set("search", params.search);
    return (await request<Json[]>(`/employees?${q}`)).map(mapEmployee);
  }

  static async getMyEmployee(): Promise<Employee> {
    return mapEmployee(await request("/employees/me"));
  }

  static async updateEmployee(idOrCode: string, u: Partial<Employee>): Promise<Employee> {
    const body: Record<string, unknown> = {};
    if (u.firstName !== undefined) body.first_name = u.firstName;
    if (u.lastName !== undefined) body.last_name = u.lastName;
    if (u.phone !== undefined) body.phone = u.phone;
    if (u.department !== undefined) body.department = u.department;
    if (u.designation !== undefined) body.designation = u.designation;
    if (u.status !== undefined) body.status = u.status;
    if (u.avatarUrl !== undefined) body.avatar_url = u.avatarUrl;
    if (u.address !== undefined) body.address = u.address;
    if (u.emergencyContact !== undefined) body.emergency_contact = u.emergencyContact;
    if (u.wage !== undefined) body.wage = u.wage;
    return mapEmployee(await request(`/employees/${idOrCode}`, { method: "PUT", body }));
  }

  /** Onboards a person. The one-time password is generated here and shown to the admin once. */
  static async createEmployee(e: NewEmployeeInput): Promise<{ employee: Employee; temporaryPassword: string }> {
    const temporaryPassword = generateTempPassword();
    await request("/auth/register", {
      method: "POST",
      body: {
        employee_id: e.employeeId,
        email: e.email.toLowerCase(),
        password: temporaryPassword,
        first_name: e.firstName,
        last_name: e.lastName,
        role: e.role ?? "EMPLOYEE",
        department: e.department,
        designation: e.designation,
        phone: e.phone || null,
        wage: e.wage,
      },
    });
    const employee = mapEmployee(await request(`/employees/${encodeURIComponent(e.employeeId)}`));
    return { employee, temporaryPassword };
  }

  // ---- attendance -------------------------------------------------------
  /** Today's status, month summary and records for the signed-in user, or for one employee (HR/Admin). */
  static async getAttendance(employeeId?: string): Promise<AttendanceOverview> {
    const d = await request<Json>(employeeId ? `/attendance/${encodeURIComponent(employeeId)}` : "/attendance/me");
    return {
      today: {
        checkedIn: d.today.checked_in,
        checkedOut: d.today.checked_out,
        checkInTime: d.today.check_in_time ?? null,
        checkOutTime: d.today.check_out_time ?? null,
        status: d.today.status,
      },
      summary: {
        totalWorkingDays: d.summary.total_working_days,
        presentDays: d.summary.present_days,
        halfDays: d.summary.half_days,
        leavesTaken: d.summary.leaves_taken,
        totalHoursWorked: d.summary.total_hours_worked,
      },
      records: (d.records as Json[]).map(mapAttendance),
    };
  }

  static async getAttendanceHistory(employeeId?: string): Promise<AttendanceRecord[]> {
    return (await this.getAttendance(employeeId)).records;
  }

  /** Company-wide board for one day (HR/Admin). */
  static async getCompanyAttendance(date: string): Promise<AttendanceRecord[]> {
    return (await request<Json[]>(`/attendance?date=${date}`)).map(mapAttendance);
  }

  static async checkIn(notes?: string): Promise<AttendanceRecord> {
    return mapAttendance(await request("/attendance/check-in", { method: "POST", body: { notes: notes ?? null } }));
  }

  static async checkOut(): Promise<AttendanceRecord> {
    return mapAttendance(await request("/attendance/check-out", { method: "POST", body: {} }));
  }

  static async overrideAttendance(p: {
    employeeId: string;
    workDate: string;
    status: AttendanceStatus;
    totalHours?: number;
    notes?: string;
  }): Promise<AttendanceRecord> {
    return mapAttendance(
      await request("/attendance/override", {
        method: "PUT",
        body: { employee_id: p.employeeId, work_date: p.workDate, status: p.status, total_hours: p.totalHours ?? null, notes: p.notes ?? null },
      })
    );
  }

  // ---- leaves -----------------------------------------------------------
  static async getLeaveRequests(employeeId?: string): Promise<LeaveRequest[]> {
    const q = employeeId ? `?employee_id=${encodeURIComponent(employeeId)}&limit=500` : "?limit=500";
    return (await request<Json[]>(`/leaves${q}`)).map(mapLeave);
  }

  static async applyLeave(r: {
    leaveType: LeaveRequest["leaveType"];
    startDate: string;
    endDate: string;
    reason: string;
    attachmentUrl?: string;
  }): Promise<LeaveRequest> {
    return mapLeave(
      await request("/leaves", {
        method: "POST",
        body: { leave_type: r.leaveType, start_date: r.startDate, end_date: r.endDate, reason: r.reason, attachment_url: r.attachmentUrl || null },
      })
    );
  }

  static async reviewLeave(leaveId: string, status: "APPROVED" | "REJECTED", hrComments?: string): Promise<LeaveRequest> {
    const action = status === "APPROVED" ? "approve" : "reject";
    return mapLeave(await request(`/leaves/${leaveId}/${action}`, { method: "PATCH", body: { hr_comments: hrComments ?? "" } }));
  }

  static async getLeaveBalances(): Promise<Record<string, LeaveBalance>> {
    return (await request<Json>("/leaves/me")).balances;
  }

  // ---- payroll ----------------------------------------------------------
  static async getEmployeePayroll(employeeId: string, month?: number, year?: number): Promise<PayrollView> {
    const q = new URLSearchParams();
    if (month) q.set("month", String(month));
    if (year) q.set("year", String(year));
    const d = await request<Json>(`/payroll/${encodeURIComponent(employeeId)}${q.size ? `?${q}` : ""}`);
    const e = d.earnings;
    const a = d.attendance_summary;
    return {
      month: a.month,
      year: a.year,
      structure: {
        wage: d.wage,
        basic: e.basic,
        hra: e.hra,
        standardAllowance: e.standard_allowance,
        performanceBonus: e.performance_bonus,
        lta: e.lta,
        fixedAllowance: e.fixed_allowance,
        grossSalary: d.gross_salary,
        pf: d.deductions.pf,
        professionalTax: d.deductions.professional_tax,
        totalDeductions: d.total_deductions,
        netSalary: d.net_salary,
      },
      payableSummary: {
        totalWorkingDays: a.total_working_days,
        totalWorkDays: a.total_working_days,
        payableDays: a.payable_days,
        presentDays: a.present_days,
        approvedLeaves: a.paid_leave_days,
        unpaidDays: a.unpaid_days,
        effectiveNetPayout: a.effective_net_payout,
        payableAmount: a.effective_net_payout,
      },
    };
  }

  static async updateEmployeeWage(employeeId: string, wage: number): Promise<void> {
    await request(`/payroll/${encodeURIComponent(employeeId)}/salary`, { method: "PUT", body: { wage } });
  }

  // ---- notifications ----------------------------------------------------
  static async getNotifications(): Promise<NotificationItem[]> {
    return (await request<Json[]>("/notifications")).map((n) => ({
      id: n.id,
      userId: n.user_id,
      type: n.type,
      title: n.title,
      message: n.message,
      isRead: n.is_read,
      createdAt: n.created_at,
    }));
  }

  static async markNotificationRead(id: string): Promise<void> {
    await request(`/notifications/${id}/read`, { method: "PATCH" });
  }

  // ---- analytics --------------------------------------------------------
  static async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    const d = await request<Json>("/analytics/dashboard");
    const m = d.metrics;
    return {
      metrics: {
        totalEmployees: m.total_employees,
        presentToday: m.present_today,
        absentToday: m.absent_today,
        onLeaveToday: m.on_leave_today,
        pendingLeaves: m.pending_leaves,
        attendanceRate: m.attendance_rate,
        monthlyPayrollTotal: m.monthly_payroll_total,
      },
      departmentDistribution: d.department_distribution,
      attendanceTrends: d.attendance_trends,
    };
  }
}

export { SESSION_KEY };
