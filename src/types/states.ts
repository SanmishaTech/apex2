export interface State {
  id: number;
  state: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StatesResponse {
  data: State[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateStateData {
  state: string;
}

export interface UpdateStateData {
  state?: string;
}
