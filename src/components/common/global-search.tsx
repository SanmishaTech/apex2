"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CommandDialog, 
  CommandInput, 
  CommandList, 
  CommandEmpty, 
  CommandGroup, 
  CommandItem 
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Search, ArrowRight } from 'lucide-react';
import { NAV_ITEMS, NavItem, NavGroupItem, NavLeafItem } from '@/config/nav';
import { useCurrentUser } from '@/hooks/use-current-user';
import { ROLES_PERMISSIONS } from '@/config/roles';

interface SearchableItem extends NavLeafItem {
  group?: string;
  fullPath: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const router = useRouter();
  const { user } = useCurrentUser();

  // Generate searchable items based on user permissions
  const searchableItems = useMemo(() => {
    if (!user) return [];

    const rolePermissions = ROLES_PERMISSIONS[user.role] || [];
    const permissionSet = new Set(rolePermissions);
    const items: SearchableItem[] = [];

    NAV_ITEMS.forEach(item => {
      if (isGroup(item)) {
        const filteredChildren = item.children.filter(c => permissionSet.has(c.permission));
        filteredChildren.forEach(child => {
          items.push({
            ...child,
            group: item.title,
            fullPath: `${item.title} > ${child.title}`
          });
        });
      } else if (permissionSet.has(item.permission)) {
        items.push({
          ...item,
          fullPath: item.title
        });
      }
    });

    return items;
  }, [user?.role]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!search) return searchableItems;
    
    const query = search.toLowerCase();
    return searchableItems.filter(item => 
      item.title.toLowerCase().includes(query) ||
      item.fullPath.toLowerCase().includes(query) ||
      (item.group && item.group.toLowerCase().includes(query))
    );
  }, [searchableItems, search]);

  // Group filtered items
  const groupedItems = useMemo(() => {
    const groups: Record<string, SearchableItem[]> = {};
    
    filteredItems.forEach(item => {
      const groupName = item.group || 'Navigation';
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(item);
    });
    
    return groups;
  }, [filteredItems]);

  function isGroup(item: NavItem): item is NavGroupItem {
    return (item as NavGroupItem).children !== undefined;
  }

  const handleSelect = (href: string) => {
    setOpen(false);
    setSearch('');
    router.push(href);
  };

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-8 w-8 rounded-md border-border/40 hover:border-border/60 hover:bg-muted/50 transition-colors"
        title="Search (Ctrl+K)"
      >
        <Search className="h-4 w-4" />
        <span className="sr-only">Search</span>
      </Button>

      <CommandDialog 
        open={open} 
        onOpenChange={setOpen}
        title="Search Navigation"
        description="Search for pages and features"
      >
        <CommandInput 
          placeholder="Search navigation..." 
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          {Object.entries(groupedItems).map(([groupName, items]) => (
            <CommandGroup key={groupName} heading={groupName}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={item.fullPath}
                    onSelect={() => handleSelect(item.href)}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{item.title}</span>
                      {item.group && (
                        <span className="text-xs text-muted-foreground">
                          {item.group}
                        </span>
                      )}
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto" />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
