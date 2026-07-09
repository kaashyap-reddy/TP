import { useEffect, useRef, useState } from 'react';

export function useTabLoadingSkeleton(activeTab: string, delayMs = 350): boolean {
  const [tabLoading, setTabLoading] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setTabLoading(true);
    const timer = setTimeout(() => setTabLoading(false), delayMs);
    return () => clearTimeout(timer);
  }, [activeTab, delayMs]);

  return tabLoading;
}
