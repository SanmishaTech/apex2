// Asset types and interfaces

export interface AssetGroup {
  id: number;
  assetGroupName: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetCategory {
  id: number;
  assetGroupId: number;
  category: string;
  createdAt: string;
  updatedAt: string;
  assetGroup?: AssetGroup;
}

export interface Asset {
  id: number;
  assetNo: string;
  assetName: string;
  make?: string | null;
  description?: string | null;
  status: string;
  useStatus: string;
  purchaseDate?: string | null;
  nextMaintenanceDate?: string | null;
  supplier?: string | null;
  invoiceNo?: string | null;
  invoiceCopyUrl?: string | null;
  assetGroupId?: number | null;
  assetCategoryId?: number | null;
  transferStatus?: string;
  currentSiteId?: number | null;
  createdAt: string;
  updatedAt: string;
  assetGroup?: {
    id: number;
    assetGroupName: string;
  } | null;
  assetCategory?: {
    id: number;
    category: string;
  } | null;
  currentSite?: {
    id: number;
    shortName?: string | null;
    site?: string | null;
  } | null;
}

export interface AssetFormData {
  assetGroupId: number | null;
  assetCategoryId: number | null;
  assetName: string;
  make: string;
  description: string;
  purchaseDate: string;
  invoiceNo: string;
  supplier: string;
  invoiceCopyUrl?: string;
  nextMaintenanceDate: string;
  status: string;
  useStatus: string;
}

export interface AssetsResponse {
  data: Asset[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface AssetGroupsResponse {
  data: AssetGroup[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface AssetCategoriesResponse {
  data: AssetCategory[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

// Asset status options
export const ASSET_STATUS_OPTIONS = [
  { value: "Working", label: "Working" },
  { value: "Under Repair", label: "Under Repair" },
  { value: "Out of Order", label: "Out of Order" },
  { value: "Scrapped", label: "Scrapped" },
];

// Asset use status options
export const ASSET_USE_STATUS_OPTIONS = [
  { value: "In Use", label: "In Use" },
  { value: "Spare", label: "Spare" },
];

// Asset transfer status options
export const ASSET_TRANSFER_STATUS_OPTIONS = [
  { value: "Available", label: "Available" },
  { value: "In Transit", label: "In Transit" },
  { value: "Assigned", label: "Assigned" },
];
