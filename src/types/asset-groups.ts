export interface AssetGroup {
  id: number;
  assetGroup: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetGroupsResponse {
  data: AssetGroup[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface CreateAssetGroupData {
  assetGroup: string;
}

export interface UpdateAssetGroupData {
  assetGroup?: string;
}
