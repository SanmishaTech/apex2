export interface IndentItem {
  id: number;
  itemId?: number;
  item?: {
    id: number;
    itemCode: string;
    item: string;
  };
  remark?: string;
  indentQty: number;
  approved1Qty?: number;
  approved2Qty?: number;
}

export interface Indent {
  id: number;
  indentNo?: string;
  indentDate: string;
  deliveryDate: string;
  siteId?: number;
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
