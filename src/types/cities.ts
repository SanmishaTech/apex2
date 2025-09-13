export interface City {
  id: number;
  city: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
  stateId?: number | null;
  state?: {
    id: number;
    state: string;
  } | null;
}

export interface CitiesResponse {
  data: City[];
  page: number; 
  perPage: number; 
  total: number; 
  totalPages: number; 
}

export interface CreateCityData {
  city: string;
  status: boolean;
  stateId?: number | null;
}

export interface UpdateCityData {
  city?: string;
  status?: boolean;
  stateId?: number | null;
}
