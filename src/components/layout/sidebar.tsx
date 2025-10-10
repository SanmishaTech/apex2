"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { NAV_ITEMS, NavItem, NavGroupItem, NavLeafItem } from '@/config/nav';
import { useCurrentUser } from '@/hooks/use-current-user';
import { ROLES_PERMISSIONS } from '@/config/roles';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { GlobalSearch } from '@/components/common/global-search';

type SidebarProps = {
  fixed?: boolean;
  className?: string;
  mobile?: boolean; // show in mobile context (removes hidden md:flex)
  onNavigate?: () => void; // callback when a navigation link is clicked (useful for mobile close)
};

export function Sidebar({ fixed, className, mobile, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const safePathname = pathname ?? '';
  const searchParams = useSearchParams();
  const sp = searchParams ?? new URLSearchParams();
  const qs = sp.toString();
  const { user } = useCurrentUser();

  function isGroup(item: NavItem): item is NavGroupItem {
    return (item as any)?.type === 'group' && Array.isArray((item as any).children);
  }

  const items = useMemo(() => {
    if (!user) return [] as NavItem[];
    const rolePermissions = ROLES_PERMISSIONS[user.role] || [];
    const permissionSet = new Set(rolePermissions);

    function filterNavItems(items: NavItem[]): NavItem[] {
      return items.map(item => {
        if (isGroup(item)) {
          const filteredChildren = filterNavItems(item.children) as (NavLeafItem | NavGroupItem)[];
          if (filteredChildren.length === 0) return null;
          return { ...item, children: filteredChildren } as NavGroupItem;
        }
        return permissionSet.has(item.permission) ? item : null;
      }).filter(Boolean) as NavItem[];
    }

    return filterNavItems(NAV_ITEMS);
  }, [user?.role]); // Only re-run when role changes, not entire user object
 

  // Create a function to check active children that accepts pathname and searchParams as arguments
  const createActiveChecker = (currentPathname: string, currentSearchParams: ReturnType<typeof useSearchParams> | URLSearchParams) => {
    function checkActiveInChildren(children: (NavLeafItem | NavGroupItem)[]): boolean {
      return children.some(c => {
        if (isGroup(c)) {
          return checkActiveInChildren(c.children);
        }
        try {
          // Parse hrefs to handle query parameters
          const cUrl = new URL(c.href, 'http://example.com');
          const searchParamsStr = currentSearchParams?.toString() || '';
          const currentFullPath = currentPathname + (searchParamsStr ? '?' + searchParamsStr : '');
          const currentUrl = new URL(currentFullPath, 'http://example.com');
          
          // Exact match (including query params) or child route
          return (currentUrl.pathname === cUrl.pathname && currentUrl.search === cUrl.search) || 
            (currentUrl.pathname.startsWith(cUrl.pathname + '/')) ||
            (currentUrl.pathname === cUrl.pathname && cUrl.search && currentUrl.search.includes(cUrl.search.substring(1)));
        } catch (e) {
          // Fallback for invalid URLs
          return c.href === currentPathname;
        }
      });
    }
    return checkActiveInChildren;
  };
  
  // Initialize openGroups state with groups that contain active routes
  function getInitialOpenGroups(items: NavItem[], currentPathname: string, currentSearchParams: ReturnType<typeof useSearchParams> | URLSearchParams): Record<string, boolean> {
    const initial: Record<string, boolean> = {};
    const checkActiveInChildren = createActiveChecker(currentPathname, currentSearchParams);
    
    function processItems(items: NavItem[], parentPath: string = '') {
      items.forEach(item => {
        if (isGroup(item)) {
          const groupPath = parentPath ? `${parentPath} > ${item.title}` : item.title;
          const hasActive = checkActiveInChildren(item.children);
          if (hasActive) {
            initial[item.title] = true;
          }
          // Process nested groups
          processItems(item.children, groupPath);
        }
      });
    }
    
    processItems(items);
    return initial;
  }
  
  // Manage open groups (keyed by group path for nested groups)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => getInitialOpenGroups(items, safePathname, sp));
  
  // Update open groups when pathname or search params change
  // Standard behavior: close all dropdowns except those containing the active page
  useEffect(() => {
    const newOpenGroups = getInitialOpenGroups(items, safePathname, sp);
    setOpenGroups(newOpenGroups);
  }, [safePathname, qs, items]);

  // Helper to get all leaf hrefs from navigation tree
  function getAllLeafHrefs(items: NavItem[]): string[] {
    const hrefs: string[] = [];
    items.forEach(item => {
      if (isGroup(item)) {
        hrefs.push(...getAllLeafHrefs(item.children));
      } else {
        hrefs.push(item.href);
      }
    });
    return hrefs;
  }
  
  const allHrefs = getAllLeafHrefs(items);

  // Recursive function to render navigation items (supports nested groups)
  function renderNavItem(item: NavItem, idx: number, depth: number, siblings: NavItem[] = []): React.ReactNode {
    const separatorClass = idx > 0 && depth === 0 ? 'mt-2 pt-2 border-t border-border/40' : '';
    const paddingLeft = depth > 0 ? `pl-${4 + depth * 4}` : 'pl-9';
    
    if (isGroup(item)) {
      const open = openGroups[item.title];
      const toggle = () => setOpenGroups(g => ({ ...g, [item.title]: !open }));
      const checkActiveInChildren = createActiveChecker(safePathname, sp);
      const childActive = checkActiveInChildren(item.children);
      const GroupIcon = item.icon;
      
      return (
        <li key={`${item.title}-${depth}-${idx}`} className={separatorClass}>
          <div className={cn(
            'relative',
            childActive && depth > 0 ? 'before:absolute before:inset-0 before:rounded-md before:pointer-events-none' : ''
          )}>
            <button
              type="button"
              onClick={toggle}
              className={cn(
                'w-full flex items-center gap-2 rounded-md px-4 py-2 text-left transition-colors outline-none focus:ring-2 focus:ring-ring hover:text-primary',
                depth > 0 ? 'font-medium text-sm' : 'font-semibold text-sm',
                childActive ? 'text-primary' : 'text-muted-foreground'
              )}
              style={{ paddingLeft: depth > 0 ? `${1 + depth * 0.75}rem` : undefined }}
              aria-expanded={open}
            >
              <GroupIcon className="h-4 w-4" />
              <span className="flex-1 truncate text-left">{item.title}</span>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
          <div className={cn(
            'ml-0 transition-all duration-200 ease-in-out',
            open ? 'mt-1 mb-2 max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
          )} aria-hidden={!open}>
            <ul className="space-y-1 pt-0.5">
              {item.children.map((child, childIdx) => renderNavItem(child, childIdx, depth + 1, item.children))}
            </ul>
          </div>
        </li>
      );
    }
    
    // Leaf item
    const leaf = item as NavLeafItem;
    const ActiveIcon = leaf.icon;
    
    let active = false;
    try {
      // Parse href to handle query parameters
      const hrefUrl = new URL(leaf.href, 'http://example.com');
      const currentUrl = new URL(safePathname + (qs ? '?' + qs : ''), 'http://example.com');
      
      // Check if current path matches exactly (including query params)
      const isExactMatch = currentUrl.pathname === hrefUrl.pathname && currentUrl.search === hrefUrl.search;
      
      // Check if it's a child route (pathname starts with href pathname)
      const isChildRoute = currentUrl.pathname.startsWith(hrefUrl.pathname + '/');
      
      // For routes with query params, also check if pathname matches and query params match
      const isPathnameMatchWithQuery = currentUrl.pathname === hrefUrl.pathname && 
        hrefUrl.search && currentUrl.search.includes(hrefUrl.search.substring(1));
      
      // Find if there's a more specific route that also matches
      const hasMoreSpecificMatch = isChildRoute && allHrefs.some(h => {
        if (h === leaf.href) return false;
        try {
          const hUrl = new URL(h, 'http://example.com');
          return hUrl.pathname.startsWith(hrefUrl.pathname) && 
            (currentUrl.pathname === hUrl.pathname || currentUrl.pathname.startsWith(hUrl.pathname + '/'));
        } catch (e) {
          return false;
        }
      });
      
      active = isExactMatch || isPathnameMatchWithQuery || (isChildRoute && !hasMoreSpecificMatch);
    } catch (e) {
      // Fallback for invalid URLs
      active = pathname === leaf.href;
    }
    
    return (
      <li
        key={leaf.href}
        className={cn(
          'transition-all duration-300',
          separatorClass
        )}
      >
        <Link
          href={leaf.href}
          onClick={() => onNavigate?.()}
          className={cn(
            'group flex items-center rounded-md pr-3 py-1.5 text-sm font-medium transition-colors relative',
            active
              ? 'text-primary'
              : 'text-muted-foreground hover:text-primary'
          )}
          style={{ paddingLeft: depth > 0 ? `${2.25 + depth * 0.75}rem` : '2.25rem' }}
        >
          <span className="truncate">{leaf.title}</span>
          {/* Left accent bar */}
          <span
            className={cn(
              'absolute top-1/2 -translate-y-1/2 h-5 w-1 rounded bg-primary/0 transition-colors group-hover:bg-primary/40',
              active ? 'bg-primary' : ''
            )}
            style={{ left: depth > 0 ? `${0.75 + depth * 0.75}rem` : '0.75rem' }}
          />
        </Link>
      </li>
    );
  }

  const baseClasses = `${mobile ? 'flex' : 'hidden md:flex'} w-64 flex-col border-r bg-gradient-to-b from-background to-background/80 backdrop-blur-sm shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)] relative`;
  const positionClasses = fixed ? 'fixed inset-y-0 left-0 z-40' : 'shrink-0';
  return (
    <aside className={cn(baseClasses, positionClasses, className)}>
      {/* subtle gradient hairline to accentuate right edge */}
      <span className="pointer-events-none absolute top-0 right-0 h-full w-px bg-gradient-to-b from-transparent via-border/70 to-transparent" />
      <div className="h-14 flex items-center px-4 font-semibold tracking-tight">
        <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-90 transition focus:outline-none focus:ring-2 focus:ring-ring rounded-sm">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/20">
            <Building2 className="h-4 w-4" />
          </span>
          <span className="truncate text-sm font-semibold tracking-tight">
            Apex
          </span>
        </Link>
        <div className="ml-auto">
          <GlobalSearch />
        </div>
      </div>
      <div className="px-3 mb-1">
        <div className="h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
      </div>
      <nav className="flex-1 overflow-y-auto py-2 text-sm custom-scrollbar-hover">
        <ul className="space-y-1 px-2">
          {items.map((item, idx) => renderNavItem(item, idx, 0, items))}
          {items.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground">No navigation</li>
          )}
        </ul>
      </nav>
    </aside>
  );
}
