import { useEffect } from "react";
import { useEstado } from "./estado/useEstado.js";
import { contarTotalNaoLidas } from "./utilidades/conversas.js";
import TopoApp from "./componentes/TopoApp.jsx";
import BarraLateral from "./componentes/BarraLateral.jsx";
import Chat from "./componentes/Chat.jsx";
import Aviso from "./componentes/Aviso.jsx";

/* O componente principal: monta a tela com os pedaços */
export default function App() {
  const { estado } = useEstado();
  const total = contarTotalNaoLidas(estado.conversas);
  const marca = estado.marca.nome;

  /* Título da aba: "(5) Talk Atendimento".
     useEffect com [total, marca]: roda de novo SÓ quando um desses dois
     valores mudar. É a lista de "dependências" do efeito */
  useEffect(() => {
    document.title = total > 0 ? `(${total}) ${marca}` : marca;
  }, [total, marca]);

  if (estado.erro) {
    return (
      <>
        <TopoApp />
        <p className="aviso-carregamento">{estado.erro}</p>
      </>
    );
  }

  return (
    <>
      {/* <> </> é um "Fragment": agrupa elementos sem criar uma div extra */}
      <TopoApp />
      {/* No celular, a classe app--chat-aberto troca a lista pelo chat */}
      <div className={estado.conversaAbertaId ? "app app--chat-aberto" : "app"}>
        <BarraLateral />
        <Chat />
      </div>
      <Aviso />
    </>
  );
}
