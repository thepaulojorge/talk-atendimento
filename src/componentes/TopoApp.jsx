import { useEstado } from "../estado/useEstado.js";
import { buscarPorId } from "../utilidades/conversas.js";
import { PAPEIS, papelDe } from "../utilidades/permissoes.js";
import { descreverSessao } from "../utilidades/turnos.js";
import Icone from "./Icone.jsx";

/* A barra do topo: a marca (white-label) e quem está logado.
   Só INFORMA: os botões (tema, supervisão, conta) ficam na barra de ícones */
export default function TopoApp() {
  const { estado } = useEstado();
  const atendente = buscarPorId(estado.atendentes, estado.atendenteLogadoId);
  // De onde você entrou: "Estação 01 · Turno da manhã" (ou o papel, nas contas pessoais)
  const onde = descreverSessao(estado.sessao, estado) || PAPEIS[papelDe(estado, estado.atendenteLogadoId)];

  return (
    <header className="topo-app">
      <div className="topo-app__esquerda">
        {/* O nome vem do estado: quando a empresa trocar, muda aqui sozinho */}
        <span className="topo-app__logo">
          <Icone nome="logo" />
          {/* span próprio: assim só o TEXTO ganha reticências quando não cabe */}
          <span className="topo-app__nome">{estado.marca.nome}</span>
        </span>
      </div>

      {atendente && (
        <p className="topo-app__sessao">
          <strong>{atendente.nome}</strong>
          <span> · {onde}</span>
        </p>
      )}
    </header>
  );
}
