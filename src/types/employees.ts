export interface Employee {
  id: number;
  name: string;
  departmentId: number | null;
  siteId: number | null;
  resignDate: string | null;
  createdAt: string;
  updatedAt: string;
  department?: {
    id: number;
    department: string;
  } | null;
  site?: {
    id: number;
    site: string;
  } | null;
}

export interface EmployeesResponse {
  data: Employee[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface CreateEmployeeData {
  name: string;
  departmentId?: number;
  siteId?: number;
  resignDate?: string;
}

export interface UpdateEmployeeData {
  name?: string;
  departmentId?: number;
  siteId?: number;
  resignDate?: string;
}

export interface EmployeeFormData {
  name: string;
  departmentId: number | null;
  siteId: number | null;
  resignDate: Date | null;
}
