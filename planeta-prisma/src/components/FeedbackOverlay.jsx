import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertTriangle, X } from 'lucide-react'

const MESSAGES = {
  sync_ok: {
    headline: 'DATOS SINCRONIZADOS',
    sub: 'El sistema de energía ha registrado tu cálculo correctamente.',
    icon: CheckCircle2,
    color: 'text-neon-green',
    border: 'border-green-500/50',
    bg: 'bg-green-950/80',
    glow: 'shadow-[0_0_30px_rgba(57,255,20,0.3)]',
  },
  sync_fail: {
    headline: 'INTERFERENCIA EN EL ANÁLISIS',
    sub: 'La muestra no coincide con los parámetros de la base. Recalibra el sensor.',
    icon: AlertTriangle,
    color: 'text-neon-amber',
    border: 'border-amber-500/50',
    bg: 'bg-amber-950/80',
    glow: 'shadow-[0_0_30px_rgba(255,190,0,0.3)]',
  },
}

export default function FeedbackOverlay({ feedbackKey, chosenPath, energyGained, onContinue }) {
  const meta = MESSAGES[feedbackKey] ?? MESSAGES.sync_fail
  const Icon = meta.icon

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className={`relative max-w-md w-full mx-4 rounded-2xl border ${meta.border} ${meta.bg} ${meta.glow} p-8`}
          initial={{ scale: 0.85, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          {/* Scanline decoration */}
          <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden opacity-10">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="h-px bg-white/30" style={{ marginTop: `${i * 14}px` }} />
            ))}
          </div>

          <div className="relative flex flex-col items-center text-center gap-4">
            <Icon className={`w-14 h-14 ${meta.color}`} strokeWidth={1.5} />

            <h2 className={`font-mono font-bold text-xl tracking-widest ${meta.color}`}>
              {meta.headline}
            </h2>

            <p className="text-slate-300 text-sm leading-relaxed">{meta.sub}</p>

            {feedbackKey === 'sync_ok' && (
              <div className="flex gap-6 mt-2">
                <Badge label="Vía elegida" value={`Vía ${chosenPath}`} />
                <Badge label="Energía ganada" value={`+${energyGained} J`} color="text-neon-amber" />
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={onContinue}
              className={`mt-4 px-8 py-3 rounded-lg border ${meta.border} ${meta.color}
                font-mono text-sm tracking-wider hover:bg-white/5 transition-colors`}
            >
              CONTINUAR MISIÓN
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function Badge({ label, value, color = 'text-neon-cyan' }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">{label}</span>
      <span className={`font-mono font-bold text-lg ${color}`}>{value}</span>
    </div>
  )
}
