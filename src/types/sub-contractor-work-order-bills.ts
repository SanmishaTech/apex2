export interface SubContractorWorkOrderBill {
  id: number;
  subContractorWorkOrderId: number;
  billNo: string;
  billDate: string;
  billAmount: number;
  paidAmount?: number | null;
  dueAmount: number;
  dueDate: string;
  paymentDate?: string | null;
  paymentMode: string;
  chequeNo?: string | null;
  chequeDate?: string | null;
  utrNo?: string | null;
  bankName?: string | null;
  rtgsDate?: string | null;
  neftDate?: string | null;
  transactionNo?: string | null;
  transactionDate?: string | null;
  deductionTax?: number;
  status: "PAID" | "UNPAID" | "PARTIALLY_PAID";
  createdAt: string;
  updatedAt: string;
  subContractorWorkOrder?: {
    id: number;
    workOrderNo: string;
  } | null;
}

export interface SubContractorWorkOrderBillsResponse {
  data: SubContractorWorkOrderBill[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface CreateSubContractorWorkOrderBillData {
  subContractorWorkOrderId: number;
  billNo: string;
  billDate: string;
  billAmount: number;
  paidAmount?: number;
  dueAmount?: number;
  dueDate: string;
  paymentDate?: string | null;
  paymentMode: string;
  chequeNo?: string | null;
  chequeDate?: string | null;
  utrNo?: string | null;
  bankName?: string | null;
  rtgsDate?: string | null;
  neftDate?: string | null;
  transactionNo?: string | null;
  transactionDate?: string | null;
  deductionTax?: number;
  status: "PAID" | "UNPAID" | "PARTIALLY_PAID";
}

export interface UpdateSubContractorWorkOrderBillData extends Partial<CreateSubContractorWorkOrderBillData> {}
