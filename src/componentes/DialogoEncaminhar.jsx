import { useEffect, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { buscarPorId, nomeDaConversa, ordenarConversas, resumoDaMensagem } from "../utilidades/conversas.js";
import { normalizar } from "../utilidades/texto.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";

/* Janela "Encaminhar para...": escolher a conversa de destino.
   Props: msg (a mensagem a encaminhar), aoEscolher(conversaId), aoFechar */
export default function DialogoEncaminhar({ msg, aoEscolher, aoFechar }) {
  const { estado } = useEstado();
  const dialogo = useRef(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!dialogo.current.open) dialogo.current.showModal();
  }, []);

  // Destinos: as conversas que aparecem na lista (não arquivadas, com mensagens)
  const termo = normalizar(busca);
  const destinos = ordenarConversas(
    estado.conversas.filter(
      (c) =>
        !c.arquivada &&
        c.mensagens.length > 0 &&
        (!termo || normalizar(nomeDaConversa(c, estado.contatos)).includes(termo))
    )
  );

  function escolher(conversaId) {
    aoEscolher(conversaId);
    dialogo.current.close(); // dispara o "close", que chama o aoFechar
  }

  function detalheDe(conversa) {
    if (conversa.tipo === "grupo") return `Grupo · ${conversa.participantes.length} participantes`;
    return buscarPorId(estado.contatos, conversa.contatoId)?.numero || "";
  }

  return (
    <dialog className="confirmacao dialogo-encaminhar" ref={dialogo} onClose={aoFechar} aria-labelledby="titulo-encaminhar">
      <h2 className="confirmacao__titulo" id="titulo-encaminhar">
        Encaminhar para…
      </h2>
      {/* O que vai ser encaminhado, para não ter dúvida */}
      <p className="dialogo-encaminhar__previa">{resumoDaMensagem(msg)}</p>

      <div className="busca">
        <label htmlFor="busca-encaminhar" className="visualmente-oculto">
          Buscar conversa
        </label>
        <span className="busca__icone">
          <Icone nome="buscar" />
        </span>
        <input
          type="search"
          id="busca-encaminhar"
          placeholder="Buscar conversa"
          autoComplete="off"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          // Enter escolhe o primeiro resultado (sem fechar pelo form)
          onKeyDown={(evento) => {
            if (evento.key === "Enter" && destinos.length > 0) {
              evento.preventDefault();
              escolher(destinos[0].id);
            }
          }}
        />
      </div>

      <ul className="lista-contatos dialogo-encaminhar__lista">
        {destinos.length === 0 && <li className="lista-vazia">Nenhuma conversa encontrada</li>}
        {destinos.map((conversa) => {
          const nome = nomeDaConversa(conversa, estado.contatos);
          return (
            <li key={conversa.id}>
              {/* <button>: clicável e acessível pelo teclado sem código extra */}
              <button type="button" className="contato" onClick={() => escolher(conversa.id)}>
                <Avatar nome={nome} grupo={conversa.tipo === "grupo"} />
                <div className="contato__info">
                  <div className="contato__nome">{nome}</div>
                  <div className="contato__numero">{detalheDe(conversa)}</div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="confirmacao__botoes">
        <button type="button" onClick={() => dialogo.current.close()}>
          Cancelar
        </button>
      </div>
    </dialog>
  );
}
