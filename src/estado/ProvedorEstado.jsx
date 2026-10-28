import { useCallback, useEffect, useReducer, useRef } from "react";
import { ContextoEstado } from "./contexto.js";
import { reducer, estadoInicial } from "./reducer.js";
import { avisar } from "./avisos.js";
import {
  apagarSalvos,
  juntarComSalvos,
  lerSalvos,
  lerSessao,
  montarPacote,
  salvar,
  salvarSessao,
} from "./armazenamento.js";
import { trazerDatasParaPerto } from "../utilidades/datas.js";
import { MARCA_PADRAO } from "../configuracao.js";
import { buscarConfiguracaoPublica, buscarDados } from "../api.js";

const ATRASO_SALVAR_MS = 300;

/* Os dados de exemplo "frescos": uma CÓPIA do dados.json com as datas
   trazidas para perto de hoje. structuredClone copia o objeto inteiro,
   com tudo o que tem dentro, para o original nunca ser alterado */
function dadosDeExemplo(original) {
  const dados = structuredClone(original);
  trazerDatasParaPerto(dados.conversas, dados.auditoria);
  return {
    atendentes: dados.atendentes,
    contatos: dados.contatos,
    conversas: dados.conversas,
    etiquetas: dados.etiquetas || [],
    respostasRapidas: dados.respostasRapidas || [],
    auditoria: dados.auditoria || [],
    rascunhos: {},
    marca: dados.marca || MARCA_PADRAO,
    estacoes: dados.estacoes || [],
  };
}

/* Guarda o estado do app (com useReducer) e o entrega a todos os
   componentes pelo Context. Também carrega e SALVA os dados. */
export default function ProvedorEstado({ children }) {
  /* useReducer devolve duas coisas:
     - estado: os dados atuais
     - despachar: a função para pedir mudanças, ex.: despachar({ tipo: "abrirConversa", id }) */
  const [estado, despachar] = useReducer(reducer, estadoInicial);

  const original = useRef(null); // o dados.json intacto, para "Restaurar"
  /* "Pule o próximo salvamento": acabamos de CARREGAR (ou restaurar) os
     dados. Salvar agora só copiaria o exemplo para o navegador, e as datas
     dele parariam de andar. Salvamos só quando a pessoa MUDAR algo */
  const pularSalvamento = useRef(false);
  const avisouFalha = useRef(false);

  /* ---------- Carregar as conversas (depois do login) ----------
     sessao = { token, email, atendenteId, estacaoId, turnoId, desde }
     useCallback: a mesma função entre renderizações (ela vai no Context) */
  const carregarComSessao = useCallback(async (sessao) => {
    // O token vai junto: sem ele, a API responde 401 ("faça login")
    const dados = await buscarDados(sessao.token);

    original.current = dados;
    const salvos = lerSalvos(sessao.atendenteId); // a cópia DESTA pessoa
    pularSalvamento.current = true;
    despachar({
      tipo: "dadosCarregados",
      dados: {
        // Tem algo salvo neste navegador? Junta com o que veio da API
        ...(salvos ? juntarComSalvos(dados, salvos) : dadosDeExemplo(dados)),
        sessao,
        atendenteLogadoId: sessao.atendenteId,
      },
    });
  }, []);

  /* A tela de login chama esta função com a resposta do servidor
     ({ token, sessao }). O token passa a morar DENTRO da sessão */
  const entrarComResposta = useCallback(
    async ({ token, sessao }) => {
      await carregarComSessao({ ...sessao, token });
      const nome = original.current.atendentes.find((a) => a.id === sessao.atendenteId)?.nome;
      avisar(despachar, `Olá, ${nome}! Bom atendimento.`);
    },
    [carregarComSessao]
  );

  /* ---------- Ao abrir o app (uma vez) ----------
     1. Busca o nome da empresa (público), para a tela de login
     2. Já tinha alguém logado neste navegador? Tenta carregar com o token
        guardado. Se o servidor recusar (token vencido), volta para o login */
  useEffect(() => {
    let cancelado = false;

    async function iniciar() {
      try {
        const publico = await buscarConfiguracaoPublica();
        if (cancelado) return;

        const sessao = lerSessao();
        if (sessao) {
          try {
            await carregarComSessao(sessao);
            return; // entrou direto, sem passar pelo login
          } catch (erro) {
            // 401: token vencido ou inválido. Qualquer outro erro: problema de verdade
            if (erro.status !== 401) throw erro;
            if (!cancelado) avisar(despachar, erro.message); // "Sua sessão expirou. Entre de novo."
          }
        }

        if (!cancelado) {
          despachar({ tipo: "prontoParaLogin", marca: publico.marca, modoDemonstracao: publico.modoDemonstracao });
        }
      } catch (erro) {
        console.error("Falha ao iniciar:", erro);
        // A mensagem vem pronta do api.js, explicando o que aconteceu
        if (!cancelado) despachar({ tipo: "erroAoCarregar", mensagem: erro.message });
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

  /* ---------- Salvar (a cada mudança, com "debounce") ----------
     Várias mudanças seguidas (abrir conversa + marcar como lida...) viram
     UM salvamento só. O truque está na limpeza do efeito: cada mudança
     cancela o temporizador anterior e começa outro. Só o último "sobrevive".

     Um efeito é o lugar certo aqui: o localStorage é um sistema DE FORA
     do React, e o efeito mantém os dois sincronizados */
  const pacotePendente = useRef(null);
  const { carregando, conversas, contatos, etiquetas, auditoria, rascunhos, marca, estacoes, sessao, atendenteLogadoId } =
    estado;

  useEffect(() => {
    /* Só salva com alguém LOGADO. Na tela de login o estado está vazio
       (as conversas só chegam depois de entrar): salvar ali gravaria uma
       cópia vazia por cima das conversas guardadas */
    if (carregando || !atendenteLogadoId) return;
    if (pularSalvamento.current) {
      pularSalvamento.current = false;
      return;
    }

    const pacote = montarPacote({ conversas, contatos, etiquetas, auditoria, rascunhos, marca, estacoes });
    // O dono vai junto: o salvamento do "pagehide" precisa saber de quem é
    pacotePendente.current = { pacote, dono: atendenteLogadoId };

    const temporizador = setTimeout(() => {
      pacotePendente.current = null;
      if (salvar(pacote, atendenteLogadoId)) {
        avisouFalha.current = false;
      } else if (!avisouFalha.current) {
        // Avisa uma vez só, para não incomodar a cada letra digitada
        avisouFalha.current = true;
        avisar(despachar, "Não foi possível salvar: o espaço do navegador pode estar cheio");
      }
    }, ATRASO_SALVAR_MS);

    return () => clearTimeout(temporizador);
  }, [carregando, atendenteLogadoId, conversas, contatos, etiquetas, auditoria, rascunhos, marca, estacoes]);

  /* A sessão é salva na hora (sem debounce): entrar e sair são raros.
     Esperamos o carregamento: antes dele, a sessão do estado ainda é null,
     e salvar null APAGARIA o login guardado */
  useEffect(() => {
    if (!carregando) salvarSessao(sessao);
  }, [carregando, sessao]);

  // Fechou ou recarregou a aba antes dos 300ms? Salva na hora o que estava pendente
  useEffect(() => {
    function aoSair() {
      const pendente = pacotePendente.current;
      if (pendente) salvar(pendente.pacote, pendente.dono);
    }
    window.addEventListener("pagehide", aoSair);
    return () => window.removeEventListener("pagehide", aoSair);
  }, []);

  /* ---------- Restaurar os dados de exemplo ---------- */
  const restaurarExemplo = useCallback(() => {
    if (!original.current) return;
    apagarSalvos(atendenteLogadoId); // só a cópia de quem está logado
    pacotePendente.current = null;
    pularSalvamento.current = true; // o exemplo não precisa ser salvo
    despachar({ tipo: "dadosRestaurados", dados: dadosDeExemplo(original.current) });
    avisar(despachar, "Dados de exemplo restaurados");
  }, [atendenteLogadoId]);

  return (
    <ContextoEstado.Provider value={{ estado, despachar, restaurarExemplo, entrarComResposta }}>{children}</ContextoEstado.Provider>
  );
}
