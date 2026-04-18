import { GameExperience } from "@/components/game/GameExperience";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100">
      <header className="border-b border-white/10 px-4 py-4 md:px-8">
        <h1 className="text-lg font-semibold tracking-tight text-sky-200 md:text-xl">Measuring the Universe</h1>
        <p className="text-sm text-slate-400">Type Ia supernovae — step-by-step path to the 1998 Hubble diagram</p>
      </header>
      <GameExperience />
    </main>
  );
}
