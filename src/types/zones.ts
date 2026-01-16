export interface Zone {
  id: number;
  zoneName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ZonesResponse {
  data: Zone[];
  meta?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}
