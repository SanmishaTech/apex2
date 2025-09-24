export interface RentType {
  id: number;
  rentType: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentTypesResponse {
  data: RentType[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface CreateRentTypeData {
  rentType: string;
}

export interface UpdateRentTypeData {
  rentType?: string;
}
