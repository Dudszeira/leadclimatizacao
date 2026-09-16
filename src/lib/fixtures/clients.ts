import type { Client } from "@/lib/types";
import { stamps } from "./dates";

type ClientSeed = [
  id: string,
  razao_social: string,
  nome_fantasia: string,
  cnpj: string,
  segmento: string,
  contato_nome: string,
  contato_email: string,
  contato_telefone: string,
];

/** 12 clientes de Curitiba — espelho da seção 2 do seed.sql. */
const rows: ClientSeed[] = [
  ["c0000000-0000-4000-8000-000000000001", "Centro Comercial Água Verde S.A.", "Shopping Água Verde", "12.345.678/0001-01", "shopping", "Marcelo Tavares", "facilities@shoppingaguaverde.com.br", "(41) 3222-1010"],
  ["c0000000-0000-4000-8000-000000000002", "Empreendimentos Jardim das Américas Ltda.", "Shopping Jardim das Américas", "23.456.789/0001-02", "shopping", "Renata Campos", "manutencao@shopjardim.com.br", "(41) 3266-2020"],
  ["c0000000-0000-4000-8000-000000000003", "Associação Hospitalar Santa Clara", "Hospital Santa Clara", "34.567.890/0001-03", "hospital", "Dr. Aloísio Prado", "engenharia@hsantaclara.org.br", "(41) 3330-3030"],
  ["c0000000-0000-4000-8000-000000000004", "Hospital e Maternidade Boa Vista Ltda.", "Hospital Boa Vista", "45.678.901/0001-04", "hospital", "Silvia Kraemer", "infra@hboavista.com.br", "(41) 3357-4040"],
  ["c0000000-0000-4000-8000-000000000005", "Indústria Metalúrgica Paranaense S.A.", "IMP Metalúrgica", "56.789.012/0001-05", "industria", "Jorge Wisniewski", "manutencao@impmetal.com.br", "(41) 3346-5050"],
  ["c0000000-0000-4000-8000-000000000006", "Araucária Alimentos Indústria e Com. Ltda.", "Araucária Foods", "67.890.123/0001-06", "industria", "Tatiane Moro", "engenharia@araucariafoods.com.br", "(41) 3286-6060"],
  ["c0000000-0000-4000-8000-000000000007", "Condomínio Edifício Torres do Batel", "Torres do Batel", "78.901.234/0001-07", "condominio", "Sr. Valdir Souza", "sindico@torresdobatel.com.br", "(41) 3242-7070"],
  ["c0000000-0000-4000-8000-000000000008", "Condomínio Comercial Centro Cívico Offices", "Centro Cívico Offices", "89.012.345/0001-08", "condominio", "Ana Paula Riedi", "adm@ccoffices.com.br", "(41) 3254-8080"],
  ["c0000000-0000-4000-8000-000000000009", "Drogarias Pinheiro Ltda.", "Farmácias Pinheiro", "90.123.456/0001-09", "varejo", "Luciano Pinheiro", "operacoes@farmpinheiro.com.br", "(41) 3233-9090"],
  ["c0000000-0000-4000-8000-000000000010", "Instituto Educacional Campos do Paraná S.A.", "Centro Universitário Campos", "01.234.567/0001-10", "educacao", "Profª Marta Gruber", "prefeitura.campus@unicampos.edu.br", "(41) 3317-1111"],
  ["c0000000-0000-4000-8000-000000000011", "Supermercados Bom Preço Curitiba Ltda.", "Bom Preço", "11.223.344/0001-11", "varejo", "Edson Maluf", "manutencao@bompreco-ctba.com.br", "(41) 3278-1212"],
  ["c0000000-0000-4000-8000-000000000012", "Hotelaria Barigui Empreendimentos Ltda.", "Hotel Vista Barigui", "22.334.455/0001-12", "hotelaria", "Juliana Prado", "gerencia@hotelvistabarigui.com.br", "(41) 3335-1313"],
];

export const clientsFixture: Client[] = rows.map(
  ([id, razao_social, nome_fantasia, cnpj, segmento, contato_nome, contato_email, contato_telefone]) => ({
    id,
    razao_social,
    nome_fantasia,
    cnpj,
    segmento,
    contato_nome,
    contato_email,
    contato_telefone,
    observacoes: null,
    ativo: true,
    ...stamps(),
  }),
);
