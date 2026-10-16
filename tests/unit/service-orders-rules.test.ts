import { describe, expect, it } from "vitest"

import type { ChecklistItem } from "../../src/lib/types"
import {
  PHOTO_MAX_BYTES,
  SIGNATURE_MAX_BYTES,
  buildPhotoPath,
  buildSignaturePath,
  canTransition,
  dayKeyBRT,
  evaluateConclusion,
  fitWithin,
  groupFieldOrders,
  isChecklistItemAnswered,
  isChecklistItemRequired,
  isValidOsStoragePath,
  mapsHref,
  normalizeChecklistAnswers,
  sourceStatusesFor,
  validatePhotoInput,
  validatePhotoUpload,
  validateSignatureUpload,
} from "../../src/components/chamados/execution-rules"

const OS_ID = "50000000-0000-4000-8000-000000000004"

const ITENS: ChecklistItem[] = [
  { id: "filtro", label: "Limpeza dos filtros", tipo: "checkbox" },
  { id: "pressao", label: "Pressão", tipo: "numero", unidade: "psi" },
  { id: "obs", label: "Observações", tipo: "texto" },
]

describe("máquina de estados da OS", () => {
  it("técnico só faz aberto|agendado -> em_campo e em_campo -> concluido", () => {
    expect(canTransition("aberto", "em_campo", "tecnico")).toBe(true)
    expect(canTransition("agendado", "em_campo", "tecnico")).toBe(true)
    expect(canTransition("em_campo", "concluido", "tecnico")).toBe(true)
    expect(canTransition("aberto", "concluido", "tecnico")).toBe(false)
    expect(canTransition("em_campo", "cancelado", "tecnico")).toBe(false)
    expect(canTransition("aberto", "agendado", "tecnico")).toBe(false)
    expect(canTransition("concluido", "em_campo", "tecnico")).toBe(false)
  })

  it("escritório agenda, cancela e conclui, mas nunca reabre encerradas", () => {
    expect(canTransition("aberto", "agendado", "atendente")).toBe(true)
    expect(canTransition("agendado", "agendado", "admin")).toBe(true)
    expect(canTransition("em_campo", "cancelado", "admin")).toBe(true)
    expect(canTransition("concluido", "aberto", "admin")).toBe(false)
    expect(canTransition("cancelado", "aberto", "admin")).toBe(false)
    expect(canTransition("em_campo", "agendado", "admin")).toBe(false)
  })

  it("sourceStatusesFor gera o filtro .in() de cada transição", () => {
    expect(sourceStatusesFor("em_campo", "tecnico").sort()).toEqual(["aberto", "agendado"])
    expect(sourceStatusesFor("concluido", "tecnico")).toEqual(["em_campo"])
    expect(sourceStatusesFor("cancelado", "tecnico")).toEqual([])
    expect(sourceStatusesFor("cancelado", "admin").sort()).toEqual(["aberto", "agendado", "em_campo"])
  })
})

describe("checklist", () => {
  it("checkbox e número são obrigatórios por padrão; texto é opcional", () => {
    expect(isChecklistItemRequired(ITENS[0])).toBe(true)
    expect(isChecklistItemRequired(ITENS[1])).toBe(true)
    expect(isChecklistItemRequired(ITENS[2])).toBe(false)
    expect(isChecklistItemRequired({ ...ITENS[2], obrigatorio: true } as ChecklistItem)).toBe(true)
  })

  it("'não conforme' (false) conta como respondido; null não", () => {
    expect(isChecklistItemAnswered(ITENS[0], false)).toBe(true)
    expect(isChecklistItemAnswered(ITENS[0], null)).toBe(false)
    expect(isChecklistItemAnswered(ITENS[1], 0)).toBe(true)
    expect(isChecklistItemAnswered(ITENS[1], Number.NaN)).toBe(false)
    expect(isChecklistItemAnswered(ITENS[2], "   ")).toBe(false)
  })

  it("normaliza respostas: descarta chaves estranhas e aceita vírgula decimal", () => {
    const { respostas, errors } = normalizeChecklistAnswers(ITENS, {
      filtro: true,
      pressao: "118,5",
      obs: "  ok  ",
      hack: "<script>",
    })
    expect(errors).toEqual([])
    expect(respostas).toEqual({ filtro: true, pressao: 118.5, obs: "ok" })
  })

  it("rejeita tipos inválidos", () => {
    const { errors } = normalizeChecklistAnswers(ITENS, { filtro: "sim", pressao: "abc" })
    expect(errors).toHaveLength(2)
  })
})

describe("prontidão para concluir", () => {
  const base = {
    status: "em_campo" as const,
    itens: ITENS,
    respostas: { filtro: true, pressao: 120 },
    fotosDepois: 1,
    assinaturaPath: `${OS_ID}/assinatura-1.png`,
    assinadoPorNome: "Mariana Souza",
  }

  it("pronta com checklist obrigatório + foto depois + assinatura", () => {
    expect(evaluateConclusion(base)).toEqual({ ready: true, pendencias: [] })
  })

  it("bloqueia sem foto depois", () => {
    const r = evaluateConclusion({ ...base, fotosDepois: 0 })
    expect(r.ready).toBe(false)
    expect(r.pendencias.join(" ")).toMatch(/foto "depois"/)
  })

  it("bloqueia sem assinatura ou sem nome", () => {
    expect(evaluateConclusion({ ...base, assinaturaPath: null }).ready).toBe(false)
    expect(evaluateConclusion({ ...base, assinadoPorNome: "  " }).ready).toBe(false)
  })

  it("bloqueia com item obrigatório pendente e fora de em_campo", () => {
    const r = evaluateConclusion({ ...base, respostas: { filtro: true } })
    expect(r.ready).toBe(false)
    expect(r.pendencias[0]).toMatch(/Pressão/)
    expect(evaluateConclusion({ ...base, status: "agendado" }).ready).toBe(false)
  })

  it("OS sem template não exige checklist", () => {
    expect(evaluateConclusion({ ...base, itens: null, respostas: null }).ready).toBe(true)
  })
})

describe("validação de arquivo", () => {
  it("foto: aceita jpeg/png/webp, recusa heic, pdf e vazio", () => {
    expect(validatePhotoInput({ type: "image/jpeg", size: 3_000_000 })).toBeNull()
    expect(validatePhotoInput({ type: "image/webp", size: 10 })).toBeNull()
    expect(validatePhotoInput({ type: "image/heic", size: 10 })).toMatch(/Formato/)
    expect(validatePhotoInput({ type: "application/pdf", size: 10 })).toMatch(/Formato/)
    expect(validatePhotoInput({ type: "image/png", size: 0 })).toMatch(/vazio/)
  })

  it("foto enviada ao bucket respeita 8 MB", () => {
    expect(validatePhotoUpload({ type: "image/jpeg", size: PHOTO_MAX_BYTES })).toBeNull()
    expect(validatePhotoUpload({ type: "image/jpeg", size: PHOTO_MAX_BYTES + 1 })).toMatch(/8 MB/)
  })

  it("assinatura: só PNG até 1 MB", () => {
    expect(validateSignatureUpload({ type: "image/png", size: 40_000 })).toBeNull()
    expect(validateSignatureUpload({ type: "image/jpeg", size: 40_000 })).toMatch(/PNG/)
    expect(validateSignatureUpload({ type: "image/png", size: SIGNATURE_MAX_BYTES + 1 })).toMatch(/1 MB/)
  })

  it("compressão: lado maior até 1600 px preservando proporção", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(1080, 1920)).toEqual({ width: 900, height: 1600 })
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it("caminho no Storage é sempre <os_id>/<arquivo>", () => {
    const foto = buildPhotoPath(OS_ID, "depois", new Date("2026-10-14T12:00:00Z"))
    expect(foto.startsWith(`${OS_ID}/depois-20261014120000-`)).toBe(true)
    expect(isValidOsStoragePath(OS_ID, foto, ["jpg"])).toBe(true)
    expect(isValidOsStoragePath(OS_ID, buildSignaturePath(OS_ID), ["png"])).toBe(true)

    const outra = "50000000-0000-4000-8000-000000000005"
    expect(isValidOsStoragePath(OS_ID, `${outra}/x.jpg`, ["jpg"])).toBe(false)
    expect(isValidOsStoragePath(OS_ID, `${OS_ID}/../x.jpg`, ["jpg"])).toBe(false)
    expect(isValidOsStoragePath(OS_ID, `${OS_ID}/sub/x.jpg`, ["jpg"])).toBe(false)
    expect(isValidOsStoragePath(OS_ID, `${OS_ID}/x.exe`, ["jpg"])).toBe(false)
    expect(isValidOsStoragePath("nao-uuid", "nao-uuid/x.jpg", ["jpg"])).toBe(false)
  })
})

describe("app de campo", () => {
  // 14/10/2026 10:00 em Curitiba (13:00 UTC)
  const now = new Date("2026-10-14T13:00:00Z")

  it("dia no fuso de Curitiba", () => {
    expect(dayKeyBRT(new Date("2026-10-15T02:00:00Z"))).toBe("2026-10-14")
  })

  it("agrupa em andamento / hoje (inclui atrasadas) / próximas", () => {
    const items = [
      { id: "a", status: "em_campo" as const, scheduled_at: null, checkin_at: "2026-10-14T11:00:00Z" },
      { id: "b", status: "agendado" as const, scheduled_at: "2026-10-14T20:00:00Z" },
      { id: "c", status: "agendado" as const, scheduled_at: "2026-10-12T12:00:00Z" },
      { id: "d", status: "agendado" as const, scheduled_at: "2026-10-16T12:00:00Z" },
      { id: "e", status: "aberto" as const, scheduled_at: null },
      { id: "f", status: "concluido" as const, scheduled_at: "2026-10-14T12:00:00Z" },
    ]
    const g = groupFieldOrders(items, now)
    expect(g.emAndamento.map((o) => o.id)).toEqual(["a"])
    expect(g.hoje.map((o) => o.id)).toEqual(["c", "b"])
    expect(g.proximas.map((o) => o.id)).toEqual(["d", "e"])
  })

  it("link de mapa usa lat/lng ou o endereço", () => {
    const b = {
      logradouro: "Rua XV de Novembro",
      numero: "100",
      bairro: "Centro",
      cidade: "Curitiba",
      uf: "PR",
      lat: -25.43,
      lng: -49.27,
    }
    expect(mapsHref(b)).toBe("https://www.google.com/maps/search/?api=1&query=-25.43,-49.27")
    expect(mapsHref({ ...b, lat: null, lng: null })).toContain("Rua%20XV%20de%20Novembro")
    expect(mapsHref({ ...b, lat: null, lng: null, logradouro: null })).toBeNull()
  })
})
