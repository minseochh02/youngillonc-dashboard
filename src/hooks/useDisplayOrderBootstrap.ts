'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { recordToMap } from '@/lib/display-order-core';

export type DisplayOrderMaps = {
  office: Map<string, number>;
  teamB2c: Map<string, number>;
  teamB2b: Map<string, number>;
  empB2c: Map<string, number>;
  empB2b: Map<string, number>;
};

const emptyMaps = (): DisplayOrderMaps => ({
  office: new Map(),
  teamB2c: new Map(),
  teamB2b: new Map(),
  empB2c: new Map(),
  empB2b: new Map(),
});

/**
 * Loads admin display-order maps once for client-side sorting (compareTeams / compareOffices / compareEmployees).
 */
export function useDisplayOrderBootstrap(): DisplayOrderMaps & { ready: boolean } {
  const [state, setState] = useState<DisplayOrderMaps & { ready: boolean }>(() => ({
    ...emptyMaps(),
    ready: false,
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/dashboard/display-order/bootstrap');
        const j = await res.json();
        if (cancelled) return;
        if (!j?.success) {
          setState({ ...emptyMaps(), ready: true });
          return;
        }
        setState({
          office: recordToMap(j.office || {}),
          teamB2c: recordToMap(j.teamB2c || {}),
          teamB2b: recordToMap(j.teamB2b || {}),
          empB2c: recordToMap(j.empB2c || {}),
          empB2b: recordToMap(j.empB2b || {}),
          ready: true,
        });
      } catch {
        if (!cancelled) setState({ ...emptyMaps(), ready: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
