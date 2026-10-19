import { useEffect, useRef } from "react";
import { useEstado } from "../estado/useEstado.js";
import Avatar from "./Avatar.jsx";

/* Janela "Transferir conversa": um botão por atendente.
   Props: conversa, aoEscolher(destinoId ou null), aoFechar

   Mesmo truque do DialogoConfirmacao: cada botão tem um "value", que vira
   o returnValue do <dialog> quando ele fecha. Sem nenhum useState! */
export default function DialogoTransferir({ conversa, aoEscolher, aoFechar }) {
  const { estado } = useEstado();
  const dialogo = useRef(null);

  useEffect(() => {
    if (!dialogo.current.open) dialogo.current.showModal();
  }, []);

  function aoFecharDialogo() {
    const escolha = dialogo.current.returnValue;
    // Esc ou "Cancelar": returnValue vazio ou "cancelar"
    if (escolha && escolha !== "cancelar") aoEscolher(escolha === "fila" ? null : escolha);
    aoFechar();
  }

  // Todos, menos o responsável atual. A diretoria acompanha, mas não recebe conversas
  const destinos = estado.atendentes.filter((a) => a.id !== conversa.atendenteId && a.papel !== "diretoria");

  return (
    <dialog className="confirmacao" ref={dialogo} onClose={aoFecharDialogo}>
      <form method="dialog">
        <h2 className="confirmacao__titulo">Transferir conversa</h2>
        <p className="confirmacao__texto">Quem vai continuar este atendimento?</p>

        <div className="transferir__lista">
          {destinos.map((atendente) => (
            <button key={atendente.id} type="submit" value={atendente.id}>
              <Avatar nome={atendente.nome} />
              <span>
                {atendente.nome}
                {atendente.id === estado.atendenteLogadoId && " (você)"}
              </span>
            </button>
          ))}

          {/* Devolver para a fila só faz sentido se a conversa tem alguém */}
          {conversa.atendenteId && (
            <button type="submit" value="fila" className="transferir__fila">
              <span className="avatar" aria-hidden="true">
                ⟲
              </span>
              <span>Devolver para a fila (sem atendente)</span>
            </button>
          )}
        </div>

        <div className="confirmacao__botoes">
          <button type="submit" value="cancelar">
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
