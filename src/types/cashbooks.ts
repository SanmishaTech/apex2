// Cashbook type definitions following established patterns

export interface CashbookHead {
  id: number;
  cashbookHeadName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  id: number;
  site: string;
}

export interface Boq {
  id: number;
  boqNo: string | null;
}

export interface UserLite {
  id: number;
  name: string | null;
  email: string;
}

export interface CashbookDetail {
  id?: number;
  cashbookId?: number;
  cashbookHeadId: number;
  cashbookHead?: CashbookHead;
  description?: string | null;
  openingBalance?: number | null;
  closingBalance?: number | null;
  amountReceived?: number | null;
  amountPaid?: number | null;
  documentUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Cashbook {
  id: number;
  voucherNo: string | null;
  voucherDate: string;
  siteId: number | null;
  boqId: number | null;
  attachVoucherCopyUrl: string | null;
  createdById?: number;
  updatedById?: number;
  isApproved1?: boolean;
  approved1ById?: number | null;
  approved1At?: string | null;
  isApproved2?: boolean;
  approved2ById?: number | null;
  approved2At?: string | null;
  createdBy?: UserLite | null;
  approved1By?: UserLite | null;
  approved2By?: UserLite | null;
  site?: Site | null;
  boq?: Boq | null;
  cashbookDetails?: CashbookDetail[];
  createdAt: string;
  updatedAt: string;
}

export interface CashbooksResponse {
  data: Cashbook[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface CreateCashbookRequest {
  voucherDate: string;
  siteId: number | null;
  boqId: number | null;
  attachVoucherCopyUrl?: string | null;
  cashbookDetails: Array<{
    cashbookHeadId: number;
    description?: string | null;
    openingBalance?: number | null;
    closingBalance?: number | null;
    amountReceived?: number | null;
    amountPaid?: number | null;
    documentUrl?: string | null;
  }>;
}

export interface UpdateCashbookRequest extends Partial<CreateCashbookRequest> {
  cashbookDetails?: Array<{
    id?: number;
    cashbookHeadId: number;
    description?: string | null;
    openingBalance?: number | null;
    closingBalance?: number | null;
    amountReceived?: number | null;
    amountPaid?: number | null;
    documentUrl?: string | null;
  }>;
}
