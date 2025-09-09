export type CurrentUser = {
  id: number;
  name: string | null;
  email: string;
  role: string;
  profilePhoto: string | null;
  status: boolean;
  lastLogin: Date | null;
};
