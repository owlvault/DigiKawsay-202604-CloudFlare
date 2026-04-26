// Evaluates a user's numeric answer against a challenge path.
// Returns a structured result object consumed by ChallengeModule and the store.

export function evaluatePath({ challenge, chosenPathKey, userAnswer, latencyMs }) {
  const path = challenge[chosenPathKey]   // pathA or pathB
  const isCorrect = Number(userAnswer) === path.answer

  // Energy reward: path-specific cost determines efficiency bonus
  // Correct on pathB gives double base reward to reinforce complex thinking
  const baseReward = isCorrect
    ? chosenPathKey === 'pathB'
      ? 20
      : 10
    : 0

  return {
    challengeId: challenge.id,
    biomeId: challenge.biome,
    chosenPath: chosenPathKey === 'pathA' ? 'A' : 'B',
    isCorrect,
    energyGained: baseReward,
    latencyMs,
    path,
    // Feedback messages avoid binary correct/incorrect framing
    feedbackKey: isCorrect ? 'sync_ok' : 'sync_fail',
  }
}

// Determines whether a biome has been fully restored (all challenges completed)
export function isBiomeRestored(biomeState, biomeChallengeIds) {
  return biomeChallengeIds.every((id) =>
    biomeState.completedChallenges.includes(id)
  )
}

// Maps energy level (0-100) to a CSS filter string for the color-restoration effect
export function energyToFilter(energyLevel) {
  const saturation = 20 + energyLevel * 0.8   // 20% → 100% as energy fills
  const brightness = 0.6 + energyLevel * 0.004 // 0.6 → 1.0
  return `saturate(${saturation}%) brightness(${brightness})`
}
