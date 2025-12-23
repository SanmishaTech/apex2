// Application navigation tree definition. Items filtered at runtime based on user permissions.
// Keeps UI structure & required permissions centralized (avoid scattering nav logic).
import { PERMISSIONS } from "@/config/roles";

import {
  LayoutDashboard,
  Users,
  Settings,
  MapPin,
  Map,
  Building2,
  Warehouse,
  Briefcase,
  Folder,
  UserCheck,
  Receipt,
  Megaphone,
  Database,
  TrendingUp,
  Calculator,
  FileText,
  Package,
  Building,
  Home,
  ArrowRightLeft,
  UserPlus,
  ArrowUpDown,
  ClipboardCheck,
  Edit3,
  FileBarChart,
} from "lucide-react";
import type { ComponentType } from "react";

export type NavLeafItem = {
  type?: "item";
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  permission: string; // permission required to view
};

export type NavGroupItem = {
  type: "group";
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: (NavLeafItem | NavGroupItem)[]; // support nested groups
};

export type NavItem = NavLeafItem | NavGroupItem;

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    permission: PERMISSIONS.VIEW_DASHBOARD,
  },

  {
    type: "group",
    title: "Basic",
    icon: Database,
    children: [
      {
        title: "States",
        href: "/states",
        icon: Map,
        permission: PERMISSIONS.VIEW_STATES,
      },
      {
        title: "Cities",
        href: "/cities",
        icon: MapPin,
        permission: PERMISSIONS.VIEW_CITIES,
      },
      {
        title: "Companies",
        href: "/companies",
        icon: Building2,
        permission: PERMISSIONS.VIEW_COMPANIES,
      },
      {
        title: "Sites",
        href: "/sites",
        icon: Warehouse,
        permission: PERMISSIONS.VIEW_SITES,
      },
      {
        title: "Departments",
        href: "/departments",
        icon: Briefcase,
        permission: PERMISSIONS.VIEW_DEPARTMENTS,
      },

      {
        title: "Notices",
        href: "/notices",
        icon: Megaphone,
        permission: PERMISSIONS.VIEW_NOTICES,
      },
    ],
  },

  {
    type: "group",
    title: "H.R",
    icon: UserCheck,
    children: [
      {
        title: "Employees",
        href: "/employees",
        icon: UserCheck,
        permission: PERMISSIONS.VIEW_EMPLOYEES,
      },
      {
        title: "Categories",
        href: "/categories",
        icon: Folder,
        permission: PERMISSIONS.VIEW_CATEGORIES,
      },
      {
        title: "Skill Sets",
        href: "/skill-sets",
        icon: Folder,
        permission: PERMISSIONS.VIEW_SKILLSETS,
      },
      {
        title: "Manpower Suppliers",
        href: "/manpower-suppliers",
        icon: Folder,
        permission: PERMISSIONS.VIEW_MANPOWER_SUPPLIERS,
      },
      {
        title: "Manpower",
        href: "/manpower",
        icon: Folder,
        permission: PERMISSIONS.VIEW_MANPOWER,
      },

      {
        title: "Minimum Wages",
        href: "/minimum-wages",
        icon: Folder,
        permission: PERMISSIONS.VIEW_MIN_WAGES,
      },
      {
        title: "Assign Manpower",
        href: "/assign-manpower",

        icon: UserPlus,
        permission: PERMISSIONS.VIEW_MANPOWER_ASSIGNMENTS,
      },
      {
        title: "Assign Employees",
        href: "/assign-employees",
        icon: UserPlus,
        permission: PERMISSIONS.READ_EMPLOYEES,
      },
      {
        title: "Manpower Transfers",
        href: "/manpower-transfers",
        icon: ArrowUpDown,
        permission: PERMISSIONS.VIEW_MANPOWER_TRANSFERS,
      },
      {
        title: "Attendances",
        href: "/attendances",
        icon: ClipboardCheck,
        permission: PERMISSIONS.VIEW_ATTENDANCES,
      },
      {
        title: "Edit Attendance",
        href: "/edit-attendance",
        icon: Edit3,
        permission: PERMISSIONS.EDIT_ATTENDANCES,
      },
      {
        title: "Payslips",
        href: "/payslips",
        icon: Receipt,
        permission: PERMISSIONS.READ_PAYSLIPS,
      },
      {
        type: "group",
        title: "Reports",
        icon: Receipt,
        children: [
          {
            type: "group",
            title: "Wages Reports",
            icon: Receipt,
            children: [
              {
                title: "Wage sheet as per minimum wages",
                href: "/reports/wage-sheet?mode=govt",
                icon: Receipt,
                permission: PERMISSIONS.READ_PAYSLIPS,
              },
              {
                title: "Wage sheet as per company rates",
                href: "/reports/wage-sheet?mode=company",
                icon: Receipt,
                permission: PERMISSIONS.READ_PAYSLIPS,
              },
            ],
          },
          {
            type: "group",
            title: "Manpower Reports",
            icon: FileBarChart,
            children: [
              {
                title: "Attendance Reports",
                href: "/attendance-reports",
                icon: ClipboardCheck,
                permission: PERMISSIONS.VIEW_ATTENDANCE_REPORTS,
              },
              {
                title: "Manpower Attendance Summary",
                href: "/attendance-reports/summary",
                icon: FileText,
                permission: PERMISSIONS.VIEW_ATTENDANCE_REPORTS,
              },
            ],
          },
        ],
      },
    ],
  },

  {
    type: "group",
    title: "Rental",
    icon: Building,
    children: [
      {
        title: "Rental Categories",
        href: "/rental-categories",
        icon: Folder,
        permission: PERMISSIONS.READ_RENTAL_CATEGORIES,
      },
      {
        title: "Rent Types",
        href: "/rent-types",
        icon: Folder,
        permission: PERMISSIONS.READ_RENT_TYPES,
      },
      {
        title: "Rental Registrations",
        href: "/rents",
        icon: Home,
        permission: PERMISSIONS.READ_RENTS,
      },
      {
        type: "group",
        title: "Reports",
        icon: FileText,
        children: [
          {
            title: "Rent Registration Report",
            href: "/reports/rent-registration",
            icon: FileText,
            permission: PERMISSIONS.READ_RENTS,
          },
        ],
      },
    ],
  },

  {
    type: "group",
    title: "Cashbook",
    icon: Calculator,
    children: [
      {
        title: "Cashbooks",
        href: "/cashbooks",
        icon: FileText,
        permission: PERMISSIONS.READ_CASHBOOKS,
      },
      {
        title: "Cashbook Heads",
        href: "/cashbook-heads",
        icon: Folder,
        permission: PERMISSIONS.READ_CASHBOOK_HEADS,
      },
      {
        title: "Cashbook Budgets",
        href: "/cashbook-budgets",
        icon: Folder,
        permission: PERMISSIONS.READ_CASHBOOK_BUDGETS,
      },
      {
        type: "group",
        title: "Reports",
        icon: FileText,
        children: [
          {
            title: "Cashbook Budget Report",
            href: "/reports/cashbook-budget",
            icon: FileText,
            permission: PERMISSIONS.READ_CASHBOOK_BUDGETS,
          },
          {
            title: "Daily Cashbook Report",
            href: "/reports/daily-cashbook",
            icon: FileText,
            permission: PERMISSIONS.READ_CASHBOOKS,
          },
        ],
      },
    ],
  },

  {
    type: "group",
    title: "Purchase",
    icon: Briefcase,
    children: [
      {
        title: "Items",
        href: "/items",
        icon: Folder,
        permission: PERMISSIONS.READ_ITEMS,
      },
      {
        title: "Indents",
        href: "/indents",
        icon: FileText,
        permission: PERMISSIONS.READ_INDENTS,
      },
      {
        title: "Purchase Orders",
        href: "/purchase-orders",
        icon: FileText,
        permission: PERMISSIONS.READ_PURCHASE_ORDERS,
      },
      // {
      //   title: "Work Order Bills",
      //   href: "/work-order-bills",
      //   icon: FileText,
      //   permission: PERMISSIONS.READ_WORK_ORDER_BILLS,
      // },
      {
        title: "Inward Delivery Challan",
        href: "/inward-delivery-challans",
        icon: FileText,
        permission: PERMISSIONS.READ_INWARD_DELIVERY_CHALLAN,
      },
      {
        title: "Outward Delivery Challan",
        href: "/outward-delivery-challans",
        icon: FileText,
        permission: PERMISSIONS.READ_OUTWARD_DELIVERY_CHALLAN,
      },
      // {
      //   title: "Work Orders",
      //   href: "/work-orders",
      //   icon: FileText,
      //   permission: PERMISSIONS.READ_WORK_ORDERS,
      // },
      {
        title: "Units",
        href: "/units",
        icon: Folder,
        permission: PERMISSIONS.READ_UNITS,
      },
      {
        title: "Item Categories",
        href: "/item-categories",
        icon: Folder,
        permission: PERMISSIONS.READ_ITEM_CATEGORIES,
      },

      {
        title: "Billing Addresses",
        href: "/billing-addresses",
        icon: Folder,
        permission: PERMISSIONS.READ_BILLING_ADDRESSES,
      },
      {
        title: "Vendors",
        href: "/vendors",
        icon: Folder,
        permission: PERMISSIONS.READ_VENDORS,
      },
      {
        title: "Payment Terms",
        href: "/payment-terms",
        icon: Folder,
        permission: PERMISSIONS.READ_PAYMENT_TERMS,
      },
      {
        title: "Add Budget",
        href: "/site-budgets",
        icon: Folder,
        permission: PERMISSIONS.READ_SITE_BUDGETS,
      },
    ],
  },
  {
    type: "group",
    title: "Purchase Billing",
    icon: Receipt,
    children: [
      {
        title: "Inward Bills",
        href: "/inward-bills",
        icon: FileText,
        permission: PERMISSIONS.READ_INWARD_BILL,
      },
    ],
  },

  {
    type: "group",
    title: "Billing",
    icon: Receipt,
    children: [
      {
        title: "Bills of Quantity",
        href: "/boqs",
        icon: Folder,
        permission: PERMISSIONS.READ_BOQS,
      },
    ],
  },
  {
    type: "group",
    title: "Progress",
    icon: TrendingUp,
    children: [
      {
        title: "BOQ Targets",
        href: "/boq-targets",
        icon: Folder,
        permission: PERMISSIONS.READ_BOQS,
      },
      {
        title: "Daily Consumptions",
        href: "/daily-consumptions",
        icon: Folder,
        permission: PERMISSIONS.VIEW_DAILY_CONSUMPTIONS,
      },
      {
        title: "Daily Progress",
        href: "/daily-progresses",
        icon: Folder,
        permission: PERMISSIONS.READ_DAILY_PROGRESSES,
      },
    ],
  },

  {
    type: "group",
    title: "Assets",
    icon: Building,
    children: [
      {
        title: "Assets",
        href: "/assets",
        icon: Building2,
        permission: PERMISSIONS.READ_ASSETS,
      },
      {
        title: "Asset Groups",
        href: "/asset-groups",
        icon: Folder,
        permission: PERMISSIONS.READ_ASSET_GROUPS,
      },
      {
        title: "Asset Categories",
        href: "/asset-categories",
        icon: Database,
        permission: PERMISSIONS.READ_ASSET_CATEGORIES,
      },
      {
        title: "Asset Transfers",
        href: "/asset-transfers",
        icon: ArrowRightLeft,
        permission: PERMISSIONS.READ_ASSET_TRANSFERS,
      },
    ],
  },

  {
    type: "group",
    title: "Stocks",
    icon: Building,
    children: [
      {
        title: "Stocks",
        href: "/stocks",
        icon: Building2,
        permission: PERMISSIONS.VIEW_STOCKS,
      },
      {
        title: "Stock Adjustments",
        href: "/stock-adjustments",
        icon: Building2,
        permission: PERMISSIONS.VIEW_STOCK_ADJUSTMENTS,
      },
    ],
  },

  {
    type: "group",
    title: "Settings",

    icon: Settings,
    children: [
      // {
      //   title: "Roles",
      //   href: "/roles",
      //   icon: Users,
      //   permission: PERMISSIONS.VIEW_ROLES,
      // },
      {
        title: "Users",
        href: "/users",
        icon: Users,
        permission: PERMISSIONS.VIEW_USERS,
      },
    ],
  },
];
