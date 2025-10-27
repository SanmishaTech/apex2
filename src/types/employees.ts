export interface Employee {
  id: number;
  name: string;
  userId: number | null;
  departmentId: number | null;
  siteId: number | null;
  resignDate: Date | null;
  // Personal Details
  dateOfBirth: Date | null;
  anniversaryDate: Date | null;
  spouseName: string | null;
  bloodGroup: string | null;
  // Address Details
  addressLine1: string | null;
  addressLine2: string | null;
  stateId: number | null;
  cityId: number | null;
  pincode: string | null;
  // Contact Details
  mobile1: string | null;
  mobile2: string | null;
  // Other Details
  esic: string | null;
  pf: string | null;
  panNo: string | null;
  adharNo: string | null;
  cinNo: string | null;
  signatureImage: string | null;
  employeeImage: string | null;
  createdAt: Date;
  updatedAt: Date;
  department?: {
    id: number;
    department: string;
  } | null;
  siteEmployees?: {
    id: number;
    siteId: number;
    assignedDate: Date;
    site: {
      id: number;
      site: string;
    };
  }[]; // assuming one employee can be linked to multiple siteEmployees
  state?: {
    id: number;
    state: string;
  } | null;
  city?: {
    id: number;
    city: string;
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
