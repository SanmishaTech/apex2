export interface Department {
  id: number;
  department: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentsResponse {
  data: Department[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface CreateDepartmentData {
  department: string;
}

export interface UpdateDepartmentData {
  department?: string;
}
