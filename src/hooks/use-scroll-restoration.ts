'use client';

import React, { useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface ScrollPosition {
  x: number;
  y: number;
}

// In-memory storage for scroll positions and URLs during the session
const scrollPositions = new Map<string, ScrollPosition>();
const savedUrls = new Map<string, string>();

export function useScrollRestoration(key: string) {
  const router = useRouter();
  const pathname = usePathname();

  // Save current scroll position
  const saveScrollPosition = useCallback(() => {
    scrollPositions.set(key, {
      x: window.scrollX,
      y: window.scrollY,
    });
  }, [key]);

  // Restore scroll position
  const restoreScrollPosition = useCallback(() => {
    const position = scrollPositions.get(key);
    if (position) {
      window.scrollTo(position.x, position.y);
      return true;
    }
    return false;
  }, [key]);

  // Enhanced router push that saves scroll position and current URL before navigating
  const pushWithScrollSave = useCallback((href: string) => {
    saveScrollPosition();
    // Save current URL with query params
    const currentUrl = window.location.pathname + window.location.search;
    savedUrls.set(key, currentUrl);
    console.log(`[ScrollRestoration] Saved scroll for key: ${key}, position: ${window.scrollY}, url: ${currentUrl}`);
    router.push(href);
  }, [router, saveScrollPosition, key]);

  // Navigate to a URL and restore the saved state for a specific key
  const pushAndRestoreKey = useCallback((restoreKey: string) => {
    const savedUrl = savedUrls.get(restoreKey);
    const targetUrl = savedUrl || pathname || '/';
    console.log(`[ScrollRestoration] Navigating to: ${targetUrl} (from key: ${restoreKey})`);
    router.push(targetUrl);
  }, [router, pathname]);

  // Enhanced router back that restores scroll position
  const backWithScrollRestore = useCallback(() => {
    router.back();
    // Restore after navigation (with a small delay to ensure DOM is ready)
    setTimeout(() => {
      restoreScrollPosition();
    }, 50);
  }, [router, restoreScrollPosition]);

  // Auto-save scroll position when component unmounts
  useEffect(() => {
    return () => {
      saveScrollPosition();
    };
  }, [saveScrollPosition]);

  // Auto-restore scroll position when component mounts (if coming back)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const restored = restoreScrollPosition();
      if (restored) {
        console.log(`[ScrollRestoration] Restored scroll for key: ${key}`);
      }
    }, 150); // Increased delay to ensure content is fully rendered

    return () => clearTimeout(timeoutId);
  }, [restoreScrollPosition, key]);

  return {
    saveScrollPosition,
    restoreScrollPosition,
    pushWithScrollSave,
    pushAndRestoreKey,
    backWithScrollRestore,
  };
}

// Higher-order component for automatic scroll restoration
export function withScrollRestoration<T extends Record<string, any>>(
  Component: React.ComponentType<T>,
  scrollKey: string
) {
  return function WrappedComponent(props: T) {
    useScrollRestoration(scrollKey);
    return React.createElement(Component, props);
  };
}
