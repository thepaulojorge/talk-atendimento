import { useEffect, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { nomeDaConversa } from "../utilidades/conversas.js";
import { normalizar } from "../utilidades/texto.js";
import Icone from "./Icone.jsx";

/* Janela "Etiquetas": marcar e desmarcar as etiquetas de uma conversa
   e renomear as personalizáveis (as que têm o ✏️).
   Cada clique já salva; o botão "Concluir" só fecha a janela.
   Props: conversa, aoFechar */
export default function DialogoEtiquetas({ conversa, aoFechar }) {
  const { estado, despachar } = useEstado();
  const dialogo = useRef(null);

  // Renomear: qual etiqueta está em edição, o texto do campo e o erro (se houver)
  const [editandoId, setEditandoId] = useState(null);
  const [nomeNovo, setNomeNovo] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!dialogo.current.open) dialogo.current.showModal();
  }, []);

  function comecarEdicao(etiqueta) {
    setEditandoId(etiqueta.id);
    setNomeNovo(etiqueta.nome);
    setErro("");
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setErro("");
  }

  function salvarNome() {
    if (!editandoId) return; // Enter salvou e o "blur" veio logo depois: ignora
    const nome = nomeNovo.trim();

    // O erro aparece DENTRO da janela: o aviso flutuante ficaria atrás dela
    if (!nome) return setErro("O nome não pode ficar vazio.");
    const repetida = estado.etiquetas.some((e) => e.id !== editandoId && normalizar(e.nome) === normalizar(nome));
    if (repetida) return setErro(`Já existe uma etiqueta chamada "${nome}".`);

    despachar({ tipo: "renomearEtiqueta", id: editandoId, nome });
    cancelarEdicao();
  }

  function aoApertarTecla(evento) {
    if (evento.key === "Enter") {
      evento.preventDefault(); // Enter num form enviaria e fecharia a janela
      salvarNome();
    }
  }

  /* Esc dispara o evento "cancel" do <dialog> (que fecharia a janela).
     Com um nome em edição, o Esc cancela SÓ a edição */
  function aoCancelarDialogo(evento) {
    if (editandoId) {
      evento.preventDefault();
      cancelarEdicao();
    }
  }

  const marcadas = conversa.etiquetas || [];

  return (
    <dialog className="confirmacao" ref={dialogo} onClose={aoFechar} onCancel={aoCancelarDialogo}>
      <form method="dialog">
        <h2 className="confirmacao__titulo">Etiquetas</h2>
        <p className="confirmacao__texto">Conversa com {nomeDaConversa(conversa, estado.contatos)}</p>

        <div className="etiquetas__lista">
          {estado.etiquetas.map((etiqueta) => (
            <div key={etiqueta.id} className="etiquetas__linha">
              {/* <label> em volta do checkbox: clicar no texto também marca */}
              <label>
                <input
                  type="checkbox"
                  checked={marcadas.includes(etiqueta.id)}
                  onChange={() => despachar({ tipo: "alternarEtiqueta", conversaId: conversa.id, etiquetaId: etiqueta.id })}
                />
                {editandoId === etiqueta.id ? (
                  <input
                    type="text"
                    className="etiquetas__input"
                    style={{ "--cor-etiqueta": etiqueta.cor }}
                    aria-label="Novo nome da etiqueta"
                    maxLength={20} // etiqueta é curta por natureza
                    value={nomeNovo}
                    onChange={(evento) => setNomeNovo(evento.target.value)}
                    onKeyDown={aoApertarTecla}
                    // Clicou fora do campo: salva (igual a renomear arquivo no computador)
                    onBlur={salvarNome}
                    // Já chega com o texto selecionado: é só digitar por cima
                    onFocus={(evento) => evento.target.select()}
                    autoFocus
                  />
                ) : (
                  <span className="etiqueta" style={{ "--cor-etiqueta": etiqueta.cor }}>
                    {etiqueta.nome}
                  </span>
                )}
              </label>

              {/* O ✏️ fica FORA do <label>: senão clicar nele também marcaria a caixa.
                  type="button": não envia o form (que fecharia a janela) */}
              {etiqueta.editavel && editandoId !== etiqueta.id && (
                <button
                  type="button"
                  className="etiquetas__editar"
                  aria-label={`Renomear etiqueta ${etiqueta.nome}`}
                  onClick={() => comecarEdicao(etiqueta)}
                >
                  <Icone nome="lapis" />
                </button>
              )}
            </div>
          ))}
        </div>

        {erro && (
          <p className="etiquetas__erro" role="alert">
            {erro}
          </p>
        )}

        <div className="confirmacao__botoes">
          <button type="submit" value="ok" className="confirmacao__ok">
            Concluir
          </button>
        </div>
      </form>
    </dialog>
  );
}
