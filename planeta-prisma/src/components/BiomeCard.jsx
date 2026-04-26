import { motion } from 'framer-motion'
import { Lock, Zap, ChevronRight } from 'lucide-react'
import { useMissionStore } from '../store/useMissionStore'
import { BIOME_META, MATH_CHALLENGES } from '../constants/mathChallenges'
import { energyToFilter } from '../logic/disjunctiveEngine'

export default function BiomeCard({ biomeId, onClick, index }) {
  const meta = BIOME_META[biomeId]
  const biomeState = useMissionStore((s) => s.biomes[biomeId])

  const totalChallenges = MATH_CHALLENGES.filter((c) => c.biome === biomeId).length
  const completedCount = biomeState.completedChallenges.length
  const progressPct = totalChallenges > 0 ? (completedCount / totalChallenges) * 100 : 0
  const isRestored = progressPct === 100
  const filter = energyToFilter(biomeState.energyLevel)

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative cursor-pointer rounded-2xl border ${meta.borderColor}
        bg-gradient-to-br ${meta.bgFrom} ${meta.bgTo} p-6 overflow-hidden
        transition-shadow hover:shadow-xl hover:${meta.glowColor}`}
      style={{ filter, '--accent': meta.accentColor }}
    >
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(${meta.accentColor} 1px, transparent 1px),
            linear-gradient(90deg, ${meta.accentColor} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Restored pulse ring */}
      {isRestored && (
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{ border: `2px solid ${meta.accentColor}` }}
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <div className="relative flex flex-col h-full gap-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <span className="text-4xl">{meta.icon}</span>
          <div className="flex items-center gap-1 text-xs font-mono"
            style={{ color: meta.accentColor }}>
            <Zap className="w-3 h-3" />
            {biomeState.energyLevel}%
          </div>
        </div>

        {/* Name & subtitle */}
        <div>
          <p className="text-xs font-mono tracking-widest text-slate-400 uppercase mb-1">
            {meta.subtitle}
          </p>
          <h3 className="font-display font-bold text-white text-xl leading-tight">
            {meta.name}
          </h3>
        </div>

        {/* Description */}
        <p className="text-slate-400 text-sm leading-relaxed flex-1">
          {meta.description}
        </p>

        {/* Progress */}
        <div>
          <div className="flex justify-between text-xs font-mono text-slate-500 mb-2">
            <span>Muestras analizadas</span>
            <span style={{ color: meta.accentColor }}>{completedCount} / {totalChallenges}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: meta.accentColor }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: index * 0.15 }}
            />
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs font-mono" style={{ color: meta.accentColor }}>
            {isRestored ? '✓ SECTOR RESTAURADO' : 'ACCEDER AL SECTOR'}
          </span>
          <ChevronRight className="w-4 h-4" style={{ color: meta.accentColor }} />
        </div>
      </div>
    </motion.div>
  )
}
