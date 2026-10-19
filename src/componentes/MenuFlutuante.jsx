import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Icone from "./Icone.jsx";

/* Um menu genérico, que serve para qualquer lista de opções.
   (Na etapa 3b, o clique direito nas conversas vai usar o mesmo.)

   Props:
   - opcoes: [{ id, rotulo, icone?, perigo?, teste?, acao }] ou { divisoria: true }
   - x, y: onde abrir (posição do mouse)
   - folha: true = "folha" que sobe do rodapé (celular, aberto pelo toque)
   - previa: texto curto mostrado no topo da folha (a mensagem escolhida)
   - titulo: um rótulo pequeno no topo do menu ("Simular login como")
   - aoFechar: chamado ao clicar fora, apertar Esc ou escolher uma opção
   - ancora (opcional): ref do botão que abre o menu (o ⋮). Clicar nele não
     conta como "clicar fora": quem cuida desse clique é o próprio botão */
export default function MenuFlutuante({ opcoes, x, y, folha = false, previa, titulo, ancora, aoFechar }) {
  const caixa = useRef(null); // o menu inteiro (na folha, inclui o fundo escuro)
  const lista = useRef(null);
  const tocouNoFundo = useRef(false);
  const itens = limparDivisorias(opcoes);

  // Posiciona perto do mouse sem sair da tela (a folha não precisa: fica no rodapé)
  useLayoutEffect(() => {
    lista.current.querySelector("button")?.focus(); // teclado já pode navegar
    if (folha) return;
    const el = lista.current;
    el.style.left = `${Math.max(8, Math.min(x, window.innerWidth - el.offsetWidth - 8))}px`;
    el.style.top = `${Math.max(8, Math.min(y, window.innerHeight - el.offsetHeight - 8))}px`;
  }, [x, y, folha]);

  /* Fechar: clique FORA do menu, Esc ou a janela mudando de tamanho.
     "true" no addEventListener = fase de captura: o Esc é tratado aqui
     ANTES de chegar no ouvinte do chat (que fecharia a conversa inteira) */
  useEffect(() => {
    function aoApertarFora(evento) {
      if (caixa.current.contains(evento.target)) return;
      if (ancora?.current?.contains(evento.target)) return;
      aoFechar();
    }
    function aoApertarTecla(evento) {
      if (evento.key === "Escape") {
        evento.stopPropagation();
        aoFechar();
      }
    }
    document.addEventListener("pointerdown", aoApertarFora, true);
    document.addEventListener("keydown", aoApertarTecla, true);
    window.addEventListener("resize", aoFechar);
    return () => {
      document.removeEventListener("pointerdown", aoApertarFora, true);
      document.removeEventListener("keydown", aoApertarTecla, true);
      window.removeEventListener("resize", aoFechar);
    };
  }, [aoFechar, ancora]);

  // Setas para cima e para baixo andam pelas opções (dando a volta)
  function aoNavegar(evento) {
    if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp") return;
    evento.preventDefault();
    const botoes = [...lista.current.querySelectorAll("button")];
    const atual = botoes.indexOf(document.activeElement);
    const passo = evento.key === "ArrowDown" ? 1 : -1;
    botoes[(atual + passo + botoes.length) % botoes.length]?.focus();
  }

  function escolher(opcao) {
    aoFechar(); // fecha primeiro: a ação pode abrir outra coisa (uma janela, a edição)
    opcao.acao();
  }

  const menu = (
    <ul
      ref={lista}
      className={`menu__lista ${folha ? "menu-folha" : "menu-contexto"}`}
      role="menu"
      onKeyDown={aoNavegar}
    >
      {folha && previa && (
        <li role="none" className="menu-folha__previa">
          {previa}
        </li>
      )}
      {titulo && (
        <li role="none" className="menu-atendente__titulo">
          {titulo}
        </li>
      )}
      {itens.map((opcao, i) =>
        opcao.divisoria ? (
          <li key={`div-${i}`} role="separator" className="menu__divisoria" />
        ) : (
          <li key={opcao.id} role="none">
            <button
              type="button"
              role="menuitem"
              // perigo = vermelho (excluir) | teste = discreto (ferramentas de simulação)
              className={opcao.perigo ? "perigo" : opcao.teste ? "menu__teste" : undefined}
              onClick={() => escolher(opcao)}
            >
              {opcao.icone && <Icone nome={opcao.icone} />}
              <span className="menu__texto">{opcao.rotulo}</span>
            </button>
          </li>
        )
      )}
    </ul>
  );

  // Portal: desenhado no <body>, por cima de tudo (como o cartão de prévia)
  return createPortal(
    <div ref={caixa}>
      {/* Na folha, tocar no fundo escuro fecha. Mas atenção: ao soltar o dedo
          que ABRIU o menu, o navegador manda um "click" bem aqui, no fundo.
          Por isso só fechamos se o toque também COMEÇOU no fundo */}
      {folha && (
        <div
          className="menu-folha__fundo"
          onPointerDown={() => (tocouNoFundo.current = true)}
          onClick={() => tocouNoFundo.current && aoFechar()}
        />
      )}
      {menu}
    </div>,
    document.body
  );
}

/* Tira divisórias sobrando: no começo, no fim ou duas seguidas.
   Assim quem monta o menu pode esconder opções sem se preocupar com elas */
function limparDivisorias(opcoes) {
  const resultado = [];
  for (const opcao of opcoes) {
    if (opcao.divisoria && (resultado.length === 0 || resultado.at(-1).divisoria)) continue;
    resultado.push(opcao);
  }
  if (resultado.at(-1)?.divisoria) resultado.pop();
  return resultado;
}
