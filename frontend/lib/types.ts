export type Role = "SUPER_ADMIN" | "ADMIN" | "HR" | "EMPLOYEE";
export type EmployeeStatus = "ACTIVE" | "ON_LEAVE" | "TERMINATED";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "HALF_DAY" | "ON_LEAVE";
export type LeaveType = "PAID" | "SICK" | "CASUAL" | "UNPAID";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Employee {
  id: string;
  userId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  joiningDate: string;
  status: EmployeeStatus;
  avatarUrl: string;
  address: string;
  emergencyContact: EmergencyContact;
  wage: number;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  department?: string;
  workDate: string;
  checkIn: string | null;
  checkOut: string | null;
  totalHours: number;
  status: AttendanceStatus;
  notes?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  avatarUrl: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  hrComments?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface LeaveBalance {
  allocated: number;
  used: number;
  remaining: number;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface CompanyTenant {
  id: string;
  name: string;
  slug: string;
  domain: string;
  plan: "Starter" | "Growth" | "Enterprise";
  adminName: string;
  adminEmail: string;
  employeeCount: number;
  status: "ACTIVE" | "PENDING_SETUP" | "SUSPENDED";
  maxEmployees: number | null;
  createdAt: string;
}

export interface CompanyInquiry {
  id: string;
  companyName: string;
  contactName: string;
  workEmail: string;
  phone: string;
  teamSize: string;
  planInterest: "Starter" | "Growth" | "Enterprise";
  message: string;
  status: "NEW" | "PROVISIONED" | "CONTACTED";
  createdAt: string;
}

export interface UserSession {
  id: string;
  email: string;
  role: Role;
  employee: Employee;
  token: string;
  mustChangePassword?: boolean;
  companyId?: string;
  companyName?: string;
}

