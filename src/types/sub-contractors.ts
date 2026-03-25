export interface SubContractor {
  id: number;
  code: string;
  name: string;
  contactPerson?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  pinCode?: string | null;
  stateId?: number | null;
  cityId?: number | null;
  bankName?: string | null;
  branchName?: string | null;
  branchCode?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  panNumber?: string | null;
  gstNumber?: string | null;
  cinNumber?: string | null;
  vatTinNumber?: string | null;
  cstTinNumber?: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: number;
  updatedById: number;
  state?: {
    id: number;
    state: string;
  } | null;
  city?: {
    id: number;
    city: string;
  } | null;
  subContractorContacts?: SubContractorContact[];
}

export interface SubContractorContact {
  id: number;
  subContractorId: number;
  contactPersonName: string;
  mobile?: string | null;
  email?: string | null;
}

export interface SubContractorsResponse {
  data: SubContractor[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface CreateSubContractorData {
  code: string;
  name: string;
  contactPerson?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  pinCode?: string | null;
  stateId?: number | null;
  cityId?: number | null;
  bankName?: string | null;
  branchName?: string | null;
  branchCode?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  panNumber?: string | null;
  gstNumber?: string | null;
  cinNumber?: string | null;
  vatTinNumber?: string | null;
  cstTinNumber?: string | null;
  subContractorContacts?: Omit<SubContractorContact, "id" | "subContractorId">[];
}

export interface UpdateSubContractorData extends Partial<CreateSubContractorData> {
  subContractorContacts?: (Partial<SubContractorContact> & { contactPersonName: string })[];
}
