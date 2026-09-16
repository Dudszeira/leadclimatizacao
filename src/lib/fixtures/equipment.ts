import type { Equipment, EquipmentStatus, EquipmentType } from "@/lib/types";
import { dayOffset, stamps } from "./dates";

type EquipmentSeed = [
  id: string,
  building_id: string,
  tipo: EquipmentType,
  marca: string,
  modelo: string,
  capacidade_btu: number,
  codigo_interno: string,
  ambiente: string,
  status: EquipmentStatus,
  instaladoHaDias: number,
];

/** 18 equipamentos nominais — espelho da seção 4 do seed.sql. */
const nominais: EquipmentSeed[] = [
  // Shopping Água Verde
  ["e0000000-0000-4000-8000-000000000001", "b0000000-0000-4000-8000-000000000001", "chiller", "Carrier", "30XA-352", 1_800_000, "CAG-01", "Central de água gelada", "operacional", 1460],
  ["e0000000-0000-4000-8000-000000000002", "b0000000-0000-4000-8000-000000000001", "chiller", "Carrier", "30XA-352", 1_800_000, "CAG-02", "Central de água gelada (reserva)", "operacional", 1460],
  ["e0000000-0000-4000-8000-000000000003", "b0000000-0000-4000-8000-000000000001", "self", "Trane", "SCWM-20TR", 240_000, "01-S1", "Praça de alimentação", "operacional", 900],
  ["e0000000-0000-4000-8000-000000000004", "b0000000-0000-4000-8000-000000000001", "vrf", "Daikin", "VRV IV RXYQ12", 136_000, "02-V1", "Administração — 2º piso", "operacional", 700],
  // Hospital Santa Clara
  ["e0000000-0000-4000-8000-000000000005", "b0000000-0000-4000-8000-000000000003", "chiller", "York", "YVAA-0210", 1_200_000, "CAG-01", "Casa de máquinas — subsolo", "tecnico_em_campo", 2200],
  ["e0000000-0000-4000-8000-000000000006", "b0000000-0000-4000-8000-000000000003", "vrf", "Hitachi", "Set Free FSXN10", 120_000, "03-V2", "CTI — ala leste", "operacional", 1100],
  ["e0000000-0000-4000-8000-000000000007", "b0000000-0000-4000-8000-000000000003", "split", "Springer", "Midea Xtreme 30k", 30_000, "01-B4", "Farmácia interna", "chamado_aberto", 600],
  // IMP Metalúrgica
  ["e0000000-0000-4000-8000-000000000008", "b0000000-0000-4000-8000-000000000005", "self", "Hitachi", "RVT-15TR", 180_000, "GAL-S1", "Galpão de usinagem", "tecnico_em_campo", 1800],
  ["e0000000-0000-4000-8000-000000000009", "b0000000-0000-4000-8000-000000000005", "split", "Fujitsu", "Inverter 27k", 27_000, "ADM-B2", "Sala de TI / CPD", "operacional", 400],
  // Torres do Batel
  ["e0000000-0000-4000-8000-000000000010", "b0000000-0000-4000-8000-000000000007", "vrf", "LG", "Multi V 5", 160_000, "T1-V1", "Salão de festas / áreas comuns", "operacional", 800],
  // Hotel Vista Barigui
  ["e0000000-0000-4000-8000-000000000011", "b0000000-0000-4000-8000-000000000014", "vrf", "Samsung", "DVM S2", 180_000, "HT-V1", "Apartamentos — torre única", "operacional", 500],
  ["e0000000-0000-4000-8000-000000000012", "b0000000-0000-4000-8000-000000000014", "split", "Daikin", "Advance 18k", 18_000, "00-B1", "Recepção / lobby", "operacional", 500],
  // Farmácias Pinheiro
  ["e0000000-0000-4000-8000-000000000013", "b0000000-0000-4000-8000-000000000009", "split", "Elgin", "Eco Power 24k", 24_000, "01-B1", "Salão de vendas — matriz", "chamado_aberto", 1000],
  ["e0000000-0000-4000-8000-000000000014", "b0000000-0000-4000-8000-000000000010", "janela", "Springer", "Silentia 10k", 10_000, "01-J1", "Estoque — fundos", "inativo", 3000],
  // Bom Preço
  ["e0000000-0000-4000-8000-000000000015", "b0000000-0000-4000-8000-000000000012", "self", "Carrier", "50BZ-10TR", 120_000, "LJ-S1", "Área de vendas", "operacional", 1300],
  ["e0000000-0000-4000-8000-000000000016", "b0000000-0000-4000-8000-000000000013", "self", "Trane", "SCWM-10TR", 120_000, "LJ-S1", "Área de vendas", "operacional", 1300],
  // Centro Cívico Offices
  ["e0000000-0000-4000-8000-000000000017", "b0000000-0000-4000-8000-000000000008", "vrf", "Daikin", "VRV IV RXYQ8", 96_000, "01-V1", "Torre comercial — pavimentos", "operacional", 650],
  // Campus Ecoville
  ["e0000000-0000-4000-8000-000000000018", "b0000000-0000-4000-8000-000000000011", "chiller", "Midea", "MGBT-150", 900_000, "CAG-01", "Biblioteca e auditórios", "operacional", 1700],
];

/** Lotes programáticos — equivalentes aos generate_series do seed.sql. */
interface Batch {
  idPrefix: string;
  building_id: string;
  tipo: EquipmentType;
  marca: string;
  modelo: string;
  capacidade_btu: number;
  count: number;
  codigo: (n: number) => string;
  ambiente: (n: number) => string;
}

const batches: Batch[] = [
  {
    // 8 splits nas alas do Hospital Santa Clara (02-A1..02-A8)
    idPrefix: "e0000000-0000-4000-8000-0000000001",
    building_id: "b0000000-0000-4000-8000-000000000003",
    tipo: "split",
    marca: "Springer",
    modelo: "Midea AirVolution 18k",
    capacidade_btu: 18_000,
    count: 8,
    codigo: (n) => `02-A${n}`,
    ambiente: (n) => `Enfermaria ${n} — 2º andar`,
  },
  {
    // 6 splits nas lojas-âncora do Shopping Jardim das Américas (03-L1..03-L6)
    idPrefix: "e0000000-0000-4000-8000-0000000002",
    building_id: "b0000000-0000-4000-8000-000000000002",
    tipo: "split",
    marca: "Daikin",
    modelo: "Sky Air 36k",
    capacidade_btu: 36_000,
    count: 6,
    codigo: (n) => `03-L${n}`,
    ambiente: (n) => `Loja âncora ${n}`,
  },
  {
    // 6 splits nos andares do Ed. Torres do Batel (04-B1..04-B6)
    idPrefix: "e0000000-0000-4000-8000-0000000003",
    building_id: "b0000000-0000-4000-8000-000000000007",
    tipo: "split",
    marca: "LG",
    modelo: "Dual Inverter 12k",
    capacidade_btu: 12_000,
    count: 6,
    codigo: (n) => `04-B${n}`,
    ambiente: (n) => `Hall do ${n + 3}º pavimento`,
  },
  {
    // 3 splits no administrativo da Araucária Foods (ADM-B1..ADM-B3)
    idPrefix: "e0000000-0000-4000-8000-0000000004",
    building_id: "b0000000-0000-4000-8000-000000000006",
    tipo: "split",
    marca: "Gree",
    modelo: "Eco Garden 24k",
    capacidade_btu: 24_000,
    count: 3,
    codigo: (n) => `ADM-B${n}`,
    ambiente: (n) => `Escritório administrativo — sala ${n}`,
  },
];

function buildBatch(batch: Batch): Equipment[] {
  return Array.from({ length: batch.count }, (_, i) => {
    const n = i + 1;
    return {
      id: `${batch.idPrefix}${String(n).padStart(2, "0")}`,
      building_id: batch.building_id,
      tipo: batch.tipo,
      marca: batch.marca,
      modelo: batch.modelo,
      capacidade_btu: batch.capacidade_btu,
      codigo_interno: batch.codigo(n),
      ambiente: batch.ambiente(n),
      status: "operacional" as const,
      data_instalacao: null,
      observacoes: null,
      ...stamps(),
    };
  });
}

/** ~41 equipamentos (18 nominais + 23 em lote), como no seed. */
export const equipmentFixture: Equipment[] = [
  ...nominais.map(
    ([id, building_id, tipo, marca, modelo, capacidade_btu, codigo_interno, ambiente, status, dias]) => ({
      id,
      building_id,
      tipo,
      marca,
      modelo,
      capacidade_btu,
      codigo_interno,
      ambiente,
      status,
      data_instalacao: dayOffset(-dias),
      observacoes: null,
      ...stamps(),
    }),
  ),
  ...batches.flatMap(buildBatch),
];
