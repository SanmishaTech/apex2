export interface Notice {
  id: number;
  noticeHead: string;
  noticeHeading: string;
  noticeDescription?: string | null;
  documentUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoticeFormData {
  noticeHead: string;
  noticeHeading: string;
  noticeDescription?: string;
}

export interface NoticeInitialData {
  id?: number;
  noticeHead?: string;
  noticeHeading?: string;
  noticeDescription?: string | null;
  documentUrl?: string | null;
}

export interface NoticesResponse {
  data: Notice[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface NoticesListResponse extends NoticesResponse {}
