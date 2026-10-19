import { useState } from "react";
import PainelConversas from "./PainelConversas.jsx";
import PainelContatos from "./PainelContatos.jsx";

/* Coluna da esquerda: alterna entre a lista de conversas e a aba de contatos.

   Onde guardar busca, filtro e arquivadas? Só a coluna da esquerda usa,
   então NÃO vão para o estado global: ficam aqui, em useState.

   E por que aqui, e não dentro do PainelConversas? Porque o painel SOME
   enquanto a aba de Contatos está aberta, e um componente que some perde
   o próprio estado. Guardando no "pai", a busca e o filtro continuam lá
   quando você volta. Isso se chama "elevar o estado" (lifting state up). */
export default function BarraLateral() {
  const [painel, setPainel] = useState("conversas"); // "conversas" | "contatos"
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [etiqueta, setEtiqueta] = useState(""); // "" = qualquer etiqueta
  const [vendoArquivadas, setVendoArquivadas] = useState(false);

  // Iniciou uma conversa pelos contatos: volta para a lista, fora das arquivadas
  // (a conversa pode ter acabado de sair de lá)
  function aoIniciarConversa() {
    setVendoArquivadas(false);
    setPainel("conversas");
  }

  return (
    <aside className="barra-lateral">
      {painel === "conversas" ? (
        <PainelConversas
          busca={busca}
          setBusca={setBusca}
          filtro={filtro}
          setFiltro={setFiltro}
          etiqueta={etiqueta}
          setEtiqueta={setEtiqueta}
          vendoArquivadas={vendoArquivadas}
          setVendoArquivadas={setVendoArquivadas}
          aoAbrirContatos={() => setPainel("contatos")}
        />
      ) : (
        <PainelContatos aoFechar={() => setPainel("conversas")} aoIniciarConversa={aoIniciarConversa} />
      )}
    </aside>
  );
}
