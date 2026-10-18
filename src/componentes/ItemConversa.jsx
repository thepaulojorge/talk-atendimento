import { useEstado } from "../estado/useEstado.js";
import {
  buscarPorId,
  contarNaoLidas,
  estaResolvida,
  nomeDaConversa,
  textoPrevia,
  ultimaMensagem,
} from "../utilidades/conversas.js";
import { formatarHoraLista } from "../utilidades/datas.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";

/* Uma conversa na lista. Compare com a antiga criarItemConversa():
   a lógica é a mesma, mas o HTML aparece escrito do jeito que vai ficar */
export default function ItemConversa({ conversa }) {
  const { estado, despachar } = useEstado();

  const nome = nomeDaConversa(conversa, estado.contatos);
  const naoLidas = contarNaoLidas(conversa);
  const msg = ultimaMensagem(conversa);
  const resolvida = estaResolvida(conversa);

  // Classes conforme a situação (mesmas regras de antes)
  const classes = [
    "conversa",
    naoLidas > 0 && "conversa--nao-lida",
    naoLidas === 0 && conversa.marcadaNaoLida && "conversa--marcada",
    conversa.id === estado.conversaAbertaId && "conversa--ativa",
    resolvida && "conversa--resolvida",
  ]
    .filter(Boolean)
    .join(" ");

  /* Selos: o status primeiro; com status na linha, sobra espaço para só 1 etiqueta */
  const etiquetas = (conversa.etiquetas || []).map((id) => buscarPorId(estado.etiquetas, id)).filter(Boolean);
  const temStatus = resolvida || !conversa.atendenteId;
  const cabem = temStatus ? 1 : 2;

  // Antes: um ouvinte na LISTA inteira (delegação). No React, cada item
  // tem o próprio onClick, e o React cuida da eficiência por baixo
  function abrir() {
    despachar({ tipo: "abrirConversa", id: conversa.id });
  }

  function aoApertarTecla(evento) {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      abrir();
    }
  }

  return (
    <li className={classes} tabIndex={0} onClick={abrir} onKeyDown={aoApertarTecla}>
      <Avatar nome={nome} grupo={conversa.tipo === "grupo"} />

      <div className="conversa__info">
        <div className="conversa__nome">{nome}</div>
        {/* {} no JSX = "aqui entra um valor do JavaScript". O texto é
            colocado como TEXTO, nunca como HTML: o React já protege contra XSS */}
        <div className="conversa__previa">{textoPrevia(conversa, estado)}</div>

        {(temStatus || etiquetas.length > 0) && (
          <div className="conversa__etiquetas">
            {resolvida && <span className="selo selo--resolvida">✓ Resolvida</span>}
            {!resolvida && !conversa.atendenteId && <span className="selo">Sem atendente</span>}

            {/* .map() transforma cada etiqueta num <span>. A "key" é um
                identificador único: ajuda o React a saber qual item é qual
                quando a lista muda */}
            {etiquetas.slice(0, cabem).map((etiqueta) => (
              <span key={etiqueta.id} className="etiqueta" style={{ "--cor-etiqueta": etiqueta.cor }}>
                {etiqueta.nome}
              </span>
            ))}
            {etiquetas.length > cabem && <span className="selo selo--mais">+{etiquetas.length - cabem}</span>}
          </div>
        )}
      </div>

      <div className="conversa__lado">
        <span className="conversa__hora">{msg ? formatarHoraLista(msg.horario) : ""}</span>
        <div className="conversa__indicadores">
          {conversa.fixadaEm && <Icone nome="pino" className="conversa__fixada" />}
          {/* Operador ternário: "condição ? isto : aquilo" */}
          {naoLidas > 0 ? (
            <span className="conversa__badge" aria-label={`${naoLidas} mensagens não lidas`}>
              {naoLidas}
            </span>
          ) : (
            conversa.marcadaNaoLida && <span className="conversa__ponto" aria-label="Marcada como não lida" />
          )}
        </div>
      </div>
    </li>
  );
}
