import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { loadSettings, saveSettings } from '@/storage/settingsStorage';
import type { AppSettings, CallerProfile } from '@/types/call';

import { DEFAULT_SETTINGS } from './defaults';

export type SettingsStatus = 'loading' | 'ready';

interface SettingsContextValue {
  settings: AppSettings;
  status: SettingsStatus;
  /** Set when reading or writing local storage failed; the app keeps working in memory. */
  storageError: string | null;
  updateCaller: (patch: Partial<CallerProfile>) => void;
  setVibrate: (vibrate: boolean) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<SettingsStatus>('loading');
  const [storageError, setStorageError] = useState<string | null>(null);

  // Tracks the latest value so rapid successive updates never write stale data.
  const latest = useRef<AppSettings>(DEFAULT_SETTINGS);
  const userChangedBeforeLoad = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadSettings()
      .then((loaded) => {
        if (cancelled) return;
        // If the user somehow changed something before the read finished, keep their change.
        if (!userChangedBeforeLoad.current) {
          latest.current = loaded;
          setSettings(loaded);
        }
      })
      .catch(() => {
        if (!cancelled) setStorageError('Saved settings could not be read. Using defaults.');
      })
      .finally(() => {
        if (!cancelled) setStatus('ready');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = useCallback((next: AppSettings) => {
    latest.current = next;
    userChangedBeforeLoad.current = true;
    setSettings(next);
    saveSettings(next)
      .then(() => setStorageError(null))
      .catch(() => setStorageError('Changes could not be saved on this device.'));
  }, []);

  const updateCaller = useCallback(
    (patch: Partial<CallerProfile>) => {
      commit({ ...latest.current, caller: { ...latest.current.caller, ...patch } });
    },
    [commit],
  );

  const setVibrate = useCallback(
    (vibrate: boolean) => {
      commit({ ...latest.current, vibrate });
    },
    [commit],
  );

  const resetSettings = useCallback(() => commit(DEFAULT_SETTINGS), [commit]);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, status, storageError, updateCaller, setVibrate, resetSettings }),
    [settings, status, storageError, updateCaller, setVibrate, resetSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
