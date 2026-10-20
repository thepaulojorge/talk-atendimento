import { useEffect } from "react";
import { useEstado } from "./estado/useEstado.js";
import { buscarPorId, contarTotalNaoLidas } from "./utilidades/conversas.js";
import TopoApp from "./componentes/TopoApp.jsx";
import BarraLateral from "./componentes/BarraLateral.jsx";
import Chat from "./componentes/Chat.jsx";
import PainelDados from "./componentes/PainelDados.jsx";
import Aviso from "./componentes/Aviso.jsx";
import TelaLogin from "./componentes/TelaLogin.jsx";

/* O componente principal: monta a tela com os pedaços */
export default function App() {
  const { estado } = useEstado();
  const logado = Boolean(estado.atendenteLogadoId);
  // Na tela de login, o título não entrega quantas mensagens há
  const total = logado ? contarTotalNaoLidas(estado.conversas) : 0;
  const marca = estado.marca.nome;
  const conversaAberta = buscarPorId(estado.conversas, estado.conversaAbertaId);

  /* Título da aba: "(5) Talk Atendimento".
     useEffect com [total, marca]: roda de novo SÓ quando um desses dois
     valores mudar. É a lista de "dependências" do efeito */
  useEffect(() => {
    document.title = total > 0 ? `(${total}) ${marca}` : marca;
  }, [total, marca]);

  /* Carregando: ainda não sabemos se alguém já estava logado neste
     navegador. Mostrar o login agora faria a tela "piscar" para quem estava */
  if (estado.carregando) return <p className="aviso-carregamento">Carregando…</p>;

  if (estado.erro) {
    return (
      <>
        <TopoApp />
        <p className="aviso-carregamento">{estado.erro}</p>
      </>
    );
  }

  // Ninguém logado: só a tela de login (e o aviso, para o "Olá, Paulo!")
  if (!logado) {
    return (
      <>
        <TelaLogin />
        <Aviso />
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
        {/* Terceira coluna: só existe com uma conversa aberta E o painel pedido */}
        {conversaAberta && estado.painelDadosAberto && <PainelDados conversa={conversaAberta} />}
      </div>
      <Aviso />
    </>
  );
}
