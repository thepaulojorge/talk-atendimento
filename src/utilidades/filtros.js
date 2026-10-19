/* Busca e filtros da lista de conversas (funções puras, como antes) */
import { buscarPorId, contarNaoLidas, estaResolvida, nomeDaConversa, textoPrevia } from "./conversas.js";
import { normalizar, somenteDigitos } from "./texto.js";

/* Procura uma mensagem de TEXTO ou NOTA que contenha o termo (a mais recente).
   Mensagens apagadas não contam: o texto delas "não existe mais" */
export function mensagemEncontrada(conversa, termo) {
  for (let i = conversa.mensagens.length - 1; i >= 0; i--) {
    const msg = conversa.mensagens[i];
    const temTexto = msg.tipo === "texto" || msg.tipo === "nota";
    if (temTexto && !msg.apagada && normalizar(msg.texto).includes(termo)) return msg;
  }
  return null;
}

/* A conversa combina com a busca? Procura em:
   nome, número (em qualquer formato), participantes, etiquetas e mensagens */
function combinaComBusca(conversa, termo, estado) {
  if (!termo) return true;
  if (normalizar(nomeDaConversa(conversa, estado.contatos)).includes(termo)) return true;

  const digitos = somenteDigitos(termo);
  if (digitos && conversa.tipo === "contato") {
    const contato = buscarPorId(estado.contatos, conversa.contatoId);
    if (somenteDigitos(contato?.numero).includes(digitos)) return true;
  }

  if (conversa.tipo === "grupo" && conversa.participantes.some((p) => normalizar(p).includes(termo))) return true;

  const etiquetaCombina = (conversa.etiquetas || []).some((id) =>
    normalizar(buscarPorId(estado.etiquetas, id)?.nome).includes(termo)
  );
  if (etiquetaCombina) return true;

  return mensagemEncontrada(conversa, termo) !== null;
}

function combinaComFiltro(conversa, filtro, estado) {
  // A conversa ABERTA continua visível, mesmo que deixe de combinar
  // (senão ela sumiria da lista no momento do clique em "Não lidas")
  const estaAberta = conversa.id === estado.conversaAbertaId;
  const resolvida = estaResolvida(conversa);

  switch (filtro) {
    case "nao-lidas":
      return contarNaoLidas(conversa) > 0 || conversa.marcadaNaoLida || estaAberta;
    case "minhas":
      return (conversa.atendenteId === estado.atendenteLogadoId && !resolvida) || estaAberta;
    case "fila":
      return (!conversa.atendenteId && !resolvida) || estaAberta;
    case "resolvidas":
      return resolvida || estaAberta;
    case "grupos":
      return conversa.tipo === "grupo";
    default:
      return true; // "todas"
  }
}

/* Junta tudo. "opcoes" = { busca, filtro, etiqueta, vendoArquivadas } */
export function filtrarConversas(estado, opcoes) {
  const termo = normalizar(opcoes.busca);
  return estado.conversas.filter(
    (conversa) =>
      // Lista normal mostra as não arquivadas; dentro das arquivadas, só elas
      Boolean(conversa.arquivada) === opcoes.vendoArquivadas &&
      // Conversa sem mensagens só aparece enquanto está aberta
      (conversa.mensagens.length > 0 || conversa.id === estado.conversaAbertaId) &&
      combinaComBusca(conversa, termo, estado) &&
      combinaComFiltro(conversa, opcoes.filtro, estado) &&
      (!opcoes.etiqueta || (conversa.etiquetas || []).includes(opcoes.etiqueta))
  );
}

/* Prévia na lista: se a busca achou o termo DENTRO de uma mensagem
   (e não no nome), mostra essa mensagem com 🔍 */
export function previaParaLista(conversa, estado, busca) {
  const termo = normalizar(busca);
  if (termo && !normalizar(nomeDaConversa(conversa, estado.contatos)).includes(termo)) {
    const msg = mensagemEncontrada(conversa, termo);
    if (msg) return `🔍 ${msg.texto}`;
  }
  return textoPrevia(conversa, estado);
}
