import { Unit } from "./units";

export interface SubContractorInvoiceDetail {
  id: number;
  subContractorInvoiceId: number;
  subContractorWorkOrderDetailId: number;
  subContractorWorkOrderDetail: {
    id: number;
    item: string;
    sacCode?: string;
    unit?: Unit;
    qty: number;
    executedQty: number;
    rate: number;
  };
  particulars: string;
  workOrderQty: number;
  currentBillQty: number;
  rate: number;
  discountPercent?: number;
  discountAmount?: number;
  cgstPercent?: number;
  sgstpercent?: number;
  igstPercent?: number;
  cgstAmt?: number;
  sgstAmt?: number;
  igstAmt?: number;
  totalLineAmount: number;
}

export interface SubContractorInvoice {
  id: number;
  siteId: number;
  site: {
    id: number;
    site: string;
    siteCode?: string;
  };
  subcontractorWorkOrderId: number;
  subcontractorWorkOrder: {
    id: number;
    workOrderNo: string;
    subContractor: {
      id: number;
      name: string;
      contactPerson?: string;
      contactNo?: string;
      email?: string;
    };
    vendor?: {
      id: number;
      vendorName: string;
      gstNumber?: string;
    };
    billingAddress?: {
      id: number;
      companyName: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: { city: string };
      state?: { state: string };
      pincode?: string;
      gstNumber?: string;
    };
    subContractorWorkOrderDetails: Array<{
      id: number;
      item: string;
      sacCode?: string;
      unit?: Unit;
      qty: number;
      executedQty: number;
      rate: number;
      cgst?: number;
      sgst?: number;
      igst?: number;
    }>;
  };
  invoiceNumber: string;
  invoiceDate: string;
  fromDate?: string;
  toDate?: string;
  grossAmount: number;
  retentionAmount?: number;
  tds?: number;
  lwf?: number;
  otherDeductions?: number;
  netPayable: number;
  status: "PENDING" | "APPROVED" | "PAID";
  isAuthorized: boolean;
  createdAt: string;
  updatedAt: string;
  revision: string;
  createdById: number;
  updatedById: number;
  authorizedById?: number;
  createdBy?: { id: number; name: string };
  updatedBy?: { id: number; name: string };
  authorizedBy?: { id: number; name: string };
  subContractorInvoiceDetails: SubContractorInvoiceDetail[];
}

export interface SubContractorInvoicesResponse {
  data: SubContractorInvoice[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateSubContractorInvoiceRequest {
  siteId: number;
  subcontractorWorkOrderId: number;
  invoiceNumber: string;
  invoiceDate: string;
  fromDate?: string;
  toDate?: string;
  grossAmount: number;
  retentionAmount?: number;
  tds?: number;
  lwf?: number;
  otherDeductions?: number;
  netPayable: number;
  status: "PENDING";
  invoiceItems: {
    subContractorWorkOrderDetailId: number;
    particulars: string;
    workOrderQty: number;
    currentBillQty: number;
    rate: number;
    discountPercent?: number;
    discountAmount?: number;
    cgstPercent?: number;
    sgstpercent?: number;
    igstPercent?: number;
    cgstAmt?: number;
    sgstAmt?: number;
    igstAmt?: number;
    totalLineAmount: number;
  }[];
}

export interface UpdateSubContractorInvoiceRequest extends Partial<CreateSubContractorInvoiceRequest> {
  id: number;
  statusAction?: "authorize" | "markPaid";
  remarks?: string;
}
