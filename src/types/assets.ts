// Asset types and interfaces

export interface AssetGroup {
  id: number;
  assetGroup: string;
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
  assetGroupId: number;
  assetCategoryId: number;
  assetName: string;
  make?: string;
  description?: string;
  purchaseDate?: string;
  invoiceNo?: string;
  supplier?: string;
  invoiceCopyUrl?: string;
  nextMaintenanceDate?: string;
  status: string;
  useStatus: string;
  createdAt: string;
  updatedAt: string;
  assetGroup?: AssetGroup;
  assetCategory?: AssetCategory;
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
  { value: "Available", label: "Available" },
  { value: "Under Maintenance", label: "Under Maintenance" },
  { value: "Reserved", label: "Reserved" },
];
