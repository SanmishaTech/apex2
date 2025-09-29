// Asset Transfer types and interfaces

import { Asset } from './assets';
import { Site } from './sites';

export interface User {
  id: number;
  name?: string;
  email: string;
}

export interface AssetTransferItem {
  id: number;
  assetTransferId: number;
  assetId: number;
  createdAt: string;
  asset?: Asset;
}

export interface AssetTransfer {
  id: number;
  challanNo: string;
  challanDate: string;
  transferType: string; // "New Assign" or "Transfer"
  fromSiteId?: number;
  toSiteId: number;
  status: string; // "Pending", "Accepted", "Rejected"
  challanCopyUrl?: string;
  approvedById?: number;
  approvedAt?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
  fromSite?: Site;
  toSite?: Site;
  approvedBy?: User;
  transferItems?: AssetTransferItem[];
}

export interface AssetTransferFormData {
  transferType: string;
  challanDate: string;
  fromSiteId: number | null;
  toSiteId: number | null;
  assetIds: number[];
  challanCopyUrl?: string;
  remarks?: string;
}

export interface AssetTransfersResponse {
  data: AssetTransfer[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

// Asset Transfer Type options
export const ASSET_TRANSFER_TYPE_OPTIONS = [
  { value: "New Assign", label: "New Assign" },
  { value: "Transfer", label: "Transfer" },
];

// Asset Transfer Status options
export const ASSET_TRANSFER_STATUS_OPTIONS = [
  { value: "Pending", label: "Pending" },
  { value: "Accepted", label: "Accepted" },
  { value: "Rejected", label: "Rejected" },
];

// Asset Transfer Status options for display
export const ASSET_TRANSFER_STATUS_COLORS = {
  "Pending": "bg-yellow-100 text-yellow-800",
  "Accepted": "bg-green-100 text-green-800",
  "Rejected": "bg-red-100 text-red-800",
};
