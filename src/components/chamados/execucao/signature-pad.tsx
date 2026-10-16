"use client"

import * as React from "react"
import { EraserIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export type SignaturePadHandle = {
  isEmpty: () => boolean
  clear: () => void
  toPngBlob: () => Promise<Blob | null>
}

type SignaturePadProps = {
  disabled?: boolean
  onInkChange?: (hasInk: boolean) => void
  ref?: React.Ref<SignaturePadHandle>
  label?: string
}

const INK = "#0B1220"
const PAPER = "#FFFFFF"

/**
 * Quadro de assinatura sem dependências: pointer events (mouse, caneta e
 * toque), suavização por ponto médio, alta densidade (devicePixelRatio) e
 * export PNG. `touch-action: none` impede a rolagem da página ao assinar.
 */
export function SignaturePad({ disabled, onInkChange, ref, label = "Quadro de assinatura" }: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const drawing = React.useRef(false)
  const points = React.useRef<Array<{ x: number; y: number }>>([])
  const inked = React.useRef(false)
  const [hasInk, setHasInk] = React.useState(false)

  const setInk = React.useCallback(
    (value: boolean) => {
      inked.current = value
      setHasInk(value)
      onInkChange?.(value)
    },
    [onInkChange],
  )

  const paintPaper = React.useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }, [])

  const resize = React.useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    // com traço já feito, mantém o bitmap (o CSS só reescala)
    if (inked.current && canvas.width > 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.max(1, Math.floor(wrap.clientWidth))
    const height = Math.max(1, Math.floor(wrap.clientHeight))
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = INK
    ctx.lineWidth = 2.2
    paintPaper()
  }, [paintPaper])

  React.useEffect(() => {
    resize()
    const wrap = wrapRef.current
    if (!wrap || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => resize())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [resize])

  /** Coordenadas no espaço do bitmap (antes do transform de dpr). */
  function pos(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    return {
      x: ((clientX - rect.left) * (canvas.width / Math.max(1, rect.width))) / dpr,
      y: ((clientY - rect.top) * (canvas.height / Math.max(1, rect.height))) / dpr,
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return
    if (e.pointerType === "mouse" && e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = pos(e.currentTarget, e.clientX, e.clientY)
    points.current = [p]
    const ctx = e.currentTarget.getContext("2d")
    if (ctx) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2)
      ctx.fillStyle = INK
      ctx.fill()
    }
    if (!inked.current) setInk(true)
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return
    e.preventDefault()
    const ctx = e.currentTarget.getContext("2d")
    if (!ctx) return
    const events =
      typeof e.nativeEvent.getCoalescedEvents === "function"
        ? e.nativeEvent.getCoalescedEvents()
        : []
    const batch = events.length > 0 ? events : [e.nativeEvent]
    for (const ev of batch) {
      const p = pos(e.currentTarget, ev.clientX, ev.clientY)
      const pts = points.current
      pts.push(p)
      if (pts.length < 3) {
        ctx.beginPath()
        ctx.moveTo(pts[0].x, pts[0].y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
        continue
      }
      const [a, b, c] = pts.slice(-3)
      const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 }
      ctx.beginPath()
      ctx.moveTo(m1.x, m1.y)
      ctx.quadraticCurveTo(b.x, b.y, m2.x, m2.y)
      ctx.stroke()
      if (pts.length > 64) points.current = pts.slice(-3)
    }
  }

  function endStroke(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    drawing.current = false
    points.current = []
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const clear = React.useCallback(() => {
    inked.current = false
    resize()
    paintPaper()
    setInk(false)
  }, [paintPaper, resize, setInk])

  React.useImperativeHandle(
    ref,
    () => ({
      isEmpty: () => !inked.current,
      clear,
      toPngBlob: () =>
        new Promise<Blob | null>((resolve) => {
          const canvas = canvasRef.current
          if (!canvas) return resolve(null)
          canvas.toBlob(resolve, "image/png")
        }),
    }),
    [clear],
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <p className="text-sm text-ink-dim">Assinatura do responsável</p>
        <Button
          type="button"
          variant="ghost"
          onClick={clear}
          disabled={disabled || !hasInk}
        >
          <EraserIcon aria-hidden="true" />
          Limpar
        </Button>
      </div>
      {/* touch-none + overscroll: o traço não rola nem recarrega a página */}
      <div
        ref={wrapRef}
        className="relative h-56 touch-none overflow-hidden overscroll-contain rounded-2xl bg-white select-none sm:h-52"
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          className="block h-full w-full cursor-crosshair touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onPointerLeave={endStroke}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-x-0 bottom-12 mx-6 border-b border-dashed border-neutral-300" aria-hidden="true" />
        )}
        {!hasInk && (
          <span className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[0.8125rem] text-neutral-500" aria-hidden="true">
            Assine aqui com o dedo ou a caneta
          </span>
        )}
      </div>
    </div>
  )
}
