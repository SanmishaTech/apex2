export interface Designation {
  id: number;
  designationName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DesignationsResponse {
  data: Designation[];
  meta?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}
