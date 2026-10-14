"use client"

import * as React from "react"
import {
  AirVentIcon,
  EllipsisVerticalIcon,
  LoaderCircleIcon,
  LocateFixedIcon,
  PencilLineIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import type { Building } from "@/lib/types"
import { buscarCoordenadas, deleteBuilding, saveBuilding } from "@/server/actions/cadastros"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ConfirmDialog, Field, SelectField, SubmitButton, invalidProps, useCadastroAction } from "./form-kit"
import { buildingSchema, fieldErrorsFrom, type BuildingInput } from "./schemas"
import { EquipmentFormDialog, type BuildingOption } from "./equipment-dialogs"
import { UFS, maskCep } from "./validators"

const UF_ITEMS = Object.fromEntries(UFS.map((uf) => [uf, uf]))

function initial(clientId: string, b?: Building): Required<BuildingInput> {
  return {
    id: b?.id ?? "",
    client_id: clientId,
    nome: b?.nome ?? "",
    logradouro: b?.logradouro ?? "",
    numero: b?.numero ?? "",
    bairro: b?.bairro ?? "",
    cidade: b?.cidade ?? "Curitiba",
    uf: b?.uf ?? "PR",
    cep: b?.cep ? maskCep(b.cep) : "",
    regiao: b?.regiao ?? "",
    lat: b?.lat != null ? String(b.lat) : "",
    lng: b?.lng != null ? String(b.lng) : "",
  }
}

/** Cadastro/edição de prédio (controlado pelo pai). */
export function BuildingFormDialog({
  open,
  onOpenChange,
  clientId,
  building,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  building?: Building
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{building ? "Editar prédio" : "Novo prédio"}</DialogTitle>
          <DialogDescription>
            Endereço da unidade atendida. As coordenadas posicionam o prédio no mapa e na
            roteirização dos técnicos.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <BuildingForm clientId={clientId} building={building} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Corpo do formulário: monta a cada abertura (estado inicial limpo). */
function BuildingForm({
  clientId,
  building,
  onClose,
}: {
  clientId: string
  building?: Building
  onClose: () => void
}) {
  const [form, setForm] = React.useState(() => initial(clientId, building))
  const { pending, run, fieldErrors: errors, setFieldErrors } = useCadastroAction()
  const [geoPending, startGeo] = React.useTransition()

  const set = (key: keyof BuildingInput) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const check = buildingSchema.safeParse(form)
    if (!check.success) {
      setFieldErrors(fieldErrorsFrom(check.error))
      return
    }
    run(() => saveBuilding(form), onClose)
  }

  function handleGeocode() {
    startGeo(async () => {
      const r = await buscarCoordenadas({
        logradouro: form.logradouro,
        numero: form.numero,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
        cep: form.cep,
      })
      if (r.ok && r.lat != null && r.lng != null) {
        setForm((f) => ({ ...f, lat: String(r.lat), lng: String(r.lng) }))
        toast.success(r.message, { description: r.encontrado })
      } else {
        toast.error(r.message)
      }
    })
  }

  const busy = pending || geoPending

  return (
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field id="predio-nome" label="Nome do prédio / unidade" error={errors.nome}>
              <Input
                id="predio-nome"
                value={form.nome}
                onChange={(e) => set("nome")(e.target.value)}
                placeholder="Ex.: Torre A, Matriz, Loja Batel"
                className="max-md:h-11"
                {...invalidProps("predio-nome", errors.nome)}
              />
            </Field>
            <Field id="predio-regiao" label="Região" error={errors.regiao} hint="centro, sul, cic…">
              <Input
                id="predio-regiao"
                value={form.regiao}
                onChange={(e) => set("regiao")(e.target.value)}
                className="max-md:h-11"
                {...invalidProps("predio-regiao", errors.regiao)}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[9rem_1fr_6rem]">
            <Field id="predio-cep" label="CEP" error={errors.cep}>
              <Input
                id="predio-cep"
                value={form.cep}
                onChange={(e) => set("cep")(maskCep(e.target.value))}
                placeholder="00000-000"
                inputMode="numeric"
                autoComplete="postal-code"
                className="font-mono max-md:h-11"
                {...invalidProps("predio-cep", errors.cep)}
              />
            </Field>
            <Field id="predio-logradouro" label="Logradouro" error={errors.logradouro}>
              <Input
                id="predio-logradouro"
                value={form.logradouro}
                onChange={(e) => set("logradouro")(e.target.value)}
                placeholder="Rua, avenida…"
                autoComplete="address-line1"
                className="max-md:h-11"
                {...invalidProps("predio-logradouro", errors.logradouro)}
              />
            </Field>
            <Field id="predio-numero" label="Número" error={errors.numero}>
              <Input
                id="predio-numero"
                value={form.numero}
                onChange={(e) => set("numero")(e.target.value)}
                className="max-md:h-11"
                {...invalidProps("predio-numero", errors.numero)}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
            <Field id="predio-bairro" label="Bairro" error={errors.bairro}>
              <Input
                id="predio-bairro"
                value={form.bairro}
                onChange={(e) => set("bairro")(e.target.value)}
                className="max-md:h-11"
                {...invalidProps("predio-bairro", errors.bairro)}
              />
            </Field>
            <Field id="predio-cidade" label="Cidade" error={errors.cidade}>
              <Input
                id="predio-cidade"
                value={form.cidade}
                onChange={(e) => set("cidade")(e.target.value)}
                autoComplete="address-level2"
                className="max-md:h-11"
                {...invalidProps("predio-cidade", errors.cidade)}
              />
            </Field>
            <Field id="predio-uf" label="UF" error={errors.uf}>
              <SelectField id="predio-uf" value={form.uf} onChange={set("uf")} items={UF_ITEMS} error={errors.uf} />
            </Field>
          </div>
          <fieldset className="grid gap-3 rounded-lg border border-line bg-console-2/40 p-3">
            <legend className="px-1 text-xs font-medium tracking-wider text-ink-faint uppercase">
              Coordenadas
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="predio-lat" label="Latitude" error={errors.lat}>
                <Input
                  id="predio-lat"
                  value={form.lat}
                  onChange={(e) => set("lat")(e.target.value)}
                  placeholder="-25.4284"
                  inputMode="decimal"
                  className="font-mono max-md:h-11"
                  {...invalidProps("predio-lat", errors.lat)}
                />
              </Field>
              <Field id="predio-lng" label="Longitude" error={errors.lng}>
                <Input
                  id="predio-lng"
                  value={form.lng}
                  onChange={(e) => set("lng")(e.target.value)}
                  placeholder="-49.2733"
                  inputMode="decimal"
                  className="font-mono max-md:h-11"
                  {...invalidProps("predio-lng", errors.lng)}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-8 max-md:h-11"
                onClick={handleGeocode}
                disabled={busy}
                aria-busy={geoPending}
              >
                {geoPending ? (
                  <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
                ) : (
                  <LocateFixedIcon aria-hidden="true" />
                )}
                Buscar coordenadas
              </Button>
              <span className="text-xs text-ink-faint">
                Opcional. Consulta o OpenStreetMap pelo endereço; confira antes de salvar.
              </span>
            </div>
          </fieldset>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
              className="max-md:h-11"
            >
              Cancelar
            </Button>
            <SubmitButton pending={pending}>{building ? "Salvar alterações" : "Cadastrar prédio"}</SubmitButton>
          </DialogFooter>
        </form>
  )
}


/** Botão "Novo prédio" do detalhe do cliente. */
export function NewBuildingButton({ clientId, label = "Novo prédio" }: { clientId: string; label?: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button className="h-9 px-3 max-md:h-11" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        {label}
      </Button>
      <BuildingFormDialog open={open} onOpenChange={setOpen} clientId={clientId} />
    </>
  )
}

/** Menu do card de prédio: editar, novo equipamento, excluir (admin, sem equipamentos). */
export function BuildingCardActions({
  building,
  buildings,
  equipmentCount,
  canDelete,
}: {
  building: Building
  buildings: BuildingOption[]
  equipmentCount: number
  canDelete: boolean
}) {
  const [dialog, setDialog] = React.useState<"editar" | "equipamento" | "excluir" | null>(null)
  const close = (open: boolean) => !open && setDialog(null)
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 max-md:size-11"
              aria-label={`Ações do prédio ${building.nome}`}
            />
          }
        >
          <EllipsisVerticalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem onClick={() => setDialog("editar")}>
            <PencilLineIcon aria-hidden="true" />
            Editar prédio
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("equipamento")}>
            <AirVentIcon aria-hidden="true" />
            Novo equipamento aqui
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={equipmentCount > 0}
                onClick={() => setDialog("excluir")}
              >
                <Trash2Icon aria-hidden="true" />
                {equipmentCount > 0 ? "Excluir (tem equipamentos)" : "Excluir prédio"}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <BuildingFormDialog
        open={dialog === "editar"}
        onOpenChange={close}
        clientId={building.client_id}
        building={building}
      />
      <EquipmentFormDialog
        open={dialog === "equipamento"}
        onOpenChange={close}
        buildings={buildings}
        defaultBuildingId={building.id}
      />
      <ConfirmDialog
        open={dialog === "excluir"}
        onOpenChange={close}
        title="Excluir prédio?"
        description={`"${building.nome}" será removido definitivamente. Só é possível excluir prédios sem equipamentos e sem histórico de OS.`}
        confirmLabel="Excluir prédio"
        action={() => deleteBuilding(building.id)}
      />
    </>
  )
}
