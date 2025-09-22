export interface Unit {
  id: number;
  unitName: string;
  createdAt: string;
  updatedAt: string;
}

export interface UnitsResponse {
  data: Unit[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}
