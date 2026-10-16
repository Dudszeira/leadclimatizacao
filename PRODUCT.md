# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Técnicos de campo** da Lead Climatização: usam quase só o celular, na rua, em casa de máquinas e telhado, com luz forte ou pouca, às vezes de luva e com sinal fraco. Trabalho: ver as OS do dia, chegar ao local (mapa), executar checklist, laudo, fotos e coletar assinatura.
- **Dono / administrador**: usa muito pelo celular (entre visitas e reuniões) e no notebook. Trabalho: acompanhar o dashboard, chamados abertos, PMOC vencendo, financeiro (faturas Asaas) e convidar a equipe.
- **Atendentes**: no escritório, desktop. Trabalho: abrir e despachar chamados, cadastrar clientes, prédios e equipamentos, gerir PMOC e o funil comercial.
- Cliente final não tem login na Fase 1.

## Product Purpose
Control Lead é o sistema de gestão da Lead Climatização (Curitiba/PR): CRM por cliente e prédio, central de chamados/OS com execução em campo, calendário de PMOC (Lei 13.589/2018), mapa de equipamentos, dashboard único e financeiro/fiscal via Asaas. Sucesso: nenhum PMOC vence sem ser visto, toda OS fecha com evidência (checklist, fotos, assinatura) e o dono enxerga a operação pelo celular.

## Positioning
Um sistema feito sob medida para a operação de uma empresa de climatização, que junta PMOC legal, execução de OS no celular e cobrança no mesmo lugar.

## Operating Context
- Uso intenso no celular (técnicos e dono); desktop para atendimento e cadastros.
- Produção: https://app.leadclimatizacao.com.br (Vercel, conta do cliente). Push no `main` publica.
- Atendimento IA/WhatsApp fora do go-live: tela existe para consulta, envio bloqueado.

## Capabilities and Constraints
- Next.js 16 App Router, Tailwind v4, shadcn/ui sobre Base UI, Supabase (RLS por papel admin/atendente/tecnico), Leaflet/OSM, Recharts, Asaas.
- Técnico não vê PMOC, dashboard nem financeiro.
- Datas sempre em America/Sao_Paulo. Idioma pt-BR.
- Tema escuro único (sem modo claro nesta fase).

## Brand Commitments
- Nome do produto: **Control Lead**, da **Lead Climatização**. Sem logotipo oficial no repositório.
- Redesign de 16/10/2026: o dono pediu linguagem monocromática escura inspirada nas referências em `../.claude-pastes/colado-1792187015284.png`, `colado-1792187049069.png`, `colado-1792187069322.png`, `colado-1792187086624.png` (shell em grafite com painel interno, cards suaves, botão principal claro, tabs sublinhadas, seletor de período claro), **mantendo um azul Lead como cor de marca**.
- Voz: português direto, sem jargão de sistema, frases curtas.

## Evidence on Hand
- Dados reais vêm do Supabase de produção; fixtures de demonstração em `src/lib/fixtures/` (modo demo local).
- Não há depoimentos, números comerciais nem logotipo; não inventar.

## Product Principles
1. Celular primeiro: tudo que técnico e dono fazem precisa caber no polegar.
2. Status salta, o resto silencia: cor só para estado (urgente, vencendo, ok, em campo) e para a marca.
3. Evidência antes de conclusão: a OS só fecha com prova.
4. Densidade com respiro: muita informação, legível de relance.

## Accessibility & Inclusion
WCAG AA de contraste, alvos de toque de 44px no celular, foco visível, `prefers-reduced-motion` respeitado, campos com 16px no celular (sem zoom do iOS).
