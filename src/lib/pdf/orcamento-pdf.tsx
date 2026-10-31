import path from "node:path";

import {
  Document,
  Font,
  Image,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import { EMPRESA, enderecoEmpresa } from "@/lib/empresa";
import { formatBRL, formatDateBR, formatDateTimeBR, formatTelefoneBR, maskCnpj } from "@/lib/format";
import { quoteNumeroLabel } from "@/lib/status-meta";
import type { QuoteServiceType, QuoteWithItems } from "@/lib/types";

/**
 * PDF do orçamento (A4, pt-BR). Documento comercial para impressão: fundo
 * branco, texto grafite, azul Lead só na marca e em detalhes — NÃO segue o
 * tema escuro da UI. Só roda no servidor (Node): lê as fontes do disco.
 *
 * Fontes (OFL, Google Fonts): src/assets/fonts, incluídas no trace da rota
 * /api/orcamentos/[id]/pdf via outputFileTracingIncludes (next.config.ts),
 * assim como o logo opcional (EMPRESA.logo, também em src/assets).
 */

const ASSETS_DIR = path.join(process.cwd(), "src", "assets");
const FONT_DIR = path.join(ASSETS_DIR, "fonts");

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(FONT_DIR, "Inter-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Inter-Medium.ttf"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "Inter-SemiBold.ttf"), fontWeight: 600 },
  ],
});
Font.register({
  family: "Onest",
  fonts: [
    { src: path.join(FONT_DIR, "Onest-Medium.ttf"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "Onest-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "Onest-Bold.ttf"), fontWeight: 700 },
  ],
});
// Sem hifenização automática (o padrão é inglês e quebra palavras em pt-BR).
Font.registerHyphenationCallback((word) => [word]);

// ----------------------------------------------------------------------------
// Tokens de impressão
// ----------------------------------------------------------------------------

const C = {
  ink: "#1C1C1E",
  dim: "#5A5A60",
  faint: "#8A8A91",
  line: "#DCDCD8",
  lineSoft: "#ECECE9",
  zebra: "#F7F7F5",
  brand: "#2F6FE0",
  brandSoft: "#EAF1FD",
  ok: "#1E7A4D",
  okSoft: "#E6F4EC",
  danger: "#B4233A",
  dangerSoft: "#FBEAEC",
};

const TIPO_LABEL: Record<QuoteServiceType, string> = {
  diagnostico: "Diagnóstico",
  instalacao: "Instalação",
  corretiva: "Manutenção corretiva",
  preventiva: "Manutenção preventiva",
};

const COL = { desc: "50%", unid: "8%", qtd: "10%", unit: "16%", total: "16%" } as const;

const s = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 9,
    color: C.ink,
    paddingTop: 36,
    paddingBottom: 64,
    paddingHorizontal: 40,
    // Sem lineHeight aqui: herdado, faz o Text com render (nº da página) sumir.
    backgroundColor: "#FFFFFF",
  },
  // Cabeçalho
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  brandName: { fontFamily: "Onest", fontWeight: 600, fontSize: 15, marginLeft: 8, color: C.ink },
  companyLine: { fontSize: 7.5, color: C.dim, lineHeight: 1.45 },
  docBox: { alignItems: "flex-end", maxWidth: 220 },
  docKicker: { fontSize: 7, color: C.faint, letterSpacing: 1.4, textTransform: "uppercase" },
  docNumber: { fontFamily: "Onest", fontWeight: 700, fontSize: 20, lineHeight: 1.15, color: C.ink, marginTop: 2, marginBottom: 4 },
  metaRow: { flexDirection: "row", marginTop: 2 },
  metaLabel: { fontSize: 8, color: C.faint, marginRight: 4 },
  metaValue: { fontSize: 8, color: C.ink, fontWeight: 500 },
  tag: {
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 8,
    fontSize: 7.5,
    fontWeight: 600,
  },
  rule: { height: 1.5, backgroundColor: C.brand, marginTop: 14, marginBottom: 16, width: 36 },
  ruleFull: { height: 0.75, backgroundColor: C.line, marginTop: -16.75, marginBottom: 16 },
  // Partes
  parties: { flexDirection: "row", marginBottom: 16 },
  party: { flex: 1 },
  label: {
    fontSize: 7,
    color: C.faint,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 4,
    fontWeight: 500,
  },
  partyName: { fontFamily: "Onest", fontWeight: 600, fontSize: 10.5, color: C.ink, marginBottom: 2 },
  partyLine: { fontSize: 8.5, color: C.dim, lineHeight: 1.45 },
  // Serviço
  service: {
    backgroundColor: C.zebra,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  serviceTitle: { fontFamily: "Onest", fontWeight: 600, fontSize: 12.5, color: C.ink },
  serviceTipo: { fontSize: 8, color: C.dim, marginTop: 2 },
  // Tabela
  thead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.ink,
    paddingBottom: 5,
    marginBottom: 1,
  },
  th: { fontSize: 7, color: C.dim, letterSpacing: 0.9, textTransform: "uppercase", fontWeight: 600 },
  tr: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.lineSoft,
    alignItems: "flex-start",
  },
  td: { fontSize: 8.5, color: C.ink, lineHeight: 1.4 },
  tdDim: { fontSize: 8.5, color: C.dim },
  num: { textAlign: "right" },
  idx: { fontSize: 7.5, color: C.faint, width: 16 },
  // Totais
  totals: { marginTop: 10, alignSelf: "flex-end", width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  totalLabel: { fontSize: 8.5, color: C.dim },
  totalValue: { fontSize: 8.5, color: C.ink, textAlign: "right" },
  grand: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 10,
    backgroundColor: C.brandSoft,
    borderRadius: 6,
  },
  grandLabel: { fontFamily: "Onest", fontWeight: 600, fontSize: 9, color: C.ink, letterSpacing: 1 },
  grandValue: { fontFamily: "Onest", fontWeight: 700, fontSize: 15, color: C.ink },
  // Condições
  terms: { marginTop: 22 },
  termsGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -8 },
  term: { width: "50%", paddingHorizontal: 8, marginBottom: 12 },
  termFull: { width: "100%", paddingHorizontal: 8, marginBottom: 12 },
  termText: { fontSize: 8.5, color: C.ink, lineHeight: 1.5 },
  // Rodapé
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 26,
    borderTopWidth: 0.5,
    borderTopColor: C.line,
    paddingTop: 7,
  },
  footerText: { fontSize: 7, color: C.faint },
  pageNumber: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 26,
    paddingTop: 7.5,
    fontSize: 7,
    color: C.faint,
    textAlign: "right",
  },
});

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const qtdFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const brl = (v: number) => formatBRL(v).replace(/ /g, " ");

function enderecoPredio(b: QuoteWithItems["building"]): string[] {
  const rua = [b.logradouro, b.numero].filter(Boolean).join(", ");
  const linha1 = [rua, b.bairro].filter(Boolean).join(", ");
  const linha2 = `${b.cidade}/${b.uf}${b.cep ? `, CEP ${b.cep}` : ""}`;
  return [linha1, linha2].filter(Boolean);
}

/** Símbolo provisório da marca (mesmo desenho do BrandMark da UI). */
function BrandSymbol({ size = 26 }: { size?: number }) {
  const inner = size * 0.66;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: C.brand,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={inner} height={inner} viewBox="0 0 24 24">
        <Path
          d="M8 4.5v12.25c0 .97.78 1.75 1.75 1.75H17"
          stroke="#FFFFFF"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d="M12.5 13.5c1.6 0 2.4-1 4.5-1"
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          strokeOpacity={0.6}
        />
      </Svg>
    </View>
  );
}

function StatusTag({ quote }: { quote: QuoteWithItems }) {
  if (quote.status === "aprovado") {
    const quando = quote.decidido_em ? ` em ${formatDateTimeBR(quote.decidido_em)}` : "";
    return (
      <Text style={[s.tag, { color: C.ok, backgroundColor: C.okSoft }]}>{`Aprovado${quando}`}</Text>
    );
  }
  if (quote.status === "declinado") {
    return <Text style={[s.tag, { color: C.danger, backgroundColor: C.dangerSoft }]}>Declinado</Text>;
  }
  return null;
}

function Term({ label, text, full }: { label: string; text: string; full?: boolean }) {
  return (
    <View style={full ? s.termFull : s.term} wrap={false}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.termText}>{text}</Text>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Documento
// ----------------------------------------------------------------------------

export function OrcamentoPdf({ quote }: { quote: QuoteWithItems }) {
  const numero = quoteNumeroLabel(quote.numero);
  const { client, building } = quote;
  const fantasia =
    client.nome_fantasia && client.nome_fantasia !== client.razao_social ? client.nome_fantasia : null;
  const contato = [
    client.contato_nome,
    client.contato_telefone ? formatTelefoneBR(client.contato_telefone) : null,
  ].filter(Boolean) as string[];
  const empresaContato =
    EMPRESA.telefone === EMPRESA.whatsapp
      ? `${EMPRESA.telefone} (WhatsApp)`
      : [EMPRESA.telefone, `WhatsApp ${EMPRESA.whatsapp}`].join(" · ");

  const termos: Array<{ label: string; text: string }> = [];
  if (quote.condicoes_pagamento?.trim())
    termos.push({ label: "Condições de pagamento", text: quote.condicoes_pagamento.trim() });
  if (quote.prazo_execucao?.trim())
    termos.push({ label: "Prazo de execução", text: quote.prazo_execucao.trim() });
  if (quote.garantia?.trim()) termos.push({ label: "Garantia", text: quote.garantia.trim() });

  return (
    <Document
      title={`Orçamento ${numero}: ${quote.titulo}`}
      author={EMPRESA.nomeFantasia}
      creator="Control Lead"
      producer="Control Lead"
      subject={`Orçamento ${numero}`}
      language="pt-BR"
    >
      <Page size="A4" style={s.page}>
        {/* Rodapé. O nº da página fica num Text absoluto à parte: Text com
            render dentro de View em linha some no react-pdf 4.9. */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {EMPRESA.nomeFantasia} · CNPJ {EMPRESA.cnpj} · {EMPRESA.telefone} · {EMPRESA.site}
          </Text>
        </View>
        <Text
          style={s.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `${numero} · Página ${pageNumber} de ${totalPages}`}
        />
        {/* Cabeçalho */}
        <View style={s.header}>
          <View style={{ maxWidth: 290 }}>
            <View style={s.brandRow}>
              {EMPRESA.logo ? (
                // eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf não tem alt
                <Image src={path.join(ASSETS_DIR, EMPRESA.logo)} style={{ height: 44 }} />
              ) : (
                <>
                  <BrandSymbol />
                  <Text style={s.brandName}>{EMPRESA.nomeFantasia}</Text>
                </>
              )}
            </View>
            <Text style={s.companyLine}>
              {EMPRESA.razaoSocial} · CNPJ {EMPRESA.cnpj}
            </Text>
            <Text style={s.companyLine}>{enderecoEmpresa()}</Text>
            <Text style={s.companyLine}>{empresaContato}</Text>
            <Text style={s.companyLine}>
              {[EMPRESA.email, EMPRESA.site].filter(Boolean).join(" · ")}
            </Text>
          </View>

          <View style={s.docBox}>
            <Text style={s.docKicker}>Orçamento</Text>
            <Text style={s.docNumber}>{numero}</Text>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Emissão</Text>
              <Text style={s.metaValue}>{formatDateTimeBR(quote.created_at)}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Válido até</Text>
              <Text style={s.metaValue}>{formatDateBR(quote.validade)}</Text>
            </View>
            <StatusTag quote={quote} />
          </View>
        </View>

        <View style={s.rule} />
        <View style={s.ruleFull} />

        {/* Cliente e local */}
        <View style={s.parties}>
          <View style={[s.party, { paddingRight: 16 }]}>
            <Text style={s.label}>Cliente</Text>
            <Text style={s.partyName}>{client.razao_social}</Text>
            {fantasia ? <Text style={s.partyLine}>{fantasia}</Text> : null}
            {client.cnpj ? <Text style={s.partyLine}>CNPJ {maskCnpj(client.cnpj)}</Text> : null}
            {contato.length > 0 ? <Text style={s.partyLine}>{contato.join(" · ")}</Text> : null}
            {client.contato_email ? <Text style={s.partyLine}>{client.contato_email}</Text> : null}
          </View>
          <View style={s.party}>
            <Text style={s.label}>Local do serviço</Text>
            <Text style={s.partyName}>{building.nome}</Text>
            {enderecoPredio(building).map((linha) => (
              <Text key={linha} style={s.partyLine}>
                {linha}
              </Text>
            ))}
          </View>
        </View>

        {/* Serviço */}
        <View style={s.service} wrap={false}>
          <Text style={s.label}>Serviço</Text>
          <Text style={s.serviceTitle}>{quote.titulo}</Text>
          <Text style={s.serviceTipo}>{TIPO_LABEL[quote.tipo_servico]}</Text>
        </View>

        {/* Itens */}
        <View>
          <View style={s.thead} fixed>
            <Text style={[s.th, { width: 16 }]}>#</Text>
            <Text style={[s.th, { width: COL.desc, flexGrow: 1 }]}>Descrição</Text>
            <Text style={[s.th, { width: COL.unid }]}>Unid.</Text>
            <Text style={[s.th, s.num, { width: COL.qtd }]}>Qtd.</Text>
            <Text style={[s.th, s.num, { width: COL.unit }]}>Valor unit.</Text>
            <Text style={[s.th, s.num, { width: COL.total }]}>Total</Text>
          </View>
          {quote.items.map((item, i) => (
            <View key={item.id} style={s.tr} wrap={false}>
              <Text style={s.idx}>{i + 1}</Text>
              <Text style={[s.td, { width: COL.desc, flexGrow: 1, paddingRight: 8 }]}>{item.descricao}</Text>
              <Text style={[s.tdDim, { width: COL.unid }]}>{item.unidade}</Text>
              <Text style={[s.td, s.num, { width: COL.qtd }]}>{qtdFmt.format(item.quantidade)}</Text>
              <Text style={[s.td, s.num, { width: COL.unit }]}>{brl(item.preco_unitario)}</Text>
              <Text style={[s.td, s.num, { width: COL.total, fontWeight: 500 }]}>{brl(item.valor)}</Text>
            </View>
          ))}
        </View>

        {/* Totais */}
        <View style={s.totals} wrap={false}>
          {quote.desconto > 0 ? (
            <>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Subtotal</Text>
                <Text style={s.totalValue}>{brl(quote.subtotal)}</Text>
              </View>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Desconto</Text>
                <Text style={s.totalValue}>− {brl(quote.desconto)}</Text>
              </View>
            </>
          ) : null}
          <View style={s.grand}>
            <Text style={s.grandLabel}>TOTAL</Text>
            <Text style={s.grandValue}>{brl(quote.total)}</Text>
          </View>
        </View>

        {/* Condições */}
        {termos.length > 0 || quote.observacoes?.trim() ? (
          <View style={s.terms}>
            <View style={s.termsGrid}>
              {termos.map((t) => (
                <Term key={t.label} label={t.label} text={t.text} full={termos.length === 1} />
              ))}
              {quote.observacoes?.trim() ? (
                <Term label="Observações" text={quote.observacoes.trim()} full />
              ) : null}
            </View>
          </View>
        ) : null}

      </Page>
    </Document>
  );
}

/** Renderiza o PDF do orçamento em memória. */
export function renderOrcamentoPdf(quote: QuoteWithItems): Promise<Buffer> {
  return renderToBuffer(<OrcamentoPdf quote={quote} />);
}

/** Nome do arquivo: "orcamento-ORC-1004.pdf". */
export function orcamentoPdfFilename(numero: number): string {
  return `orcamento-${quoteNumeroLabel(numero)}.pdf`;
}
