import { useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { LIMITE_FIXADAS } from "../configuracao.js";
import { contarNaoLidas, nomeDaConversa } from "../utilidades/conversas.js";
import { novoId } from "../utilidades/ids.js";
import DialogoConfirmacao from "../componentes/DialogoConfirmacao.jsx";

/* As ações de uma conversa, para os DOIS menus que as oferecem:
   o ⋮ no topo do chat e o clique direito (ou dedo pressionado) na lista.

   const { opcoesDe, dialogo } = useAcoesConversa();
   - opcoesDe(conversa): a lista de opções, pronta para o <MenuFlutuante>
   - dialogo: a janela "Excluir conversa?" (ou null). Quem usa o hook
     só precisa colocar {dialogo} em algum lugar do seu JSX

   Sim, um hook pode devolver um pedaço de tela! Por isso este arquivo
   é .jsx: ele tem JSX dentro (o <DialogoConfirmacao>). */
export function useAcoesConversa() {
  const { estado, despachar } = useEstado();
  const [excluindoId, setExcluindoId] = useState(null);

  const temAlgoNaoLido = (conversa) => contarNaoLidas(conversa) > 0 || conversa.marcadaNaoLida;

  function alternarFixada(conversa) {
    if (!conversa.fixadaEm) {
      // A regra também está no reducer; aqui ela vira uma explicação na tela
      const fixadas = estado.conversas.filter((c) => c.fixadaEm).length;
      if (fixadas >= LIMITE_FIXADAS) return avisar(despachar, `Você só pode fixar até ${LIMITE_FIXADAS} conversas`);
    }
    despachar({ tipo: "alternarFixada", id: conversa.id, agora: new Date().toISOString() });
    avisar(despachar, conversa.fixadaEm ? "Conversa desafixada" : "Conversa fixada");
  }

  function alternarLida(conversa) {
    if (temAlgoNaoLido(conversa)) {
      despachar({ tipo: "marcarLida", id: conversa.id });
    } else {
      despachar({ tipo: "marcarNaoLida", id: conversa.id });
      avisar(despachar, "Conversa marcada como não lida");
    }
  }

  function alternarArquivada(conversa) {
    despachar({ tipo: "alternarArquivada", id: conversa.id });
    avisar(despachar, conversa.arquivada ? "Conversa desarquivada" : "Conversa arquivada");
  }

  function excluir() {
    despachar({ tipo: "excluirConversa", id: excluindoId, agora: new Date().toISOString(), auditoriaId: novoId("aud") });
    avisar(despachar, "Conversa excluída");
  }

  /* As opções mudam de TEXTO conforme a situação ("Fixar" / "Desafixar").
     "extras.aoVerDados": só o menu ⋮ oferece os dados do contato */
  function opcoesDe(conversa, extras = {}) {
    const grupo = conversa.tipo === "grupo";
    return [
      extras.aoVerDados && {
        id: "dados",
        rotulo: grupo ? "Dados do grupo" : "Dados do contato",
        icone: "info",
        acao: extras.aoVerDados,
      },
      // Arquivada não pode ser fixada (como no WhatsApp)
      !conversa.arquivada && {
        id: "fixar",
        rotulo: conversa.fixadaEm ? "Desafixar conversa" : "Fixar conversa",
        icone: "pino",
        acao: () => alternarFixada(conversa),
      },
      {
        id: "lida",
        rotulo: temAlgoNaoLido(conversa) ? "Marcar como lida" : "Marcar como não lida",
        icone: "envelope",
        acao: () => alternarLida(conversa),
      },
      { divisoria: true },
      {
        id: "arquivar",
        rotulo: conversa.arquivada ? "Desarquivar conversa" : "Arquivar conversa",
        icone: "arquivo",
        acao: () => alternarArquivada(conversa),
      },
      { id: "excluir", rotulo: "Excluir conversa", icone: "lixeira", perigo: true, acao: () => setExcluindoId(conversa.id) },
    ].filter(Boolean);
  }

  const conversaExcluindo = estado.conversas.find((c) => c.id === excluindoId);
  const dialogo = conversaExcluindo ? (
    <DialogoConfirmacao
      titulo="Excluir conversa?"
      texto={`A conversa com ${nomeDaConversa(conversaExcluindo, estado.contatos)} e todas as mensagens serão apagadas. Isso não pode ser desfeito.`}
      rotulo="Excluir"
      perigo
      aoConfirmar={excluir}
      aoFechar={() => setExcluindoId(null)}
    />
  ) : null;

  return { opcoesDe, dialogo };
}
