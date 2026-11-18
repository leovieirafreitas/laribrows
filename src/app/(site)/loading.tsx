import { Ornament } from "@/components/brand/Ornament";

/** Mostrado na hora do clique enquanto a página do site carrega. */
export default function SiteLoading() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-5" aria-busy="true" aria-label="Carregando">
      <div className="flex flex-col items-center gap-4 text-champagne-500">
        <Ornament className="animate-pulse" />
        <p className="text-[0.65rem] tracking-[0.32em] text-plum-600/50 uppercase">Carregando</p>
      </div>
    </div>
  );
}
