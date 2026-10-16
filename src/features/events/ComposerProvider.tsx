import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { ItemComposer, type ComposerRequest } from './components/ItemComposer';

/**
 * One composer for the whole app: the clock, the calendar's + and the day
 * panel all open it through `compose`.
 */
type ComposerContextValue = { compose: (request: ComposerRequest) => void };

const ComposerContext = createContext<ComposerContextValue>({ compose: () => {} });

export const useComposer = () => useContext(ComposerContext);

export function ComposerProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ComposerRequest | null>(null);
  const compose = useCallback((next: ComposerRequest) => setRequest(next), []);
  const value = useMemo(() => ({ compose }), [compose]);
  return (
    <ComposerContext.Provider value={value}>
      {children}
      <ItemComposer request={request} onClose={() => setRequest(null)} />
    </ComposerContext.Provider>
  );
}
