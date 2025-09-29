'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

// In-memory storage for scroll positions during the session
const scrollPositions = new Map<string, { x: number; y: number }>();

export function useScrollRestoration() {
  const router = useRouter();

  // Save current scroll position before navigation
  const pushWithScrollSave = useCallback((href: string, scrollKey: string) => {
    // Save current scroll position
    scrollPositions.set(scrollKey, {
      x: window.scrollX,
      y: window.scrollY,
    });
    router.push(href);
  }, [router]);

  // Navigate back and restore scroll position
  const backWithScrollRestore = useCallback((scrollKey: string) => {
    router.back();
    // Restore after navigation (with a small delay to ensure DOM is ready)
    setTimeout(() => {
      const position = scrollPositions.get(scrollKey);
      if (position) {
        window.scrollTo(position.x, position.y);
      }
    }, 100);
  }, [router]);

  return {
    pushWithScrollSave,
    backWithScrollRestore,
  };
}
