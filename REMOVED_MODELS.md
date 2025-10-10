# Removed Models and Features

## Date: 2025-10-10

## Summary
Removed 6 unused tables and their related code from the project. These models were part of a separate crack inspection/civil engineering project management system that was not integrated with the main HR & Construction ERP.

## Removed Prisma Models (6 tables)

1. **Project** → `projects` table
2. **ProjectUser** → `project_users` table
3. **ProjectFile** → `project_files` table
4. **Block** → `blocks` table
5. **CrackIdentification** → `crack_identifications` table
6. **DesignMap** → `design_maps` table

## Removed API Routes

- `/src/app/api/projects/**` - All project-related API endpoints
- `/src/app/api/project-files/**` - Project file upload/download endpoints
- `/src/app/api/blocks/**` - Block management endpoints
- `/src/app/api/cracks/**` - Crack identification endpoints
- `/src/app/api/design-maps/**` - Design map endpoints

## Removed Dashboard Components

- `/src/app/(dashboard)/dashboard/project-user-dashboard.tsx` - Project user-specific dashboard

## Updated Files

### 1. `prisma/schema.prisma`
- Removed 6 model definitions
- Removed project-related fields from User model:
  - `projectUsers` relation
  - `projectFilesUploaded` relation

### 2. `src/app/(dashboard)/dashboard/page.tsx`
- Removed `ProjectUserDashboard` import and usage
- Simplified to only use `InternalDashboard` for all users

### 3. `src/config/roles.ts`
- Removed project-related permissions:
  - `CREATE_PROJECT`
  - `READ_PROJECT`
  - `EDIT_PROJECT`
  - `DELETE_PROJECT`
  - `MANAGE_PROJECT_USERS`
  - `UPLOAD_PROJECT_FILE`
  - `READ_PROJECT_FILE`
  - `DELETE_PROJECT_FILE`
  - `IMPORT_CRACKS`
  - `READ_CRACKS`
  - `MANAGE_BLOCKS`
  - `READ_DESIGN_MAP`
  - `WRITE_DESIGN_MAP`
- Updated role definitions to remove project permission references

### 4. `src/config/access-control.ts`
- Removed project-related page access rules
- Removed `/projects/**` route protection rules

## Active Tables (49 Core ERP Tables)

The following tables remain active and are used in the core business:

### HR & Manpower (11 tables)
- categories, skill_sets, manpower_suppliers, manpower
- minimum_wages, attendances, manpower_transfers, manpower_transfer_items
- pay_slips, pay_slip_details, payroll_config

### Master Data (7 tables)
- states, cities, companies, sites, departments, employees
- users, refresh_tokens

### Asset Management (5 tables)
- asset_groups, asset_categories, assets
- asset_transfers, asset_transfer_items

### BOQ & Progress (6 tables)
- boqs, boq_items, boq_targets
- daily_progresses, daily_progress_details, daily_progress_hindrances

### Rental (3 tables)
- rental_categories, rent_types, rents

### Procurement & Inventory (10 tables)
- item_categories, items, units, indents, indent_items
- site_budgets, vendors, vendor_item_categories
- billing_addresses, payment_terms

### Cashbook & Finance (7 tables)
- cashbook_heads, cashbook_budgets, cashbook_budget_items
- cashbooks, cashbook_details

### Notices (1 table)
- notices

## Next Steps

To completely remove these tables from your database:

1. **Create a migration to drop the tables:**
   ```bash
   npx prisma migrate dev --name remove_project_tables
   ```

2. **Or manually drop them in production:**
   ```sql
   DROP TABLE IF EXISTS design_maps;
   DROP TABLE IF EXISTS crack_identifications;
   DROP TABLE IF EXISTS blocks;
   DROP TABLE IF EXISTS project_files;
   DROP TABLE IF EXISTS project_users;
   DROP TABLE IF EXISTS projects;
   ```

## Notes

- The Prisma client has been regenerated with `npx prisma generate`
- All TypeScript references have been removed
- No breaking changes to the core ERP functionality
- The project is now cleaner and focused on HR & Construction ERP only
