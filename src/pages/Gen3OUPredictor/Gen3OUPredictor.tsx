import React, { useEffect, useState } from 'react';
import { chunkStepQueueTurns } from '@showdex/utils/battle/chunkStepQueueTurns';

export interface Gen3OUPredictorProps {
  store: any;
  battleId: string;
  battleRoom: any;
}

interface PredictionEntry {
  species: string;
  probability?: number;
}

export const Gen3OUPredictor: React.FC<Gen3OUPredictorProps> = ({ store, battleId, battleRoom }) => {
  const battle = battleRoom.battle;
  const [isLoading, setIsLoading] = useState(false);
  const [predictions, setPredictions] = useState<PredictionEntry[]>([]);
  const [topK, setTopK] = useState<number | null>(null);
  const [turn, setTurn] = useState(battle?.turn || 0);
  const [endGameSent, setEndGameSent] = useState(false);

  // Polling for turn updates & game end
  useEffect(() => {
    if (!battle) return;

    const interval = setInterval(() => {
      // Sync turn
      if (battle.turn !== turn) setTurn(battle.turn);
      // End game payload
      if (battle.ended && !endGameSent) {
        setEndGameSent(true);
        //void sendEndGameData();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [battle, turn, endGameSent]);

  // Helper: Build payload for prediction API
  const buildPayload = () => {
    // 1. Parse Rating
    const p1Rating = parseInt(battle.p1.rating || '0', 10);
    const p2Rating = parseInt(battle.p2.rating || '0', 10);
    const avgRating = (p1Rating && p2Rating) ? Math.floor((p1Rating + p2Rating) / 2) : 0;

    // 2. Build Team
    const buildTeam = (side: any) => {
      return side.pokemon.map((poke: any) => ({
        species: poke.speciesForme,
        moves: poke.moves,
      }));
    };

    // 3. Get Last Actions
    const turnChunks = chunkStepQueueTurns(battle.stepQueue);
    const lastTurnLog = turnChunks[turnChunks.length - 1] || [];

    const getAction = (sideId: string) => {
      const actionStep = lastTurnLog.find((step: string) =>
        step.startsWith('|move|' + sideId) || step.startsWith('|switch|' + sideId)
      );
      if (!actionStep) return { type: 'unknown', value: 'unknown' };
      const parts = actionStep.split('|');
      const type = parts[1];
      const value = parts[3];
      return { type, value };
    };

    // 4. Compose payload
    const mySideId = battle.mySide.sideid;
    const farSideId = battle.farSide.sideid;
    return {
      meta: {
        game_id: battle.id,
        turn_number: battle.turn,
        perspective: mySideId,
        rating: avgRating,
        upload_time: Math.floor(Date.now() / 1000),
      },
      observer_state: {
        active_pokemon: battle.mySide.active[0]?.speciesForme || '',
        revealed_team: buildTeam(battle.mySide),
      },
      opponent_state: {
        active_pokemon: battle.farSide.active[0]?.speciesForme || '',
        revealed_team: buildTeam(battle.farSide),
      },
      actions: {
        observer_action: getAction(mySideId),
        opponent_action: getAction(farSideId),
      },
      target: battle.ended ? battle.farSide.pokemon.map((p: any) => p.speciesForme) : [],
    };
  };

  // Send prediction payload on turn change
  useEffect(() => {
    if (!battle) return;

    const sendLogToBackend = async () => {
      setIsLoading(true);
      try {
        const payload = buildPayload();
        console.log("Predictor Payload:", payload);

        const response = await fetch('https://gen3predictor.azurewebsites.net/api/predict/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        // Support two response shapes:
        // 1) { predictions: [{ species, probability }], k }
        // 2) { pokemon: ["Species", ...] }
        if (Array.isArray(data?.predictions)) {
          const parsed: PredictionEntry[] = data.predictions
            .filter((p: any) => p && typeof p.species === 'string')
            .map((p: any) => ({ species: p.species, probability: typeof p.probability === 'number' ? p.probability : undefined }));
          setPredictions(parsed);
          setTopK(typeof data.k === 'number' ? data.k : null);
        } else if (Array.isArray(data?.pokemon)) {
          setPredictions((data.pokemon as string[]).map((name: string) => ({ species: name })));
          setTopK(null);
        } else {
          setPredictions([]);
          setTopK(null);
        }
      } catch (error) {
        console.error('Prediction API failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void sendLogToBackend();
  }, [turn]);

  // Send end game payload when detected
  // const sendEndGameData = async () => {
  //   try {
  //     const opponentSide = battle.farSide;
  //     const targetList = opponentSide.pokemon.map((p: any) => p.speciesForme || p.name);

  //     const payload = {
  //       game_id: battle.id,
  //       perspective: battle.mySide.sideid,
  //       target: targetList,
  //     };

  //     console.log("Sending End Game Data:", payload);

  //     await fetch('https://yourbackend/api/end-game', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify(payload),
  //     });

  //   } catch (error) {
  //     console.error('Failed to send end game data:', error);
  //     setEndGameSent(false);
  //   }
  // };

  return (
    <div style={{
      padding: 32,
      textAlign: 'center',
      fontSize: 20,
      color: '#444',
      background: '#f7f7f7',
      borderRadius: 16,
      boxShadow: '0 4px 20px #0001'
    }}>
      <strong>Gen 3 OU Dex Predictor</strong>
      <div style={{ marginTop: 10 }}>
        battleId: <code>{battleId}</code><br />
        current turn: {battle?.turn ?? '??'}
      </div>
      {isLoading ? (
        <div style={{ marginTop: 20, color: '#999' }}>Fetching prediction...</div>
      ) : (
        predictions.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <strong>
              Predicted Pokémon{topK ? ` (top ${topK})` : ''}:
            </strong>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {predictions.map((p, i) => (
                <li key={i} style={{ margin: '6px 0' }}>
                  {p.species}
                  {typeof p.probability === 'number' && (
                    <span style={{ color: '#666' }}> — {(p.probability * 100).toFixed(1)}%</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      )}
      {battle?.ended && <div style={{ marginTop: 10, color: 'green' }}>Battle Ended - Data Submitted</div>}
    </div>
  );
};
