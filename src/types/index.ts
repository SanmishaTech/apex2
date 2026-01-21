export type CurrentUser = {
  id: number;
  name: string | null;
  email: string;
  role: string | null;
  profilePhoto: string | null;
  status: boolean;
  lastLogin: Date | null;
  permissions: string[];
};
