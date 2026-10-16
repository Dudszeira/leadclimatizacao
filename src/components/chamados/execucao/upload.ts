"use client"

import { createClient } from "@/lib/supabase/client"
import { STORAGE_BUCKETS } from "@/lib/types"
import {
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_DIMENSION,
  fitWithin,
} from "@/components/chamados/execution-rules"

/** Carrega o arquivo como imagem decodificada (respeita orientação EXIF quando suportado). */
async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" })
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
    } catch {
      // cai no <img> abaixo (Safari antigo)
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = "async"
    img.src = url
    await img.decode()
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    }
  } catch (err) {
    URL.revokeObjectURL(url)
    throw err
  }
}

/**
 * Comprime a foto no navegador: lado maior <= 1600px, JPEG ~0.8.
 * Lança Error com mensagem pt-BR se a imagem não puder ser lida.
 */
export async function compressPhoto(file: File): Promise<Blob> {
  let decoded
  try {
    decoded = await decode(file)
  } catch {
    throw new Error("Não foi possível ler esta imagem. Tente outra foto.")
  }
  try {
    const { width, height } = fitWithin(decoded.width, decoded.height, PHOTO_MAX_DIMENSION)
    if (!width || !height) throw new Error("Imagem inválida. Tente outra foto.")
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Seu navegador não conseguiu processar a foto.")
    // fundo branco: PNG/WebP com transparência não vira preto no JPEG
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(decoded.source, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", PHOTO_JPEG_QUALITY),
    )
    if (!blob) throw new Error("Não foi possível comprimir a foto.")
    return blob
  } finally {
    decoded.close()
  }
}

/** Upload direto do navegador ao bucket privado (client do usuário, RLS do Storage). */
export async function uploadToBucket(
  bucket: (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS],
  path: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  let supabase
  try {
    supabase = createClient()
  } catch {
    throw new Error("Armazenamento não configurado. Avise o administrador.")
  }
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType,
    upsert: false,
    cacheControl: "3600",
  })
  if (error) {
    console.error("[upload]", error)
    const status = (error as { statusCode?: string | number }).statusCode
    if (String(status) === "403") {
      throw new Error("Sem permissão para enviar arquivos nesta OS.")
    }
    if (String(status) === "413") throw new Error("Arquivo acima do limite permitido.")
    throw new Error("Falha no envio. Verifique a conexão e tente novamente.")
  }
}
