// Access control configuration: declarative page + API prefix -> required permission mapping
// Provides longest-prefix rule resolution via findAccessRule for client guards (and future middleware).
// No side effects; consumed by hooks (useProtectPage) & guardApiAccess.
import { PERMISSIONS } from "@/config/roles";

// Page (app router) path prefix -> required permissions (ALL must pass)
// Order no longer matters once longest-prefix logic below is applied, but keep specific before general for readability.
export const PAGE_ACCESS_RULES: { prefix: string; permissions: string[] }[] = [
  // Dashboard
  { prefix: "/dashboard", permissions: [PERMISSIONS.VIEW_DASHBOARD] },
  { prefix: "/users/new", permissions: [PERMISSIONS.EDIT_USERS] }, // create user page
  { prefix: "/users/", permissions: [PERMISSIONS.EDIT_USERS] }, // edit user pages (/users/:id/...)
  { prefix: "/users", permissions: [PERMISSIONS.READ_USERS] }, // users list (view only)
  // Cities
  { prefix: "/cities/new", permissions: [PERMISSIONS.EDIT_CITIES] },
  { prefix: "/cities/", permissions: [PERMISSIONS.EDIT_CITIES] },
  { prefix: "/cities", permissions: [PERMISSIONS.READ_CITIES] },
  // States
  { prefix: "/states/new", permissions: [PERMISSIONS.EDIT_STATES] },
  { prefix: "/states/", permissions: [PERMISSIONS.EDIT_STATES] },
  { prefix: "/states", permissions: [PERMISSIONS.READ_STATES] },
  // Companies
  { prefix: "/companies/new", permissions: [PERMISSIONS.EDIT_COMPANIES] },
  { prefix: "/companies/", permissions: [PERMISSIONS.EDIT_COMPANIES] },
  { prefix: "/companies", permissions: [PERMISSIONS.READ_COMPANIES] },
  // Sites
  { prefix: "/sites/new", permissions: [PERMISSIONS.EDIT_SITES] },
  { prefix: "/sites/", permissions: [PERMISSIONS.EDIT_SITES] },
  { prefix: "/sites", permissions: [PERMISSIONS.READ_SITES] },
  // Departments
  { prefix: "/departments/new", permissions: [PERMISSIONS.EDIT_DEPARTMENTS] },
  { prefix: "/departments/", permissions: [PERMISSIONS.EDIT_DEPARTMENTS] },
  { prefix: "/departments", permissions: [PERMISSIONS.READ_DEPARTMENTS] },
  // Employees
  { prefix: "/employees/new", permissions: [PERMISSIONS.EDIT_EMPLOYEES] },
  { prefix: "/employees/", permissions: [PERMISSIONS.EDIT_EMPLOYEES] },
  { prefix: "/employees", permissions: [PERMISSIONS.READ_EMPLOYEES] },
  // Manpower (workers)
  { prefix: "/manpower/new", permissions: [PERMISSIONS.EDIT_MANPOWER] },
  { prefix: "/manpower/", permissions: [PERMISSIONS.EDIT_MANPOWER] },
  { prefix: "/manpower", permissions: [PERMISSIONS.READ_MANPOWER] },
  // Manpower Suppliers
  {
    prefix: "/manpower-suppliers/new",
    permissions: [PERMISSIONS.EDIT_MANPOWER_SUPPLIERS],
  },
  {
    prefix: "/manpower-suppliers/",
    permissions: [PERMISSIONS.EDIT_MANPOWER_SUPPLIERS],
  },
  {
    prefix: "/manpower-suppliers",
    permissions: [PERMISSIONS.READ_MANPOWER_SUPPLIERS],
  },
  // Categories
  { prefix: "/categories/new", permissions: [PERMISSIONS.EDIT_CATEGORIES] },
  { prefix: "/categories/", permissions: [PERMISSIONS.EDIT_CATEGORIES] },
  { prefix: "/categories", permissions: [PERMISSIONS.READ_CATEGORIES] },
  // Skill Sets
  { prefix: "/skill-sets/new", permissions: [PERMISSIONS.EDIT_SKILLSETS] },
  { prefix: "/skill-sets/", permissions: [PERMISSIONS.EDIT_SKILLSETS] },
  { prefix: "/skill-sets", permissions: [PERMISSIONS.READ_SKILLSETS] },
  // Minimum Wages
  { prefix: "/minimum-wages/new", permissions: [PERMISSIONS.EDIT_MIN_WAGES] },
  { prefix: "/minimum-wages/", permissions: [PERMISSIONS.EDIT_MIN_WAGES] },
  { prefix: "/minimum-wages", permissions: [PERMISSIONS.READ_MIN_WAGES] },
  // Units
  { prefix: "/units/new", permissions: [PERMISSIONS.EDIT_UNITS] },
  { prefix: "/units/", permissions: [PERMISSIONS.EDIT_UNITS] },
  { prefix: "/units", permissions: [PERMISSIONS.READ_UNITS] },
  // BOQs
  { prefix: "/boqs/new", permissions: [PERMISSIONS.EDIT_BOQS] },
  { prefix: "/boqs/", permissions: [PERMISSIONS.EDIT_BOQS] },
  { prefix: "/boqs", permissions: [PERMISSIONS.READ_BOQS] },
  // daily Progress
  {
    prefix: "/daily-progresses/new",
    permissions: [PERMISSIONS.EDIT_DAILY_PROGRESSES],
  },

  // purchase-orders
  {
    prefix: "/purchase-orders/new",
    permissions: [PERMISSIONS.CREATE_PURCHASE_ORDERS],
  },
  // Allow viewing subpages (e.g., approve1/approve2) without requiring EDIT rights
  {
    prefix: "/purchase-orders/",
    permissions: [PERMISSIONS.READ_PURCHASE_ORDERS],
  },
  {
    prefix: "/purchase-orders",
    permissions: [PERMISSIONS.READ_PURCHASE_ORDERS],
  },
  { prefix: "/work-orders/new", permissions: [PERMISSIONS.CREATE_WORK_ORDERS] },
  { prefix: "/work-orders/", permissions: [PERMISSIONS.EDIT_WORK_ORDERS] },
  { prefix: "/work-orders", permissions: [PERMISSIONS.READ_WORK_ORDERS] },
  {
    prefix: "/daily-progresses/",
    permissions: [PERMISSIONS.EDIT_DAILY_PROGRESSES],
  },
  {
    prefix: "/daily-progresses",
    permissions: [PERMISSIONS.READ_DAILY_PROGRESSES],
  },
  // Notices
  { prefix: "/notices/new", permissions: [PERMISSIONS.CREATE_NOTICES] },
  { prefix: "/notices/", permissions: [PERMISSIONS.EDIT_NOTICES] },
  { prefix: "/notices", permissions: [PERMISSIONS.READ_NOTICES] },
  // Cashbook Heads
  {
    prefix: "/cashbook-heads/new",
    permissions: [PERMISSIONS.EDIT_CASHBOOK_HEADS],
  },
  {
    prefix: "/cashbook-heads/",
    permissions: [PERMISSIONS.EDIT_CASHBOOK_HEADS],
  },
  { prefix: "/cashbook-heads", permissions: [PERMISSIONS.READ_CASHBOOK_HEADS] },
  // Cashbook Budgets
  {
    prefix: "/cashbook-budgets/new",
    permissions: [PERMISSIONS.CREATE_CASHBOOK_BUDGETS],
  },
  {
    prefix: "/cashbook-budgets/",
    permissions: [PERMISSIONS.EDIT_CASHBOOK_BUDGETS],
  },
  {
    prefix: "/cashbook-budgets",
    permissions: [PERMISSIONS.READ_CASHBOOK_BUDGETS],
  },
  // Cashbooks
  { prefix: "/cashbooks/new", permissions: [PERMISSIONS.CREATE_CASHBOOKS] },
  { prefix: "/cashbooks/", permissions: [PERMISSIONS.EDIT_CASHBOOKS] },
  { prefix: "/cashbooks", permissions: [PERMISSIONS.READ_CASHBOOKS] },
  // Indents
  { prefix: "/indents/new", permissions: [PERMISSIONS.CREATE_INDENTS] },
  { prefix: "/indents/", permissions: [PERMISSIONS.READ_INDENTS] },
  { prefix: "/indents", permissions: [PERMISSIONS.READ_INDENTS] },
  // Rental Categories
  {
    prefix: "/rental-categories/new",
    permissions: [PERMISSIONS.EDIT_RENTAL_CATEGORIES],
  },
  {
    prefix: "/rental-categories/",
    permissions: [PERMISSIONS.EDIT_RENTAL_CATEGORIES],
  },
  {
    prefix: "/rental-categories",
    permissions: [PERMISSIONS.READ_RENTAL_CATEGORIES],
  },
  // Rent Types
  { prefix: "/rent-types/new", permissions: [PERMISSIONS.EDIT_RENT_TYPES] },
  { prefix: "/rent-types/", permissions: [PERMISSIONS.EDIT_RENT_TYPES] },
  { prefix: "/rent-types", permissions: [PERMISSIONS.READ_RENT_TYPES] },
  // Rents
  { prefix: "/rents/new", permissions: [PERMISSIONS.CREATE_RENTS] },
  { prefix: "/rents/", permissions: [PERMISSIONS.EDIT_RENTS] },
  { prefix: "/rents", permissions: [PERMISSIONS.READ_RENTS] },
  // Asset Groups
  { prefix: "/asset-groups/new", permissions: [PERMISSIONS.EDIT_ASSET_GROUPS] },
  { prefix: "/asset-groups/", permissions: [PERMISSIONS.EDIT_ASSET_GROUPS] },
  { prefix: "/asset-groups", permissions: [PERMISSIONS.READ_ASSET_GROUPS] },
  // Asset Categories
  {
    prefix: "/asset-categories/new",
    permissions: [PERMISSIONS.EDIT_ASSET_CATEGORIES],
  },
  {
    prefix: "/asset-categories/",
    permissions: [PERMISSIONS.EDIT_ASSET_CATEGORIES],
  },
  {
    prefix: "/asset-categories",
    permissions: [PERMISSIONS.READ_ASSET_CATEGORIES],
  },
  // Assets
  { prefix: "/assets/new", permissions: [PERMISSIONS.CREATE_ASSETS] },
  { prefix: "/assets/", permissions: [PERMISSIONS.EDIT_ASSETS] },
  { prefix: "/assets", permissions: [PERMISSIONS.READ_ASSETS] },
  // Asset Transfers
  {
    prefix: "/asset-transfers/new",
    permissions: [PERMISSIONS.CREATE_ASSET_TRANSFERS],
  },
  {
    prefix: "/asset-transfers/",
    permissions: [PERMISSIONS.READ_ASSET_TRANSFERS],
  },
  {
    prefix: "/asset-transfers",
    permissions: [PERMISSIONS.READ_ASSET_TRANSFERS],
  },
  // Assign Manpower
  {
    prefix: "/assign-manpower/",
    permissions: [PERMISSIONS.READ_MANPOWER_ASSIGNMENTS],
  },
  {
    prefix: "/assign-manpower",
    permissions: [PERMISSIONS.READ_MANPOWER_ASSIGNMENTS],
  },
  // Manpower Transfers
  {
    prefix: "/manpower-transfers/new",
    permissions: [PERMISSIONS.CREATE_MANPOWER_TRANSFERS],
  },
  {
    prefix: "/manpower-transfers/",
    permissions: [PERMISSIONS.READ_MANPOWER_TRANSFERS],
  },
  {
    prefix: "/manpower-transfers",
    permissions: [PERMISSIONS.READ_MANPOWER_TRANSFERS],
  },
  // Attendances
  {
    prefix: "/attendances/mark/",
    permissions: [PERMISSIONS.CREATE_ATTENDANCES],
  },
  { prefix: "/edit-attendance", permissions: [PERMISSIONS.EDIT_ATTENDANCES] },
  { prefix: "/attendances", permissions: [PERMISSIONS.READ_ATTENDANCES] },
  // Attendance Reports
  {
    prefix: "/attendance-reports",
    permissions: [PERMISSIONS.VIEW_ATTENDANCE_REPORTS],
  },
  // Reports
  {
    prefix: "/reports/rent-registration",
    permissions: [PERMISSIONS.READ_RENTS],
  },
  { prefix: "/reports/wage-sheet", permissions: [PERMISSIONS.READ_PAYSLIPS] },

  // add more page rules here (place more specific prefixes first)
];

// API route path prefix -> required permissions (ALL must pass)
// NOTE: '/api/users' will also match '/api/users/...'
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Method-aware API rules. If methods map present, use per-method permissions; else fall back to permissions.
export type ApiAccessRule = {
  prefix: string; // path prefix
  permissions?: Permission[]; // fallback permissions (ALL must pass)
  methods?: Partial<Record<string, Permission[]>>; // e.g. { GET: [...], POST: [...] }
};

export const API_ACCESS_RULES: ApiAccessRule[] = [
  {
    prefix: "/api/users",
    methods: {
      GET: [PERMISSIONS.READ_USERS],
      POST: [PERMISSIONS.EDIT_USERS],
      PATCH: [PERMISSIONS.EDIT_USERS],
      DELETE: [PERMISSIONS.DELETE_USERS],
    },
  },
  {
    prefix: "/api/cities",
    methods: {
      GET: [PERMISSIONS.READ_CITIES],
      POST: [PERMISSIONS.EDIT_CITIES],
      PATCH: [PERMISSIONS.EDIT_CITIES],
      DELETE: [PERMISSIONS.DELETE_CITIES],
    },
  },
  {
    prefix: "/api/states",
    methods: {
      GET: [PERMISSIONS.READ_STATES],
      POST: [PERMISSIONS.EDIT_STATES],
      PATCH: [PERMISSIONS.EDIT_STATES],
      DELETE: [PERMISSIONS.DELETE_STATES],
    },
  },
  {
    prefix: "/api/companies",
    methods: {
      GET: [PERMISSIONS.READ_COMPANIES],
      POST: [PERMISSIONS.EDIT_COMPANIES],
      PATCH: [PERMISSIONS.EDIT_COMPANIES],
      DELETE: [PERMISSIONS.DELETE_COMPANIES],
    },
  },
  {
    prefix: "/api/sites",
    methods: {
      GET: [PERMISSIONS.READ_SITES],
      POST: [PERMISSIONS.EDIT_SITES],
      PATCH: [PERMISSIONS.EDIT_SITES],
      DELETE: [PERMISSIONS.DELETE_SITES],
    },
  },
  {
    prefix: "/api/departments",
    methods: {
      GET: [PERMISSIONS.READ_DEPARTMENTS],
      POST: [PERMISSIONS.EDIT_DEPARTMENTS],
      PATCH: [PERMISSIONS.EDIT_DEPARTMENTS],
      DELETE: [PERMISSIONS.DELETE_DEPARTMENTS],
    },
  },
  {
    prefix: "/api/employees",
    methods: {
      GET: [PERMISSIONS.READ_EMPLOYEES],
      POST: [PERMISSIONS.EDIT_EMPLOYEES],
      PATCH: [PERMISSIONS.EDIT_EMPLOYEES],
      DELETE: [PERMISSIONS.DELETE_EMPLOYEES],
    },
  },
  {
    prefix: "/api/manpower",
    methods: {
      GET: [PERMISSIONS.READ_MANPOWER],
      POST: [PERMISSIONS.EDIT_MANPOWER],
      PATCH: [PERMISSIONS.EDIT_MANPOWER],
      DELETE: [PERMISSIONS.DELETE_MANPOWER],
    },
  },
  {
    prefix: "/api/manpower-suppliers",
    methods: {
      GET: [PERMISSIONS.READ_MANPOWER_SUPPLIERS],
      POST: [PERMISSIONS.EDIT_MANPOWER_SUPPLIERS],
      PATCH: [PERMISSIONS.EDIT_MANPOWER_SUPPLIERS],
      DELETE: [PERMISSIONS.DELETE_MANPOWER_SUPPLIERS],
    },
  },
  {
    prefix: "/api/categories",
    methods: {
      GET: [PERMISSIONS.READ_CATEGORIES],
      POST: [PERMISSIONS.EDIT_CATEGORIES],
      PATCH: [PERMISSIONS.EDIT_CATEGORIES],
      DELETE: [PERMISSIONS.DELETE_CATEGORIES],
    },
  },
  {
    prefix: "/api/skill-sets",
    methods: {
      GET: [PERMISSIONS.READ_SKILLSETS],
      POST: [PERMISSIONS.EDIT_SKILLSETS],
      PATCH: [PERMISSIONS.EDIT_SKILLSETS],
      DELETE: [PERMISSIONS.DELETE_SKILLSETS],
    },
  },
  {
    prefix: "/api/minimum-wages",
    methods: {
      GET: [PERMISSIONS.READ_MIN_WAGES],
      POST: [PERMISSIONS.EDIT_MIN_WAGES],
      PATCH: [PERMISSIONS.EDIT_MIN_WAGES],
      DELETE: [PERMISSIONS.DELETE_MIN_WAGES],
    },
  },
  {
    prefix: "/api/units",
    methods: {
      GET: [PERMISSIONS.READ_UNITS],
      POST: [PERMISSIONS.EDIT_UNITS],
      PATCH: [PERMISSIONS.EDIT_UNITS],
      DELETE: [PERMISSIONS.DELETE_UNITS],
    },
  },
  {
    prefix: "/api/boqs",
    methods: {
      GET: [PERMISSIONS.READ_BOQS],
      POST: [PERMISSIONS.EDIT_BOQS],
      PATCH: [PERMISSIONS.EDIT_BOQS],
      DELETE: [PERMISSIONS.DELETE_BOQS],
    },
  },
  {
    prefix: "/api/daily-progresses",
    methods: {
      GET: [PERMISSIONS.READ_DAILY_PROGRESSES],
      POST: [PERMISSIONS.EDIT_DAILY_PROGRESSES],
      PATCH: [PERMISSIONS.EDIT_DAILY_PROGRESSES],
      DELETE: [PERMISSIONS.DELETE_DAILY_PROGRESSES],
    },
  },
  {
    prefix: "/api/notices",
    methods: {
      GET: [PERMISSIONS.READ_NOTICES],
      POST: [PERMISSIONS.CREATE_NOTICES],
      PATCH: [PERMISSIONS.EDIT_NOTICES],
      DELETE: [PERMISSIONS.DELETE_NOTICES],
    },
  },
  {
    prefix: "/api/cashbook-heads",
    methods: {
      GET: [PERMISSIONS.READ_CASHBOOK_HEADS],
      POST: [PERMISSIONS.EDIT_CASHBOOK_HEADS],
      PATCH: [PERMISSIONS.EDIT_CASHBOOK_HEADS],
      DELETE: [PERMISSIONS.DELETE_CASHBOOK_HEADS],
    },
  },
  {
    prefix: "/api/cashbook-budgets",
    methods: {
      GET: [PERMISSIONS.READ_CASHBOOK_BUDGETS],
      POST: [PERMISSIONS.CREATE_CASHBOOK_BUDGETS],
      PATCH: [PERMISSIONS.EDIT_CASHBOOK_BUDGETS],
      DELETE: [PERMISSIONS.DELETE_CASHBOOK_BUDGETS],
    },
  },
  {
    prefix: "/api/cashbooks",
    methods: {
      GET: [PERMISSIONS.READ_CASHBOOKS],
      POST: [PERMISSIONS.CREATE_CASHBOOKS],
      PATCH: [PERMISSIONS.EDIT_CASHBOOKS],
      DELETE: [PERMISSIONS.DELETE_CASHBOOKS],
    },
  },
  {
    prefix: "/api/indents",
    methods: {
      GET: [PERMISSIONS.READ_INDENTS],
      POST: [PERMISSIONS.CREATE_INDENTS],
      // Let the handler enforce granular permissions: approve1/approve2/complete/suspend
      PATCH: [],
      DELETE: [PERMISSIONS.DELETE_INDENTS],
    },
  },
  {
    prefix: "/api/purchase-orders",
    methods: {
      GET: [PERMISSIONS.READ_PURCHASE_ORDERS],
      POST: [PERMISSIONS.CREATE_PURCHASE_ORDERS],
      // Let the handler enforce granular permissions (approve1/approve2/suspend/complete)
      PATCH: [],
      DELETE: [PERMISSIONS.DELETE_PURCHASE_ORDERS],
    },
  },
  {
    prefix: "/api/work-orders",
    methods: {
      GET: [PERMISSIONS.READ_WORK_ORDERS],
      POST: [PERMISSIONS.CREATE_WORK_ORDERS],
      PATCH: [PERMISSIONS.EDIT_WORK_ORDERS],
      DELETE: [PERMISSIONS.DELETE_WORK_ORDERS],
    },
  },
  {
    prefix: "/api/work-order-bills",
    methods: {
      GET: [PERMISSIONS.READ_WORK_ORDER_BILLS],
      POST: [PERMISSIONS.CREATE_WORK_ORDER_BILLS],
      PATCH: [PERMISSIONS.EDIT_WORK_ORDER_BILLS],
      DELETE: [PERMISSIONS.DELETE_WORK_ORDER_BILLS],
    },
  },
  {
    prefix: "/api/inward-delivery-challans",
    methods: {
      GET: [PERMISSIONS.READ_INWARD_DELIVERY_CHALLAN],
      POST: [PERMISSIONS.CREATE_INWARD_DELIVERY_CHALLAN],
      PATCH: [PERMISSIONS.EDIT_INWARD_DELIVERY_CHALLAN],
    },
  },
  {
    prefix: "/api/outward-delivery-challans",
    methods: {
      GET: [PERMISSIONS.READ_OUTWARD_DELIVERY_CHALLAN],
      POST: [PERMISSIONS.CREATE_OUTWARD_DELIVERY_CHALLAN],
      PATCH: [],
    },
  },
  {
    prefix: "/api/rental-categories",
    methods: {
      GET: [PERMISSIONS.READ_RENTAL_CATEGORIES],
      POST: [PERMISSIONS.EDIT_RENTAL_CATEGORIES],
      PATCH: [PERMISSIONS.EDIT_RENTAL_CATEGORIES],
      DELETE: [PERMISSIONS.DELETE_RENTAL_CATEGORIES],
    },
  },
  {
    prefix: "/api/rent-types",
    methods: {
      GET: [PERMISSIONS.READ_RENT_TYPES],
      POST: [PERMISSIONS.EDIT_RENT_TYPES],
      PATCH: [PERMISSIONS.EDIT_RENT_TYPES],
      DELETE: [PERMISSIONS.DELETE_RENT_TYPES],
    },
  },
  {
    prefix: "/api/rents",
    methods: {
      GET: [PERMISSIONS.READ_RENTS],
      POST: [PERMISSIONS.CREATE_RENTS],
      PATCH: [PERMISSIONS.EDIT_RENTS],
      DELETE: [PERMISSIONS.DELETE_RENTS],
    },
  },
  {
    prefix: "/api/asset-groups",
    methods: {
      GET: [PERMISSIONS.READ_ASSET_GROUPS],
      POST: [PERMISSIONS.EDIT_ASSET_GROUPS],
      PATCH: [PERMISSIONS.EDIT_ASSET_GROUPS],
      DELETE: [PERMISSIONS.DELETE_ASSET_GROUPS],
    },
  },
  {
    prefix: "/api/asset-categories",
    methods: {
      GET: [PERMISSIONS.READ_ASSET_CATEGORIES],
      POST: [PERMISSIONS.EDIT_ASSET_CATEGORIES],
      PATCH: [PERMISSIONS.EDIT_ASSET_CATEGORIES],
      DELETE: [PERMISSIONS.DELETE_ASSET_CATEGORIES],
    },
  },
  {
    prefix: "/api/assets",
    methods: {
      GET: [PERMISSIONS.READ_ASSETS],
      POST: [PERMISSIONS.CREATE_ASSETS],
      PATCH: [PERMISSIONS.EDIT_ASSETS],
      DELETE: [PERMISSIONS.DELETE_ASSETS],
    },
  },
  {
    prefix: "/api/asset-transfers",
    methods: {
      GET: [PERMISSIONS.READ_ASSET_TRANSFERS],
      POST: [PERMISSIONS.CREATE_ASSET_TRANSFERS],
      PATCH: [
        PERMISSIONS.EDIT_ASSET_TRANSFERS,
        PERMISSIONS.APPROVE_ASSET_TRANSFERS,
      ],
      DELETE: [PERMISSIONS.DELETE_ASSET_TRANSFERS],
    },
  },
  {
    prefix: "/api/manpower-assignments",
    methods: {
      GET: [PERMISSIONS.READ_MANPOWER_ASSIGNMENTS],
      POST: [PERMISSIONS.CREATE_MANPOWER_ASSIGNMENTS],
      PATCH: [PERMISSIONS.EDIT_MANPOWER_ASSIGNMENTS],
      DELETE: [PERMISSIONS.DELETE_MANPOWER_ASSIGNMENTS],
    },
  },
  {
    prefix: "/api/manpower-transfers",
    methods: {
      GET: [PERMISSIONS.READ_MANPOWER_TRANSFERS],
      POST: [PERMISSIONS.CREATE_MANPOWER_TRANSFERS],
      PATCH: [PERMISSIONS.EDIT_MANPOWER_TRANSFERS],
      DELETE: [PERMISSIONS.DELETE_MANPOWER_TRANSFERS],
    },
  },
  {
    prefix: "/api/attendances",
    methods: {
      GET: [PERMISSIONS.READ_ATTENDANCES],
      POST: [PERMISSIONS.CREATE_ATTENDANCES],
      PATCH: [PERMISSIONS.EDIT_ATTENDANCES],
    },
  },
  {
    prefix: "/api/attendance-reports",
    methods: {
      GET: [PERMISSIONS.VIEW_ATTENDANCE_REPORTS],
    },
  },
  {
    prefix: "/api/reports/rent-registration",
    methods: {
      GET: [PERMISSIONS.READ_RENTS],
    },
  },
  // add more API rules here
];

export type AccessRuleMatch = {
  permissions: Permission[];
  type: "page" | "api";
};

// Cache for access rule lookups to avoid repeated computation
const accessRuleCache = new Map<string, AccessRuleMatch | null>();

// Longest-prefix matcher so that more specific rules override broader ones automatically.
export function findAccessRule(pathname: string): AccessRuleMatch | null {
  // Check cache first
  if (accessRuleCache.has(pathname)) {
    return accessRuleCache.get(pathname) || null;
  }

  let result: AccessRuleMatch | null = null;

  if (pathname.startsWith("/api/")) {
    let match: ApiAccessRule | undefined;
    for (const r of API_ACCESS_RULES) {
      if (pathname.startsWith(r.prefix)) {
        if (!match || r.prefix.length > match.prefix.length) match = r;
      }
    }
    if (match) {
      const perms = match.methods?.["GET"] || match.permissions || [];
      result = { permissions: perms, type: "api" };
    }
  } else {
    let match: { prefix: string; permissions: string[] } | undefined;
    for (const r of PAGE_ACCESS_RULES) {
      if (pathname.startsWith(r.prefix)) {
        if (!match || r.prefix.length > match.prefix.length) match = r;
      }
    }
    if (match)
      result = { permissions: match.permissions as Permission[], type: "page" };
  }

  // Cache the result
  accessRuleCache.set(pathname, result);
  return result;
}

// Guard functions live in lib/access-guard.ts – this file is purely declarative configuration + rule lookup.
