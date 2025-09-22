export interface Item {
  id: number;
  itemCode: string;
  hsnCode?: string;
  item: string;
  itemCategoryId?: number;
  createdAt: string;
  updatedAt: string;
  itemCategory?: {
    id: number;
    itemCategory: string;
  };
}

export interface ItemsResponse {
  data: Item[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}
