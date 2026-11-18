/** Mostrado na hora do clique enquanto a página do painel carrega. */
export default function PainelLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse" aria-busy="true" aria-label="Carregando">
      <div className="mb-8 space-y-3">
        <div className="h-3 w-40 rounded-full bg-lavender-200/70" />
        <div className="h-10 w-72 rounded-2xl bg-lavender-200/70" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-32 rounded-3xl border border-lavender-200/60 bg-white/70" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3 rounded-3xl border border-lavender-200/60 bg-white/70 p-6">
          <div className="h-6 w-48 rounded-xl bg-lavender-100" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-14 rounded-2xl bg-lavender-50" />
          ))}
        </div>
        <div className="h-72 rounded-3xl border border-lavender-200/60 bg-white/70" />
      </div>
    </div>
  );
}
