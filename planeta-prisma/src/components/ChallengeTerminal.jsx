import { motion } from 'framer-motion'
import { Terminal, ChevronLeft, CheckCircle2, Lock } from 'lucide-react'
import { MATH_CHALLENGES, BIOME_META } from '../constants/mathChallenges'
import { useMissionStore } from '../store/useMissionStore'
import ChallengeModule from './ChallengeModule'

export default function ChallengeTerminal({ biomeId, onBack }) {
  const biomeMeta = BIOME_META[biomeId]
  const biomeState = useMissionStore((s) => s.biomes[biomeId])
  const { activeChallengeId, startChallenge, clearChallenge } = useMissionStore()

  const challenges = MATH_CHALLENGES.filter((c) => c.biome === biomeId)
  const activeChallenge = challenges.find((c) => c.id === activeChallengeId)

  const handleComplete = () => clearChallenge()

  return (
    <motion.div
      className="min-h-screen bg-cosmos-900 pt-20 pb-12 px-4"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3 }}
    >
      {/* Terminal header bar */}
      <div className="max-w-2xl mx-auto mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white
            font-mono text-sm mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Volver al mapa
        </button>

        <div
          className={`p-5 rounded-xl border ${biomeMeta.borderColor} bg-gradient-to-br
            ${biomeMeta.bgFrom} ${biomeMeta.bgTo} shadow-lg ${biomeMeta.glowColor}`}
        >
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5" style={{ color: biomeMeta.accentColor }} />
            <div>
              <h1 className="font-display font-bold text-white text-xl">{biomeMeta.name}</h1>
              <p className="text-sm text-slate-400 mt-0.5">{biomeMeta.description}</p>
            </div>
            <div className="ml-auto text-right">
              <div className="text-xs font-mono text-slate-500">Energía del sector</div>
              <div className="font-mono font-bold text-lg" style={{ color: biomeMeta.accentColor }}>
                {biomeState.energyLevel}%
              </div>
            </div>
          </div>

          {/* Energy bar */}
          <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: biomeMeta.accentColor }}
              initial={{ width: 0 }}
              animate={{ width: `${biomeState.energyLevel}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Active challenge or challenge list */}
      <div className="max-w-2xl mx-auto">
        {activeChallenge ? (
          <ChallengeModule challenge={activeChallenge} onComplete={handleComplete} />
        ) : (
          <ChallengeList
            challenges={challenges}
            completed={biomeState.completedChallenges}
            accentColor={biomeMeta.accentColor}
            borderColor={biomeMeta.borderColor}
            onSelect={startChallenge}
          />
        )}
      </div>
    </motion.div>
  )
}

function ChallengeList({ challenges, completed, accentColor, borderColor, onSelect }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-mono text-xs text-slate-500 uppercase tracking-widest mb-2">
        — Muestras disponibles —
      </h2>
      {challenges.map((ch, i) => {
        const done = completed.includes(ch.id)
        return (
          <motion.button
            key={ch.id}
            whileHover={!done ? { scale: 1.01 } : {}}
            whileTap={!done ? { scale: 0.99 } : {}}
            onClick={() => !done && onSelect(ch.id)}
            className={`w-full text-left p-5 rounded-xl border transition-all
              ${done
                ? 'border-green-800/40 bg-green-950/20 cursor-default'
                : `${borderColor} bg-cosmos-800/60 hover:bg-cosmos-700/40 cursor-pointer`
              }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{ch.sample.icon}</span>
                <div>
                  <div className="font-display font-semibold text-white">{ch.title}</div>
                  <div className="text-xs font-mono text-slate-500 mt-1 flex gap-2 flex-wrap">
                    {ch.tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {done ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-1" />
              ) : (
                <span
                  className="font-mono text-xs shrink-0 mt-1"
                  style={{ color: accentColor }}
                >
                  MISIÓN {String(i + 1).padStart(2, '0')}
                </span>
              )}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}
