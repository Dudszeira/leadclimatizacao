import type { Building } from "@/lib/types";
import { stamps } from "./dates";

type BuildingSeed = [
  id: string,
  client_id: string,
  nome: string,
  logradouro: string,
  numero: string,
  bairro: string,
  cep: string,
  lat: number,
  lng: number,
  regiao: string,
];

/** 14 prédios/unidades com lat/lng em Curitiba — espelho da seção 3 do seed.sql. */
const rows: BuildingSeed[] = [
  ["b0000000-0000-4000-8000-000000000001", "c0000000-0000-4000-8000-000000000001", "Shopping Água Verde", "Av. República Argentina", "1200", "Água Verde", "80620-010", -25.4472, -49.288, "sul"],
  ["b0000000-0000-4000-8000-000000000002", "c0000000-0000-4000-8000-000000000002", "Shopping Jardim das Américas", "Av. Comendador Franco", "4500", "Jardim das Américas", "81520-000", -25.461, -49.234, "leste"],
  ["b0000000-0000-4000-8000-000000000003", "c0000000-0000-4000-8000-000000000003", "Hospital Santa Clara — Sede", "R. Brigadeiro Franco", "2300", "Rebouças", "80230-100", -25.4448, -49.262, "centro"],
  ["b0000000-0000-4000-8000-000000000004", "c0000000-0000-4000-8000-000000000004", "Hospital Boa Vista", "Av. Paraná", "3050", "Boa Vista", "82510-000", -25.388, -49.244, "norte"],
  ["b0000000-0000-4000-8000-000000000005", "c0000000-0000-4000-8000-000000000005", "IMP — Planta CIC", "R. Senador Accioly Filho", "1750", "Cidade Industrial", "81310-000", -25.495, -49.345, "cic"],
  ["b0000000-0000-4000-8000-000000000006", "c0000000-0000-4000-8000-000000000006", "Araucária Foods — Unidade CIC", "Av. Juscelino K. de Oliveira", "2900", "Cidade Industrial", "81260-000", -25.51, -49.33, "cic"],
  ["b0000000-0000-4000-8000-000000000007", "c0000000-0000-4000-8000-000000000007", "Ed. Torres do Batel", "Al. Dom Pedro II", "480", "Batel", "80420-060", -25.442, -49.283, "centro"],
  ["b0000000-0000-4000-8000-000000000008", "c0000000-0000-4000-8000-000000000008", "Centro Cívico Offices", "R. Ébano Pereira", "309", "Centro Cívico", "80410-240", -25.418, -49.268, "centro"],
  ["b0000000-0000-4000-8000-000000000009", "c0000000-0000-4000-8000-000000000009", "Farmácia Pinheiro — Matriz Centro", "R. XV de Novembro", "890", "Centro", "80020-310", -25.429, -49.27, "centro"],
  ["b0000000-0000-4000-8000-000000000010", "c0000000-0000-4000-8000-000000000009", "Farmácia Pinheiro — Portão", "Av. República Argentina", "3600", "Portão", "81050-000", -25.472, -49.293, "sul"],
  ["b0000000-0000-4000-8000-000000000011", "c0000000-0000-4000-8000-000000000010", "Campus Ecoville", "R. Prof. Pedro V. Parigot de Souza", "5300", "Ecoville", "81280-330", -25.444, -49.348, "oeste"],
  ["b0000000-0000-4000-8000-000000000012", "c0000000-0000-4000-8000-000000000011", "Bom Preço — Portão", "R. João Bettega", "850", "Portão", "81070-000", -25.477, -49.299, "sul"],
  ["b0000000-0000-4000-8000-000000000013", "c0000000-0000-4000-8000-000000000011", "Bom Preço — Boqueirão", "Av. Marechal Floriano Peixoto", "6200", "Boqueirão", "81650-000", -25.501, -49.245, "sul"],
  ["b0000000-0000-4000-8000-000000000014", "c0000000-0000-4000-8000-000000000012", "Hotel Vista Barigui", "R. Padre Anchieta", "1540", "Bigorrilho", "80730-000", -25.437, -49.301, "oeste"],
];

export const buildingsFixture: Building[] = rows.map(
  ([id, client_id, nome, logradouro, numero, bairro, cep, lat, lng, regiao]) => ({
    id,
    client_id,
    nome,
    logradouro,
    numero,
    bairro,
    cidade: "Curitiba",
    uf: "PR",
    cep,
    lat,
    lng,
    regiao,
    ...stamps(),
  }),
);
