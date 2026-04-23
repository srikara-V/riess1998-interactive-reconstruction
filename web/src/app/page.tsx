import { GameExperience } from "@/components/game/GameExperience";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fafaf9] text-stone-900">
      <header className="border-b border-stone-200 bg-white/90 px-4 py-5 font-ui shadow-sm backdrop-blur-sm md:px-8">
        <h1 className="text-xl font-semibold tracking-tight text-stone-900 md:text-2xl">Measuring the Universe</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-stone-600 md:text-base">
          Type Ia supernovae: a step-by-step path to the 1998 Hubble diagram
        </p>
      </header>
      <GameExperience />
    </main>
  );
}
