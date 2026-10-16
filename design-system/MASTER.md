# Control Lead: contrato visual (redesign 16/10/2026)

Substitui o "console azul-marinho" da demo. Pedido do dono: linguagem das referências
em `../.claude-pastes/colado-1792187015284.png`, `colado-1792187049069.png`,
`colado-1792187069322.png` e `colado-1792187086624.png`, mantendo um azul Lead como
marca, com a responsividade como prioridade (técnicos e dono usam muito o celular).

## Mundo
Grafite monocromático. Uma moldura (`bg-shell #171717`, onde fica a barra lateral) e,
no desktop, um painel interno mais escuro (`bg-void #0D0D0D`, raio 28px) onde a tela vive.
Cards suaves e grandes, quase sem borda. O branco é a cor de ação. Cor só para estado e marca.

## Tokens (em `src/app/globals.css`; os nomes antigos foram mantidos)
| Papel | Token / classe | Valor |
|---|---|---|
| Moldura, barra lateral | `bg-shell` | #171717 |
| Fundo da tela | `bg-void` / `bg-background` | #0D0D0D |
| Card | `bg-console` / `bg-card` | #131313 + `ring-1 ring-line` |
| Campo, popover, card elevado | `bg-console-2` | #1B1B1B |
| Hover / selecionado | `bg-console-3` | #252525 |
| Linhas | `border-line` #262626, `border-line-soft` #1D1D1D |
| Texto | `text-ink` #F5F5F4, `text-ink-dim` #A8A8AD (secundário), `text-ink-faint` #8A8A91 (terciário, AA) |
| Ação principal | `bg-ink text-void` (Button default) | branco sobre preto |
| Marca (azul Lead) | `text-signal`, `bg-signal`, `bg-signal-dim` | #5B9BFF |
| Status | `clear` ok/concluído, `amber` atenção/vencendo, `danger` urgente/atrasado, `signal` em campo; versões `-dim` para fundo de pílula |
| Sobreposição clara | classe `.surface-paper` | papel #F1F1EF com grão; reescreve os tokens por dentro |

Regras de cor:
- Azul Lead SÓ em: marca, item ativo (ícone), foco, links, "em campo / técnico em campo", série principal de gráfico quando precisar de cor. Nunca como fundo de botão primário (botão primário é branco). `variant="brand"` existe para casos raros.
- Status sempre como pílula `rounded-full` com fundo `-dim` + texto da cor (ou ponto colorido + texto `ink-dim`). Cancelado é neutro (`ink-faint`).
- Nada de gradiente decorativo, glow, borda colorida lateral, sombra colorida.

## Tipografia
- **Onest** (`font-display` / `font-heading`): títulos, números grandes (KPIs), valores. Peso 500 (medium), tracking negativo (-0.02 a -0.03em). Nunca negrito pesado em título.
- **Inter** (`font-sans`): todo o resto. `font-mono` agora é Inter com números tabulares (não use mais monoespaçada).
- PROIBIDO: rótulo em CAIXA ALTA com letter-spacing (`uppercase tracking-wider`), eyebrow acima de título, `font-mono` como fantasia. Rótulos em frase normal: "Chamados abertos", `text-sm text-ink-dim`.
- Escala: título de página 28px celular / 36px desktop (vem do `PageHeader`); título de card 17px; KPI 32-40px Onest; corpo 14-15px; secundário 13px; nada abaixo de 12px.
- Números: `tabular-nums` (já global em tabela/time/.font-mono). Nº de OS: `#1004` em `font-medium text-ink-dim tabular-nums`, sem mono.

## Forma
- Raios (`--radius` 10px): card 22px (`rounded-[1.375rem]`, já no `Card`), bloco interno/linha de lista 18px (`rounded-2xl`), campo 14px (`rounded-xl`), botão e pílula `rounded-full`, folha inferior 28px.
- Espaço: gutter da tela 16px celular / 32px desktop (já no layout). Entre seções 24px celular / 32px desktop. Dentro do card 16/20px.
- Sem cards aninhados. Lista dentro de card = linhas separadas por `divide-y divide-line-soft`, não card dentro de card.
- Sombra só em sobreposição (popover, folha, dock).

## Componentes base (já prontos em `src/components/ui/*` — use, não reestilize por tela)
- `Button`: pílula. `default` = branco (ação principal, 1 por área), `secondary` = grafite, `outline`, `ghost`, `destructive`, `link` (azul). Tamanhos já dão 44px no celular (`h-11 md:h-9`); `size="lg"` para CTA de campo (48px). Remova overrides antigos `max-md:h-11`, `max-md:size-11` e afins que agora são redundantes.
- `Input`, `Select`, `Textarea`: preenchidos `bg-console-2`, 44px no celular, texto 16px no celular (sem zoom do iOS). Não sobrescreva altura.
- `Tabs`: `variant="default"` = segmentado em pílula com ativo branco (filtros rápidos: Todos / Abertos / Em campo). `variant="line"` = sublinhado (seções da página, como "Overview / Performance" na referência).
- `Dialog`: no celular já vira folha inferior (sobe do rodapé, alça no topo, botões em largura total). No desktop centralizado. `DialogFooter` já empilha no celular.
- `Sheet` lateral para detalhes; no celular use `side="bottom"` quando for ação rápida.
- `Badge`: pílula 24px.
- `Table`: cabeçalho em frase, `text-ink-faint`, linhas de 56px. **No celular (< md) tabela vira lista de cards/linhas** (já há esse padrão em Chamados): `hidden md:block` na tabela e lista `md:hidden`.
- `PageHeader` (`@/components/page-header`): TODA tela usa. `title`, `description` (1 frase curta), `actions` (botão principal à direita no desktop; no celular as ações esticam em linha própria), `children` (abas/filtros do cabeçalho). Ele é o `h1`; a barra superior mostra o título compacto ao rolar.
- `.surface-paper`: sobreposição clara das referências 3 e 4. Use em seletores de data/período (PopoverContent `className="surface-paper"`), nada além disso.

## Celular primeiro (obrigatório em toda tela)
- Projete para 390px primeiro; `md:` (768) e `lg:` (1024) acrescentam colunas. Nada de largura fixa em px que estoure; teste mental em 360px.
- Alvo de toque ≥ 44px; 8px entre alvos. Ação principal no alcance do polegar: em fluxos de campo, barra de ação fixa no rodapé acima da barra de abas (`bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+1rem)]`) ou botão de largura total.
- A barra de abas inferior ocupa o rodapé no celular; o layout já reserva o espaço (`pb-tabbar`). Elementos `fixed bottom-*` precisam somar `var(--tabbar-h)`.
- Filtros: no celular, chips roláveis na horizontal (`flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4`) ou um botão "Filtros" que abre folha; nunca 3 selects empilhados ocupando a tela.
- Tabelas largas viram lista; KPIs em grade 2x2 no celular, não 4 cards empilhados de altura cheia.
- Texto longo trunca com `truncate`/`line-clamp-2`, nunca empurra a largura.
- `min-w-0` em filhos de flex com texto.

## Movimento
Ease `var(--ease-out-expo)`, 150-250ms em interação. Um único momento orquestrado: entrada do dashboard (`.console-enter` com `--enter-delay`). `prefers-reduced-motion` sempre.

## Voz
Português direto, frase em caixa normal, botão diz a ação ("Novo chamado", "Salvar cliente"). Sem "Sistema operacional", sem jargão técnico, sem travessão em texto de interface (use vírgula ou dois-pontos). Estado vazio diz o que fazer.
