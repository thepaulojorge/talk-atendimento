/* Regras sobre conversas e mensagens.
   Diferença para a versão antiga: antes estas funções liam o "estado" global
   direto. Agora RECEBEM o que precisam como parâmetro. Assim cada função
   funciona sozinha, e o React sabe exatamente de quais dados a tela depende. */
import { formatarDuracao } from "./texto.js";

// Busca um item por id em qualquer lista (contatos, atendentes, etiquetas...)
export function buscarPorId(lista, id) {
  return lista.find((item) => item.id === id);
}

// Grupo tem nome próprio; contato pega o nome da lista de contatos
export function nomeDaConversa(conversa, contatos) {
  if (conversa.tipo === "grupo") return conversa.nome;
  return buscarPorId(contatos, conversa.contatoId)?.nome || "Contato desconhecido";
}

/* A última mensagem "de verdade": eventos do sistema
   ("Carla assumiu...") não mudam a prévia nem a ordem */
export function ultimaMensagem(conversa) {
  for (let i = conversa.mensagens.length - 1; i >= 0; i--) {
    if (conversa.mensagens[i].tipo !== "sistema") return conversa.mensagens[i];
  }
  return null;
}

/* O contador nunca é guardado: é sempre CALCULADO a partir das mensagens.
   (Foi isso que corrigiu o bug do contador que não diminuía) */
export function contarNaoLidas(conversa) {
  return conversa.mensagens.filter((msg) => msg.direcao === "recebida" && !msg.lida).length;
}

// Arquivadas não entram no total (igual ao WhatsApp)
export function contarTotalNaoLidas(conversas) {
  return conversas
    .filter((conversa) => !conversa.arquivada)
    .reduce((total, conversa) => total + contarNaoLidas(conversa), 0);
}

export function estaResolvida(conversa) {
  return conversa.status === "resolvida";
}

export function resumoDaMensagem(msg) {
  if (msg.apagada) return "🚫 Mensagem apagada";
  if (msg.tipo === "audio") return `🎤 Áudio (${formatarDuracao(msg.duracao)})`;
  if (msg.tipo === "arquivo") return descreverArquivo(msg);
  return msg.texto;
}

// "📷 Foto", "💟 Figurinha" ou "📄 orcamento.pdf"
function descreverArquivo(msg) {
  if (!msg.arquivo) return "📎 Arquivo";
  if (msg.arquivo.nome.startsWith("sticker-")) return "💟 Figurinha";
  return msg.arquivo.tipo.startsWith("image/") ? "📷 Foto" : `📄 ${msg.arquivo.nome}`;
}

/* O conteúdo em texto, para REGISTRO (auditoria e cópia da conversa excluída):
   "🎤 Áudio de 0:22", "📎 orcamento.pdf" ou o próprio texto */
export function conteudoParaRegistro(msg) {
  if (msg.tipo === "audio") return `🎤 Áudio de ${formatarDuracao(msg.duracao)}`;
  if (msg.tipo === "arquivo") return `📎 ${msg.arquivo?.nome || "Arquivo"}`;
  return msg.texto;
}

/* Prévia na lista: "Você: ...", "Carla: ...", "Bruno: 🎤 Áudio (0:22)" */
export function textoPrevia(conversa, estado) {
  const msg = ultimaMensagem(conversa);
  if (!msg) return "";
  if (msg.apagada) return "🚫 Mensagem apagada";

  const nomeAtendente = (id) =>
    id === estado.atendenteLogadoId ? "Você" : buscarPorId(estado.atendentes, id)?.nome || "Equipe";

  if (msg.tipo === "nota") return `📝 ${nomeAtendente(msg.autor)}: ${msg.texto}`;

  const conteudo = resumoDaMensagem(msg);
  if (msg.direcao === "enviada") return `${nomeAtendente(msg.autor)}: ${conteudo}`;
  if (conversa.tipo === "grupo" && msg.autor) return `${msg.autor.split(" ")[0]}: ${conteudo}`;
  return conteudo;
}

/* Quem escreveu, do ponto de vista de quem está logado:
   "Você", "Carla", o participante do grupo ou o nome do contato */
export function nomeDoAutor(msg, conversa, estado) {
  if (msg.direcao === "enviada" || msg.tipo === "nota") {
    if (msg.autor === estado.atendenteLogadoId) return "Você";
    return buscarPorId(estado.atendentes, msg.autor)?.nome || "Equipe";
  }
  if (conversa.tipo === "grupo" && msg.autor) return msg.autor;
  return nomeDaConversa(conversa, estado.contatos);
}

/* Respostas rápidas: troca as "lacunas" pelos dados reais
   {nome} -> primeiro nome do cliente | {atendente} -> quem está logado */
export function preencherModelo(texto, conversa, estado) {
  const primeiroNome =
    conversa.tipo === "grupo" ? "pessoal" : nomeDaConversa(conversa, estado.contatos).split(" ")[0];
  const atendente = buscarPorId(estado.atendentes, estado.atendenteLogadoId)?.nome || "";
  return texto.replaceAll("{nome}", primeiroNome).replaceAll("{atendente}", atendente);
}

/* Ordem da lista:
   1º as fixadas (a fixada mais recentemente primeiro)
   2º as demais (a última mensagem mais recente primeiro) */
export function ordenarConversas(conversas) {
  // [...conversas]: sort() altera o array; ordenamos uma CÓPIA
  return [...conversas].sort((a, b) => {
    const aFixada = Boolean(a.fixadaEm);
    const bFixada = Boolean(b.fixadaEm);
    if (aFixada !== bFixada) return aFixada ? -1 : 1;
    if (aFixada && bFixada) return new Date(b.fixadaEm) - new Date(a.fixadaEm);

    // Conversa nova, ainda sem mensagens, conta como "agora" (vai para o topo)
    const horaA = ultimaMensagem(a)?.horario || Date.now();
    const horaB = ultimaMensagem(b)?.horario || Date.now();
    return new Date(horaB) - new Date(horaA);
  });
}
