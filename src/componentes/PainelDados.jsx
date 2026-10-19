import { useEffect } from "react";
import { useEstado } from "../estado/useEstado.js";
import { buscarPorId, nomeDaConversa } from "../utilidades/conversas.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";

/* Coluna da direita: os dados do contato (ou do grupo) da conversa aberta.
   Só existe enquanto estado.painelDadosAberto for true (quem decide é o App) */
export default function PainelDados({ conversa }) {
  const { estado, despachar } = useEstado();
  const fechar = () => despachar({ tipo: "fecharDados" });

  /* Esc fecha o PAINEL primeiro (e não a conversa inteira).
     Fase de captura + stopPropagation: chegamos antes do Esc do chat */
  useEffect(() => {
    function aoApertarTecla(evento) {
      if (evento.key !== "Escape" || document.querySelector("dialog[open]")) return;
      evento.stopPropagation();
      despachar({ tipo: "fecharDados" });
    }
    document.addEventListener("keydown", aoApertarTecla, true);
    return () => document.removeEventListener("keydown", aoApertarTecla, true);
  }, [despachar]);

  const grupo = conversa.tipo === "grupo";
  const nome = nomeDaConversa(conversa, estado.contatos);
  const contato = grupo ? null : buscarPorId(estado.contatos, conversa.contatoId);
  const atendente = buscarPorId(estado.atendentes, conversa.atendenteId);
  const titulo = grupo ? "Dados do grupo" : "Dados do contato";

  return (
    <aside className="painel-dados" aria-label={titulo}>
      <div className="painel-dados__topo">
        <button type="button" id="botao-fechar-dados" aria-label={`Fechar ${titulo.toLowerCase()}`} onClick={fechar} autoFocus>
          <Icone nome="fechar" />
        </button>
        <h2>{titulo}</h2>
      </div>

      <div className="painel-dados__conteudo">
        <Avatar nome={nome} grupo={grupo} />
        <h3 className="painel-dados__nome">{nome}</h3>

        {grupo ? (
          <div className="dado">
            <div className="dado__rotulo">{conversa.participantes.length} participantes</div>
            <ul className="dado__lista">
              {conversa.participantes.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ) : (
          contato && (
            <>
              <Dado rotulo="Número" valor={contato.numero} />
              {/* Só mostra o que estiver preenchido: nada de campos vazios na tela */}
              <Dado rotulo="E-mail" valor={contato.email} />
              <Dado rotulo="Empresa" valor={contato.empresa} />
              <Dado rotulo="Observação" valor={contato.observacao} />
              {contato.salvo === false && <Dado rotulo="Situação" valor="Número não salvo nos contatos" />}
            </>
          )
        )}

        <Dado rotulo="Atendente responsável" valor={atendente ? atendente.nome : "Sem atendente"} />
      </div>
    </aside>
  );
}

/* Uma linha do painel: rótulo pequeno em cima, valor embaixo.
   Sem valor, não desenha nada (devolver null = "nada na tela") */
function Dado({ rotulo, valor }) {
  if (!valor) return null;
  return (
    <div className="dado">
      <div className="dado__rotulo">{rotulo}</div>
      <div className="dado__valor">{valor}</div>
    </div>
  );
}
