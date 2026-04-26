import { create } from 'zustand'
import { BIOMES, BIOME_META, MATH_CHALLENGES } from '../constants/mathChallenges'

const initialBiomeState = Object.keys(BIOME_META).reduce((acc, key) => {
  acc[key] = {
    unlocked: true,
    energyLevel: 0,        // 0–100: drives the color-restoration effect
    completedChallenges: [],
  }
  return acc
}, {})

export const useMissionStore = create((set, get) => ({
  // ── Explorer identity ────────────────────────────────────────────────────
  explorerName: 'Explorador',
  totalEnergy: 0,
  missionStartedAt: Date.now(),

  // ── Biome state ──────────────────────────────────────────────────────────
  biomes: initialBiomeState,

  // ── Active challenge session ─────────────────────────────────────────────
  activeBiome: null,
  activeChallengeId: null,
  lastResult: null,   // { challengeId, chosenPath, correct, energyGained, timestamp }

  // ── Behaviour telemetry (raw log entries — persisted via service) ─────────
  behaviorLog: [],

  // ── Actions ──────────────────────────────────────────────────────────────
  setExplorerName: (name) => set({ explorerName: name }),

  enterBiome: (biomeId) => set({ activeBiome: biomeId, activeChallengeId: null }),

  exitBiome: () => set({ activeBiome: null, activeChallengeId: null }),

  startChallenge: (challengeId) => set({ activeChallengeId: challengeId, lastResult: null }),

  resolveChallenge: ({ challengeId, chosenPath, isCorrect, energyGained, latencyMs }) => {
    const state = get()
    const challenge = MATH_CHALLENGES.find((c) => c.id === challengeId)
    if (!challenge) return

    const biomeId = challenge.biome
    const biome = state.biomes[biomeId]

    const alreadyCompleted = biome.completedChallenges.includes(challengeId)
    const newEnergy = isCorrect && !alreadyCompleted
      ? Math.min(100, biome.energyLevel + energyGained)
      : biome.energyLevel

    const logEntry = {
      timestamp: Date.now(),
      challengeId,
      biomeId,
      chosenPath,        // 'A' | 'B'
      isCorrect,
      latencyMs,
      energyGained: isCorrect ? energyGained : 0,
    }

    set((s) => ({
      totalEnergy: isCorrect && !alreadyCompleted
        ? s.totalEnergy + energyGained
        : s.totalEnergy,
      lastResult: { challengeId, chosenPath, isCorrect, energyGained, timestamp: Date.now() },
      biomes: {
        ...s.biomes,
        [biomeId]: {
          ...biome,
          energyLevel: newEnergy,
          completedChallenges: alreadyCompleted
            ? biome.completedChallenges
            : isCorrect
              ? [...biome.completedChallenges, challengeId]
              : biome.completedChallenges,
        },
      },
      behaviorLog: [...s.behaviorLog, logEntry],
    }))

    return logEntry
  },

  clearChallenge: () => set({ activeChallengeId: null, lastResult: null }),

  // Selector helpers (stable references via getState pattern)
  getBiomeChallenges: (biomeId) =>
    MATH_CHALLENGES.filter((c) => c.biome === biomeId),

  getBiomeProgress: (biomeId) => {
    const total = MATH_CHALLENGES.filter((c) => c.biome === biomeId).length
    const completed = get().biomes[biomeId]?.completedChallenges.length ?? 0
    return total > 0 ? Math.round((completed / total) * 100) : 0
  },
}))
