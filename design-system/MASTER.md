# Control Lead — Design System (contrato visual da demo aceita)

Fonte: proposta-comercial/demo-fragment.html (o cliente comprou ESTE visual).

## Paleta (dark console — tema único nesta fase)
- Fundo: `--void #060B14` · Superfícies: `--console #0D1729` / `--console-2 #131F38` / `--console-3 #182848`
- Bordas: `--line #1E2E4A` · `--line-soft #16233C`
- Accent: `--signal #5B9BFF` (sólido `#1D5FD1`, dim `rgba(91,155,255,.13)`)
- Status: âmbar `#F5A623` (atenção/vencendo) · verde `#2FE3A6` (ok/resolvido) · vermelho a definir p/ urgente (`#FF5C7A` sugerido, mesmo croma)
- Texto: `--ink #EAF2FF` · `--ink-dim #93A7C9` · `--ink-faint #5C7093`

## Tipografia
- Display/números: **Space Grotesk** · Corpo: **Inter** · Dados/códigos/KPIs: **JetBrains Mono**
- KPIs grandes em mono; labels uppercase pequenas com letter-spacing (padrão "console de operações")

## Layout
Sidebar fixa escura (7 itens: Dashboard, Clientes, Chamados, Calendário PMOC, Mapa, Atendimento IA, Financeiro) + topbar com contexto do dia. Conteúdo em cards `--console` com borda `--line`, raio 8/10/16px.

## Princípio
"Console de operações": denso, legível, dados em mono, um accent azul só. O elemento memorável é o painel de status vivo (KPIs + atividade). Todo o resto quieto.

## Motion
Ease `cubic-bezier(0.22,1,0.36,1)`. Um momento orquestrado: entrada do dashboard (stagger dos cards). Resto responde a ação. `prefers-reduced-motion` sempre.

## Risco aceito
Tema dark único (sem light) nesta fase — é o que a demo vendeu; contraste AA verificado sobre #0D1729.
