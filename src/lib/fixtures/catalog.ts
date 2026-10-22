import type { CatalogItem } from "@/lib/types";
import { stamps } from "./dates";

type CatalogSeed = [id: string, nome: string, descricao: string | null, unidade: string, preco: number, ativo?: boolean];

/** Catálogo de serviços/produtos da Lead Climatização (preços de referência, Curitiba). */
const rows: CatalogSeed[] = [
  ["ca000000-0000-4000-8000-000000000001", "Instalação split 9.000 BTU", "Instalação padrão com até 3 m de tubulação, suporte e dreno", "un", 650],
  ["ca000000-0000-4000-8000-000000000002", "Instalação split 12.000 BTU", "Instalação padrão com até 3 m de tubulação, suporte e dreno", "un", 750],
  ["ca000000-0000-4000-8000-000000000003", "Instalação split 18.000 BTU", "Instalação padrão com até 3 m de tubulação, suporte e dreno", "un", 950],
  ["ca000000-0000-4000-8000-000000000004", "Instalação split 24.000 BTU", "Instalação padrão com até 3 m de tubulação, suporte reforçado e dreno", "un", 1150],
  ["ca000000-0000-4000-8000-000000000005", "Higienização completa de split", "Limpeza de evaporadora e condensadora com produto bactericida", "un", 280],
  ["ca000000-0000-4000-8000-000000000006", "Recarga de gás R-410A", "Carga de fluido refrigerante com teste de estanqueidade", "kg", 190],
  ["ca000000-0000-4000-8000-000000000007", "Troca de capacitor", "Capacitor de partida/permanente com mão de obra", "un", 240],
  ["ca000000-0000-4000-8000-000000000008", "Infraestrutura de cobre (par de tubos isolados)", "Tubulação de cobre 1/4\" + 3/8\" ou 1/4\" + 1/2\", isolamento e fixação", "m", 135],
  ["ca000000-0000-4000-8000-000000000009", "Visita técnica / diagnóstico", "Deslocamento em Curitiba e região + laudo de diagnóstico", "un", 180],
  ["ca000000-0000-4000-8000-000000000010", "PMOC mensal (por equipamento)", "Manutenção preventiva conforme Lei 13.589/2018, com relatório", "mês", 120],
  ["ca000000-0000-4000-8000-000000000011", "Instalação janela 7.500 BTU", "Serviço descontinuado", "un", 350, false],
];

export const catalogFixture: CatalogItem[] = rows.map(([id, nome, descricao, unidade, preco, ativo = true]) => ({
  id,
  nome,
  descricao,
  unidade,
  preco,
  ativo,
  ...stamps(),
}));
