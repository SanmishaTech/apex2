export interface AssetCategory {
  id: number;
  assetGroupId: number;
  category: string;
  createdAt: string;
  updatedAt: string;
  assetGroup: {
    id: number;
    assetGroup: string;
  };
}

export interface AssetCategoriesResponse {
  data: AssetCategory[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface CreateAssetCategoryData {
  assetGroupId: number;
  category: string;
}

export interface UpdateAssetCategoryData {
  assetGroupId?: number;
  category?: string;
}

// Simple AssetGroup interface for dropdowns
export interface AssetGroupOption {
  id: number;
  assetGroup: string;
}
