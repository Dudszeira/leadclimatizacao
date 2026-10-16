---
name: Control Lead
description: Sistema de gestão da Lead Climatização, num estojo grafite com o azul Lead como marca
colors:
  shell: "#171717"
  void: "#0D0D0D"
  console: "#131313"
  console-2: "#1B1B1B"
  console-3: "#252525"
  line: "#262626"
  line-soft: "#1D1D1D"
  ink: "#F5F5F4"
  ink-dim: "#A8A8AD"
  ink-faint: "#8A8A91"
  signal: "#5B9BFF"
  signal-solid: "#2F6FE0"
  signal-dim: "rgba(91, 155, 255, 0.14)"
  amber: "#F5A623"
  amber-dim: "rgba(245, 166, 35, 0.14)"
  clear: "#3DD68C"
  clear-dim: "rgba(61, 214, 140, 0.13)"
  danger: "#FF6B7F"
  danger-dim: "rgba(255, 107, 127, 0.14)"
  paper: "#F1F1EF"
  paper-ink: "#0D0D0D"
  paper-line: "#DCDCD8"
typography:
  display:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 500
    lineHeight: 1.375
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"cv11\", \"ss03\""
  body-lead:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.375
rounded:
  field: "14px"
  block: "18px"
  card: "22px"
  panel: "28px"
  pill: "9999px"
spacing:
  gutter-mobile: "16px"
  gutter-desktop: "32px"
  card-mobile: "16px"
  card-desktop: "20px"
  section-mobile: "24px"
  section-desktop: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.void}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.console-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.console-3}"
  button-ghost:
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.pill}"
    height: "44px"
  input:
    backgroundColor: "{colors.console-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 14px"
    height: "44px"
  card:
    backgroundColor: "{colors.console}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-mobile}"
  status-pill-em-campo:
    backgroundColor: "{colors.signal-dim}"
    textColor: "{colors.signal}"
    rounded: "{rounded.pill}"
    height: "24px"
    padding: "0 10px"
  status-pill-aberto:
    backgroundColor: "{colors.amber-dim}"
    textColor: "{colors.amber}"
    rounded: "{rounded.pill}"
    height: "24px"
  status-pill-concluido:
    backgroundColor: "{colors.clear-dim}"
    textColor: "{colors.clear}"
    rounded: "{rounded.pill}"
    height: "24px"
  status-pill-atrasado:
    backgroundColor: "{colors.danger-dim}"
    textColor: "{colors.danger}"
    rounded: "{rounded.pill}"
    height: "24px"
  tabs-segmented:
    backgroundColor: "{colors.console-2}"
    textColor: "{colors.ink-dim}"
    rounded: "{rounded.pill}"
    height: "44px"
  tabs-segmented-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.void}"
  mobile-dock:
    backgroundColor: "{colors.console-2}"
    rounded: "24px"
    height: "68px"
  surface-paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.panel}"
---

# Design System: Control Lead

<!-- Registro derivado do build de 16/10/2026. O contrato de trabalho dos agentes continua em design-system/MASTER.md; este arquivo descreve o que foi entregue. Tokens normativos em src/app/globals.css. -->

## Overview

**Creative North Star: "O Estojo Grafite"**

A operação inteira cabe no polegar dentro de um estojo escuro. Uma moldura grafite (`shell`) segura a barra lateral; dentro dela, no desktop, um painel mais escuro (`void`) de cantos largos é onde a tela vive. Os cards são suaves e grandes, separados do painel por um fio quase invisível, nunca por sombra. O branco é a cor de ação; o azul Lead aparece só como marca, foco e "em campo". Todo o resto é grafite em degraus de poucos pontos de luminância.

A densidade é de ferramenta de trabalho: muita informação por tela, mas com respiro de 16 a 20px dentro dos cards e títulos em Onest médio que ancoram cada bloco. A cor só aparece para estado (urgente, vencendo, ok, em campo), sempre em pílula de fundo translúcido; o olho acha o problema antes de ler. Uma única exceção clara quebra o grafite de propósito: o papel com grão dos seletores de período, que lê como um cartão físico pousado sobre o estojo.

O mundo recusa o "console de operações" padrão do nicho: azul-marinho, rótulos monoespaçados em caixa alta, brilho de status. Tema escuro único nesta fase.

**Key Characteristics:**
- Moldura `shell` + painel `void` de 28px no desktop; no celular o painel ocupa a tela e a navegação vira dock flutuante.
- Cards `console` de 22px com fio `line` de 1px, sem sombra em repouso.
- Botões e pílulas totalmente arredondados; primário branco com texto preto.
- Onest 500 com tracking negativo para títulos e números; Inter para todo o resto.
- Cor apenas para estado e marca; tipos e categorias são neutros.
- Alvos de 44px no celular, 36 a 40px no desktop.

## Colors

Grafite monocromático em degraus curtos, um azul de marca e quatro cores de estado, cada uma com uma versão translúcida para fundo de pílula.

### Primary
- **Azul Lead** (`signal`): marca (BrandMark), anel de foco, cursor de texto, links, ícone do item ativo e tudo que significa "em campo / técnico em campo". Nunca fundo de botão primário.
- **Azul Lead Sólido** (`signal-solid`): variante mais profunda reservada para preenchimentos de marca que precisam de contraste com texto claro.
- **Véu Azul** (`signal-dim`): fundo da pílula "Em campo" e "IA"; seleção de texto em versão 28%.

### Secondary
- **Âmbar de Atenção** (`amber` / `amber-dim`): aberto, pendente, vencendo, prioridade alta, chamado aberto no mapa.
- **Verde Liberado** (`clear` / `clear-dim`): concluído, pago, ativo, em dia, equipamento operacional.
- **Rosa Alarme** (`danger` / `danger-dim`): urgente, atrasado, risco, ações destrutivas. Cancelado nunca usa esta cor.

### Neutral
- **Grafite de Moldura** (`shell`): fundo do `html`/`body`, barra lateral e `theme-color` do navegador.
- **Painel Fundo** (`void`): canvas onde a tela vive; texto de botão primário; aro dos pinos do mapa.
- **Card** (`console`): superfície de card.
- **Grafite Elevado** (`console-2`): campos, popovers, botão secundário, trilho do segmentado, dock.
- **Grafite Selecionado** (`console-3`): hover e selecionado, pílula "Agendado".
- **Fio** (`line`) e **Fio Suave** (`line-soft`): contorno de card e campo; divisórias internas de listas, tabelas e abas sublinhadas.
- **Tinta** (`ink`): texto principal e cor de ação (botão primário, aba ativa, sublinhado ativo).
- **Tinta Média** (`ink-dim`): texto secundário, descrições, rótulos de KPI, pílulas neutras.
- **Tinta Fraca** (`ink-faint`): terciário com contraste AA, placeholders, cabeçalho de tabela, cancelado, inativo.
- **Papel** (`paper`, `paper-ink`, `paper-line`): sobreposição clara com grão, só em seletores de data e período.

### Named Rules
**A Regra do Branco que Age.** A ação principal é `ink` sobre `void`, uma por área. O azul nunca é o botão primário; a variante `brand` existe para casos raros.

**A Regra do Status que Salta.** Cor só para estado e marca. Estado é pílula `rounded-full` com fundo `-dim` e texto na cor, ou ponto colorido de 6px com texto `ink-dim`. Tipo de OS, tipo de contrato e cancelado são neutros.

**A Regra do Papel Único.** `.surface-paper` reescreve os tokens por dentro (tinta, fio, cards, primário) e só aparece em seletores de data e período (dashboard e mês do PMOC).

## Typography

**Display Font:** Onest (com ui-sans-serif, system-ui)
**Body Font:** Inter (com ui-sans-serif, system-ui), recursos `cv11` e `ss03` ligados
**Label/Mono Font:** não há monoespaçada; `font-mono` é Inter com números tabulares

**Character:** Onest médio e apertado dá aos títulos e números um peso calmo e geométrico; Inter carrega a leitura densa sem chamar atenção.

### Hierarchy
- **Display** (Onest 500, 36px desktop, 1.1, -0.03em): título de página do `PageHeader` no desktop; também é o `h1`.
- **Headline** (Onest 500, 28px celular, 1.1, -0.03em): título de página no celular; KPIs em 28 a 40px (`font-display`, números proporcionais).
- **Title** (Onest 500, 17px, 1.375, -0.01em): título de card; título compacto da barra superior em 16px.
- **Body** (Inter 400, 14px, 1.5): corpo e células de tabela. Descrição de página em 15px com entrelinha 1.625, até 60ch. Campos em 16px no celular para evitar zoom do iOS.
- **Label** (Inter 400/500, 13px): metadados, rótulos de KPI, secundários. Badge em 12px medium. Rótulos sempre em caixa de frase.

### Named Rules
**A Regra do Medium.** Títulos e números são Onest 500 com tracking negativo; nunca negrito pesado. A única exceção registrada é o nome "Control Lead" na barra lateral (600).

**A Regra dos Números Certos.** Tabelas, horários e `font-mono` usam `tabular-nums`; números de exibição em `font-display` usam algarismos proporcionais, porque o "1" tabular do Onest separa "11" em "1 1". Nº de OS é `#1004` em Inter medium `ink-dim` tabular.

## Layout

Celular primeiro, projetado em 390px e testado em 360px; `md` (768px) e `lg` (1024px) acrescentam colunas. Conteúdo limitado a 1520px.

- **Desktop:** barra lateral de 15.5rem na moldura (recolhível para ícones); painel `void` com margem de 8px, raio 28px e fio `line-soft`. Barra superior sticky de 64px, translúcida (`void` 80% com desfoque), mostra o título compacto quando o `h1` sai da tela.
- **Celular:** barra superior de 56px + área segura com a marca; dock de abas flutuante no rodapé (`--tabbar-h` 68px) com o ativo em pílula branca e "Mais" abrindo a barra lateral em folha. O conteúdo reserva o espaço do dock (`pb-tabbar`); elementos fixos no rodapé somam `--tabbar-h` e a área segura.
- **Ritmo:** gutter 16px celular / 32px desktop; 24px entre seções no celular, 32px no desktop; 16/20px dentro do card. `PageHeader` em toda tela: título à esquerda, ação principal à direita no desktop; no celular as ações descem e esticam em largura total.
- **Adaptação:** tabela larga vira lista de cards abaixo de `md`; KPIs em grade 2x2 no celular; filtros em chips roláveis na horizontal; texto longo trunca, nunca empurra a largura.

## Elevation & Depth

Plano em repouso, profundidade por degrau tonal: `shell` → `void` → `console` → `console-2` → `console-3`, cada passo um pouco mais claro. Cards se separam do painel por um fio de 1px, não por sombra. Sombra existe apenas em camadas que flutuam sobre o conteúdo, sempre preta, difusa e com espalhamento negativo; desfoque de fundo só na barra superior e no dock.

### Shadow Vocabulary
- **Sobreposição** (`box-shadow: 0 18px 48px -12px rgba(0,0,0,0.7)`): popover, select, menus, popup do mapa.
- **Sobreposição alta** (`box-shadow: 0 24px 64px -12px rgba(0,0,0,0.85)`): papel do seletor de mês do PMOC.
- **Dock** (`box-shadow: 0 -8px 32px rgba(0,0,0,0.55)`): dock de abas e barra de ação fixa da execução de OS.
- **Halo de status** (`box-shadow: 0 0 0 4px <cor>-dim`): anel dos pinos do mapa; anel chapado, sem brilho.

### Named Rules
**A Regra do Fio, não da Sombra.** Nada em repouso projeta sombra. Se algo precisa se separar do painel, é degrau tonal ou fio de 1px.

## Shapes

Formas macias e concêntricas: quanto maior o contêiner, maior o raio. Painel 28px, folha inferior 28px, papel do seletor 28px, dock 24px, card 22px, bloco interno e linha de lista 18px, popover 16px, campo 14px, marca 30% do lado. Botões, abas segmentadas, badges e pílulas de status são totalmente arredondados. Sem cards aninhados: lista dentro de card são linhas separadas por fio `line-soft`.

## Components

### Buttons
Pílulas firmes que encolhem 2% ao toque.
- **Shape:** totalmente arredondado (9999px).
- **Primary:** `ink` com texto `void`, 44px no celular / 36px no desktop, 20px/16px laterais, Inter 14px medium; hover a 88%.
- **Hover / Focus:** transição de 150ms; anel de foco de 3px em `signal` a 60%; `active` escala 0.98.
- **Secondary / Outline / Ghost:** secundário em `console-2` (hover `console-3`); contorno em fio `line` transparente; fantasma em `ink-dim` que acende ao hover. Destrutivo é `danger` sobre véu de 10 a 20%. Link é azul sublinhado no hover. `lg` (48px) para a ação de campo.

### Chips
- **Style:** badge de 24px, 12px medium, 10px de lateral. Estado: fundo `-dim` + texto na cor. Neutro (tipo, encerrado): contorno `line` com `ink-dim`; cancelado em `console-2` com `ink-faint`; agendado em `console-3` com `ink`.
- **Prioridade:** ponto colorido de 6px antes do rótulo (urgente `danger`, alta `amber`, média `ink-dim`, baixa `ink-faint`).

### Cards / Containers
- **Corner Style:** 22px.
- **Background:** `console`; rodapé em `console-2` a 40% com fio `line-soft`.
- **Shadow Strategy:** nenhuma; ver Elevation & Depth.
- **Border:** anel de 1px `line`.
- **Internal Padding:** 16px celular, 20px desktop, 12px na variante `sm`.

### Inputs / Fields
- **Style:** preenchido `console-2`, fio `line`, raio 14px, 44px celular / 40px desktop, texto 16px celular / 14px desktop, placeholder `ink-faint`, cursor `signal`.
- **Focus:** fio vira `signal` a 70% com anel de 3px `signal` a 20%.
- **Error / Disabled:** fio `danger` com anel `danger` a 20%; desabilitado a 50% de opacidade.

### Navigation
- **Barra lateral:** na moldura `shell`, itens em `ink-dim`, ativo em `console-3` com `ink`; grupo "Administração" no rodapé com rótulo em caixa de frase 12px `ink-faint`. Marca no topo: BrandMark azul + "Control Lead" / "Lead Climatização".
- **Abas:** `default` é segmentado em pílula (trilho `console-2`, ativo `ink` com texto `void`) para filtros rápidos; `line` é sublinhado de 2px em `ink` sob fio `line-soft`, 24px entre abas, para seções.
- **Dock (celular):** `console-2` a 92% com desfoque, raio 24px, fio `line`, sombra de dock; até cinco destinos do papel, ícone de 20px sobre rótulo; ativo em pílula `ink`.

### Seletor de período (papel)
Popover `.surface-paper` de raio 28px: papel claro com grão de ruído, faixa "Mar 2026 → Jul 2026" em Onest, botões Fechar (secundário) e Aplicar (primário escuro, que no papel é `paper-ink`), abas sublinhadas Meses/Anos, grade de meses e atalhos em pílula. É o único lugar onde o mundo inverte para claro.

### Execução de OS em campo
Cards grandes por OS com número tabular, tipo neutro, pílula de estado, linhas de ícone + texto e ações em largura total ("Abrir no mapa" secundário, "Continuar execução" primário). No celular a barra de ação fica fixa acima do dock; no desktop vira cápsula flutuante `console-2` com sombra de dock.

## Do's and Don'ts

### Do:
- **Do** use `PageHeader` em toda tela: título 28px celular / 36px desktop em Onest 500, uma frase curta de descrição, ação principal branca.
- **Do** mantenha uma ação principal `ink` por área; as demais em secundário, contorno ou fantasma.
- **Do** expresse estado como pílula de fundo `-dim` com texto na cor, ou ponto de 6px com texto `ink-dim`.
- **Do** separe superfícies por degrau tonal e fio de 1px; reserve sombra para popover, folha e dock.
- **Do** garanta 44px de alvo no celular, 8px entre alvos, campos em 16px e foco visível em `signal`.
- **Do** use `ease-out-expo` (`cubic-bezier(0.22, 1, 0.36, 1)`) em 150 a 250ms; o único momento orquestrado é a entrada dos cards do dashboard (`.console-enter`), desligada em `prefers-reduced-motion`.

### Don't:
- **Don't** use o azul Lead como fundo de botão primário nem como cor de tipo ou categoria.
- **Don't** use rótulo em caixa alta com espaçamento, eyebrow acima de título ou monoespaçada decorativa.
- **Don't** use gradiente decorativo, brilho, borda lateral colorida ou sombra colorida.
- **Don't** aninhe cards; lista dentro de card é linha com fio `line-soft`.
- **Don't** aplique `.surface-paper` fora de seletores de data e período.
- **Don't** pinte "Cancelado" de `danger`; é neutro em `ink-faint`.
- **Don't** use texto abaixo de 12px.
