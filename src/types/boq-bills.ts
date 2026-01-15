export type BoqBillStatus = "DRAFT" | "FINAL";

export interface BoqBillDetailRow {
  id: number;
  boqBillId: number;
  boqItemId: number;
  qty: number;
  amount: number;
  boqItem?: {
    id: number;
    activityId?: string | null;
    clientSrNo?: string | null;
    item?: string | null;
    unit?: { unitName: string } | null;
    rate?: number | string | null;
  } | null;
}

export interface BoqBill {
  id: number;
  boqId: number;
  billNumber: string;
  billName: string;
  billDate: string;
  remarks?: string | null;
  totalBillAmount?: number;
  createdAt: string;
  updatedAt: string;
  boq?: {
    id: number;
    boqNo: string | null;
    site?: { id: number; site: string } | null;
    workName?: string | null;
  } | null;
  boqBillDetails?: BoqBillDetailRow[];
  totalAmount?: number;
}

export interface BoqBillsResponse {
  data: BoqBill[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface CreateBoqBillData {
  boqId: number;
  billNumber: string;
  billName: string;
  billDate: string;
  remarks?: string | null;
  details: Array<{ boqItemId: number; qty: number }>;
}

export type UpdateBoqBillData = Partial<CreateBoqBillData>;
