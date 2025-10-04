"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, NavItem, NavGroupItem, NavLeafItem } from '@/config/nav';
import { useCurrentUser } from '@/hooks/use-current-user';
import { ROLES_PERMISSIONS } from '@/config/roles';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { useState, useMemo } from 'react';
import { GlobalSearch } from '@/components/common/global-search';

type SidebarProps = {
  fixed?: boolean;
  className?: string;
  mobile?: boolean; // show in mobile context (removes hidden md:flex)
  onNavigate?: () => void; // callback when a navigation link is clicked (useful for mobile close)
};

export function Sidebar({ fixed, className, mobile, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useCurrentUser();

  const items = useMemo(() => {
    if (!user) return [];

    const rolePermissions = ROLES_PERMISSIONS[user.role] || [];
    const permissionSet = new Set(rolePermissions); // O(1) lookup instead of O(n)

    return NAV_ITEMS.map(item => {
      if (isGroup(item)) {
        const filteredChildren = item.children.filter(c => permissionSet.has(c.permission));
        if (filteredChildren.length === 0) return null;
        return { ...item, children: filteredChildren } as NavGroupItem;
      }
      return permissionSet.has(item.permission) ? item : null;
    }).filter(Boolean) as NavItem[];
  }, [user?.role]); // Only re-run when role changes, not entire user object

  function isGroup(item: NavItem): item is NavGroupItem {
    return (item as NavGroupItem).children !== undefined;
  }

  // Manage open groups
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Auto-open groups containing active route
  const activePath = pathname;
  items.forEach(item => {
    if (isGroup(item)) {
      const hasActive = item.children.some(c => c.href === activePath || activePath.startsWith(c.href + '/'));
      if (hasActive && !openGroups[item.title]) {
        openGroups[item.title] = true; // mutate initial (safe before first render commit)
      }
    }
  });

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
          {items.map((item, idx) => {
            const separatorClass = idx > 0 ? 'mt-2 pt-2 border-t border-border/40' : '';
            if (isGroup(item)) {
              const open = openGroups[item.title];
              const toggle = () => setOpenGroups(g => ({ ...g, [item.title]: !open }));
              const childActive = item.children.some(c => pathname === c.href || activePath.startsWith(c.href + '/'));
              const GroupIcon = item.icon;
              return (
                <li key={item.title} className={separatorClass}>
          <button
                    type="button"
                    onClick={toggle}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-md px-4 py-2 text-left transition-colors outline-none focus:ring-2 focus:ring-ring hover:text-primary font-semibold',
                      childActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                    aria-expanded={open}
                  >
                    <GroupIcon className="h-4 w-4" />
                    <span className="flex-1 truncate text-left">{item.title}</span>
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className={cn(
                    'ml-0 overflow-hidden transition-all duration-200 ease-in-out',
                    open ? 'mt-1 mb-2 max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
                  )} aria-hidden={!open}>
                    <ul className="space-y-1 pt-0.5">
                    {item.children.map((child, idx) => {
                      const active = pathname === child.href || activePath.startsWith(child.href + '/');
                      return (
                        <li
                          key={child.href}
                          className={cn(
                            'transition-all duration-300',
                            open
                              ? 'opacity-100 translate-y-0'
                              : 'opacity-0 -translate-y-1'
                          )}
                          style={{ transitionDelay: open ? `${idx * 40}ms` : '0ms' }}
                        >
                          <Link
                            href={child.href}
                            onClick={() => onNavigate?.()}
                            className={cn(
                              'group flex items-center rounded-md pl-9 pr-3 py-1.5 text-sm font-medium transition-colors relative',
                              active
                                ? 'text-primary'
                                : 'text-muted-foreground hover:text-primary'
                            )}
                          >
                            <span className="truncate">{child.title}</span>
                            {/* Left accent bar */}
                            <span
                              className={cn(
                                'absolute left-3 top-1/2 -translate-y-1/2 h-5 w-1 rounded bg-primary/0 transition-colors group-hover:bg-primary/40',
                                active ? 'bg-primary' : ''
                              )}
                            />
                          </Link>
                        </li>
                      );
                    })}
                    </ul>
                  </div>
                </li>
              );
            }
            const leaf = item as NavLeafItem; // narrowed
            const ActiveIcon = leaf.icon;
            const active = pathname === leaf.href || activePath.startsWith(leaf.href + '/');
            return (
              <li key={leaf.href} className={separatorClass}>
                <Link
                  href={leaf.href}
                  onClick={() => onNavigate?.()}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-4 py-2 transition-colors font-semibold',
                    active ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                  )}
                >
                  <ActiveIcon className="h-4 w-4" />
                  <span>{leaf.title}</span>
                </Link>
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="px-3 py-2 text-muted-foreground">No navigation</li>
          )}
  </ul>
      </nav>
    </aside>
  );
}
