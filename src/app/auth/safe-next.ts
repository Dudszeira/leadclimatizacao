/**
 * Valida o parâmetro `next` contra open redirect: só caminho relativo
 * começando com "/" e sem "//" (nem "\" que alguns browsers tratam como "/").
 * Retorna null quando inválido.
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || v.length > 512) return null;
  if (!v.startsWith("/")) return null;
  if (v.includes("//") || v.includes("\\")) return null;
  // Caracteres de controle (ex.: \t, \n) podem ser descartados pelo browser.
  if (/[\u0000-\u001f\u007f]/.test(v)) return null;
  return v;
}
