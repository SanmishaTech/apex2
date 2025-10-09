export interface IndentItem {
  id: number;
  itemId?: number;
  item?: {
    id: number;
    itemCode: string;
    item: string;
  };
  closingStock: number;
  unitId?: number;
  unit?: {
    id: number;
    unitName: string;
  };
  remark?: string;
  indentQty: number;
  approvedQty?: number;
  deliveryDate: string;
}

export interface Indent {
  id: number;
  indentNo?: string;
  indentDate: string;
  siteId?: number;
  approvalStatus?: 'DRAFT' | 'APPROVED_1' | 'APPROVED_2' | 'COMPLETED';
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
  siteId?: number;
  remarks?: string;
  indentItems: {
    itemId: number;
    closingStock: number;
    unitId: number;
    remark?: string;
    indentQty: number;
    deliveryDate: string;
  }[];
}

// For status updates from index page
export interface UpdateIndentStatusRequest {
  statusAction: 'approve1' | 'approve2' | 'complete' | 'suspend' | 'unsuspend';
}

export interface UpdateIndentRequest {
  indentDate?: string;
  siteId?: number;
  remarks?: string;
  indentItems?: {
    id?: number;
    itemId: number;
    closingStock: number;
    unitId: number;
    remark?: string;
    indentQty: number;
    approvedQty?: number;
    deliveryDate: string;
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
