/* O REDUCER: o único lugar onde o estado muda.

   Funciona como um "balcão de pedidos":
   - os componentes NÃO mexem no estado; eles DESPACHAM uma ação,
     um objeto descrevendo o que aconteceu: { tipo: "abrirConversa", id: "c1" }
   - o reducer recebe o estado atual + a ação e devolve o PRÓXIMO estado
   - o React percebe que o estado mudou e redesenha só o que depende dele

   REGRAS DE OURO:
   1. Nunca alterar o estado recebido. Sempre devolver um objeto NOVO
      (com "..." para copiar o que não mudou). É assim que o React descobre
      o que mudou: comparando o objeto velho com o novo.
   2. Ser PURO: com o mesmo estado e a mesma ação, devolver sempre o mesmo
      resultado. Por isso nada de Date.now() ou new Date() aqui dentro:
      ids e horários são criados ANTES, no componente, e vêm na ação. */
import { MARCA_PADRAO, ATENDENTE_PADRAO } from "../configuracao.js";
import { buscarPorId, estaResolvida } from "../utilidades/conversas.js";

export const estadoInicial = {
  carregando: true,
  erro: null,
  marca: MARCA_PADRAO,
  atendentes: [],
  contatos: [],
  conversas: [],
  etiquetas: [],
  respostasRapidas: [],
  auditoria: [],
  atendenteLogadoId: ATENDENTE_PADRAO,
  conversaAbertaId: null,
  rascunhos: {}, // texto não enviado de cada conversa: { c1: "Olá...", c3: "..." }
  aviso: null, // o aviso flutuante: { id, texto } ou null
};

/* Ajudante: devolve uma lista de conversas nova, trocando só a conversa
   "id" pelo resultado de "mudar(conversa)". As outras ficam como estão */
function mudarConversa(conversas, id, mudar) {
  return conversas.map((conversa) => (conversa.id === id ? mudar(conversa) : conversa));
}

export function reducer(estado, acao) {
  switch (acao.tipo) {
    case "dadosCarregados":
      return { ...estado, ...acao.dados, carregando: false };

    case "erroAoCarregar":
      return { ...estado, carregando: false, erro: acao.mensagem };

    /* Abrir a conversa também a marca como lida. Nada é alterado "no lugar":
       .map() cria listas novas, e só o que mudou vira objeto novo */
    case "abrirConversa":
      return {
        ...estado,
        conversaAbertaId: acao.id,
        conversas: mudarConversa(estado.conversas, acao.id, (conversa) => ({
          ...conversa,
          marcadaNaoLida: false,
          mensagens: conversa.mensagens.map((msg) =>
            msg.direcao === "recebida" && !msg.lida ? { ...msg, lida: true } : msg
          ),
        })),
      };

    case "fecharConversa":
      return { ...estado, conversaAbertaId: null };

    case "definirRascunho":
      return { ...estado, rascunhos: { ...estado.rascunhos, [acao.conversaId]: acao.texto } };

    /* Enviar mensagem, com as mesmas regras da versão antiga:
       - conversa da fila: quem respondeu assume
       - conversa resolvida: reabre
       Cada regra deixa um evento no histórico ("Paulo assumiu a conversa") */
    case "enviarMensagem": {
      const nomeLogado = buscarPorId(estado.atendentes, estado.atendenteLogadoId)?.nome || "Atendente";

      const conversas = mudarConversa(estado.conversas, acao.conversaId, (conversa) => {
        const eventos = [];
        let { atendenteId, status } = conversa;

        if (!atendenteId) {
          atendenteId = estado.atendenteLogadoId;
          eventos.push({ texto: `${nomeLogado} assumiu a conversa` });
        }
        if (estaResolvida(conversa)) {
          status = "aberta";
          eventos.push({ texto: `${nomeLogado} reabriu a conversa` });
        }

        const mensagensDeEvento = eventos.map((evento, i) => ({
          id: `${acao.id}-e${i}`,
          tipo: "sistema",
          texto: evento.texto,
          horario: acao.agora,
          direcao: "interna",
          lida: true,
          autor: null,
        }));

        const novaMensagem = {
          id: acao.id,
          tipo: "texto",
          texto: acao.texto,
          horario: acao.agora,
          direcao: "enviada",
          lida: false, // ✓✓ cinza: o cliente ainda não leu
          autor: estado.atendenteLogadoId,
          respostaA: acao.respostaA || null,
        };

        return {
          ...conversa,
          atendenteId,
          status,
          mensagens: [...conversa.mensagens, ...mensagensDeEvento, novaMensagem],
        };
      });

      // Enviou: o rascunho desta conversa some. Copiamos e apagamos da CÓPIA
      // (apagar do estado.rascunhos original quebraria a regra 1)
      const rascunhos = { ...estado.rascunhos };
      delete rascunhos[acao.conversaId];
      return { ...estado, conversas, rascunhos };
    }

    // ✓✓ fica azul (por enquanto, quem avisa é uma simulação)
    case "mensagemLida":
      return {
        ...estado,
        conversas: mudarConversa(estado.conversas, acao.conversaId, (conversa) => ({
          ...conversa,
          mensagens: conversa.mensagens.map((msg) => (msg.id === acao.mensagemId ? { ...msg, lida: true } : msg)),
        })),
      };

    case "mostrarAviso":
      return { ...estado, aviso: { id: acao.id, texto: acao.texto } };

    case "esconderAviso":
      // Só esconde se ainda for o MESMO aviso (um novo pode ter chegado)
      return estado.aviso?.id === acao.id ? { ...estado, aviso: null } : estado;

    default:
      // Ação com nome errado? Melhor avisar do que falhar em silêncio
      throw new Error(`Ação desconhecida: ${acao.tipo}`);
  }
}
