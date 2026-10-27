import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PublicUser } from '@birge/shared';
import { useAuth } from '@/auth/AuthProvider';
import { api } from '@/lib/api';

/** Мен бұғаттаған адамдар: олардың хабарламалары жасырылады, дауысы өшіріледі. */
export function useBlocks() {
  const { status } = useAuth();
  const [users, setUsers] = useState<PublicUser[]>([]);

  const reload = useCallback(async () => {
    try {
      setUsers(await api.get<PublicUser[]>('/api/blocks'));
    } catch {
      // желі болмаса — бұрынғы тізім қалады
    }
  }, []);

  useEffect(() => {
    if (status === 'signedIn') void reload();
  }, [status, reload]);

  const block = useCallback(async (user: PublicUser) => {
    await api.post('/api/blocks', { userId: user.id });
    setUsers((list) => (list.some((u) => u.id === user.id) ? list : [user, ...list]));
  }, []);

  const unblock = useCallback(async (userId: string) => {
    await api.delete(`/api/blocks/${userId}`);
    setUsers((list) => list.filter((u) => u.id !== userId));
  }, []);

  const ids = useMemo(() => new Set(users.map((u) => u.id)), [users]);
  return { users, ids, block, unblock, reload };
}
