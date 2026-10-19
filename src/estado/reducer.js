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
import { buscarPorId, estaResolvida, nomeDaConversa } from "../utilidades/conversas.js";
import { podeApagarMensagem, podeEditarMensagem } from "../utilidades/permissoes.js";
import { formatarDuracao } from "../utilidades/texto.js";

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

// O mesmo, um nível abaixo: troca só uma mensagem dentro de uma conversa
function mudarMensagem(conversas, conversaId, mensagemId, mudar) {
  return mudarConversa(conversas, conversaId, (conversa) => ({
    ...conversa,
    mensagens: conversa.mensagens.map((msg) => (msg.id === mensagemId ? mudar(msg) : msg)),
  }));
}

/* Registro para o painel de supervisão. Áudio vira uma descrição em texto:
   o arquivo continua na mensagem (soft delete), não precisa ser copiado */
function registroDeAuditoria(estado, acao, conversa, msg, extra) {
  return {
    id: acao.auditoriaId,
    conversaId: conversa.id,
    conversaNome: nomeDaConversa(conversa, estado.contatos),
    mensagemId: msg.id,
    autorId: estado.atendenteLogadoId,
    quando: acao.agora,
    tipoMensagem: msg.tipo,
    antes: msg.tipo === "audio" ? `🎤 Áudio de ${formatarDuracao(msg.duracao)}` : msg.texto,
    ...extra, // tipo ("edicao" ou "exclusao") e, na edição, o "depois"
  };
}

// Acha conversa + mensagem de uma vez (ou devolve null)
function acharMensagem(estado, conversaId, mensagemId) {
  const conversa = buscarPorId(estado.conversas, conversaId);
  const msg = conversa?.mensagens.find((m) => m.id === mensagemId);
  return msg ? { conversa, msg } : null;
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

    /* Iniciar conversa pela aba de Contatos. A ação traz:
       { contatoId, conversaId, novoContato? }
       - novoContato: número não salvo; entra na lista com salvo: false
       - já existe conversa com o contato? Reaproveita (e desarquiva)
       - não existe? Cria uma vazia, já com quem iniciou como responsável */
    case "iniciarConversa": {
      const contatos = acao.novoContato ? [...estado.contatos, acao.novoContato] : estado.contatos;
      const existente = estado.conversas.find((c) => c.tipo === "contato" && c.contatoId === acao.contatoId);

      let conversas;
      let id;
      if (existente) {
        id = existente.id;
        // Procurou o contato de propósito: a conversa volta das arquivadas
        conversas = mudarConversa(estado.conversas, id, (c) => ({ ...c, arquivada: false }));
      } else {
        id = acao.conversaId;
        conversas = [
          ...estado.conversas,
          {
            id,
            tipo: "contato",
            contatoId: acao.contatoId,
            atendenteId: estado.atendenteLogadoId,
            marcadaNaoLida: false,
            arquivada: false,
            status: "aberta",
            etiquetas: [],
            fixadaEm: null,
            mensagens: [],
          },
        ];
      }

      /* Reaproveita a ação "abrirConversa" chamando o próprio reducer:
         assim a regra "abrir = marcar como lida" fica num lugar só */
      return reducer({ ...estado, contatos, conversas }, { tipo: "abrirConversa", id });
    }

    case "fecharConversa":
      return { ...estado, conversaAbertaId: null };

    case "definirRascunho":
      return { ...estado, rascunhos: { ...estado.rascunhos, [acao.conversaId]: acao.texto } };

    /* Enviar mensagem (texto ou áudio), com as mesmas regras da versão antiga:
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

        /* acao.conteudo traz o que muda entre texto e áudio:
           { tipo: "texto", texto } ou { tipo: "audio", audioUrl, duracao }.
           As regras acima (assumir, reabrir) valem igual para os dois */
        const novaMensagem = {
          id: acao.id,
          ...acao.conteudo,
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

      // Encaminhar envia para OUTRA conversa: o rascunho de lá fica intacto
      if (acao.limparRascunho === false) return { ...estado, conversas };

      // Enviou: o rascunho desta conversa some. Copiamos e apagamos da CÓPIA
      // (apagar do estado.rascunhos original quebraria a regra 1)
      const rascunhos = { ...estado.rascunhos };
      delete rascunhos[acao.conversaId];
      return { ...estado, conversas, rascunhos };
    }

    /* Editar: { conversaId, mensagemId, texto, agora, auditoriaId }
       O reducer confere a permissão de novo: é a última barreira, mesmo
       que algum botão apareça onde não devia */
    case "editarMensagem": {
      const achado = acharMensagem(estado, acao.conversaId, acao.mensagemId);
      if (!achado || !podeEditarMensagem(estado, achado.msg)) return estado;
      const { conversa, msg } = achado;
      if (acao.texto === msg.texto) return estado; // nada mudou, nada a registrar

      return {
        ...estado,
        auditoria: [
          ...estado.auditoria,
          registroDeAuditoria(estado, acao, conversa, msg, { tipo: "edicao", depois: acao.texto }),
        ],
        conversas: mudarMensagem(estado.conversas, conversa.id, msg.id, (m) => ({
          ...m,
          // A versão anterior não se perde: vai para o histórico
          versoesAnteriores: [...(m.versoesAnteriores || []), m.texto],
          texto: acao.texto,
          editadaEm: acao.agora,
        })),
      };
    }

    /* Apagar: { conversaId, mensagemId, agora, auditoriaId }
       Soft delete: a mensagem continua no array, só ganha "apagada: true".
       Assim citações e o histórico da supervisão continuam fazendo sentido */
    case "apagarMensagem": {
      const achado = acharMensagem(estado, acao.conversaId, acao.mensagemId);
      if (!achado || !podeApagarMensagem(estado, achado.msg)) return estado;
      const { conversa, msg } = achado;

      return {
        ...estado,
        auditoria: [...estado.auditoria, registroDeAuditoria(estado, acao, conversa, msg, { tipo: "exclusao" })],
        conversas: mudarMensagem(estado.conversas, conversa.id, msg.id, (m) => ({
          ...m,
          apagada: true,
          apagadaPor: estado.atendenteLogadoId,
          apagadaEm: acao.agora,
        })),
      };
    }

    // ✓✓ fica azul (por enquanto, quem avisa é uma simulação)
    case "mensagemLida":
      return {
        ...estado,
        conversas: mudarMensagem(estado.conversas, acao.conversaId, acao.mensagemId, (msg) => ({ ...msg, lida: true })),
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
