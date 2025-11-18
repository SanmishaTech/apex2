export interface WorkOrderBill {
  id: number;
  workOrderId: number;
  billNo: string;
  billDate: string;
  billAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate: string;
  paymentDate: string;
  paymentMode: string;
  chequeNo?: string | null;
  chequeDate?: string | null;
  utrNo?: string | null;
  bankName?: string | null;
  deductionTax: number;
  status: "PAID" | "UNPAID" | "PARTIALLY_PAID";
  createdAt: string;
  updatedAt: string;
  workOrder?: {
    id: number;
    workOrderNo: string;
  } | null;
}

export interface WorkOrderBillsResponse {
  data: WorkOrderBill[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface CreateWorkOrderBillData {
  workOrderId: number;
  billNo: string;
  billDate: string;
  billAmount: number;
  paidAmount?: number;
  dueAmount?: number;
  dueDate: string;
  paymentDate: string;
  paymentMode: string;
  chequeNo?: string | null;
  chequeDate?: string | null;
  utrNo?: string | null;
  bankName?: string | null;
  deductionTax?: number;
  status: "PAID" | "UNPAID" | "PARTIALLY_PAID";
}

export interface UpdateWorkOrderBillData extends Partial<CreateWorkOrderBillData> {}
