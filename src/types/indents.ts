export interface IndentItem {
  id: number;
  itemId?: number;
  item?: {
    id: number;
    itemCode: string;
    item: string;
    unitId?: number;
    unit?: {
      id: number;
      unitName: string;
    };
  };
  remark?: string;
  indentQty: number;
  approved1Qty?: number;
  approved2Qty?: number;
  purchaseOrderDetailId?: number | null;
}

export interface Indent {
  id: number;
  indentNo?: string;
  indentDate: string;
  deliveryDate: string;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  siteId?: number;
  createdById?: number | null;
  approved1ById?: number | null;
  approved2ById?: number | null;
  approved1At?: string | null;
  approved2At?: string | null;
  suspendedById?: number | null;
  suspendedAt?: string | null;
  completedById?: number | null;
  completedAt?: string | null;
  createdBy?: { id: number; name: string | null } | null;
  approved1By?: { id: number; name: string | null } | null;
  approved2By?: { id: number; name: string | null } | null;
  suspendedBy?: { id: number; name: string | null } | null;
  completedBy?: { id: number; name: string | null } | null;
  approvalStatus?:
    | "DRAFT"
    | "APPROVED_LEVEL_1"
    | "APPROVED_LEVEL_2"
    | "COMPLETED"
    | "SUSPENDED";
  suspended?: boolean;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  site?: {
    id: number;
    site: string;
  };
  indentItems?: IndentItem[];
}

export interface IndentsResponse {
  data: Indent[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateIndentRequest {
  indentDate: string;
  deliveryDate: string;
  siteId?: number;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  remarks?: string;
  indentItems: {
    itemId: number;
    remark?: string;
    indentQty: number;
    approved1Qty?: number;
    approved2Qty?: number;
  }[];
}

// For status updates from index page
export interface UpdateIndentStatusRequest {
  statusAction: "approve1" | "approve2" | "complete" | "suspend" | "unsuspend";
}

export interface UpdateIndentRequest {
  indentDate?: string;
  deliveryDate?: string;
  siteId?: number;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  remarks?: string;
  indentItems?: {
    id?: number;
    itemId: number;
    remark?: string;
    indentQty: number;
    approved1Qty?: number;
    approved2Qty?: number;
  }[];
}

export interface Site {
  id: number;
  site: string;
}

export interface SitesResponse {
  data: Site[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}
