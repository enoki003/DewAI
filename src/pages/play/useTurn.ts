import { useCallback } from 'react';

export function useTurn() {
  const computeNextTurn = useCallback((params: { currentTurn: number; aiCount: number; userParticipates: boolean }) => {
    const { currentTurn, aiCount, userParticipates } = params;
    if (userParticipates) return currentTurn < aiCount ? currentTurn + 1 : 0;
    return currentTurn < aiCount ? currentTurn + 1 : 1;
  }, []);

  return { computeNextTurn };
}
