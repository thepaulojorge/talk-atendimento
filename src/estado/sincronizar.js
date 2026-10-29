/* SINCRONIZAR: de AÇÃO do reducer para PEDIDO à API.

   Como a tela continua instantânea com o banco no meio?
   1. O componente despacha a ação, como sempre: { tipo: "assumirConversa", ... }
   2. O reducer muda a tela NA HORA (ninguém espera o servidor)
   3. Esta função traduz a mesma ação num pedido: POST /conversas/c3/assumir
   4. O pedido vai para o servidor em segundo plano
   5. Deu erro? O app avisa e busca tudo de novo: a tela volta a ser igual ao banco

   Isso se chama "atualização otimista" (optimistic update): otimista
   porque mostramos o resultado ANTES de o servidor confirmar, apostando
   que vai dar certo (e quase sempre dá).

   "estado" é o estado ANTES da ação: precisamos dele para saber, por
   exemplo, se "alternar fixada" vai fixar ou desafixar.
   Devolve { metodo, caminho, corpo } ou null (ação que não grava nada,
   como abrir o painel de dados ou mostrar um aviso) */
import { buscarPorId, contarNaoLidas, estaResolvida } from "../utilidades/conversas.js";

// encodeURIComponent: um id esquisito nunca "quebra" o endereço
const de = (id) => encodeURIComponent(id);

export function pedidoDaAcao(acao, estado) {
  const conversa = buscarPorId(estado.conversas, acao.id ?? acao.conversaId);

  switch (acao.tipo) {
    /* Abrir a conversa a marca como lida. Só pede se havia algo não lido:
       abrir uma conversa já lida não precisa incomodar o servidor */
    case "abrirConversa":
    case "verNaConversa":
    case "marcarLida": {
      const alvo = buscarPorId(estado.conversas, acao.id ?? acao.conversaId);
      const temAlgoNaoLido = alvo && (contarNaoLidas(alvo) > 0 || alvo.marcadaNaoLida);
      return temAlgoNaoLido ? { metodo: "PATCH", caminho: `/conversas/${de(alvo.id)}`, corpo: { lida: true } } : null;
    }

    case "marcarNaoLida":
      return { metodo: "PATCH", caminho: `/conversas/${de(acao.id)}`, corpo: { marcadaNaoLida: true } };

    // "Alternar" vira o valor FINAL: { fixada: true }. Repetir o pedido não desfaz nada
    case "alternarFixada":
      return conversa && { metodo: "PATCH", caminho: `/conversas/${de(acao.id)}`, corpo: { fixada: !conversa.fixadaEm } };

    case "alternarArquivada":
      return conversa && { metodo: "PATCH", caminho: `/conversas/${de(acao.id)}`, corpo: { arquivada: !conversa.arquivada } };

    /* Iniciar pelos Contatos: a mesma regra do reducer. Já existe conversa
       com o contato nesta linha? Só desarquiva (se precisar). Senão, cria */
    case "iniciarConversa": {
      const existente = estado.conversas.find(
        (c) => c.tipo === "contato" && c.contatoId === acao.contatoId && c.linhaId === acao.linhaId
      );
      if (existente) {
        return existente.arquivada
          ? { metodo: "PATCH", caminho: `/conversas/${de(existente.id)}`, corpo: { arquivada: false } }
          : null;
      }
      return {
        metodo: "POST",
        caminho: "/conversas",
        corpo: { id: acao.conversaId, contatoId: acao.contatoId, linhaId: acao.linhaId, novoContato: acao.novoContato },
      };
    }

    case "excluirConversa":
      return { metodo: "DELETE", caminho: `/conversas/${de(acao.id)}` };

    // Texto, nota, áudio e encaminhada: tudo pelo mesmo caminho
    case "enviarMensagem":
      return {
        metodo: "POST",
        caminho: `/conversas/${de(acao.conversaId)}/mensagens`,
        corpo: { id: acao.id, ...acao.conteudo, respostaA: acao.respostaA || null },
      };

    case "editarMensagem":
      return { metodo: "PATCH", caminho: `/mensagens/${de(acao.mensagemId)}`, corpo: { texto: acao.texto } };

    case "apagarMensagem":
      return { metodo: "DELETE", caminho: `/mensagens/${de(acao.mensagemId)}` };

    // A conversa já tem a etiqueta? Então o clique TIRA (DELETE); senão, COLOCA (PUT)
    case "alternarEtiqueta": {
      if (!conversa) return null;
      const tem = (conversa.etiquetas || []).includes(acao.etiquetaId);
      return { metodo: tem ? "DELETE" : "PUT", caminho: `/conversas/${de(conversa.id)}/etiquetas/${de(acao.etiquetaId)}` };
    }

    case "renomearEtiqueta":
      return { metodo: "PATCH", caminho: `/etiquetas/${de(acao.id)}`, corpo: { nome: acao.nome.trim() } };

    case "assumirConversa":
      return { metodo: "POST", caminho: `/conversas/${de(acao.id)}/assumir`, corpo: { eventoId: acao.eventoId } };

    case "transferirConversa":
      return {
        metodo: "POST",
        caminho: `/conversas/${de(acao.id)}/transferir`,
        corpo: { destinoId: acao.destinoId, eventoId: acao.eventoId },
      };

    case "alternarResolvida":
      return (
        conversa && {
          metodo: "POST",
          caminho: `/conversas/${de(acao.id)}/resolver`,
          corpo: { resolvida: !estaResolvida(conversa), eventoId: acao.eventoId },
        }
      );

    // ⚠️ As simulações do modo demonstração (até o WhatsApp de verdade, na B7)
    case "receberMensagem":
      return {
        metodo: "POST",
        caminho: `/demonstracao/conversas/${de(acao.conversaId)}/recebida`,
        corpo: { id: acao.id, texto: acao.texto, autor: acao.autor },
      };

    // A mensagem pode ter sumido nesses 3 segundos (envio recusado, conversa excluída)
    case "mensagemLida": {
      const existe = conversa?.mensagens.some((m) => m.id === acao.mensagemId);
      return existe ? { metodo: "POST", caminho: `/demonstracao/mensagens/${de(acao.mensagemId)}/lida` } : null;
    }

    default:
      return null; // ações só de tela: abrir painel, trocar de seção, avisos...
  }
}
