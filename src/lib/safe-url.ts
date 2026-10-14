/**
 * Só aceita URL absoluta https (links externos que viram href na UI ou são
 * gravados vindos de terceiros, ex.: PDF da NFS-e do Asaas). Qualquer outra
 * coisa (http, javascript:, relativa, inválida) vira null.
 */
export function httpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
