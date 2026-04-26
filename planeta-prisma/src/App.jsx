import HUD from './components/HUD'
import MapExplorer from './components/MapExplorer'

export default function App() {
  return (
    <div className="font-display bg-cosmos-900 text-white min-h-screen">
      <HUD />
      <MapExplorer />
    </div>
  )
}
