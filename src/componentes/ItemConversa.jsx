import { useEstado } from "../estado/useEstado.js";
import { useMenuDeContexto } from "../hooks/useMenuDeContexto.js";
import {
  buscarPorId,
  contarNaoLidas,
  estaResolvida,
  nomeDaConversa,
  ultimaMensagem,
} from "../utilidades/conversas.js";
import { previaParaLista } from "../utilidades/filtros.js";
import { formatarHoraLista } from "../utilidades/datas.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";

/* Uma conversa na lista. Compare com a antiga criarItemConversa():
   a lógica é a mesma, mas o HTML aparece escrito do jeito que vai ficar */
/* Props novas: termoBusca (para a prévia com 🔍) e os avisos de mouse,
   que o painel usa para o cartão de prévia */
export default function ItemConversa({ conversa, termoBusca = "", selecionada, aoEntrarMouse, aoSairMouse, aoAbrirMenu }) {
  const { estado, despachar } = useEstado();
  // O mesmo hook das mensagens: botão direito ou dedo pressionado
  const eventosMenu = useMenuDeContexto((posicao) => aoAbrirMenu?.(conversa.id, posicao));

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
    selecionada && "conversa--selecionada",
  ]
    .filter(Boolean)
    .join(" ");

  /* Selos: o status primeiro; com status na linha, sobra espaço para só 1 etiqueta */
  const etiquetas = (conversa.etiquetas || []).map((id) => buscarPorId(estado.etiquetas, id)).filter(Boolean);
  const temStatus = resolvida || !conversa.atendenteId;
  const cabem = temStatus ? 1 : 2;

  /* Atendendo mais de uma linha? Cada conversa mostra de qual estação é
     ("E02"), para não responder pelo número errado */
  const linha = estado.linhas.length > 1 ? buscarPorId(estado.linhas, conversa.linhaId) : null;

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
    <li
      className={classes}
      tabIndex={0}
      onClick={abrir}
      onKeyDown={aoApertarTecla}
      /* onMouseEnter só dispara ao ENTRAR no item (não a cada filho, como o
         "mouseover" da versão antiga). evento.currentTarget = o próprio <li> */
      onMouseEnter={(evento) => aoEntrarMouse?.(conversa.id, evento.currentTarget)}
      onMouseLeave={aoSairMouse}
      {...eventosMenu}
    >
      <Avatar nome={nome} grupo={conversa.tipo === "grupo"} />

      <div className="conversa__info">
        <div className="conversa__nome">{nome}</div>
        {/* {} no JSX = "aqui entra um valor do JavaScript". O texto é
            colocado como TEXTO, nunca como HTML: o React já protege contra XSS */}
        <div className="conversa__previa">{previaParaLista(conversa, estado, termoBusca)}</div>

        {(linha || temStatus || etiquetas.length > 0) && (
          <div className="conversa__etiquetas">
            {linha && (
              <span className="selo selo--linha" title={`Linha ${linha.nome}`}>
                {linha.sigla}
              </span>
            )}
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
