import { useEffect, useReducer } from "react";
import { ContextoEstado } from "./contexto.js";
import { reducer, estadoInicial } from "./reducer.js";
import { trazerDatasParaPerto } from "../utilidades/datas.js";

/* Guarda o estado do app (com useReducer) e o entrega a todos os
   componentes pelo Context. Também busca os dados ao abrir o app. */
export default function ProvedorEstado({ children }) {
  /* useReducer devolve duas coisas:
     - estado: os dados atuais
     - despachar: a função para pedir mudanças, ex.: despachar({ tipo: "abrirConversa", id }) */
  const [estado, despachar] = useReducer(reducer, estadoInicial);

  /* useEffect com [] no final: roda UMA vez, quando o app aparece na tela.
     É o lugar certo para buscar dados (antes era o carregarDados()) */
  useEffect(() => {
    let cancelado = false;

    async function carregar() {
      try {
        // BASE_URL: o caminho do site. Em casa é "/", no GitHub Pages
        // será "/talk-atendimento/". Assim o fetch funciona nos dois lugares
        const resposta = await fetch(`${import.meta.env.BASE_URL}dados.json`);
        if (!resposta.ok) throw new Error(`Erro ${resposta.status}`);
        const dados = await resposta.json();

        trazerDatasParaPerto(dados.conversas, dados.auditoria);

        if (!cancelado) {
          despachar({
            tipo: "dadosCarregados",
            dados: {
              atendentes: dados.atendentes,
              contatos: dados.contatos,
              conversas: dados.conversas,
              etiquetas: dados.etiquetas || [],
              respostasRapidas: dados.respostasRapidas || [],
              auditoria: dados.auditoria || [],
            },
          });
        }
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

  return <ContextoEstado.Provider value={{ estado, despachar }}>{children}</ContextoEstado.Provider>;
}
