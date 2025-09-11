// Access control configuration: declarative page + API prefix -> required permission mapping
// Provides longest-prefix rule resolution via findAccessRule for client guards (and future middleware).
// No side effects; consumed by hooks (useProtectPage) & guardApiAccess.
import { PERMISSIONS } from '@/config/roles';

// Page (app router) path prefix -> required permissions (ALL must pass)
// Order no longer matters once longest-prefix logic below is applied, but keep specific before general for readability.
export const PAGE_ACCESS_RULES: { prefix: string; permissions: string[] }[] = [
  { prefix: '/users/new', permissions: [PERMISSIONS.EDIT_USERS] },            // create user page
  { prefix: '/users/', permissions: [PERMISSIONS.EDIT_USERS] },                // edit user pages (/users/:id/...)
  { prefix: '/users', permissions: [PERMISSIONS.READ_USERS] },                 // users list (view only)
  // Projects (adjust actual router paths as implemented)
  { prefix: '/projects/new', permissions: [PERMISSIONS.CREATE_PROJECT] },
  { prefix: '/projects/', permissions: [PERMISSIONS.READ_PROJECT] },           // details/edit pages /projects/:id
  { prefix: '/projects', permissions: [PERMISSIONS.READ_PROJECT] },            // project list
  // Cities
  { prefix: '/cities/new', permissions: [PERMISSIONS.EDIT_CITIES] },
  { prefix: '/cities/', permissions: [PERMISSIONS.EDIT_CITIES] },
  { prefix: '/cities', permissions: [PERMISSIONS.READ_CITIES] },
  // States
  { prefix: '/states/new', permissions: [PERMISSIONS.EDIT_STATES] },
  { prefix: '/states/', permissions: [PERMISSIONS.EDIT_STATES] },
  { prefix: '/states', permissions: [PERMISSIONS.READ_STATES] },
  // Companies
  { prefix: '/companies/new', permissions: [PERMISSIONS.EDIT_COMPANIES] },
  { prefix: '/companies/', permissions: [PERMISSIONS.EDIT_COMPANIES] },
  { prefix: '/companies', permissions: [PERMISSIONS.READ_COMPANIES] },
  // Sites
  { prefix: '/sites/new', permissions: [PERMISSIONS.EDIT_SITES] },
  { prefix: '/sites/', permissions: [PERMISSIONS.EDIT_SITES] },
  { prefix: '/sites', permissions: [PERMISSIONS.READ_SITES] },
  // Departments
  { prefix: '/departments/new', permissions: [PERMISSIONS.EDIT_DEPARTMENTS] },
  { prefix: '/departments/', permissions: [PERMISSIONS.EDIT_DEPARTMENTS] },
  { prefix: '/departments', permissions: [PERMISSIONS.READ_DEPARTMENTS] },
  // Employees
  { prefix: '/employees/new', permissions: [PERMISSIONS.EDIT_EMPLOYEES] },
  { prefix: '/employees/', permissions: [PERMISSIONS.EDIT_EMPLOYEES] },
  { prefix: '/employees', permissions: [PERMISSIONS.READ_EMPLOYEES] },
  // Categories
  { prefix: '/categories/new', permissions: [PERMISSIONS.EDIT_CATEGORIES] },
  { prefix: '/categories/', permissions: [PERMISSIONS.EDIT_CATEGORIES] },
  { prefix: '/categories', permissions: [PERMISSIONS.READ_CATEGORIES] },
  // Skill Sets
  { prefix: '/skill-sets/new', permissions: [PERMISSIONS.EDIT_SKILLSETS] },
  { prefix: '/skill-sets/', permissions: [PERMISSIONS.EDIT_SKILLSETS] },
  { prefix: '/skill-sets', permissions: [PERMISSIONS.READ_SKILLSETS] },
  // add more page rules here (place more specific prefixes first)
];

// API route path prefix -> required permissions (ALL must pass)
// NOTE: '/api/users' will also match '/api/users/...'
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Method-aware API rules. If methods map present, use per-method permissions; else fall back to permissions.
export type ApiAccessRule = {
  prefix: string; // path prefix
  permissions?: Permission[]; // fallback permissions (ALL must pass)
  methods?: Partial<Record<string, Permission[]>>; // e.g. { GET: [...], POST: [...] }
};

export const API_ACCESS_RULES: ApiAccessRule[] = [
  {
    prefix: '/api/users',
    methods: {
      GET: [PERMISSIONS.READ_USERS],
      POST: [PERMISSIONS.EDIT_USERS],
      PATCH: [PERMISSIONS.EDIT_USERS],
      DELETE: [PERMISSIONS.DELETE_USERS],
    },
  },
  // More specific projects sub-path rule (must appear before generic '/api/projects' to win longest-prefix)
  {
    prefix: '/api/projects/',
    methods: {
      GET: [PERMISSIONS.READ_PROJECT], // covers /api/projects/:id and nested like /api/projects/:id/users
      POST: [PERMISSIONS.MANAGE_PROJECT_USERS], // membership additions under /api/projects/:id/users
      PATCH: [PERMISSIONS.EDIT_PROJECT], // updating a project via PATCH /api/projects/:id
      DELETE: [PERMISSIONS.MANAGE_PROJECT_USERS], // membership removal via /api/projects/:id/users
    },
  },
  {
    prefix: '/api/projects',
    methods: {
      GET: [PERMISSIONS.READ_PROJECT],
      POST: [PERMISSIONS.CREATE_PROJECT],
      PATCH: [PERMISSIONS.EDIT_PROJECT],
      DELETE: [PERMISSIONS.DELETE_PROJECT],
    },
  },
  {
    prefix: '/api/project-files', // adjust if nesting under /api/projects/:id/files
    methods: {
      GET: [PERMISSIONS.READ_PROJECT_FILE],
      POST: [PERMISSIONS.UPLOAD_PROJECT_FILE],
      DELETE: [PERMISSIONS.DELETE_PROJECT_FILE],
    },
  },
  {
    prefix: '/api/blocks',
    methods: {
      GET: [PERMISSIONS.READ_CRACKS],
      POST: [PERMISSIONS.MANAGE_BLOCKS],
      PATCH: [PERMISSIONS.MANAGE_BLOCKS],
      DELETE: [PERMISSIONS.MANAGE_BLOCKS],
    },
  },
  {
    prefix: '/api/cracks',
    methods: {
      GET: [PERMISSIONS.READ_CRACKS],
      POST: [PERMISSIONS.IMPORT_CRACKS],
      DELETE: [PERMISSIONS.IMPORT_CRACKS],
    },
  },
  {
    prefix: '/api/design-maps',
    methods: {
      GET: [PERMISSIONS.READ_DESIGN_MAP],
      POST: [PERMISSIONS.WRITE_DESIGN_MAP],
      PATCH: [PERMISSIONS.WRITE_DESIGN_MAP],
      DELETE: [PERMISSIONS.WRITE_DESIGN_MAP],
    },
  },
  {
    prefix: '/api/cities',
    methods: {
      GET: [PERMISSIONS.READ_CITIES],
      POST: [PERMISSIONS.EDIT_CITIES],
      PATCH: [PERMISSIONS.EDIT_CITIES],
      DELETE: [PERMISSIONS.DELETE_CITIES],
    },
  },
  {
    prefix: '/api/states',
    methods: {
      GET: [PERMISSIONS.READ_STATES],
      POST: [PERMISSIONS.EDIT_STATES],
      PATCH: [PERMISSIONS.EDIT_STATES],
      DELETE: [PERMISSIONS.DELETE_STATES],
    },
  },
  {
    prefix: '/api/companies',
    methods: {
      GET: [PERMISSIONS.READ_COMPANIES],
      POST: [PERMISSIONS.EDIT_COMPANIES],
      PATCH: [PERMISSIONS.EDIT_COMPANIES],
      DELETE: [PERMISSIONS.DELETE_COMPANIES],
    },
  },
  {
    prefix: '/api/sites',
    methods: {
      GET: [PERMISSIONS.READ_SITES],
      POST: [PERMISSIONS.EDIT_SITES],
      PATCH: [PERMISSIONS.EDIT_SITES],
      DELETE: [PERMISSIONS.DELETE_SITES],
    },
  },
  {
    prefix: '/api/departments',
    methods: {
      GET: [PERMISSIONS.READ_DEPARTMENTS],
      POST: [PERMISSIONS.EDIT_DEPARTMENTS],
      PATCH: [PERMISSIONS.EDIT_DEPARTMENTS],
      DELETE: [PERMISSIONS.DELETE_DEPARTMENTS],
    },
  },
  {
    prefix: '/api/employees',
    methods: {
      GET: [PERMISSIONS.READ_EMPLOYEES],
      POST: [PERMISSIONS.EDIT_EMPLOYEES],
      PATCH: [PERMISSIONS.EDIT_EMPLOYEES],
      DELETE: [PERMISSIONS.DELETE_EMPLOYEES],
    },
  },
  {
    prefix: '/api/categories',
    methods: {
      GET: [PERMISSIONS.READ_CATEGORIES],
      POST: [PERMISSIONS.EDIT_CATEGORIES],
      PATCH: [PERMISSIONS.EDIT_CATEGORIES],
      DELETE: [PERMISSIONS.DELETE_CATEGORIES],
    },
  },
  {
    prefix: '/api/skill-sets',
    methods: {
      GET: [PERMISSIONS.READ_SKILLSETS],
      POST: [PERMISSIONS.EDIT_SKILLSETS],
      PATCH: [PERMISSIONS.EDIT_SKILLSETS],
      DELETE: [PERMISSIONS.DELETE_SKILLSETS],
    },
  },
  // add more API rules here
];

export type AccessRuleMatch = {
  permissions: Permission[];
  type: 'page' | 'api';
};

// Longest-prefix matcher so that more specific rules override broader ones automatically.
export function findAccessRule(pathname: string): AccessRuleMatch | null {
  if (pathname.startsWith('/api/')) {
    let match: ApiAccessRule | undefined;
    for (const r of API_ACCESS_RULES) {
      if (pathname.startsWith(r.prefix)) {
        if (!match || r.prefix.length > match.prefix.length) match = r;
      }
    }
    if (match) {
      const perms = match.methods?.['GET'] || match.permissions || [];
      return { permissions: perms, type: 'api' };
    }
  } else {
    let match: { prefix: string; permissions: string[] } | undefined;
    for (const r of PAGE_ACCESS_RULES) {
      if (pathname.startsWith(r.prefix)) {
        if (!match || r.prefix.length > match.prefix.length) match = r;
      }
    }
    if (match) return { permissions: match.permissions as Permission[], type: 'page' };
  }
  return null;
}

// Guard functions live in lib/access-guard.ts – this file is purely declarative configuration + rule lookup.
