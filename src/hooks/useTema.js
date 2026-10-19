import { useState } from "react";

const CHAVE_TEMA = "talk-tema";

/* Tema: "preto" (o padrão) ou "claro".
   As cores estão todas no CSS, em variáveis. Trocar o tema é só colocar
   ou tirar data-tema="claro" no <html>, e o CSS faz o resto.

   Por que o <html> e não um estado do React? Porque um script no
   index.html aplica o tema ANTES de o React carregar. Sem ele, quem usa
   o tema claro veria um "piscar" preto ao abrir a página */
export function useTema() {
  // Inicialização preguiçosa: lê do <html> só na primeira renderização
  const [tema, setTema] = useState(() => (document.documentElement.dataset.tema === "claro" ? "claro" : "preto"));

  function alternarTema() {
    const novo = tema === "claro" ? "preto" : "claro";
    const html = document.documentElement;
    if (novo === "claro") html.dataset.tema = "claro";
    else delete html.dataset.tema;

    // A barra do navegador no celular acompanha a cor do topo
    const corTopo = getComputedStyle(html).getPropertyValue("--fundo-topo").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", corTopo);

    try {
      localStorage.setItem(CHAVE_TEMA, novo);
    } catch {
      // aba anônima: o tema só não será lembrado na próxima visita
    }
    setTema(novo);
  }

  return { tema, alternarTema };
}
