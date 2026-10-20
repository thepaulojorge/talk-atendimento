/* Regras do painel de supervisão: filtrar, descrever e exportar os
   registros da auditoria. Funções puras, como as de filtros.js */
import { TURNOS } from "../configuracao.js";
import { buscarPorId } from "./conversas.js";
import { diasAtras } from "./datas.js";
import { PAPEIS } from "./permissoes.js";
import { normalizar } from "./texto.js";

export const TIPOS_DE_ACAO = {
  edicao: "Edições",
  exclusao: "Mensagens apagadas",
  conversa: "Conversas excluídas",
};

// "editou uma mensagem", "apagou um áudio", "excluiu a conversa"
export function descricaoDaAcao(registro) {
  if (registro.tipo === "conversa") return "excluiu a conversa";
  const oQue =
    registro.tipoMensagem === "nota" ? "uma nota interna" : registro.tipoMensagem === "audio" ? "um áudio" : "uma mensagem";
  return registro.tipo === "edicao" ? `editou ${oQue}` : `apagou ${oQue}`;
}

/* "Estação 01 · Manhã". Registros antigos (de antes do login por estação)
   e os de contas pessoais (supervisão, diretoria) não têm estação: "" */
export function origemDoRegistro(registro, estado) {
  const estacao = buscarPorId(estado.estacoes, registro.estacaoId);
  const turno = TURNOS.find((t) => t.id === registro.turnoId);
  return [estacao?.nome, turno?.nome].filter(Boolean).join(" · ");
}

function combinaComPeriodo(registro, periodo) {
  if (periodo === "tudo") return true;
  const dias = diasAtras(new Date(registro.quando));
  if (periodo === "hoje") return dias === 0;
  return dias < Number(periodo); // "7" ou "30"
}

// Tudo o que a busca pode encontrar num registro, num texto só
function textoPesquisavel(registro, estado) {
  const partes = [
    registro.antes,
    registro.depois,
    registro.conversaNome,
    buscarPorId(estado.atendentes, registro.autorId)?.nome,
    ...(registro.mensagens || []).map((m) => m.texto),
  ];
  return normalizar(partes.filter(Boolean).join(" "));
}

/* Os filtros, SEM o de ação. Separado de propósito: os cartões do resumo
   contam por ação usando esta lista. Se o filtro de ação entrasse aqui,
   ao escolher "Edições" os outros cartões mostrariam zero e perderiam a graça.
   filtros = { atendente, acao, periodo, estacao, turno, busca } */
export function filtrarSemAcao(estado, filtros) {
  const termo = normalizar(filtros.busca);
  return estado.auditoria.filter(
    (r) =>
      (!filtros.atendente || r.autorId === filtros.atendente) &&
      (!filtros.estacao || r.estacaoId === filtros.estacao) &&
      (!filtros.turno || r.turnoId === filtros.turno) &&
      combinaComPeriodo(r, filtros.periodo) &&
      (!termo || textoPesquisavel(r, estado).includes(termo))
  );
}

export function filtrarRegistros(estado, filtros) {
  return filtrarSemAcao(estado, filtros)
    .filter((r) => !filtros.acao || r.tipo === filtros.acao)
    .sort((a, b) => new Date(b.quando) - new Date(a.quando)); // mais recente primeiro
}

/* ---------- CSV (abre no Excel ou no Google Planilhas) ---------- */
export function gerarCsv(registros, estado) {
  /* Cada valor vai entre aspas, e aspas DENTRO do texto viram aspas duplas.
     Sem isso, uma mensagem com ; ou quebra de linha bagunçaria as colunas */
  const celula = (valor) => `"${String(valor ?? "").replaceAll('"', '""')}"`;

  const cabecalho = ["Data e hora", "Atendente", "Papel", "Estação", "Turno", "Ação", "Conversa", "Antes / conteúdo", "Depois"];
  const linhas = registros.map((r) => {
    const autor = buscarPorId(estado.atendentes, r.autorId);
    const conteudo =
      r.tipo === "conversa" ? (r.mensagens || []).map((m) => `${m.quem}: ${m.texto}`).join(" | ") : r.antes;
    return [
      new Date(r.quando).toLocaleString("pt-BR"),
      autor?.nome,
      PAPEIS[autor?.papel || "atendente"],
      buscarPorId(estado.estacoes, r.estacaoId)?.nome,
      TURNOS.find((t) => t.id === r.turnoId)?.nome,
      descricaoDaAcao(r),
      r.conversaNome,
      conteudo,
      r.depois,
    ]
      .map(celula)
      .join(";");
  });

  /* ";" separa as colunas: no Excel em português, a vírgula é o separador decimal.
     "\uFEFF" (BOM) no começo avisa o Excel que o arquivo é UTF-8: sem ele,
     "Ação" apareceria como "AÃ§Ã£o". "\r\n": a quebra de linha que o Excel espera */
  return "\uFEFF" + [cabecalho.map(celula).join(";"), ...linhas].join("\r\n");
}

// "Talk Atendimento" -> "talk-atendimento" (para o nome do arquivo)
export function paraNomeDeArquivo(texto) {
  return normalizar(texto).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "auditoria";
}
