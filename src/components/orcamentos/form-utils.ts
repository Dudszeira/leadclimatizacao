/** 650 → "650,00"; 2.5 → "2,5" (campo editável, sem separador de milhar). */
export function numeroParaCampo(valor: number, casas: 2 | 3 = 2): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas === 2 ? 2 : 0,
    maximumFractionDigits: casas,
    useGrouping: false,
  })
}
