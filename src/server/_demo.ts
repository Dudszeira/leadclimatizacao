import {
  buildingsFixture,
  checklistTemplatesFixture,
  clientsFixture,
  contractsFixture,
  equipmentFixture,
  invoicesFixture,
  pmocPlansFixture,
  profilesFixture,
  serviceOrdersFixture,
} from "@/lib/fixtures";
import type {
  Building,
  BuildingWithClient,
  ChecklistTemplate,
  Client,
  Equipment,
  PmocPlan,
  Profile,
  ServiceOrder,
  ServiceOrderListItem,
  ServiceOrderWithRelations,
} from "@/lib/types";

/** Índices e joins em memória para o modo demo. */

const clientById = new Map<string, Client>(clientsFixture.map((c) => [c.id, c]));
const buildingById = new Map<string, Building>(buildingsFixture.map((b) => [b.id, b]));
const equipmentById = new Map<string, Equipment>(equipmentFixture.map((e) => [e.id, e]));
const profileById = new Map<string, Profile>(profilesFixture.map((p) => [p.id, p]));
const templateById = new Map<string, ChecklistTemplate>(
  checklistTemplatesFixture.map((t) => [t.id, t]),
);
const planById = new Map<string, PmocPlan>(pmocPlansFixture.map((p) => [p.id, p]));
const planByEquipmentId = new Map<string, PmocPlan>(
  pmocPlansFixture.map((p) => [p.equipment_id, p]),
);

export function demoClient(id: string): Client | undefined {
  return clientById.get(id);
}

export function demoBuildingWithClient(buildingId: string): BuildingWithClient {
  const building = buildingById.get(buildingId);
  if (!building) throw new Error(`Fixture inconsistente: prédio ${buildingId} não existe`);
  const client = clientById.get(building.client_id);
  if (!client) throw new Error(`Fixture inconsistente: cliente ${building.client_id} não existe`);
  return {
    ...building,
    client: {
      id: client.id,
      razao_social: client.razao_social,
      nome_fantasia: client.nome_fantasia,
      segmento: client.segmento,
    },
  };
}

export function demoEquipment(id: string): Equipment | undefined {
  return equipmentById.get(id);
}

export function demoPlanByEquipment(equipmentId: string): PmocPlan | null {
  return planByEquipmentId.get(equipmentId) ?? null;
}

export function demoServiceOrderListItem(os: ServiceOrder): ServiceOrderListItem {
  const building = demoBuildingWithClient(os.building_id);
  const equipment = os.equipment_id ? equipmentById.get(os.equipment_id) ?? null : null;
  const technician = os.technician_id ? profileById.get(os.technician_id) ?? null : null;
  return {
    ...os,
    building: {
      id: building.id,
      nome: building.nome,
      bairro: building.bairro,
      regiao: building.regiao,
      client: {
        id: building.client.id,
        razao_social: building.client.razao_social,
        nome_fantasia: building.client.nome_fantasia,
      },
    },
    equipment: equipment
      ? {
          id: equipment.id,
          codigo_interno: equipment.codigo_interno,
          tipo: equipment.tipo,
          marca: equipment.marca,
          modelo: equipment.modelo,
        }
      : null,
    technician: technician
      ? { id: technician.id, full_name: technician.full_name, phone: technician.phone }
      : null,
  };
}

export function demoServiceOrderWithRelations(os: ServiceOrder): ServiceOrderWithRelations {
  return {
    ...os,
    building: demoBuildingWithClient(os.building_id),
    equipment: os.equipment_id ? equipmentById.get(os.equipment_id) ?? null : null,
    technician: os.technician_id ? profileById.get(os.technician_id) ?? null : null,
    checklist_template: os.checklist_template_id
      ? templateById.get(os.checklist_template_id) ?? null
      : null,
    pmoc_plan: os.pmoc_plan_id ? planById.get(os.pmoc_plan_id) ?? null : null,
  };
}

/** Ids de clientes com contrato ativo (para o KPI "equipamentos sob contrato"). */
export function demoClientIdsComContratoAtivo(): Set<string> {
  return new Set(
    contractsFixture.filter((c) => c.status === "ativo").map((c) => c.client_id),
  );
}

export {
  buildingsFixture,
  clientsFixture,
  contractsFixture,
  equipmentFixture,
  invoicesFixture,
  pmocPlansFixture,
  profilesFixture,
  serviceOrdersFixture,
};
