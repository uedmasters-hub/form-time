import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Whether the primary pointer can hover (mouse, trackpad). False on phones,
 * tablets and native apps, where controls need a stronger resting state.
 */
export function useCanHover(): boolean {
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    setCanHover(query.matches);
    const onChange = (event: MediaQueryListEvent) => setCanHover(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return canHover;
}
