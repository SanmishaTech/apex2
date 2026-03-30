import { Site, BillingAddress, Vendor, PaymentTerm, User, Unit } from "./purchase-orders";

export interface SubContractor {
  id: number;
  name: string;
  subContractorCode?: string | null;
  gstNumber?: string | null;
  email?: string | null;
  mobile1?: string | null;
}

export interface Boq {
  id: number;
  boqNo: string;
}

export interface SubContractorWorkOrder {
  id: number;
  siteId: number;
  boqId: number;
  subContractorId: number;
  billingAddressId: number;
  vendorId: number;
  workOrderNo: string;
  workOrderDate: string;
  typeOfWorkOrder: string;
  quotationNo?: string | null;
  quotationDate?: string | null;
  paymentTermsInDays?: number | null;
  deliveryDate?: string | null;
  note?: string | null;
  terms?: string | null;
  deliverySchedule?: string | null;
  totalAmount: number;
  totalCgst?: number | null;
  totalSgst?: number | null;
  totalIgst?: number | null;
  amountInWords: string;
  isApproved1: boolean;
  approved1ById?: number | null;
  approved1At?: string | null;
  isApproved2: boolean;
  approved2ById?: number | null;
  approved2At?: string | null;
  status: string;
  isSuspended: boolean;
  suspendedById?: number | null;
  suspendedDatetime?: string | null;
  isCompleted?: boolean | null;
  completedById?: number | null;
  completedDatetime?: string | null;
  createdById: number;
  updatedById: number;
  createdAt: string;
  updatedAt: string;

  // Relations
  subContractor: SubContractor;
  site: Site;
  boq: Boq;
  billingAddress: BillingAddress;
  vendor: Vendor;
  approved1By?: User | null;
  approved2By?: User | null;
  suspendedBy?: User | null;
  completedBy?: User | null;
  createdBy: User;
  updatedBy: User;
  subContractorWorkOrderDetails: SubContractorWorkOrderDetail[];
  subContractorWorkOrderPaymentTerms?: {
    paymentTermId: number;
    paymentTerm: PaymentTerm;
  }[];
}

export interface SubContractorWorkOrderDetail {
  id: number;
  subContractorWorkOrderId: number;
  boqItemId?: number | null;
  item?: string | null;
  sacCode?: string | null;
  unitId: number;
  qty: number;
  // orderedQty, approved1Qty and approved2Qty columns removed from DB; no longer present
  rate?: number | null;
  cgst?: number | null;
  cgstAmt?: number | null;
  sgst?: number | null;
  sgstAmt?: number | null;
  igst?: number | null;
  igstAmt?: number | null;
  amount?: number | null;
  particulars?: string | null;

  // Relations
  unit: Unit;
  subContractorWorkOrder: SubContractorWorkOrder;
}

export interface SubContractorWorkOrdersResponse {
  data: SubContractorWorkOrder[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateSubContractorWorkOrderRequest {
  siteId: number;
  boqId: number;
  subContractorId: number;
  billingAddressId: number;
  vendorId: number;
  workOrderDate: string;
  typeOfWorkOrder: string;
  quotationNo?: string;
  quotationDate?: string;
  paymentTermsInDays?: number;
  deliveryDate?: string;
  note?: string;
  terms?: string;
  deliverySchedule?: string;
  amountInWords: string;
  paymentTermIds?: number[];
  workOrderItems: {
    boqItemId?: number;
    item?: string;
    sacCode?: string;
    unitId: number;
    qty: number;
    rate: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    particulars?: string;
  }[];
}

export interface UpdateSubContractorWorkOrderRequest extends Partial<CreateSubContractorWorkOrderRequest> {
  id: number;
}

export interface UpdateSubContractorWorkOrderStatusRequest {
  statusAction: "approve1" | "approve2" | "complete" | "suspend" | "unsuspend";
  remarks?: string;
}

export interface SubContractorWorkOrderFormValues extends Omit<CreateSubContractorWorkOrderRequest, "workOrderItems"> {
  workOrderItems: {
    id?: number;
    boqItemId?: number;
    item?: string;
    sacCode?: string;
    unitId: number;
    unit?: Unit;
    qty: number | string;
    rate: number | string;
    cgst?: number | string;
    sgst?: number | string;
    igst?: number | string;
    amount?: number;
    particulars?: string;
  }[];
}
