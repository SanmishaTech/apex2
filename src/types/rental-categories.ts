export interface RentalCategory {
  id: number;
  rentalCategory: string;
  createdAt: string;
  updatedAt: string;
}

export interface RentalCategoriesResponse {
  data: RentalCategory[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}
