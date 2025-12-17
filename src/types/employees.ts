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
  // Travel/Reporting Details
  airTravelClass?: string | null;
  railwayTravelClass?: string | null;
  busTravelClass?: string | null;
  reporting1Id?: number | null;
  reporting2Id?: number | null;
  reportingSiteId?: number | null;
  reportingSiteAssignedDate?: Date | null;
  // Leave Details
  sickLeavesPerYear?: number | null;
  paidLeavesPerYear?: number | null;
  casualLeavesPerYear?: number | null;
  balanceSickLeaves?: number | null;
  balancePaidLeaves?: number | null;
  balanceCasualLeaves?: number | null;
  signatureImage: string | null;
  employeeImage: string | null;
  createdAt: Date;
  updatedAt: Date;
  department?: {
    id: number;
    department: string;
  } | null;
  employeeDocuments?: {
    id: number;
    documentName: string | null;
    documentUrl: string | null;
  }[];
  siteEmployees?: {
    id: number;
    siteId: number;
    assignedDate: Date;
    site: {
      id: number;
      site: string;
      shortName?: string | null;
      company?: {
        id: number;
        companyName: string;
        shortName?: string | null;
      } | null;
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
  user?: {
    id: number;
    email: string;
    role: string;
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
