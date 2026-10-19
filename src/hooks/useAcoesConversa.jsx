import { useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { LIMITE_FIXADAS } from "../configuracao.js";
import { buscarPorId, contarNaoLidas, estaResolvida, nomeDaConversa } from "../utilidades/conversas.js";
import { novoId } from "../utilidades/ids.js";
import DialogoConfirmacao from "../componentes/DialogoConfirmacao.jsx";
import DialogoTransferir from "../componentes/DialogoTransferir.jsx";

/* ⚠️ SIMULAÇÃO: frases que o "cliente" manda quando você testa */
const FRASES_DE_TESTE = [
  "Oi, ainda estão aí?",
  "O veículo parou de aparecer no mapa de novo.",
  "Obrigado pelo retorno!",
  "Vocês podem me ligar?",
  "Qual o valor do plano anual?",
];

const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];

/* As ações de uma conversa, para os DOIS menus que as oferecem:
   o ⋮ no topo do chat e o clique direito (ou dedo pressionado) na lista.

   const { opcoesDe, dialogo } = useAcoesConversa();
   - opcoesDe(conversa): a lista de opções, pronta para o <MenuFlutuante>
   - acoes: as ações soltas (assumir, resolver...), para quem precisar
     de uma delas fora do menu (a faixa "Ninguém está atendendo", por exemplo)
   - dialogo: a janela aberta no momento (excluir ou transferir), ou null. Quem usa o hook
     só precisa colocar {dialogo} em algum lugar do seu JSX

   Sim, um hook pode devolver um pedaço de tela! Por isso este arquivo
   é .jsx: ele tem JSX dentro (o <DialogoConfirmacao>). */
export function useAcoesConversa() {
  const { estado, despachar } = useEstado();
  const [excluindoId, setExcluindoId] = useState(null);
  const [transferindoId, setTransferindoId] = useState(null);

  // Ids e horários nascem aqui, nos eventos (o reducer é puro)
  const marcaDeTempo = () => ({ eventoId: novoId("e"), agora: new Date().toISOString() });

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

  /* ---------- Equipe ---------- */
  function assumir(conversa) {
    despachar({ tipo: "assumirConversa", id: conversa.id, ...marcaDeTempo() });
    avisar(despachar, "Agora esta conversa é sua");
  }

  function transferir(conversaId, destinoId) {
    despachar({ tipo: "transferirConversa", id: conversaId, destinoId, ...marcaDeTempo() });
    const destino = buscarPorId(estado.atendentes, destinoId);
    avisar(despachar, destino ? `Conversa transferida para ${destino.nome}` : "Conversa devolvida para a fila");
  }

  function alternarResolvida(conversa) {
    despachar({ tipo: "alternarResolvida", id: conversa.id, ...marcaDeTempo() });
    avisar(despachar, estaResolvida(conversa) ? "Conversa reaberta" : "Atendimento resolvido ✓");
  }

  /* ⚠️ SIMULAÇÃO: finge que o cliente escreveu, 3 segundos depois.
     O atraso dá tempo de fechar a conversa e ver o contador subir */
  function simularCliente(conversa) {
    avisar(despachar, "🧪 O cliente vai responder em 3 segundos…");
    const autor = conversa.tipo === "grupo" ? sortear(conversa.participantes) : null;
    setTimeout(() => {
      despachar({
        tipo: "receberMensagem",
        conversaId: conversa.id,
        id: novoId("m"),
        agora: new Date().toISOString(),
        texto: sortear(FRASES_DE_TESTE),
        autor,
      });
    }, 3000);
  }

  function excluir() {
    despachar({ tipo: "excluirConversa", id: excluindoId, agora: new Date().toISOString(), auditoriaId: novoId("aud") });
    avisar(despachar, "Conversa excluída");
  }

  /* As opções mudam de TEXTO conforme a situação ("Fixar" / "Desafixar").
     extras (só o menu ⋮ usa):
     - aoVerDados: oferece "Dados do contato"
     - comSimulacao: oferece a ferramenta de teste "Simular mensagem do cliente" */
  function opcoesDe(conversa, extras = {}) {
    const grupo = conversa.tipo === "grupo";
    const minha = conversa.atendenteId === estado.atendenteLogadoId;
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
      // "Assumir" some quando a conversa já é sua
      !minha && { id: "assumir", rotulo: "Assumir conversa", icone: "assumir", acao: () => assumir(conversa) },
      { id: "transferir", rotulo: "Transferir conversa", icone: "transferir", acao: () => setTransferindoId(conversa.id) },
      {
        id: "resolver",
        rotulo: estaResolvida(conversa) ? "Reabrir conversa" : "Marcar como resolvida",
        icone: "resolver",
        acao: () => alternarResolvida(conversa),
      },
      { divisoria: true },
      {
        id: "arquivar",
        rotulo: conversa.arquivada ? "Desarquivar conversa" : "Arquivar conversa",
        icone: "arquivo",
        acao: () => alternarArquivada(conversa),
      },
      { id: "excluir", rotulo: "Excluir conversa", icone: "lixeira", perigo: true, acao: () => setExcluindoId(conversa.id) },
      extras.comSimulacao && { divisoria: true },
      extras.comSimulacao && {
        id: "simular",
        rotulo: "Simular mensagem do cliente",
        icone: "frasco",
        teste: true,
        acao: () => simularCliente(conversa),
      },
    ].filter(Boolean);
  }

  const conversaExcluindo = estado.conversas.find((c) => c.id === excluindoId);
  const conversaTransferindo = estado.conversas.find((c) => c.id === transferindoId);

  let dialogo = null;
  if (conversaTransferindo) {
    dialogo = (
      <DialogoTransferir
        conversa={conversaTransferindo}
        aoEscolher={(destinoId) => transferir(conversaTransferindo.id, destinoId)}
        aoFechar={() => setTransferindoId(null)}
      />
    );
  } else if (conversaExcluindo) {
    dialogo = (
      <DialogoConfirmacao
        titulo="Excluir conversa?"
        texto={`A conversa com ${nomeDaConversa(conversaExcluindo, estado.contatos)} e todas as mensagens serão apagadas. Isso não pode ser desfeito.`}
        rotulo="Excluir"
        perigo
        aoConfirmar={excluir}
        aoFechar={() => setExcluindoId(null)}
      />
    );
  }

  return { opcoesDe, dialogo, acoes: { assumir, alternarResolvida } };
}
