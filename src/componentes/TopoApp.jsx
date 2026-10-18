import { useEstado } from "../estado/useEstado.js";
import { buscarPorId } from "../utilidades/conversas.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";

/* A barra do topo: a marca (white-label) e quem está logado */
export default function TopoApp() {
  const { estado } = useEstado();
  const atendente = buscarPorId(estado.atendentes, estado.atendenteLogadoId);

  return (
    <header className="topo-app">
      <div className="topo-app__esquerda">
        {/* O nome vem do estado: quando a empresa trocar, muda aqui sozinho */}
        <span className="topo-app__logo">
          <Icone nome="logo" /> {estado.marca.nome}
        </span>
      </div>

      <div className="topo-app__direita">
        {/* && no JSX: "se tiver atendente, mostra isto". Enquanto os dados
            carregam, a lista de atendentes está vazia e nada aparece */}
        {atendente && (
          <div className="atendente-logado">
            <span className="atendente-logado__nome">{atendente.nome}</span>
            <Avatar nome={atendente.nome} />
          </div>
        )}
      </div>
    </header>
  );
}
