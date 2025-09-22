export interface IndentItem {
  id: number;
  itemId?: number;
  item: string; // Keep for display, but use itemId for relations
  closingStock: number;
  unitId?: number;
  unit: string; // Keep for display, but use unitId for relations
  remark?: string;
  indentQty: number;
  deliveryDate: string;
}

export interface Indent {
  id: number;
  indentNo?: string;
  indentDate: string;
  siteId?: number;
  deliveryDate: string;
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
  deliveryDate: string;
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

export interface UpdateIndentRequest {
  indentDate?: string;
  siteId?: number;
  deliveryDate?: string;
  remarks?: string;
  indentItems?: {
    id?: number;
    itemId: number;
    closingStock: number;
    unitId: number;
    remark?: string;
    indentQty: number;
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
