import { useCallback, useEffect, useReducer, useRef } from "react";
import { io } from "socket.io-client";
import { ContextoEstado } from "./contexto.js";
import { reducer, estadoInicial } from "./reducer.js";
import { avisar } from "./avisos.js";
import { pedidoDaAcao } from "./sincronizar.js";
import { apagarCopiasAntigas, lerRascunhos, lerSessao, salvarRascunhos, salvarSessao } from "./armazenamento.js";
import { API_URL, buscarConfiguracaoPublica, buscarDados, gravar, restaurarDemonstracao } from "../api.js";
import { nomeDaConversa } from "../utilidades/conversas.js";

const ATRASO_SALVAR_MS = 300;

/* Guarda o estado do app (com useReducer) e o entrega a todos os
   componentes pelo Context. Também carrega os dados e GRAVA as mudanças
   no servidor (B5: o banco é quem guarda as conversas) */
export default function ProvedorEstado({ children }) {
  /* useReducer devolve duas coisas:
     - estado: os dados atuais
     - despacharNaTela: muda SÓ a tela. Os componentes recebem uma versão
       "turbinada" dela (o despachar, mais abaixo), que também grava no banco */
  const [estado, despacharNaTela] = useReducer(reducer, estadoInicial);

  /* O estado mais recente, numa REF. As funções abaixo são criadas uma vez
     só (useCallback), e uma função criada lá atrás "enxergaria" o estado
     daquela época. A ref é uma caixinha que sempre tem o valor de agora.
     Ela é atualizada num efeito (mexer em ref durante a renderização não é recomendado) */
  const estadoAtual = useRef(estado);
  useEffect(() => {
    estadoAtual.current = estado;
  }, [estado]);

  // O que veio do /publico/configuracao (o modo demonstração está ligado?)
  const publico = useRef({ modoDemonstracao: false });

  /* ---------- Carregar as conversas (depois do login) ----------
     sessao = { token, email, atendenteId, estacaoId, turnoId, desde } */
  const carregarComSessao = useCallback(async (sessao) => {
    // O token vai junto: sem ele, a API responde 401 ("faça login")
    const dados = await buscarDados(sessao.token);
    despacharNaTela({
      tipo: "dadosCarregados",
      dados: {
        ...dados, // TUDO vem do servidor: conversas, etiquetas, auditoria...
        rascunhos: lerRascunhos(sessao.atendenteId), // ...menos os rascunhos, que são deste navegador
        modoDemonstracao: publico.current.modoDemonstracao,
        sessao,
        atendenteLogadoId: sessao.atendenteId,
      },
    });
    return dados;
  }, []);

  // Buscar tudo de novo no servidor, com a mesma sessão (puxou estação, salvou configurações, deu erro...)
  const recarregar = useCallback(() => carregarComSessao(estadoAtual.current.sessao), [carregarComSessao]);

  /* ---------- Gravar no servidor ----------
     A FILA: os pedidos saem UM POR VEZ, na ordem em que aconteceram.
     Sem ela, "enviar" e logo depois "editar" iriam juntos pela internet,
     e o "editar" poderia chegar primeiro, quando a mensagem nem existe.

     Truque: fila.current é uma Promise. Cada pedido novo entra com
     .then(), ou seja, só começa quando o anterior terminar */
  const fila = useRef(Promise.resolve());

  /* TEMPO REAL x FILA: cada pedido que gravamos volta como aviso ao vivo
     (o servidor manda a conversa atualizada para todos, inclusive para nós).
     Problema: mandou duas mensagens seguidas? O aviso da 1ª pode chegar
     ANTES de a 2ª ser gravada, e a 2ª "sumiria" da tela por um instante.
     Solução: enquanto houver pedidos de uma conversa na fila, os avisos dela
     ficam ADIADOS; quando o último termina, vale o aviso mais recente */
  const pendentes = useRef(new Map()); // conversaId -> quantos pedidos dela estão na fila
  const adiadas = useRef(new Map()); // conversaId -> a versão mais recente que chegou nesse meio-tempo
  const aplicarConversa = useRef(() => {}); // definida mais abaixo (precisa do "despachar")

  const enfileirar = useCallback(
    (pedido, conversaId) => {
      const token = estadoAtual.current.sessao?.token;
      if (conversaId) pendentes.current.set(conversaId, (pendentes.current.get(conversaId) ?? 0) + 1);

      fila.current = fila.current
        .then(() => gravar(token, pedido))
        .catch(async (erro) => {
          /* Deu errado: o servidor recusou ou a internet caiu. A tela
             mostrou algo que o banco não tem. A saída mais segura: avisar
             e buscar tudo de novo, para a tela voltar a ser igual ao banco */
          if (erro.status === 401) {
            despacharNaTela({ tipo: "sair" });
            return avisar(despacharNaTela, erro.message); // "Sua sessão expirou. Entre de novo."
          }
          avisar(despacharNaTela, `Não foi salvo: ${erro.message}`);
          try {
            await recarregar();
          } catch {
            // sem internet nem para recarregar: o aviso já foi dado
          }
        })
        .finally(() => {
          // Terminou o último pedido desta conversa? Aplica o aviso que ficou esperando
          if (!conversaId) return;
          const restantes = pendentes.current.get(conversaId) - 1;
          if (restantes > 0) return pendentes.current.set(conversaId, restantes);
          pendentes.current.delete(conversaId);
          const adiada = adiadas.current.get(conversaId);
          if (adiada) {
            adiadas.current.delete(conversaId);
            aplicarConversa.current(adiada);
          }
        });
    },
    [recarregar],
  );

  /* O despachar que os componentes usam. Os componentes NÃO mudaram nada:
     continuam chamando despachar({ tipo: "..." }). A diferença está aqui:
     1. a tela muda na hora (despacharNaTela)
     2. se a ação grava algo, o pedido entra na fila

     reducer(antes, acao) === antes: o reducer RECUSOU a ação (uma regra
     barrou, ou nada mudou). Aí não há o que gravar. Dá para chamar o
     reducer aqui porque ele é PURO: chamar de novo não muda nada */
  const despachar = useCallback(
    (acao) => {
      const antes = estadoAtual.current;
      const pedido = antes.atendenteLogadoId ? pedidoDaAcao(acao, antes) : null;
      despacharNaTela(acao);
      // acao.conversaId ?? acao.id: de QUAL conversa é o pedido (para os avisos adiados)
      if (pedido && reducer(antes, acao) !== antes) enfileirar(pedido, acao.conversaId ?? acao.id);
    },
    [enfileirar],
  );

  /* Chegou uma conversa atualizada pelo servidor: troca na tela.
     Se nela tem mensagem NOVA do cliente:
     - conversa aberta: você já está vendo, então ela é marcada como lida
     - fechada: o aviso "Nova mensagem de Fulano" aparece */
  useEffect(() => {
    aplicarConversa.current = (conversa) => {
      const antes = estadoAtual.current;
      const antiga = antes.conversas.find((c) => c.id === conversa.id);
      const jaVistas = new Set(antiga?.mensagens.map((m) => m.id));
      const novas = conversa.mensagens.filter((m) => m.direcao === "recebida" && !m.lida && !jaVistas.has(m.id));

      despacharNaTela({ tipo: "conversaDoServidor", conversa });
      if (novas.length === 0) return;

      if (antes.conversaAbertaId === conversa.id) {
        despacharNaTela({ tipo: "marcarLida", id: conversa.id });
        enfileirar(
          { metodo: "PATCH", caminho: `/conversas/${encodeURIComponent(conversa.id)}`, corpo: { lida: true } },
          conversa.id,
        );
      } else {
        avisar(despacharNaTela, `Nova mensagem de ${nomeDaConversa(conversa, antes.contatos)}`);
      }
    };
  }, [enfileirar]);

  /* ---------- Tempo real (B6): a conexão com o servidor ----------
     Enquanto alguém está logado, o navegador mantém uma conexão ABERTA
     com o servidor (Socket.io). O servidor avisa por ela o que mudou, e
     cada aviso vira uma ação do reducer. Saiu (token some)? A limpeza do
     efeito desliga a conexão */
  const token = estado.sessao?.token;
  useEffect(() => {
    if (!token) return;
    // O token vai no "auth": o servidor só aceita a conexão de quem está logado
    const conexao = io(API_URL, { auth: { token } });

    /* A conexão caiu e voltou (internet, servidor reiniciando)? Os avisos
       desse intervalo se perderam: buscamos tudo de novo para não ficar para trás */
    let primeiraVez = true;
    conexao.on("connect", () => {
      if (!primeiraVez) recarregar().catch(() => {});
      primeiraVez = false;
    });

    // "sessao" = o servidor recusou o token (vencido): volta para o login
    conexao.on("connect_error", (erro) => {
      if (erro.message !== "sessao") return; // outros erros: o Socket.io tenta de novo sozinho
      conexao.disconnect();
      despacharNaTela({ tipo: "sair" });
      avisar(despacharNaTela, "Sua sessão expirou. Entre de novo.");
    });

    conexao.on("conversa", (conversa) => {
      // Tem pedido desta conversa na fila? Guarda para depois (veja "pendentes", lá em cima)
      if (pendentes.current.get(conversa.id) > 0) adiadas.current.set(conversa.id, conversa);
      else aplicarConversa.current(conversa);
    });
    conexao.on("conversaExcluida", ({ id }) => despacharNaTela({ tipo: "conversaExcluidaNoServidor", id }));
    conexao.on("auditoria", (registro) => despacharNaTela({ tipo: "auditoriaDoServidor", registro }));
    conexao.on("etiquetas", (etiquetas) => despacharNaTela({ tipo: "etiquetasDoServidor", etiquetas }));
    conexao.on("contato", (contato) => despacharNaTela({ tipo: "contatoDoServidor", contato }));
    conexao.on("estacoes", (estacoes) => despacharNaTela({ tipo: "estacoesDoServidor", estacoes }));
    conexao.on("recarregar", () => recarregar().catch(() => {}));

    return () => conexao.disconnect();
  }, [token, recarregar]);

  /* A tela de login chama esta função com a resposta do servidor
     ({ token, sessao }). O token passa a morar DENTRO da sessão */
  const entrarComResposta = useCallback(
    async ({ token, sessao }) => {
      const dados = await carregarComSessao({ ...sessao, token });
      const nome = dados.atendentes.find((a) => a.id === sessao.atendenteId)?.nome;
      avisar(despacharNaTela, `Olá, ${nome}! Bom atendimento.`);
    },
    [carregarComSessao],
  );

  /* ---------- Ao abrir o app (uma vez) ----------
     1. Busca o nome da empresa (público), para a tela de login
     2. Já tinha alguém logado neste navegador? Tenta carregar com o token
        guardado. Se o servidor recusar (token vencido), volta para o login */
  useEffect(() => {
    let cancelado = false;
    apagarCopiasAntigas();

    async function iniciar() {
      try {
        publico.current = await buscarConfiguracaoPublica();
        if (cancelado) return;

        const sessao = lerSessao();
        if (sessao) {
          try {
            await carregarComSessao(sessao);
            return; // entrou direto, sem passar pelo login
          } catch (erro) {
            // 401: token vencido ou inválido. Qualquer outro erro: problema de verdade
            if (erro.status !== 401) throw erro;
            if (!cancelado) avisar(despacharNaTela, erro.message); // "Sua sessão expirou. Entre de novo."
          }
        }

        if (!cancelado) {
          despacharNaTela({
            tipo: "prontoParaLogin",
            marca: publico.current.marca,
            modoDemonstracao: publico.current.modoDemonstracao,
          });
        }
      } catch (erro) {
        console.error("Falha ao iniciar:", erro);
        // A mensagem vem pronta do api.js, explicando o que aconteceu
        if (!cancelado) despacharNaTela({ tipo: "erroAoCarregar", mensagem: erro.message });
      }
    }

    iniciar();

    /* "Limpeza": se o componente sair da tela antes do fetch terminar,
       não despachamos nada. (O StrictMode faz isso de propósito em
       desenvolvimento: monta, desmonta e monta de novo, para testar) */
    return () => {
      cancelado = true;
    };
  }, [carregarComSessao]);

  /* ---------- Rascunhos no navegador (com "debounce") ----------
     Digitar "Olá" muda o rascunho 3 vezes, mas só o último salvamento
     acontece: cada mudança cancela o temporizador anterior (na limpeza
     do efeito) e começa outro. Só o último "sobrevive" aos 300ms */
  const { carregando, rascunhos, sessao, atendenteLogadoId } = estado;
  const rascunhosPendentes = useRef(null);

  useEffect(() => {
    // Só com alguém LOGADO: na tela de login não há de quem salvar
    if (carregando || !atendenteLogadoId) return;
    rascunhosPendentes.current = { rascunhos, dono: atendenteLogadoId };
    const temporizador = setTimeout(() => {
      rascunhosPendentes.current = null;
      salvarRascunhos(rascunhos, atendenteLogadoId);
    }, ATRASO_SALVAR_MS);
    return () => clearTimeout(temporizador);
  }, [carregando, atendenteLogadoId, rascunhos]);

  // Fechou ou recarregou a aba antes dos 300ms? Salva na hora o que estava pendente
  useEffect(() => {
    function aoSair() {
      const pendente = rascunhosPendentes.current;
      if (pendente) salvarRascunhos(pendente.rascunhos, pendente.dono);
    }
    window.addEventListener("pagehide", aoSair);
    return () => window.removeEventListener("pagehide", aoSair);
  }, []);

  /* A sessão é salva na hora (sem debounce): entrar e sair são raros.
     Esperamos o carregamento: antes dele, a sessão do estado ainda é null,
     e salvar null APAGARIA o login guardado */
  useEffect(() => {
    if (!carregando) salvarSessao(sessao);
  }, [carregando, sessao]);

  /* ---------- Restaurar os dados de exemplo (modo demonstração) ----------
     Agora é o SERVIDOR que volta o banco ao exemplo, para todo mundo */
  const restaurarExemplo = useCallback(async () => {
    try {
      // Espera a fila esvaziar: um pedido atrasado não pode cair no banco recém-restaurado
      await fila.current;
      await restaurarDemonstracao(estadoAtual.current.sessao?.token);
      await recarregar();
      // Fecha a conversa aberta e volta para a lista (os dados já vieram do recarregar)
      despacharNaTela({ tipo: "dadosRestaurados", dados: {} });
      avisar(despacharNaTela, "Dados de exemplo restaurados");
    } catch (erro) {
      avisar(despacharNaTela, erro.message);
    }
  }, [recarregar]);

  return (
    <ContextoEstado.Provider value={{ estado, despachar, restaurarExemplo, entrarComResposta, recarregar }}>
      {children}
    </ContextoEstado.Provider>
  );
}
