import { useState, useRef, useCallback } from 'react'
import { useMissionStore } from '../store/useMissionStore'
import { evaluatePath } from '../logic/disjunctiveEngine'
import { UserBehaviorLog } from '../services/userBehaviorLog'

export function useChallenge(challenge) {
  const [selectedPath, setSelectedPath] = useState(null)   // 'pathA' | 'pathB'
  const [userAnswer, setUserAnswer] = useState('')
  const [result, setResult] = useState(null)               // evaluatePath output
  const [phase, setPhase] = useState('select')             // select | answer | feedback
  const startTimeRef = useRef(null)

  const resolveChallenge = useMissionStore((s) => s.resolveChallenge)

  const choosePath = useCallback((pathKey) => {
    setSelectedPath(pathKey)
    startTimeRef.current = Date.now()
    setPhase('answer')
  }, [])

  const submitAnswer = useCallback(() => {
    if (!selectedPath || userAnswer === '') return

    const latencyMs = Date.now() - (startTimeRef.current ?? Date.now())
    const evalResult = evaluatePath({ challenge, chosenPathKey: selectedPath, userAnswer, latencyMs })

    // Persist to store + telemetry
    resolveChallenge(evalResult)
    UserBehaviorLog.record({ ...evalResult, biomeId: challenge.biome })

    setResult(evalResult)
    setPhase('feedback')
  }, [challenge, selectedPath, userAnswer, resolveChallenge])

  const reset = useCallback(() => {
    setSelectedPath(null)
    setUserAnswer('')
    setResult(null)
    setPhase('select')
    startTimeRef.current = null
  }, [])

  return {
    phase,
    selectedPath,
    userAnswer,
    result,
    choosePath,
    setUserAnswer,
    submitAnswer,
    reset,
  }
}
