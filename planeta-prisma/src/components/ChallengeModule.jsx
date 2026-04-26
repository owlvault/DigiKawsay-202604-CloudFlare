import { motion } from 'framer-motion'
import { FlaskConical, Zap, ArrowRight, RotateCcw } from 'lucide-react'
import { useChallenge } from '../hooks/useChallenge'
import FeedbackOverlay from './FeedbackOverlay'

export default function ChallengeModule({ challenge, onComplete }) {
  const {
    phase,
    selectedPath,
    userAnswer,
    result,
    choosePath,
    setUserAnswer,
    submitAnswer,
    reset,
  } = useChallenge(challenge)

  const handleContinue = () => {
    if (result?.isCorrect) {
      onComplete?.()
    } else {
      reset()
    }
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Sample header */}
      <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
        <span className="text-3xl">{challenge.sample.icon}</span>
        <div>
          <div className="text-xs font-mono text-slate-400 uppercase tracking-widest">
            Muestra Científica — {challenge.biome.toUpperCase()}
          </div>
          <div className="font-display font-bold text-white text-lg">{challenge.title}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs font-mono text-slate-500">{challenge.sample.label}</div>
          <div className="font-mono text-neon-cyan font-bold">{challenge.sample.value}</div>
        </div>
      </div>

      {/* Narrative */}
      <p className="text-slate-300 text-sm leading-relaxed mb-8 px-1">
        {challenge.narrative}
      </p>

      {/* Phase: select path */}
      {phase === 'select' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PathCard
            pathKey="pathA"
            path={challenge.pathA}
            accentColor="text-neon-cyan"
            borderColor="border-cyan-500/40"
            hoverBg="hover:bg-cyan-950/40"
            onClick={() => choosePath('pathA')}
          />
          <PathCard
            pathKey="pathB"
            path={challenge.pathB}
            accentColor="text-neon-green"
            borderColor="border-green-500/40"
            hoverBg="hover:bg-green-950/40"
            onClick={() => choosePath('pathB')}
          />
        </div>
      )}

      {/* Phase: enter answer */}
      {phase === 'answer' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="w-full p-4 rounded-xl border border-white/10 bg-white/5 text-center">
            <div className="text-xs font-mono text-slate-400 mb-1 uppercase tracking-widest">
              Vía {selectedPath === 'pathA' ? 'A' : 'B'} — {challenge[selectedPath].label}
            </div>
            <div className="font-mono text-2xl text-white font-bold tracking-wider">
              {challenge[selectedPath].expression} = ?
            </div>
            <div className="text-xs text-slate-500 mt-2 italic">{challenge[selectedPath].hint}</div>
          </div>

          <div className="flex items-center gap-3 w-full max-w-xs">
            <FlaskConical className="w-5 h-5 text-neon-amber shrink-0" />
            <input
              type="number"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitAnswer()}
              placeholder="Ingresa el resultado…"
              className="flex-1 bg-cosmos-800 border border-cyan-700/50 rounded-lg px-4 py-3
                font-mono text-white text-center text-lg focus:outline-none focus:border-neon-cyan
                focus:shadow-[0_0_12px_rgba(0,245,255,0.3)] transition-all"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700
                text-slate-400 text-sm font-mono hover:bg-white/5 transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Cambiar vía
            </button>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={submitAnswer}
              disabled={userAnswer === ''}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-neon-cyan/10
                border border-neon-cyan/50 text-neon-cyan text-sm font-mono
                hover:bg-neon-cyan/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Transmitir datos <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Phase: feedback overlay */}
      {phase === 'feedback' && result && (
        <FeedbackOverlay
          feedbackKey={result.feedbackKey}
          chosenPath={result.chosenPath}
          energyGained={result.energyGained}
          onContinue={handleContinue}
        />
      )}
    </div>
  )
}

function PathCard({ path, accentColor, borderColor, hoverBg, onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`text-left p-5 rounded-xl border ${borderColor} ${hoverBg}
        bg-cosmos-800/60 transition-all group cursor-pointer`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`font-mono text-xs font-bold tracking-widest uppercase ${accentColor}`}>
          {path.label}
        </span>
        <span className="flex items-center gap-1 text-xs font-mono text-slate-500">
          <Zap className="w-3 h-3" />{path.energyCost} J
        </span>
      </div>
      <div className={`font-mono text-xl font-bold text-white mb-2`}>{path.expression}</div>
      <div className={`text-xs font-mono ${accentColor} opacity-70`}>{path.efficiencyLabel}</div>
      <div className="mt-3 flex items-center gap-1 text-slate-500 text-xs group-hover:text-slate-300 transition-colors">
        Seleccionar vía <ArrowRight className="w-3 h-3" />
      </div>
    </motion.button>
  )
}
