// Application navigation tree definition. Items filtered at runtime based on user permissions.
// Keeps UI structure & required permissions centralized (avoid scattering nav logic).
import { PERMISSIONS } from '@/config/roles';
 
import { LayoutDashboard, Users, Settings, MapPin, Map, Building2, Warehouse, Briefcase, Folder, UserCheck, Receipt, Megaphone, Database, TrendingUp, Calculator, FileText, Package,Building, Home, ArrowRightLeft, UserPlus } from 'lucide-react';
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
        title: 'Employees',
        href: '/employees',
        icon: UserCheck,
        permission: PERMISSIONS.READ_EMPLOYEES,
      },
      {
        title: 'Notices',
        href: '/notices',
        icon: Megaphone,
        permission: PERMISSIONS.READ_NOTICES,
      },
    ],
  },
 
  {
    type: 'group',
    title: 'H.R',
    icon: UserCheck,
    children: [
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
        title: 'Minimum Wages',
        href: '/minimum-wages',
        icon: Folder,
        permission: PERMISSIONS.READ_MIN_WAGES,
      },
    ],
  },

  {
    type: 'group',
    title: 'Rental',
    icon: Building,
    children: [
      {
        title: 'Rental Categories',
        href: '/rental-categories',
        icon: Folder,
        permission: PERMISSIONS.READ_RENTAL_CATEGORIES,
      },
      {
        title: 'Rent Types',
        href: '/rent-types',
        icon: Folder,
        permission: PERMISSIONS.READ_RENT_TYPES,
      },
      {
        title: 'Rental Registrations',
        href: '/rents',
        icon: Home,
        permission: PERMISSIONS.READ_RENTS,
      },
    ],
  },

  {
    type: 'group',
    title: 'Purchased',
    icon: Briefcase,
    children: [
      {
        title: 'Indents',
        href: '/indents',
        icon: FileText,
        permission: PERMISSIONS.READ_INDENTS,
      },
      {
        title: 'Units',
        href: '/units',
        icon: Folder,
        permission: PERMISSIONS.READ_UNITS,
      },
      {
        title: 'Item Categories',
        href: '/item-categories',
        icon: Folder,
        permission: PERMISSIONS.READ_ITEM_CATEGORIES,
      },
      {
        title: 'Items',
        href: '/items',
        icon: Folder,
        permission: PERMISSIONS.READ_ITEMS,
      },
      {
        title: 'Billing Addresses',
        href: '/billing-addresses',
        icon: Folder,
        permission: PERMISSIONS.READ_BILLING_ADDRESSES,
      },
      {
        title: 'Vendors',
        href: '/vendors',
        icon: Folder,
        permission: PERMISSIONS.READ_VENDORS,
      },
      {
        title: 'Payment Terms',
        href: '/payment-terms',
        icon: Folder,
        permission: PERMISSIONS.READ_PAYMENT_TERMS,
      },
      {
        title: 'Add Budget',
        href: '/site-budgets',
        icon: Folder,
        permission: PERMISSIONS.READ_SITE_BUDGETS,
      },
    ],
  },

  // {
  //   type: 'group',
  //   title: 'Asset',
  //   icon: Package,
  //   children: [
  //     {
  //       title: 'Asset Group',
  //       href: '/asset-groups',
  //       icon: Folder,
  //       permission: PERMISSIONS.READ_ASSET_GROUPS,
  //     },
  //     {
  //       title: 'Asset Category',
  //       href: '/asset-categories',
  //       icon: Folder,
  //       permission: PERMISSIONS.READ_ASSET_CATEGORIES,
  //     },
  //   ],
  // },

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
    title: 'Progress',
    icon: TrendingUp,
    children: [
      {
        title: 'BOQ Targets',
        href: '/boq-targets',
        icon: Folder,
        permission: PERMISSIONS.READ_BOQS,
      },
    ],
  },

  {
    type: 'group',
    title: 'Cashbook',
    icon: Calculator,
    children: [
      {
        title: 'Cashbooks',
        href: '/cashbooks',
        icon: FileText,
        permission: PERMISSIONS.READ_CASHBOOKS,
      },
      {
        title: 'Cashbook Heads',
        href: '/cashbook-heads',
        icon: Folder,
        permission: PERMISSIONS.READ_CASHBOOK_HEADS,
      },
      {
        title: 'Cashbook Budgets',
        href: '/cashbook-budgets',
        icon: Folder,
        permission: PERMISSIONS.READ_CASHBOOK_BUDGETS,
      },
    ],
  },

  {
    type: 'group',
    title: 'Assets',
    icon: Building,
    children: [
      {
        title: 'Assets',
        href: '/assets',
        icon: Building2,
        permission: PERMISSIONS.READ_ASSETS,
      },
      {
        title: 'Asset Groups',
        href: '/asset-groups',
        icon: Folder,
        permission: PERMISSIONS.READ_ASSET_GROUPS,
      },
      {
        title: 'Asset Categories',
        href: '/asset-categories',
        icon: Database,
        permission: PERMISSIONS.READ_ASSET_CATEGORIES,
      },
      {
        title: 'Asset Transfers',
        href: '/asset-transfers',
        icon: ArrowRightLeft,
        permission: PERMISSIONS.READ_ASSET_TRANSFERS,
      },
      {
        title: 'Assign Manpower',
        href: '/assign-manpower',
        icon: UserPlus,
        permission: PERMISSIONS.READ_MANPOWER_ASSIGNMENTS,
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
