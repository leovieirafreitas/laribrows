import Link from "next/link";

export function Logo({ name = "Lari Brows", href = "/", subtitle = "studio de sobrancelhas", light = false }: { name?: string; href?: string; subtitle?: string; light?: boolean }) {
  const [first, ...rest] = name.split(" ");
  return (
    <Link href={href} className="group inline-flex flex-col leading-none" aria-label={name}>
      <span className={`font-display text-[1.7rem] font-light tracking-tight ${light ? "text-white" : "text-plum-900"}`}>
        {first} <em className={`font-normal ${light ? "text-lavender-200" : "text-lavender-600"}`}>{rest.join(" ")}</em>
      </span>
      {subtitle && (
        <span className={`mt-1 text-[0.55rem] tracking-[0.38em] uppercase ${light ? "text-lavender-200/80" : "text-plum-600/70"}`}>{subtitle}</span>
      )}
    </Link>
  );
}
