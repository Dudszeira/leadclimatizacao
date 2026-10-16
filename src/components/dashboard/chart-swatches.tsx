/** Amostras de legenda/tooltip: barra clara e barra hachurada. */
export function SwatchSolido() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2.5 shrink-0 rounded-[3px] bg-linear-to-b from-ink to-ink-faint"
    />
  )
}

export function SwatchHachurado() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2.5 shrink-0 rounded-[3px] ring-1 ring-ink-faint/60 [background:repeating-linear-gradient(135deg,var(--ink-dim)_0_1.5px,transparent_1.5px_4px)]"
    />
  )
}
