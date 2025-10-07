"use client";

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
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();

  function isGroup(item: NavItem): item is NavGroupItem {
    return (item as any)?.type === 'group' && Array.isArray((item as any).children);
  }

  const items = useMemo(() => {
    if (!user) return [] as NavItem[];
    const rolePermissions = ROLES_PERMISSIONS[user.role] || [];
    const permissionSet = new Set(rolePermissions);

    const filterItem = (item: NavItem): NavItem | null => {
      if (isGroup(item)) {
        const children = (item.children || [])
          .map(child => filterItem(child))
          .filter(Boolean) as NavItem[];
        if (children.length === 0) return null;
        return { ...item, children } as NavGroupItem;
      }
      return permissionSet.has((item as NavLeafItem).permission) ? item : null;
    };

    return NAV_ITEMS.map(filterItem).filter(Boolean) as NavItem[];
  }, [user?.role]);

  // Manage open groups (keyed by group path for nested groups)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Construct the full URL with query parameters for accurate matching
  const activePath = pathname + (searchParams.toString() ? '?' + searchParams.toString() : '');

  // Helper to check if a navigation href matches the current path
  const isActivePath = (navHref: string, currentPath: string): boolean => {
    // Handle exact matches
    if (navHref === currentPath) return true;
    
    // Handle query parameters - split URL and query
    const [navPath, navQuery] = navHref.split('?');
    const [currentPathOnly] = currentPath.split('?');
    
    // If navigation item has query params, check for exact match including query
    if (navQuery) {
      return navHref === currentPath;
    }
    
    // For paths without query params, check if current path starts with nav path
    return currentPath === navPath || currentPath.startsWith(navPath + '/');
  };

  // Helper to detect if group contains active route
  const groupHasActive = (group: NavGroupItem): boolean => {
    return group.children.some(child =>
      isGroup(child)
        ? groupHasActive(child)
        : isActivePath((child as NavLeafItem).href, activePath)
    );
  };

  // When the route changes, open only the groups that contain the active route
  useEffect(() => {
    const next: Record<string, boolean> = {};
    const walk = (itemsToCheck: NavItem[], parentKey = '') => {
      itemsToCheck.forEach(item => {
        if (isGroup(item)) {
          const key = parentKey ? `${parentKey} > ${item.title}` : item.title;
          if (groupHasActive(item)) {
            next[key] = true;
            walk(item.children, key);
          }
        }
      });
    };
    walk(items);
    setOpenGroups(next);
  }, [activePath, items]);

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
          {renderItems(items)}
          {items.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground">No navigation</li>
          )}
        </ul>
      </nav>
    </aside>
  );

  function renderItems(itemsToRender: NavItem[], parentKey = '', level = 0) {
    return itemsToRender.map((item, idx) => {
      const separatorClass = level === 0 && idx > 0 ? 'mt-2 pt-2 border-t border-border/40' : '';
      if (isGroup(item)) {
        const key = parentKey ? `${parentKey} > ${item.title}` : item.title;
        const open = !!openGroups[key];
        const toggle = () => setOpenGroups(g => ({ ...g, [key]: !open }));
        const GroupIcon = item.icon;
        const hasActiveItem = groupHasActive(item);
        return (
          <li key={key} className={separatorClass}>
            <button
              type="button"
              onClick={toggle}
              className={cn(
                'w-full flex items-center gap-2 rounded-md px-4 py-2 text-left transition-colors outline-none hover:text-primary font-semibold',
                hasActiveItem ? 'text-primary bg-primary/5' : open ? 'text-primary' : 'text-muted-foreground'
              )}
              aria-expanded={open}
            >
              <GroupIcon className={cn(
                'h-4 w-4 transition-colors',
                hasActiveItem ? 'text-primary' : ''
              )} />
              <span className={cn(
                'flex-1 truncate text-left transition-colors',
                hasActiveItem ? 'text-primary font-bold' : ''
              )}>{item.title}</span>
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <div
              className={cn(
                'ml-0 overflow-hidden transition-all duration-200 ease-in-out',
                open ? 'mt-1 mb-2 max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
              )}
              aria-hidden={!open}
            >
              <ul className="space-y-1 pt-0.5">
                {renderItems(item.children, key, level + 1)}
              </ul>
            </div>
          </li>
        );
      }
      const leaf = item as NavLeafItem;
      const ActiveIcon = leaf.icon;
      const active = isActivePath(leaf.href, activePath);
      return (
        <li key={leaf.href}>
          <Link
            href={leaf.href}
            onClick={() => onNavigate?.()}
            className={cn(
              'group flex items-center rounded-md pl-9 pr-3 py-1.5 text-sm font-medium transition-colors relative',
              active 
                ? 'text-primary bg-primary/10 border border-primary/20 shadow-sm' 
                : 'text-muted-foreground hover:text-primary hover:bg-muted/50'
            )}
          >
            <ActiveIcon className={cn(
              'h-4 w-4 mr-2 transition-colors',
              active ? 'text-primary' : 'text-muted-foreground'
            )} />
            <span className={cn(
              'truncate transition-colors',
              active ? 'text-primary font-semibold' : ''
            )}>{leaf.title}</span>
            <span
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2 h-5 w-1 rounded transition-all duration-200',
                active 
                  ? 'bg-primary w-1.5 shadow-sm' 
                  : 'bg-primary/0 group-hover:bg-primary/40 w-1'
              )}
            />
          </Link>
        </li>
      );
    });
  }
}
