-- ============================================================================
-- Control Lead — seed.sql
-- Dados fictícios realistas (pt-BR, Curitiba/PR) para demo da Fase 1.
-- Datas relativas a CURRENT_DATE. Idempotente via ON CONFLICT DO NOTHING.
-- ATENÇÃO: os inserts em auth.users são para ambiente LOCAL/DEV apenas
-- (senha de todos: "demo12345").
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Usuários (auth.users) + profiles
-- ----------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'eduardo@leadclimatizacao.com.br',
   crypt('demo12345', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Eduardo Leal","role":"admin"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'fernanda@leadclimatizacao.com.br',
   crypt('demo12345', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Fernanda Ribeiro","role":"atendente"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'carlos@leadclimatizacao.com.br',
   crypt('demo12345', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Carlos Menezes","role":"tecnico"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000004',
   'authenticated', 'authenticated', 'joaopedro@leadclimatizacao.com.br',
   crypt('demo12345', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"João Pedro Alves","role":"tecnico"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000005',
   'authenticated', 'authenticated', 'rafael@leadclimatizacao.com.br',
   crypt('demo12345', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}',
   '{"full_name":"Rafael Siqueira","role":"tecnico"}', now(), now())
on conflict (id) do nothing;

-- garante papel/nome/telefone mesmo se o trigger já criou o profile
insert into public.profiles (id, full_name, role, phone) values
  ('a0000000-0000-4000-8000-000000000001', 'Eduardo Leal',     'admin',     '(41) 99911-0001'),
  ('a0000000-0000-4000-8000-000000000002', 'Fernanda Ribeiro', 'atendente', '(41) 99911-0002'),
  ('a0000000-0000-4000-8000-000000000003', 'Carlos Menezes',   'tecnico',   '(41) 99911-0003'),
  ('a0000000-0000-4000-8000-000000000004', 'João Pedro Alves', 'tecnico',   '(41) 99911-0004'),
  ('a0000000-0000-4000-8000-000000000005', 'Rafael Siqueira',  'tecnico',   '(41) 99911-0005')
on conflict (id) do update
  set full_name = excluded.full_name, role = excluded.role, phone = excluded.phone;

-- ----------------------------------------------------------------------------
-- 2. Clientes (12) — shoppings, hospitais, indústrias, condomínios, varejo
-- ----------------------------------------------------------------------------
insert into public.clients
  (id, razao_social, nome_fantasia, cnpj, segmento, contato_nome, contato_email, contato_telefone) values
  ('c0000000-0000-4000-8000-000000000001', 'Centro Comercial Água Verde S.A.',            'Shopping Água Verde',            '12.345.678/0001-01', 'shopping',    'Marcelo Tavares',  'facilities@shoppingaguaverde.com.br', '(41) 3222-1010'),
  ('c0000000-0000-4000-8000-000000000002', 'Empreendimentos Jardim das Américas Ltda.',   'Shopping Jardim das Américas',   '23.456.789/0001-02', 'shopping',    'Renata Campos',    'manutencao@shopjardim.com.br',        '(41) 3266-2020'),
  ('c0000000-0000-4000-8000-000000000003', 'Associação Hospitalar Santa Clara',           'Hospital Santa Clara',           '34.567.890/0001-03', 'hospital',    'Dr. Aloísio Prado','engenharia@hsantaclara.org.br',       '(41) 3330-3030'),
  ('c0000000-0000-4000-8000-000000000004', 'Hospital e Maternidade Boa Vista Ltda.',      'Hospital Boa Vista',             '45.678.901/0001-04', 'hospital',    'Silvia Kraemer',   'infra@hboavista.com.br',              '(41) 3357-4040'),
  ('c0000000-0000-4000-8000-000000000005', 'Indústria Metalúrgica Paranaense S.A.',       'IMP Metalúrgica',                '56.789.012/0001-05', 'industria',   'Jorge Wisniewski', 'manutencao@impmetal.com.br',          '(41) 3346-5050'),
  ('c0000000-0000-4000-8000-000000000006', 'Araucária Alimentos Indústria e Com. Ltda.',  'Araucária Foods',                '67.890.123/0001-06', 'industria',   'Tatiane Moro',     'engenharia@araucariafoods.com.br',    '(41) 3286-6060'),
  ('c0000000-0000-4000-8000-000000000007', 'Condomínio Edifício Torres do Batel',         'Torres do Batel',                '78.901.234/0001-07', 'condominio',  'Sr. Valdir Souza', 'sindico@torresdobatel.com.br',        '(41) 3242-7070'),
  ('c0000000-0000-4000-8000-000000000008', 'Condomínio Comercial Centro Cívico Offices',  'Centro Cívico Offices',          '89.012.345/0001-08', 'condominio',  'Ana Paula Riedi',  'adm@ccoffices.com.br',                '(41) 3254-8080'),
  ('c0000000-0000-4000-8000-000000000009', 'Drogarias Pinheiro Ltda.',                    'Farmácias Pinheiro',             '90.123.456/0001-09', 'varejo',      'Luciano Pinheiro', 'operacoes@farmpinheiro.com.br',       '(41) 3233-9090'),
  ('c0000000-0000-4000-8000-000000000010', 'Instituto Educacional Campos do Paraná S.A.', 'Centro Universitário Campos',    '01.234.567/0001-10', 'educacao',    'Profª Marta Gruber','prefeitura.campus@unicampos.edu.br', '(41) 3317-1111'),
  ('c0000000-0000-4000-8000-000000000011', 'Supermercados Bom Preço Curitiba Ltda.',      'Bom Preço',                      '11.223.344/0001-11', 'varejo',      'Edson Maluf',      'manutencao@bompreco-ctba.com.br',     '(41) 3278-1212'),
  ('c0000000-0000-4000-8000-000000000012', 'Hotelaria Barigui Empreendimentos Ltda.',     'Hotel Vista Barigui',            '22.334.455/0001-12', 'hotelaria',   'Juliana Prado',    'gerencia@hotelvistabarigui.com.br',   '(41) 3335-1313')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Prédios / unidades (14)
-- ----------------------------------------------------------------------------
insert into public.buildings
  (id, client_id, nome, logradouro, numero, bairro, cep, lat, lng, regiao) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Shopping Água Verde',              'Av. República Argentina',   '1200', 'Água Verde',           '80620-010', -25.4472, -49.2880, 'sul'),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'Shopping Jardim das Américas',     'Av. Comendador Franco',     '4500', 'Jardim das Américas',  '81520-000', -25.4610, -49.2340, 'leste'),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'Hospital Santa Clara — Sede',      'R. Brigadeiro Franco',      '2300', 'Rebouças',             '80230-100', -25.4448, -49.2620, 'centro'),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 'Hospital Boa Vista',               'Av. Paraná',                '3050', 'Boa Vista',            '82510-000', -25.3880, -49.2440, 'norte'),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005', 'IMP — Planta CIC',                 'R. Senador Accioly Filho',  '1750', 'Cidade Industrial',    '81310-000', -25.4950, -49.3450, 'cic'),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000006', 'Araucária Foods — Unidade CIC',    'Av. Juscelino K. de Oliveira', '2900', 'Cidade Industrial', '81260-000', -25.5100, -49.3300, 'cic'),
  ('b0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000007', 'Ed. Torres do Batel',              'Al. Dom Pedro II',          '480',  'Batel',                '80420-060', -25.4420, -49.2830, 'centro'),
  ('b0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000008', 'Centro Cívico Offices',            'R. Ébano Pereira',          '309',  'Centro Cívico',        '80410-240', -25.4180, -49.2680, 'centro'),
  ('b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000009', 'Farmácia Pinheiro — Matriz Centro','R. XV de Novembro',         '890',  'Centro',               '80020-310', -25.4290, -49.2700, 'centro'),
  ('b0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000009', 'Farmácia Pinheiro — Portão',       'Av. República Argentina',   '3600', 'Portão',               '81050-000', -25.4720, -49.2930, 'sul'),
  ('b0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000010', 'Campus Ecoville',                  'R. Prof. Pedro V. Parigot de Souza', '5300', 'Ecoville',    '81280-330', -25.4440, -49.3480, 'oeste'),
  ('b0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000011', 'Bom Preço — Portão',               'R. João Bettega',           '850',  'Portão',               '81070-000', -25.4770, -49.2990, 'sul'),
  ('b0000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000011', 'Bom Preço — Boqueirão',            'Av. Marechal Floriano Peixoto', '6200', 'Boqueirão',        '81650-000', -25.5010, -49.2450, 'sul'),
  ('b0000000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000012', 'Hotel Vista Barigui',              'R. Padre Anchieta',         '1540', 'Bigorrilho',           '80730-000', -25.4370, -49.3010, 'oeste')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Equipamentos (~40) — 18 nominais + lotes por generate_series
-- ----------------------------------------------------------------------------
insert into public.equipment
  (id, building_id, tipo, marca, modelo, capacidade_btu, codigo_interno, ambiente, status, data_instalacao) values
  -- Shopping Água Verde
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'chiller', 'Carrier',  '30XA-352',        1800000, 'CAG-01', 'Central de água gelada',        'operacional',      current_date - 1460),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'chiller', 'Carrier',  '30XA-352',        1800000, 'CAG-02', 'Central de água gelada (reserva)','operacional',    current_date - 1460),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'self',    'Trane',    'SCWM-20TR',        240000, '01-S1',  'Praça de alimentação',          'operacional',      current_date - 900),
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'vrf',     'Daikin',   'VRV IV RXYQ12',    136000, '02-V1',  'Administração — 2º piso',       'operacional',      current_date - 700),
  -- Hospital Santa Clara
  ('e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000003', 'chiller', 'York',     'YVAA-0210',       1200000, 'CAG-01', 'Casa de máquinas — subsolo',    'tecnico_em_campo', current_date - 2200),
  ('e0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000003', 'vrf',     'Hitachi',  'Set Free FSXN10',  120000, '03-V2',  'CTI — ala leste',               'operacional',      current_date - 1100),
  ('e0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000003', 'split',   'Springer', 'Midea Xtreme 30k',  30000, '01-B4',  'Farmácia interna',              'chamado_aberto',   current_date - 600),
  -- IMP Metalúrgica
  ('e0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000005', 'self',    'Hitachi',  'RVT-15TR',         180000, 'GAL-S1', 'Galpão de usinagem',            'tecnico_em_campo', current_date - 1800),
  ('e0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000005', 'split',   'Fujitsu',  'Inverter 27k',      27000, 'ADM-B2', 'Sala de TI / CPD',              'operacional',      current_date - 400),
  -- Torres do Batel
  ('e0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000007', 'vrf',     'LG',       'Multi V 5',        160000, 'T1-V1',  'Salão de festas / áreas comuns','operacional',      current_date - 800),
  -- Hotel Vista Barigui
  ('e0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000014', 'vrf',     'Samsung',  'DVM S2',           180000, 'HT-V1',  'Apartamentos — torre única',    'operacional',      current_date - 500),
  ('e0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000014', 'split',   'Daikin',   'Advance 18k',       18000, '00-B1',  'Recepção / lobby',              'operacional',      current_date - 500),
  -- Farmácias Pinheiro
  ('e0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000009', 'split',   'Elgin',    'Eco Power 24k',     24000, '01-B1',  'Salão de vendas — matriz',      'chamado_aberto',   current_date - 1000),
  ('e0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000010', 'janela',  'Springer', 'Silentia 10k',      10000, '01-J1',  'Estoque — fundos',              'inativo',          current_date - 3000),
  -- Bom Preço
  ('e0000000-0000-4000-8000-000000000015', 'b0000000-0000-4000-8000-000000000012', 'self',    'Carrier',  '50BZ-10TR',        120000, 'LJ-S1',  'Área de vendas',                'operacional',      current_date - 1300),
  ('e0000000-0000-4000-8000-000000000016', 'b0000000-0000-4000-8000-000000000013', 'self',    'Trane',    'SCWM-10TR',        120000, 'LJ-S1',  'Área de vendas',                'operacional',      current_date - 1300),
  -- Centro Cívico Offices
  ('e0000000-0000-4000-8000-000000000017', 'b0000000-0000-4000-8000-000000000008', 'vrf',     'Daikin',   'VRV IV RXYQ8',      96000, '01-V1',  'Torre comercial — pavimentos',  'operacional',      current_date - 650),
  -- Campus Ecoville
  ('e0000000-0000-4000-8000-000000000018', 'b0000000-0000-4000-8000-000000000011', 'chiller', 'Midea',    'MGBT-150',         900000, 'CAG-01', 'Biblioteca e auditórios',       'operacional',      current_date - 1700)
on conflict (id) do nothing;

-- Lote: 8 splits nas alas do Hospital Santa Clara (códigos 02-A1..02-A8)
insert into public.equipment (building_id, tipo, marca, modelo, capacidade_btu, codigo_interno, ambiente, status)
select 'b0000000-0000-4000-8000-000000000003', 'split', 'Springer', 'Midea AirVolution 18k', 18000,
       format('02-A%s', g), format('Enfermaria %s — 2º andar', g), 'operacional'
from generate_series(1, 8) g
on conflict (building_id, codigo_interno) do nothing;

-- Lote: 6 splits nas lojas-âncora do Shopping Jardim das Américas (03-L1..03-L6)
insert into public.equipment (building_id, tipo, marca, modelo, capacidade_btu, codigo_interno, ambiente, status)
select 'b0000000-0000-4000-8000-000000000002', 'split', 'Daikin', 'Sky Air 36k', 36000,
       format('03-L%s', g), format('Loja âncora %s', g), 'operacional'
from generate_series(1, 6) g
on conflict (building_id, codigo_interno) do nothing;

-- Lote: 6 splits nos andares do Ed. Torres do Batel (04-B1..04-B6, padrão "04-B7")
insert into public.equipment (building_id, tipo, marca, modelo, capacidade_btu, codigo_interno, ambiente, status)
select 'b0000000-0000-4000-8000-000000000007', 'split', 'LG', 'Dual Inverter 12k', 12000,
       format('04-B%s', g), format('Hall do %sº pavimento', g + 3), 'operacional'
from generate_series(1, 6) g
on conflict (building_id, codigo_interno) do nothing;

-- Lote: 3 splits no administrativo da Araucária Foods (ADM-B1..ADM-B3)
insert into public.equipment (building_id, tipo, marca, modelo, capacidade_btu, codigo_interno, ambiente, status)
select 'b0000000-0000-4000-8000-000000000006', 'split', 'Gree', 'Eco Garden 24k', 24000,
       format('ADM-B%s', g), format('Escritório administrativo — sala %s', g), 'operacional'
from generate_series(1, 3) g
on conflict (building_id, codigo_interno) do nothing;

-- ----------------------------------------------------------------------------
-- 5. Templates de checklist
-- ----------------------------------------------------------------------------
insert into public.checklist_templates (id, nome, tipo, itens) values
  ('ce000000-0000-4000-8000-000000000001', 'PMOC — Split / VRF (mensal)', 'preventiva_pmoc', '[
     {"id": "limpeza_filtros",     "label": "Limpeza e higienização dos filtros de ar",  "tipo": "checkbox"},
     {"id": "limpeza_serpentina",  "label": "Limpeza da serpentina do evaporador",       "tipo": "checkbox"},
     {"id": "dreno",               "label": "Verificação e desobstrução do dreno",       "tipo": "checkbox"},
     {"id": "pressao_gas",         "label": "Medição de pressão do fluido refrigerante", "tipo": "numero", "unidade": "psi"},
     {"id": "corrente_compressor", "label": "Medição de corrente do compressor",         "tipo": "numero", "unidade": "A"},
     {"id": "temperatura_saida",   "label": "Temperatura do ar de insuflamento",         "tipo": "numero", "unidade": "°C"},
     {"id": "obs",                 "label": "Observações",                               "tipo": "texto"}
   ]'::jsonb),
  ('ce000000-0000-4000-8000-000000000002', 'PMOC — Chiller / Self (mensal)', 'preventiva_pmoc', '[
     {"id": "limpeza_condensador", "label": "Limpeza do condensador",                    "tipo": "checkbox"},
     {"id": "nivel_oleo",          "label": "Verificação do nível de óleo do compressor","tipo": "checkbox"},
     {"id": "analise_vibracao",    "label": "Análise de ruído e vibração",               "tipo": "checkbox"},
     {"id": "setpoint_agua",       "label": "Temperatura de água gelada (saída)",        "tipo": "numero", "unidade": "°C"},
     {"id": "pressao_alta",        "label": "Pressão de alta",                           "tipo": "numero", "unidade": "psi"},
     {"id": "pressao_baixa",       "label": "Pressão de baixa",                          "tipo": "numero", "unidade": "psi"},
     {"id": "obs",                 "label": "Observações",                               "tipo": "texto"}
   ]'::jsonb),
  ('ce000000-0000-4000-8000-000000000003', 'Corretiva — diagnóstico padrão', 'corretiva', '[
     {"id": "sintoma_confirmado",  "label": "Sintoma relatado confirmado em campo",      "tipo": "checkbox"},
     {"id": "causa_raiz",          "label": "Causa raiz identificada",                   "tipo": "texto"},
     {"id": "peca_substituida",    "label": "Peça(s) substituída(s)",                    "tipo": "texto"},
     {"id": "teste_funcionamento", "label": "Teste de funcionamento pós-reparo (30 min)","tipo": "checkbox"},
     {"id": "obs",                 "label": "Observações",                               "tipo": "texto"}
   ]'::jsonb),
  ('ce000000-0000-4000-8000-000000000004', 'Instalação — comissionamento', 'instalacao', '[
     {"id": "fixacao",             "label": "Fixação de unidades interna e externa",     "tipo": "checkbox"},
     {"id": "vacuo",               "label": "Vácuo na linha (mín. 30 min)",              "tipo": "checkbox"},
     {"id": "teste_estanqueidade", "label": "Teste de estanqueidade",                    "tipo": "checkbox"},
     {"id": "carga_gas",           "label": "Carga de fluido conforme manual",           "tipo": "checkbox"},
     {"id": "partida_assistida",   "label": "Partida assistida e medições finais",       "tipo": "checkbox"},
     {"id": "obs",                 "label": "Observações",                               "tipo": "texto"}
   ]'::jsonb)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 6. Planos PMOC (7) — Lei 13.589/2018
--    * 2 vencendo em até 7 dias (demo) · 1 atrasado (demo)
-- ----------------------------------------------------------------------------
insert into public.pmoc_plans
  (id, equipment_id, periodicidade_dias, proxima_data, checklist_template_id, ativo, observacoes) values
  -- VENCENDO em 5 dias (chiller do Shopping Água Verde)
  ('ac000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 30, current_date + 5,
   'ce000000-0000-4000-8000-000000000002', true, 'CAG principal — janela de manutenção: segundas antes das 10h'),
  -- ATRASADO há 9 dias (chiller do Hospital Santa Clara)
  ('ac000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000005', 30, current_date - 9,
   'ce000000-0000-4000-8000-000000000002', true, 'Hospital: acesso à casa de máquinas com autorização da engenharia clínica'),
  -- VENCENDO em 6 dias (VRF do CTI do Hospital Santa Clara)
  ('ac000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000006', 30, current_date + 6,
   'ce000000-0000-4000-8000-000000000001', true, 'CTI — executar de madrugada, acompanhado pela enfermagem'),
  ('ac000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000004', 30, current_date + 20,
   'ce000000-0000-4000-8000-000000000001', true, null),
  ('ac000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000008', 60, current_date + 33,
   'ce000000-0000-4000-8000-000000000002', true, 'Galpão — ambiente com particulado metálico, filtros extras'),
  ('ac000000-0000-4000-8000-000000000006', 'e0000000-0000-4000-8000-000000000011', 30, current_date + 14,
   'ce000000-0000-4000-8000-000000000001', true, null),
  ('ac000000-0000-4000-8000-000000000007', 'e0000000-0000-4000-8000-000000000017', 90, current_date + 50,
   'ce000000-0000-4000-8000-000000000001', true, 'Condomínio comercial — trimestral conforme plano do RT')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 7. Ordens de serviço (15) — números 1001..1015
-- ----------------------------------------------------------------------------
insert into public.service_orders
  (id, numero, tipo, prioridade, status, origem, building_id, equipment_id, pmoc_plan_id,
   technician_id, descricao, scheduled_at, checkin_lat, checkin_lng, checkin_at,
   checklist_template_id, checklist_respostas, fotos_antes, fotos_depois, laudo,
   assinatura_path, concluded_at, created_by, created_at) values

  -- CONCLUÍDAS -----------------------------------------------------------------
  ('50000000-0000-4000-8000-000000000001', 1001, 'corretiva', 'alta', 'concluido', 'manual',
   'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', null,
   'a0000000-0000-4000-8000-000000000003',
   'Self da praça de alimentação desarmando por alta pressão nos horários de pico.',
   (current_date - 20)::timestamptz + interval '9 hours',
   -25.4473, -49.2882, (current_date - 20)::timestamptz + interval '9 hours 12 minutes',
   'ce000000-0000-4000-8000-000000000003',
   '{"sintoma_confirmado": true, "causa_raiz": "Condensador obstruído por gordura da praça de alimentação", "peca_substituida": "Pressostato de alta", "teste_funcionamento": true, "obs": "Recomendada limpeza trimestral do condensador"}'::jsonb,
   array['50000000-0000-4000-8000-000000000001/antes/condensador-01.jpg'],
   array['50000000-0000-4000-8000-000000000001/depois/condensador-01.jpg'],
   'Condensador higienizado com produto alcalino e pressostato de alta substituído. Equipamento operando com pressões nominais após 40 min de teste.',
   '50000000-0000-4000-8000-000000000001/assinatura.png',
   (current_date - 20)::timestamptz + interval '12 hours',
   'a0000000-0000-4000-8000-000000000002', (current_date - 21)::timestamptz + interval '15 hours'),

  ('50000000-0000-4000-8000-000000000002', 1002, 'preventiva_pmoc', 'media', 'concluido', 'pmoc_auto',
   'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004',
   'ac000000-0000-4000-8000-000000000004',
   'a0000000-0000-4000-8000-000000000004',
   'Manutenção preventiva PMOC — VRF administração (ciclo mensal).',
   (current_date - 10)::timestamptz + interval '8 hours',
   -25.4471, -49.2879, (current_date - 10)::timestamptz + interval '8 hours 5 minutes',
   'ce000000-0000-4000-8000-000000000001',
   '{"limpeza_filtros": true, "limpeza_serpentina": true, "dreno": true, "pressao_gas": 118, "corrente_compressor": 12.4, "temperatura_saida": 13.5, "obs": "Sem anomalias"}'::jsonb,
   array['50000000-0000-4000-8000-000000000002/antes/filtros.jpg'],
   array['50000000-0000-4000-8000-000000000002/depois/filtros.jpg'],
   'Rotina PMOC executada integralmente. Parâmetros dentro da faixa. Próximo ciclo em 30 dias.',
   '50000000-0000-4000-8000-000000000002/assinatura.png',
   (current_date - 10)::timestamptz + interval '10 hours 30 minutes',
   'a0000000-0000-4000-8000-000000000002', (current_date - 12)::timestamptz + interval '9 hours'),

  ('50000000-0000-4000-8000-000000000003', 1003, 'preventiva_pmoc', 'media', 'concluido', 'pmoc_auto',
   'b0000000-0000-4000-8000-000000000014', 'e0000000-0000-4000-8000-000000000011',
   'ac000000-0000-4000-8000-000000000006',
   'a0000000-0000-4000-8000-000000000005',
   'Manutenção preventiva PMOC — VRF dos apartamentos (ciclo mensal).',
   (current_date - 16)::timestamptz + interval '14 hours',
   -25.4371, -49.3012, (current_date - 16)::timestamptz + interval '14 hours 3 minutes',
   'ce000000-0000-4000-8000-000000000001',
   '{"limpeza_filtros": true, "limpeza_serpentina": true, "dreno": true, "pressao_gas": 121, "corrente_compressor": 14.1, "temperatura_saida": 12.8, "obs": "Dreno do 6º andar com início de obstrução — tratado"}'::jsonb,
   array['50000000-0000-4000-8000-000000000003/antes/evaporadora.jpg'],
   array['50000000-0000-4000-8000-000000000003/depois/evaporadora.jpg'],
   'PMOC concluído. Atenção ao dreno do 6º pavimento nos próximos ciclos.',
   '50000000-0000-4000-8000-000000000003/assinatura.png',
   (current_date - 16)::timestamptz + interval '17 hours',
   'a0000000-0000-4000-8000-000000000002', (current_date - 18)::timestamptz + interval '10 hours'),

  -- EM CAMPO (hoje, com check-in geolocalizado) --------------------------------
  ('50000000-0000-4000-8000-000000000004', 1004, 'corretiva', 'urgente', 'em_campo', 'ia_whatsapp',
   'b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000005', null,
   'a0000000-0000-4000-8000-000000000003',
   'Chiller da casa de máquinas em alarme de baixa vazão — impacto direto no CTI. Aberto pela IA via WhatsApp.',
   current_date::timestamptz + interval '8 hours',
   -25.4449, -49.2621, now() - interval '2 hours',
   'ce000000-0000-4000-8000-000000000003', null,
   array['50000000-0000-4000-8000-000000000004/antes/painel-alarme.jpg'], '{}',
   null, null, null,
   'a0000000-0000-4000-8000-000000000002', now() - interval '4 hours'),

  ('50000000-0000-4000-8000-000000000005', 1005, 'corretiva', 'alta', 'em_campo', 'manual',
   'b0000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000008', null,
   'a0000000-0000-4000-8000-000000000004',
   'Self do galpão com ruído anormal no ventilador do condensador.',
   current_date::timestamptz + interval '13 hours',
   -25.4951, -49.3448, now() - interval '1 hour',
   'ce000000-0000-4000-8000-000000000003', null, '{}', '{}',
   null, null, null,
   'a0000000-0000-4000-8000-000000000002', (current_date - 1)::timestamptz + interval '16 hours'),

  -- AGENDADAS ------------------------------------------------------------------
  ('50000000-0000-4000-8000-000000000006', 1006, 'preventiva_pmoc', 'media', 'agendado', 'pmoc_auto',
   'b0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
   'ac000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000005',
   'Manutenção preventiva PMOC — chiller CAG-01 (vencimento próximo).',
   (current_date + 1)::timestamptz + interval '7 hours',
   null, null, null,
   'ce000000-0000-4000-8000-000000000002', null, '{}', '{}', null, null, null,
   'a0000000-0000-4000-8000-000000000002', (current_date - 2)::timestamptz + interval '11 hours'),

  ('50000000-0000-4000-8000-000000000007', 1007, 'corretiva', 'media', 'agendado', 'manual',
   'b0000000-0000-4000-8000-000000000007', 'e0000000-0000-4000-8000-000000000010', null,
   'a0000000-0000-4000-8000-000000000003',
   'VRF do salão de festas com gotejamento na evaporadora — evento no fim de semana.',
   (current_date + 2)::timestamptz + interval '9 hours',
   null, null, null,
   'ce000000-0000-4000-8000-000000000003', null, '{}', '{}', null, null, null,
   'a0000000-0000-4000-8000-000000000002', (current_date - 1)::timestamptz + interval '10 hours'),

  ('50000000-0000-4000-8000-000000000008', 1008, 'orcamento', 'baixa', 'agendado', 'manual',
   'b0000000-0000-4000-8000-000000000011', null, null,
   'a0000000-0000-4000-8000-000000000004',
   'Visita técnica para orçamento de climatização de 4 novas salas de aula do bloco C.',
   (current_date + 3)::timestamptz + interval '10 hours',
   null, null, null, null, null, '{}', '{}', null, null, null,
   'a0000000-0000-4000-8000-000000000002', (current_date - 3)::timestamptz + interval '14 hours'),

  ('50000000-0000-4000-8000-000000000009', 1009, 'instalacao', 'media', 'agendado', 'manual',
   'b0000000-0000-4000-8000-000000000012', null, null,
   'a0000000-0000-4000-8000-000000000005',
   'Instalação de split 36k na nova padaria da loja Portão (venda fechada).',
   (current_date + 5)::timestamptz + interval '8 hours',
   null, null, null,
   'ce000000-0000-4000-8000-000000000004', null, '{}', '{}', null, null, null,
   'a0000000-0000-4000-8000-000000000001', (current_date - 4)::timestamptz + interval '9 hours'),

  -- ABERTAS --------------------------------------------------------------------
  ('50000000-0000-4000-8000-000000000010', 1010, 'corretiva', 'urgente', 'aberto', 'ia_whatsapp',
   'b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000007', null,
   null,
   'Split da farmácia interna não liga — medicamentos termolábeis em risco. Aberto pela IA via WhatsApp.',
   null, null, null, null,
   'ce000000-0000-4000-8000-000000000003', null, '{}', '{}', null, null, null,
   null, now() - interval '35 minutes'),

  ('50000000-0000-4000-8000-000000000011', 1011, 'corretiva', 'media', 'aberto', 'manual',
   'b0000000-0000-4000-8000-000000000009', 'e0000000-0000-4000-8000-000000000013', null,
   null,
   'Split do salão de vendas gelando pouco; possível baixa de gás.',
   null, null, null, null,
   'ce000000-0000-4000-8000-000000000003', null, '{}', '{}', null, null, null,
   'a0000000-0000-4000-8000-000000000002', (current_date - 1)::timestamptz + interval '17 hours'),

  ('50000000-0000-4000-8000-000000000012', 1012, 'orcamento', 'baixa', 'aberto', 'manual',
   'b0000000-0000-4000-8000-000000000002', null, null,
   null,
   'Orçamento de retrofit da climatização do cinema (6 salas).',
   null, null, null, null, null, null, '{}', '{}', null, null, null,
   'a0000000-0000-4000-8000-000000000001', (current_date - 2)::timestamptz + interval '15 hours'),

  ('50000000-0000-4000-8000-000000000013', 1013, 'preventiva_pmoc', 'alta', 'aberto', 'pmoc_auto',
   'b0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000005',
   'ac000000-0000-4000-8000-000000000002',
   null,
   'Manutenção preventiva PMOC — chiller CAG-01 do hospital (PLANO ATRASADO, gerar agenda com urgência).',
   null, null, null, null,
   'ce000000-0000-4000-8000-000000000002', null, '{}', '{}', null, null, null,
   null, (current_date - 9)::timestamptz + interval '6 hours'),

  ('50000000-0000-4000-8000-000000000014', 1014, 'instalacao', 'media', 'aberto', 'manual',
   'b0000000-0000-4000-8000-000000000006', null, null,
   null,
   'Instalação de 2 splits 24k no novo laboratório de qualidade.',
   null, null, null, null,
   'ce000000-0000-4000-8000-000000000004', null, '{}', '{}', null, null, null,
   'a0000000-0000-4000-8000-000000000002', (current_date - 5)::timestamptz + interval '11 hours'),

  -- CANCELADA ------------------------------------------------------------------
  ('50000000-0000-4000-8000-000000000015', 1015, 'corretiva', 'baixa', 'cancelado', 'manual',
   'b0000000-0000-4000-8000-000000000013', 'e0000000-0000-4000-8000-000000000016', null,
   null,
   'Self da área de vendas com odor — cliente cancelou: problema era na exaustão da rotisseria.',
   null, null, null, null, null, null, '{}', '{}', null, null, null,
   'a0000000-0000-4000-8000-000000000002', (current_date - 8)::timestamptz + interval '10 hours')
on conflict (id) do nothing;

-- alinha a sequence ao maior número já usado
select setval('public.service_order_numero_seq',
              (select coalesce(max(numero), 1000) from public.service_orders));

-- ----------------------------------------------------------------------------
-- 8. Funil comercial — leads (8)
-- ----------------------------------------------------------------------------
insert into public.leads
  (id, nome_contato, empresa, telefone, email, origem, estagio, valor_estimado, client_id, motivo_perda, observacoes, created_at) values
  ('1ead0000-0000-4000-8000-000000000001', 'Marcos Antunes',  'Condomínio Alpha Business',      '(41) 99711-2201', 'marcos@alphabusiness.com.br',   'site',      'lead',              18000.00, null, null, 'Pediu proposta de PMOC para 22 splits', now() - interval '2 days'),
  ('1ead0000-0000-4000-8000-000000000002', 'Patrícia Lima',   'Clínica OdontoPrime',            '(41) 99822-3302', 'patricia@odontoprime.com.br',   'whatsapp',  'lead',               6500.00, null, null, 'Chegou pela IA do WhatsApp; 4 consultórios', now() - interval '4 days'),
  ('1ead0000-0000-4000-8000-000000000003', 'Roberto Krüger',  'Escola Kinder Haus',             '(41) 99933-4403', 'roberto@kinderhaus.com.br',     'indicacao', 'reuniao_marcada',   22000.00, null, null, 'Indicação do Hotel Vista Barigui; reunião quinta 14h', now() - interval '6 days'),
  ('1ead0000-0000-4000-8000-000000000004', 'Sandra Nogueira', 'Academia CorpoFit Batel',        '(41) 99644-5504', 'sandra@corpofit.com.br',        'site',      'reuniao_marcada',    9800.00, null, null, 'Reunião marcada para semana que vem', now() - interval '3 days'),
  ('1ead0000-0000-4000-8000-000000000005', 'Felipe Sartori',  'Cantina Sartori',                '(41) 99755-6605', 'felipe@cantinasartori.com.br',  'whatsapp',  'reuniao_realizada', 12500.00, null, null, 'Reunião feita; aguardando fechar proposta de 3 splits + PMOC', now() - interval '9 days'),
  ('1ead0000-0000-4000-8000-000000000006', 'Juliana Prado',   'Hotel Vista Barigui',            '(41) 99866-7706', 'gerencia@hotelvistabarigui.com.br', 'indicacao', 'venda',         54000.00, 'c0000000-0000-4000-8000-000000000012', null, 'Convertido em cliente — contrato PMOC recorrente', now() - interval '75 days'),
  ('1ead0000-0000-4000-8000-000000000007', 'Otávio Bastos',   'Gráfica Impressul',              '(41) 99977-8807', 'otavio@impressul.com.br',       'site',      'perdido',           15000.00, null, 'Fechou com concorrente por preço', null, now() - interval '20 days'),
  ('1ead0000-0000-4000-8000-000000000008', 'Camila Ferraz',   'Laboratório BioCuritiba',        '(41) 99588-9908', 'camila@biocuritiba.com.br',     'whatsapp',  'lead',              30000.00, null, null, 'Sala limpa: exige projeto; avaliar parceria de engenharia', now() - interval '1 day')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 9. Atendimento IA — conversas e mensagens
-- ----------------------------------------------------------------------------
insert into public.conversations (id, canal, telefone, client_id, status, last_message_at, created_at) values
  ('ca000000-0000-4000-8000-000000000001', 'whatsapp', '+554133303030', 'c0000000-0000-4000-8000-000000000003', 'transferido', now() - interval '3 hours',  now() - interval '4 hours'),
  ('ca000000-0000-4000-8000-000000000002', 'whatsapp', '+554132221010', 'c0000000-0000-4000-8000-000000000001', 'ia',          now() - interval '50 minutes', now() - interval '1 hour'),
  ('ca000000-0000-4000-8000-000000000003', 'whatsapp', '+5541998223302', null,                                   'ia',          now() - interval '4 days',   now() - interval '4 days'),
  ('ca000000-0000-4000-8000-000000000004', 'whatsapp', '+554132427070', 'c0000000-0000-4000-8000-000000000007', 'encerrado',   now() - interval '1 day',    now() - interval '1 day')
on conflict (id) do nothing;

-- messages não tem chave natural: limpa as conversas seed antes de reinserir
delete from public.messages
where conversation_id in (
  'ca000000-0000-4000-8000-000000000001', 'ca000000-0000-4000-8000-000000000002',
  'ca000000-0000-4000-8000-000000000003', 'ca000000-0000-4000-8000-000000000004');

insert into public.messages (conversation_id, direcao, autor, texto, metadata, created_at) values
  -- Hospital Santa Clara: urgência escalada para humano
  ('ca000000-0000-4000-8000-000000000001', 'in',  'cliente', 'O chiller da casa de máquinas entrou em alarme e o CTI está esquentando. Preciso de atendimento URGENTE.', '{"wa_id": "msg_9001"}', now() - interval '4 hours'),
  ('ca000000-0000-4000-8000-000000000001', 'out', 'ia',      'Entendi, situação crítica no CTI do Hospital Santa Clara. Já abri a OS nº 1004 com prioridade urgente e estou acionando a equipe. Um atendente assume a conversa agora.', '{"intent": "abrir_chamado", "os_numero": 1004}', now() - interval '3 hours 55 minutes'),
  ('ca000000-0000-4000-8000-000000000001', 'out', 'humano',  'Dr. Aloísio, aqui é a Fernanda da Lead. O técnico Carlos já está a caminho, chega em ~40 min. Vou acompanhando com o senhor por aqui.', '{}', now() - interval '3 hours'),
  -- Shopping Água Verde: dúvida simples resolvida pela IA
  ('ca000000-0000-4000-8000-000000000002', 'in',  'cliente', 'Bom dia! A preventiva do chiller está confirmada para amanhã?', '{"wa_id": "msg_9010"}', now() - interval '1 hour'),
  ('ca000000-0000-4000-8000-000000000002', 'out', 'ia',      'Bom dia, Marcelo! Sim: OS nº 1006, amanhã às 7h, técnico Rafael Siqueira. A janela termina antes das 10h, como combinado.', '{"intent": "consulta_agendamento", "os_numero": 1006}', now() - interval '50 minutes'),
  -- Lead novo (Clínica OdontoPrime)
  ('ca000000-0000-4000-8000-000000000003', 'in',  'cliente', 'Olá, vocês fazem manutenção de ar-condicionado em clínica odontológica? São 4 consultórios.', '{"wa_id": "msg_9020"}', now() - interval '4 days'),
  ('ca000000-0000-4000-8000-000000000003', 'out', 'ia',      'Olá! Sim, atendemos clínicas com plano PMOC (obrigatório pela Lei 13.589/2018). Posso agendar uma visita técnica gratuita para dimensionar a proposta?', '{"intent": "qualificar_lead"}', now() - interval '4 days' + interval '2 minutes'),
  -- Torres do Batel: chamado resolvido e encerrado
  ('ca000000-0000-4000-8000-000000000004', 'in',  'cliente', 'O ar do salão de festas está pingando água no piso.', '{"wa_id": "msg_9030"}', now() - interval '1 day'),
  ('ca000000-0000-4000-8000-000000000004', 'out', 'ia',      'Obrigado pelo aviso, Sr. Valdir. Abri a OS nº 1007 e agendei o técnico Carlos para depois de amanhã às 9h, antes do evento do fim de semana.', '{"intent": "abrir_chamado", "os_numero": 1007}', now() - interval '1 day' + interval '3 minutes'),
  ('ca000000-0000-4000-8000-000000000004', 'in',  'cliente', 'Perfeito, obrigado!', '{"wa_id": "msg_9031"}', now() - interval '1 day' + interval '10 minutes');

-- ----------------------------------------------------------------------------
-- 10. Financeiro — contratos (8) e faturas
-- ----------------------------------------------------------------------------
insert into public.contracts
  (id, client_id, tipo, valor_mensal, status, dia_vencimento, inicio, fim, observacoes) values
  ('c7000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'pmoc_recorrente',  8900.00, 'ativo', 5,  (current_date - interval '14 months')::date, null, 'PMOC mensal — 2 chillers, 1 self, 1 VRF'),
  ('c7000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'pmoc_recorrente', 12400.00, 'ativo', 10, (current_date - interval '20 months')::date, null, 'PMOC mensal — hospital (inclui plantão de sobreaviso)'),
  ('c7000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000005', 'pmoc_recorrente',  6800.00, 'ativo', 15, (current_date - interval '8 months')::date,  null, 'PMOC bimestral do galpão + mensal do administrativo'),
  ('c7000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000007', 'pmoc_recorrente',  3900.00, 'ativo', 10, (current_date - interval '6 months')::date,  null, null),
  ('c7000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000012', 'pmoc_recorrente',  5400.00, 'ativo', 5,  (current_date - interval '2 months')::date,  null, 'Contrato novo — convertido do funil (lead Juliana Prado)'),
  ('c7000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', 'pmoc_recorrente',  7600.00, 'ativo', 20, (current_date - interval '11 months')::date, null, null),
  ('c7000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000009', 'corretiva_avulsa',  850.00, 'ativo', 10, (current_date - interval '3 months')::date,  null, 'Corretivas sob demanda — ticket médio'),
  ('c7000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000006', 'instalacao',      14500.00, 'ativo', 15, (current_date - interval '1 month')::date, (current_date + interval '2 months')::date, 'Instalação laboratório de qualidade — 3 parcelas')
on conflict (id) do nothing;

-- Faturas dos contratos PMOC recorrentes: competências M-2 e M-1 pagas, mês atual pendente
insert into public.invoices
  (contract_id, competencia, valor, status, metodo, vencimento, paid_at, nf_numero)
select
  c.id,
  (date_trunc('month', current_date) - make_interval(months => m))::date,
  c.valor_mensal,
  case when m = 0 then 'pendente' else 'pago' end::public.invoice_status,
  case when c.dia_vencimento <= 10 then 'boleto' else 'pix' end::public.payment_method,
  (date_trunc('month', current_date) - make_interval(months => m))::date + (c.dia_vencimento - 1),
  case when m = 0 then null
       else ((date_trunc('month', current_date) - make_interval(months => m))::date
             + (c.dia_vencimento - 3))::timestamptz + interval '14 hours' end,
  case when m = 0 then null
       else 'NFS-' || to_char(date_trunc('month', current_date) - make_interval(months => m), 'YYYYMM')
            || '-' || lpad((row_number() over (order by c.id, m))::text, 3, '0') end
from public.contracts c
cross join generate_series(0, 2) m
where c.tipo = 'pmoc_recorrente' and c.status = 'ativo'
on conflict (contract_id, competencia) do nothing;

-- Uma fatura ATRASADA (IMP Metalúrgica, competência do mês passado, venceu e não pagou)
update public.invoices
set status = 'atrasado', paid_at = null, nf_numero = null
where contract_id = 'c7000000-0000-4000-8000-000000000003'
  and competencia = (date_trunc('month', current_date) - interval '1 month')::date;

-- Corretiva avulsa das Farmácias Pinheiro paga via Pix no mês atual
insert into public.invoices (contract_id, competencia, valor, status, metodo, vencimento, paid_at, nf_numero)
values ('c7000000-0000-4000-8000-000000000007',
        date_trunc('month', current_date)::date, 1240.00, 'pago', 'pix',
        date_trunc('month', current_date)::date + 9,
        now() - interval '5 days',
        'NFS-' || to_char(current_date, 'YYYYMM') || '-901')
on conflict (contract_id, competencia) do nothing;

-- 1ª parcela da instalação da Araucária Foods (mês atual, pendente por boleto)
insert into public.invoices (contract_id, competencia, valor, status, metodo, vencimento)
values ('c7000000-0000-4000-8000-000000000008',
        date_trunc('month', current_date)::date, 14500.00, 'pendente', 'boleto',
        date_trunc('month', current_date)::date + 14)
on conflict (contract_id, competencia) do nothing;

commit;

-- ============================================================================
-- Conferência rápida pós-seed (opcional):
--   select * from public.vw_dashboard_pmoc_situacao;   -- 1 atrasado, 2 vencendo
--   select public.dashboard_resumo();
--   select public.generate_pmoc_service_orders(7);     -- não duplica a OS 1006/1013
-- ============================================================================
