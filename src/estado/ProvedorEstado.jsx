import { useCallback, useEffect, useReducer, useRef } from "react";
import { ContextoEstado } from "./contexto.js";
import { reducer, estadoInicial } from "./reducer.js";
import { avisar } from "./avisos.js";
import { apagarSalvos, juntarComSalvos, lerSalvos, montarPacote, salvar } from "./armazenamento.js";
import { trazerDatasParaPerto } from "../utilidades/datas.js";
import { ATENDENTE_PADRAO } from "../configuracao.js";

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
    atendenteLogadoId: ATENDENTE_PADRAO,
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

  /* ---------- Carregar (uma vez, ao abrir o app) ---------- */
  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        // BASE_URL: o caminho do site. Em casa é "/", no GitHub Pages
        // é "/talk-atendimento/". Assim o fetch funciona nos dois lugares
        const resposta = await fetch(`${import.meta.env.BASE_URL}dados.json`);
        if (!resposta.ok) throw new Error(`Erro ${resposta.status}`);
        const dados = await resposta.json();
        if (cancelado) return;

        original.current = dados;
        const salvos = lerSalvos();
        pularSalvamento.current = true;
        despachar({
          tipo: "dadosCarregados",
          // Tem algo salvo? Junta com o dados.json. Não tem? Usa o exemplo
          dados: salvos ? juntarComSalvos(dados, salvos) : dadosDeExemplo(dados),
        });
      } catch (erro) {
        console.error("Falha ao carregar dados.json:", erro);
        if (!cancelado) despachar({ tipo: "erroAoCarregar", mensagem: "Não foi possível carregar as conversas." });
      }
    }

    carregar();

    /* "Limpeza": se o componente sair da tela antes do fetch terminar,
       não despachamos nada. (O StrictMode faz isso de propósito em
       desenvolvimento: monta, desmonta e monta de novo, para testar) */
    return () => {
      cancelado = true;
    };
  }, []);

  /* ---------- Salvar (a cada mudança, com "debounce") ----------
     Várias mudanças seguidas (abrir conversa + marcar como lida...) viram
     UM salvamento só. O truque está na limpeza do efeito: cada mudança
     cancela o temporizador anterior e começa outro. Só o último "sobrevive".

     Um efeito é o lugar certo aqui: o localStorage é um sistema DE FORA
     do React, e o efeito mantém os dois sincronizados */
  const pacotePendente = useRef(null);
  const { carregando, conversas, contatos, etiquetas, auditoria, rascunhos, atendenteLogadoId } = estado;

  useEffect(() => {
    if (carregando) return;
    if (pularSalvamento.current) {
      pularSalvamento.current = false;
      return;
    }

    const pacote = montarPacote({ conversas, contatos, etiquetas, auditoria, rascunhos, atendenteLogadoId });
    pacotePendente.current = pacote;

    const temporizador = setTimeout(() => {
      pacotePendente.current = null;
      if (salvar(pacote)) {
        avisouFalha.current = false;
      } else if (!avisouFalha.current) {
        // Avisa uma vez só, para não incomodar a cada letra digitada
        avisouFalha.current = true;
        avisar(despachar, "Não foi possível salvar: o espaço do navegador pode estar cheio");
      }
    }, ATRASO_SALVAR_MS);

    return () => clearTimeout(temporizador);
  }, [carregando, conversas, contatos, etiquetas, auditoria, rascunhos, atendenteLogadoId]);

  // Fechou ou recarregou a aba antes dos 300ms? Salva na hora o que estava pendente
  useEffect(() => {
    function aoSair() {
      if (pacotePendente.current) salvar(pacotePendente.current);
    }
    window.addEventListener("pagehide", aoSair);
    return () => window.removeEventListener("pagehide", aoSair);
  }, []);

  /* ---------- Restaurar os dados de exemplo ---------- */
  const restaurarExemplo = useCallback(() => {
    if (!original.current) return;
    apagarSalvos();
    pacotePendente.current = null;
    pularSalvamento.current = true; // o exemplo não precisa ser salvo
    despachar({ tipo: "dadosRestaurados", dados: dadosDeExemplo(original.current) });
    avisar(despachar, "Dados de exemplo restaurados");
  }, []);

  return (
    <ContextoEstado.Provider value={{ estado, despachar, restaurarExemplo }}>{children}</ContextoEstado.Provider>
  );
}
