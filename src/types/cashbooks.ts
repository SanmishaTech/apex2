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

export interface CashbookDetail {
  id?: number;
  cashbookId?: number;
  cashbookHeadId: number;
  cashbookHead?: CashbookHead;
  description?: string | null;
  openingQuantity?: number | null;
  closingQuantity?: number | null;
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
    openingQuantity?: number | null;
    closingQuantity?: number | null;
  }>;
}

export interface UpdateCashbookRequest extends Partial<CreateCashbookRequest> {
  cashbookDetails?: Array<{
    id?: number;
    cashbookHeadId: number;
    description?: string | null;
    openingQuantity?: number | null;
    closingQuantity?: number | null;
  }>;
}
