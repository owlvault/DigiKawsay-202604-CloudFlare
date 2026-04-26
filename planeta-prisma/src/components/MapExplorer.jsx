import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Map, Radio, User } from 'lucide-react'
import { BIOMES, BIOME_META } from '../constants/mathChallenges'
import { useMissionStore } from '../store/useMissionStore'
import BiomeCard from './BiomeCard'
import ChallengeTerminal from './ChallengeTerminal'

const BIOME_KEYS = Object.values(BIOMES)

export default function MapExplorer() {
  const [activeBiome, setActiveBiome] = useState(null)
  const { explorerName, setExplorerName } = useMissionStore()
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(explorerName)

  const commitName = () => {
    if (nameInput.trim()) setExplorerName(nameInput.trim())
    setEditingName(false)
  }

  if (activeBiome) {
    return (
      <ChallengeTerminal
        biomeId={activeBiome}
        onBack={() => setActiveBiome(null)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-cosmos-900 pt-20 pb-12 px-4 relative overflow-hidden">
      {/* Ambient background stars */}
      <Stars />

      {/* Scan line effect */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-[0.03]">
        <motion.div
          className="w-full h-32 bg-gradient-to-b from-transparent via-cyan-400 to-transparent"
          animate={{ y: ['-100vh', '100vh'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Mission brief */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
            bg-cyan-950/60 border border-cyan-800/50 mb-4">
            <Radio className="w-3 h-3 text-neon-cyan animate-pulse" />
            <span className="font-mono text-xs text-cyan-400 tracking-widest uppercase">
              Transmisión activa — Planeta Prisma
            </span>
          </div>

          <h1 className="font-display font-black text-4xl sm:text-5xl text-white mb-3 leading-tight">
            Expedición{' '}
            <span className="text-neon-cyan">Libre</span>
          </h1>
          <p className="text-slate-400 max-w-lg mx-auto text-sm leading-relaxed">
            Los biomas del planeta han perdido su energía cromática. Elige tus rutas de análisis
            matemático para restaurar cada sector y reactivar el núcleo planetario.
          </p>

          {/* Explorer identity */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <User className="w-4 h-4 text-slate-500" />
            {editingName ? (
              <input
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === 'Enter' && commitName()}
                className="bg-transparent border-b border-cyan-600 text-cyan-300 font-mono
                  text-sm focus:outline-none px-1"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-sm font-mono text-cyan-400 hover:text-neon-cyan transition-colors"
              >
                {explorerName} <span className="text-slate-600 text-xs">[editar]</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Map header */}
        <div className="flex items-center gap-2 mb-6">
          <Map className="w-4 h-4 text-slate-500" />
          <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">
            Mapa de Sectores — {BIOME_KEYS.length} biomas detectados
          </span>
        </div>

        {/* Biome grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {BIOME_KEYS.map((biomeId, i) => (
            <BiomeCard
              key={biomeId}
              biomeId={biomeId}
              index={i}
              onClick={() => setActiveBiome(biomeId)}
            />
          ))}
        </div>

        {/* Footer telemetry hint */}
        <motion.p
          className="text-center text-xs font-mono text-slate-700 mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Sistema de telemetría activo — comportamiento registrado localmente
        </motion.p>
      </div>
    </div>
  )
}

function Stars() {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    delay: Math.random() * 4,
  }))

  return (
    <div className="fixed inset-0 pointer-events-none">
      {stars.map((s) => (
        <motion.div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size }}
          animate={{ opacity: [0.1, 0.6, 0.1] }}
          transition={{ duration: 3 + Math.random() * 3, repeat: Infinity, delay: s.delay }}
        />
      ))}
    </div>
  )
}
