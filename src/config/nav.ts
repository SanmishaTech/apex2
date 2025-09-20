// Application navigation tree definition. Items filtered at runtime based on user permissions.
// Keeps UI structure & required permissions centralized (avoid scattering nav logic).
import { PERMISSIONS } from '@/config/roles';
import { LayoutDashboard, Users, Settings, MapPin, Map, Building2, Warehouse, Briefcase, Folder, UserCheck, Receipt, Megaphone, Database } from 'lucide-react';
import type { ComponentType } from 'react';

export type NavLeafItem = {
  type?: 'item';
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  permission: string; // permission required to view
};

export type NavGroupItem = {
  type: 'group';
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: NavLeafItem[]; // children filtered by permission dynamically
};

export type NavItem = NavLeafItem | NavGroupItem;

export const NAV_ITEMS: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permission: PERMISSIONS.VIEW_DASHBOARD,
  },

  {
    type: 'group',
    title: 'Basic',
    icon: Database,
    children: [
      {
        title: 'States',
        href: '/states',
        icon: Map,
        permission: PERMISSIONS.READ_STATES,
      },
      {
        title: 'Cities',
        href: '/cities',
        icon: MapPin,
        permission: PERMISSIONS.READ_CITIES,
      },
      {
        title: 'Companies',
        href: '/companies',
        icon: Building2,
        permission: PERMISSIONS.READ_COMPANIES,
      },
      {
        title: 'Sites',
        href: '/sites',
        icon: Warehouse,
        permission: PERMISSIONS.READ_SITES,
      },
      {
        title: 'Departments',
        href: '/departments',
        icon: Briefcase,
        permission: PERMISSIONS.READ_DEPARTMENTS,
      },
      {
        title: 'Notices',
        href: '/notices',
        icon: Megaphone,
        permission: PERMISSIONS.READ_BOQS,
      },
    ],
  },
 
  {
    type: 'group',
    title: 'H.R',
    icon: UserCheck,
    children: [
      {
        title: 'Manpower Suppliers',
        href: '/manpower-suppliers',
        icon: Folder,
        permission: PERMISSIONS.READ_MANPOWER_SUPPLIERS,
      },
      {
        title: 'Manpower',
        href: '/manpower',
        icon: Folder,
        permission: PERMISSIONS.READ_MANPOWER,
      },
      {
        title: 'Categories',
        href: '/categories',
        icon: Folder,
        permission: PERMISSIONS.READ_CATEGORIES,
      },
      {
        title: 'Skill Sets',
        href: '/skill-sets',
        icon: Folder,
        permission: PERMISSIONS.READ_SKILLSETS,
      },
      {
        title: 'Minimum Wages',
        href: '/minimum-wages',
        icon: Folder,
        permission: PERMISSIONS.READ_MIN_WAGES,
      },
    ],
  },

  {
    type: 'group',
    title: 'Purchased',
    icon: Briefcase,
    children: [
      {
        title: 'Units',
        href: '/units',
        icon: Folder,
        permission: PERMISSIONS.READ_UNITS,
      },
    ],
  },

  {
    type: 'group',
    title: 'Billing',
    icon: Receipt,
    children: [
      {
        title: 'Bills of Quantity',
        href: '/boqs',
        icon: Folder,
        permission: PERMISSIONS.READ_BOQS,
      },
    ],
  },

  {
    type: 'group',
    title: 'Settings',
    icon: Settings,
    children: [
      {
        title: 'Users',
        href: '/users',
        icon: Users,
        permission: PERMISSIONS.READ_USERS,
      },
    ],
  },
];
