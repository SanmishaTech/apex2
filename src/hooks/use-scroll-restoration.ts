'use client';

import React, { useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface ScrollPosition {
  x: number;
  y: number;
}

// In-memory storage for scroll positions during the session
const scrollPositions = new Map<string, ScrollPosition>();

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

  // Enhanced router push that saves scroll position before navigating
  const pushWithScrollSave = useCallback((href: string) => {
    saveScrollPosition();
    router.push(href);
  }, [router, saveScrollPosition]);

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
      restoreScrollPosition();
    }, 100); // Small delay to ensure content is rendered

    return () => clearTimeout(timeoutId);
  }, [restoreScrollPosition]);

  return {
    saveScrollPosition,
    restoreScrollPosition,
    pushWithScrollSave,
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
