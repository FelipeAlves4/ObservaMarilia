import { createContext, useContext, type ReactNode } from 'react';
import { useRoute } from './data';

const CitizenModeContext = createContext(false);

export function CitizenModeProvider({ children }: { children: ReactNode }) {
  const route = useRoute();
  const enabled = route === '/cidadao' || route.startsWith('/cidadao/') || route.startsWith('/cidadao?');
  return <CitizenModeContext.Provider value={enabled}>{children}</CitizenModeContext.Provider>;
}

export function useCitizenMode() {
  const enabled = useContext(CitizenModeContext);
  const path = (destination: string) => enabled ? `/cidadao${destination === '/' ? '' : destination}` : destination;
  return {
    enabled,
    href: (destination: string) => `#${path(destination)}`,
    navigate: (destination: string) => { window.location.hash = path(destination); },
  };
}
