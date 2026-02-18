// Base types for related models
interface User {
  id: number;
  name: string | null;
  email: string;
  role: string;
}

interface Site {
  id: number;
  site: string;
  siteCode?: string | null;
  company?: {
    id: number;
    companyName: string;
  } | null;
  state?: {
    id: number;
    state: string;
  } | null;
  city?: {
    id: number;
    city: string;
  } | null;
  siteDeliveryAddresses?: SiteDeliveryAddress[];
}

interface Vendor {
  id: number;
  vendorName: string;
  gstNumber?: string | null;
  contactPerson?: string | null;
  mobile1?: string | null;
  email?: string | null;
}

interface BillingAddress {
  id: number;
  companyName: string;
  addressLine1: string;
  addressLine2?: string | null;
  state?: {
    id: number;
    state: string;
  } | null;
  city?: {
    id: number;
    city: string;
  } | null;
  pincode?: string | null;
  gstNumber?: string | null;
}

interface PaymentTerm {
  id: number;
  paymentTerm: string;
  days: number;
  description?: string;
}

interface Item {
  id: number;
  itemCode: string;
  item: string;
  unit?: {
    id: number;
    unitName: string;
  } | null;
}

interface SiteDeliveryAddress {
  id: number;
  siteId: number;
  addressLine1?: string | null;
  addressLine2?: string | null;
  stateId?: number | null;
  cityId?: number | null;
  pinCode?: string | null;
}

export interface PoAdditionalCharge {
  id: number;
  purchaseOrderId: number;
  head: string;
  gstCharge: string;
  amount?: number | null;
  amountWithGst?: number | null;
}

// Main Purchase Order Types
export interface PurchaseOrder {
  id: number;
  siteId: number;
  vendorId: number;
  billingAddressId: number;
  siteDeliveryAddressId: number;
  paymentTermId?: number | null;
  poPaymentTerms?: {
    paymentTermId: number;
    paymentTerm: PaymentTerm;
  }[];
  purchaseOrderNo: string;
  purchaseOrderDate: string;
  deliveryDate: string;
  quotationNo?: string | null;
  quotationDate?: string | null;
  transport?: string | null;
  note?: string | null;
  terms?: string | null;
  paymentTermsInDays?: number | null;
  deliverySchedule?: string | null;
  amount?: number | null;
  totalCgstAmount?: number | null;
  totalSgstAmount?: number | null;
  totalIgstAmount?: number | null;
  exciseTaxStatus?: string | null;
  exciseTaxAmount?: string | number | null;
  octroiTaxStatus?: string | null;
  octroiTaxAmount?: string | number | null;
  approvalStatus:
    | "DRAFT"
    | "APPROVED_LEVEL_1"
    | "APPROVED_LEVEL_2"
    | "COMPLETED"
    | "SUSPENDED";
  isApproved1: boolean;
  isApproved2: boolean;
  isSuspended: boolean;
  isComplete: boolean;
  billStatus?: string | null;
  remarks?: string | null;
  createdById: number;
  updatedById: number;
  approved1ById?: number | null;
  approved2ById?: number | null;
  suspendedById?: number | null;
  completedById?: number | null;
  createdAt: string;
  updatedAt: string;
  approved1At?: string | null;
  approved2At?: string | null;
  suspendedAt?: string | null;
  completedAt?: string | null;
  revision?: number | null;
  poStatus?: "ORDER_PLACED" | "IN_TRANSIT" | "RECEIVED" | "HOLD" | "OPEN";
  transitInsuranceStatus: string | null | undefined;
  transitInsuranceAmount: number | null | undefined | string;
  pfStatus: string | null | undefined;
  pfCharges: number | null | undefined | string;
  gstReverseStatus: string | null | undefined;
  gstReverseAmount: number | null | undefined | string;
  // Relations
  site: Site;
  vendor: Vendor;
  billingAddress: BillingAddress;
  siteDeliveryAddress: SiteDeliveryAddress;
  paymentTerm?: PaymentTerm | null;
  createdBy: User;
  updatedBy: User;
  approved1By?: User | null;
  approved2By?: User | null;
  suspendedBy?: User | null;
  completedBy?: User | null;
  purchaseOrderDetails: PurchaseOrderDetail[];
  poAdditionalCharge?: PoAdditionalCharge[];
  purchaseOrderIndent?: Array<{
    indent: {
      id: number;
      indentNo: string | null;
      indentDate: string;
    };
  }>;
}

export interface PurchaseOrderDetail {
  id: number;
  serialNo: number;
  purchaseOrderId: number;
  itemId: number;
  remark?: string | null;
  qty?: number | null;
  orderedQty?: number | null;
  approved1Qty?: number | null;
  approved2Qty?: number | null;
  receivedQty?: number | null;
  rate?: number | null;
  discountPercent?: number | null;
  disAmt?: number | null;
  tax?: number | null;
  taxAmt?: number | null;
  cgstPercent?: number | null;
  cgstAmt?: number | null;
  sgstPercent?: number | null;
  sgstAmt?: number | null;
  igstPercent?: number | null;
  igstAmt?: number | null;
  amount?: number | null;
  createdAt: string;
  updatedAt: string;

  // Relations
  item: Item;
  purchaseOrder: PurchaseOrder;
}

// API Response Types
export interface PurchaseOrdersResponse {
  data: PurchaseOrder[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

// Request Types
export interface CreatePurchaseOrderRequest {
  indentIds?: number[];
  siteId: number;
  vendorId: number;
  billingAddressId: number;
  siteDeliveryAddressId: number;
  paymentTermIds?: number[];
  purchaseOrderDate: string;
  deliveryDate: string;
  quotationNo?: string;
  quotationDate?: string;
  transport?: string;
  note?: string;
  terms?: string;
  paymentTermsInDays?: number;
  deliverySchedule?: string;
  poAdditionalCharges?: {
    id?: number;
    head: string;
    gstCharge: string;
    amount?: number;
    amountWithGst?: number;
  }[];
  purchaseOrderItems: {
    itemId: number;
    qty: number;
    rate: number;
    remark?: string;
    discountPercent?: number;
    cgstPercent?: number;
    sgstPercent?: number;
    igstPercent?: number;
  }[];
}

export interface UpdatePurchaseOrderRequest
  extends Partial<CreatePurchaseOrderRequest> {
  id: number;
}

export interface UpdatePurchaseOrderStatusRequest {
  statusAction: "approve1" | "approve2" | "complete" | "suspend" | "unsuspend";
  remarks?: string;
}

// For dropdowns and selects
export interface PurchaseOrderSelectOption {
  value: number;
  label: string;
  purchaseOrderNo: string;
  vendorName: string;
  amount: number;
  status: string;
}

// For form values
export interface PurchaseOrderFormValues
  extends Omit<CreatePurchaseOrderRequest, "purchaseOrderItems"> {
  purchaseOrderItems: {
    id?: number;
    itemId: number;
    item?: Item;
    qty: number | string;
    rate: number | string;
    remark?: string;
    discountPercent?: number | string;
    cgstPercent?: number | string;
    sgstPercent?: number | string;
    igstPercent?: number | string;
    amount?: number;
  }[];
}
