import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import type { Occurrence } from './types';
interface DataValue { records: Occurrence[]; mine: Occurrence[]; loading: boolean; error: string; refresh: () => Promise<void> }
const DataContext = createContext<DataValue | null>(null);
export function DataProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<Occurrence[]>([]);
  const [mine, setMine] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const [all, own] = await Promise.all([api.list(), api.list(true)]);
      setRecords(all); setMine(own); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Erro de conexão.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <DataContext.Provider value={{ records, mine, loading, error, refresh }}>{children}</DataContext.Provider>;
}
export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('DataProvider ausente.');
  return context;
}
export function useRoute() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || '/');
  useEffect(() => {
    const handler = () => { setRoute(location.hash.slice(1) || '/'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return route;
}
export function go(path: string) { location.hash = path; }
