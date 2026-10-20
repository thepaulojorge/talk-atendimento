import { useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import PainelConversas from "./PainelConversas.jsx";
import PainelContatos from "./PainelContatos.jsx";

/* Coluna da esquerda: a lista de conversas ou a aba de contatos.
   QUAL das duas aparece vem do estado global (estado.secao), porque
   quem troca é a barra de ícones, outro componente.

   Busca, filtro e arquivadas: só a coluna da esquerda usa, então NÃO
   vão para o estado global. Ficam aqui, em useState.

   E por que aqui, e não dentro do PainelConversas? Porque o painel SOME
   enquanto a aba de Contatos está aberta, e um componente que some perde
   o próprio estado. Guardando no "pai", a busca e o filtro continuam lá
   quando você volta. Isso se chama "elevar o estado" (lifting state up). */
export default function BarraLateral() {
  const { estado, despachar } = useEstado();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [etiqueta, setEtiqueta] = useState(""); // "" = qualquer etiqueta
  const [vendoArquivadas, setVendoArquivadas] = useState(false);

  /* Iniciou uma conversa pelos contatos: o reducer já volta a seção para
     "conversas"; aqui saímos das arquivadas (a conversa pode ter saído de lá) */
  function aoIniciarConversa() {
    setVendoArquivadas(false);
  }

  return (
    <aside className="barra-lateral">
      {estado.secao === "contatos" ? (
        <PainelContatos
          aoFechar={() => despachar({ tipo: "irPara", secao: "conversas" })}
          aoIniciarConversa={aoIniciarConversa}
        />
      ) : (
        <PainelConversas
          busca={busca}
          setBusca={setBusca}
          filtro={filtro}
          setFiltro={setFiltro}
          etiqueta={etiqueta}
          setEtiqueta={setEtiqueta}
          vendoArquivadas={vendoArquivadas}
          setVendoArquivadas={setVendoArquivadas}
        />
      )}
    </aside>
  );
}
