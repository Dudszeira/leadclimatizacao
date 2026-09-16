/** Formatadores pt-BR compartilhados pelos blocos do dashboard. */

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const decimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function formatInteiro(valor: number): string {
  return inteiro.format(valor);
}

export function formatBRL(valor: number): string {
  return moeda.format(valor);
}

/** "64,5%" — ou "—" quando o denominador era zero. */
export function formatPct(valor: number | null): string {
  if (valor === null) return "—";
  return `${decimal.format(valor)}%`;
}

/** Minutos → "48s" abaixo de 1 min, senão "3,2 min"; "—" sem dados. */
export function formatMinutos(minutos: number | null): string {
  if (minutos === null) return "—";
  if (minutos < 1) return `${Math.round(minutos * 60)}s`;
  return `${decimal.format(minutos)} min`;
}
