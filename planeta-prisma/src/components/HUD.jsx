import { Zap, Activity, Globe } from 'lucide-react'
import { useMissionStore } from '../store/useMissionStore'

export default function HUD() {
  const { explorerName, totalEnergy, biomes } = useMissionStore()

  const totalCompleted = Object.values(biomes).reduce(
    (sum, b) => sum + b.completedChallenges.length, 0
  )

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3
      bg-cosmos-900/80 backdrop-blur-md border-b border-cyan-900/60">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <Globe className="text-neon-cyan w-5 h-5" />
        <span className="font-display font-bold text-sm tracking-widest text-neon-cyan uppercase">
          Planeta Prisma
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6">
        <Stat icon={<Zap className="w-4 h-4 text-neon-amber" />}
          label="Energía" value={totalEnergy} unit="J" />
        <Stat icon={<Activity className="w-4 h-4 text-neon-green" />}
          label="Muestras" value={totalCompleted} unit="sync" />
        <div className="text-xs font-mono text-cyan-400/70 hidden sm:block">
          ID: <span className="text-cyan-300">{explorerName}</span>
        </div>
      </div>
    </header>
  )
}

function Stat({ icon, label, value, unit }) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="font-mono text-xs text-slate-400">{label}:</span>
      <span className="font-mono text-sm font-bold text-white">
        {value} <span className="text-xs text-slate-500">{unit}</span>
      </span>
    </div>
  )
}
