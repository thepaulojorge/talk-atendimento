import { useEffect, useRef } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { baixarArquivo } from "../utilidades/arquivos.js";
import Icone from "./Icone.jsx";

/* A foto em tamanho grande, POR CIMA da conversa (como no WhatsApp Web).
   É um <dialog> nativo, como as outras janelas do app: o Esc fecha
   sozinho e o resto da tela fica "travado" enquanto ele está aberto.

   Props: arquivo ({ id, nome }), endereco (o "blob:" já carregado), aoFechar */
export default function VisualizadorFoto({ arquivo, endereco, aoFechar }) {
  const { estado, despachar } = useEstado();
  const dialogo = useRef(null);

  useEffect(() => {
    if (!dialogo.current.open) dialogo.current.showModal();
  }, []);

  /* Clicar no fundo escuro fecha. O clique no fundo "acerta" o próprio
     <dialog>; o clique na foto ou nos botões acerta outro elemento */
  function aoClicar(evento) {
    if (evento.target === evento.currentTarget) dialogo.current.close();
  }

  async function baixar() {
    try {
      await baixarArquivo(estado.sessao?.token, arquivo);
    } catch (erro) {
      avisar(despachar, erro.message);
    }
  }

  return (
    <dialog className="visualizador" ref={dialogo} onClose={aoFechar} onClick={aoClicar} aria-label={arquivo.nome}>
      <div className="visualizador__topo">
        <span className="visualizador__nome">{arquivo.nome}</span>
        <button type="button" aria-label="Baixar foto" title="Baixar" onClick={baixar}>
          <Icone nome="download" />
        </button>
        <button type="button" aria-label="Fechar" title="Fechar (Esc)" onClick={() => dialogo.current.close()}>
          <Icone nome="fechar" />
        </button>
      </div>
      {/* Clicar na própria foto também fecha (no celular, é o gesto natural) */}
      <img className="visualizador__foto" src={endereco} alt={arquivo.nome} onClick={() => dialogo.current.close()} />
    </dialog>
  );
}
