import { cn } from "cn"

/**
 * Marca do Control Lead: "L" de Lead com um traço de fluxo de ar, em azul Lead.
 * Não há logotipo oficial da Lead Climatização no projeto; este é o símbolo do
 * sistema até o cliente enviar o dele.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex aspect-square size-8 shrink-0 items-center justify-center rounded-[30%] bg-signal text-void",
        className
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[62%]">
        {/* "L" de Lead com a curva de um fluxo de ar saindo da base. */}
        <path
          d="M8 4.5v12.25c0 .97.78 1.75 1.75 1.75H17"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12.5 13.5c1.6 0 2.4-1 4.5-1"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity=".55"
        />
      </svg>
    </span>
  )
}
