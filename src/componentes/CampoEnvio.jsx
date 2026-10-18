import { useEffect, useRef, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { nomeDoAutor, preencherModelo, resumoDaMensagem } from "../utilidades/conversas.js";
import { normalizar } from "../utilidades/texto.js";
import { useTelaEstreita } from "../hooks/useTelaEstreita.js";
import { Citacao } from "./Mensagem.jsx";
import Icone from "./Icone.jsx";

/* O campo de mensagem, com:
   - rascunho por conversa (o texto fica no estado global, em "rascunhos")
   - respostas rápidas com "/"
   - barra "Respondendo a..." quando há citação */
export default function CampoEnvio({ conversa, respondendoA, aoCancelarCitacao }) {
  const { estado, despachar } = useEstado();
  const estreita = useTelaEstreita();
  const campo = useRef(null);

  /* "Componente controlado": o valor do <input> vem do ESTADO, e cada letra
     digitada atualiza o estado. O React é a única "fonte da verdade" */
  const texto = estado.rascunhos[conversa.id] ?? "";

  // Estado LOCAL: só este componente precisa saber disso
  const [sugestaoAtiva, setSugestaoAtiva] = useState(0);
  const [sugestoesFechadas, setSugestoesFechadas] = useState(false);

  /* VALOR DERIVADO: as sugestões não ficam guardadas em lugar nenhum.
     São CALCULADAS a partir do texto, a cada renderização. Guardar algo
     que dá para calcular é pedir para a tela ficar fora de sincronia */
  const procurandoAtalho = texto.startsWith("/") && !texto.includes(" ") && !sugestoesFechadas;
  const termo = normalizar(texto.slice(1));
  const sugestoes = procurandoAtalho
    ? estado.respostasRapidas.filter(
        (r) => normalizar(r.atalho).includes(termo) || normalizar(r.texto).includes(termo)
      )
    : [];
  const ativa = Math.min(sugestaoAtiva, Math.max(sugestoes.length - 1, 0));

  // Começou a responder uma mensagem: o cursor vai para o campo
  useEffect(() => {
    if (respondendoA) campo.current?.focus();
  }, [respondendoA]);

  function mudarTexto(novo) {
    despachar({ tipo: "definirRascunho", conversaId: conversa.id, texto: novo });
    setSugestaoAtiva(0);
    setSugestoesFechadas(false);
  }

  function escolherSugestao(resposta) {
    mudarTexto(preencherModelo(resposta.texto, conversa, estado));
    setSugestoesFechadas(true);
    campo.current?.focus();
  }

  function enviar(evento) {
    evento.preventDefault(); // sem isso o form recarregaria a página
    const conteudo = texto.trim();
    if (!conteudo) return;

    // Id e horário nascem AQUI (o reducer precisa ser puro)
    const id = `m${Date.now()}`;
    despachar({
      tipo: "enviarMensagem",
      conversaId: conversa.id,
      id,
      agora: new Date().toISOString(),
      texto: conteudo,
      respostaA: respondendoA?.id,
    });
    aoCancelarCitacao();

    /* ⚠️ SIMULAÇÃO: finge que o cliente leu 3 segundos depois.
       Com o backend, quem avisa a leitura é o WhatsApp */
    const conversaId = conversa.id;
    setTimeout(() => despachar({ tipo: "mensagemLida", conversaId, mensagemId: id }), 3000);
  }

  function aoApertarTecla(evento) {
    if (sugestoes.length > 0) {
      if (evento.key === "ArrowDown") {
        evento.preventDefault();
        setSugestaoAtiva((ativa + 1) % sugestoes.length); // depois da última, volta à primeira
        return;
      }
      if (evento.key === "ArrowUp") {
        evento.preventDefault();
        setSugestaoAtiva((ativa - 1 + sugestoes.length) % sugestoes.length);
        return;
      }
      if (evento.key === "Enter" || evento.key === "Tab") {
        evento.preventDefault(); // Enter escolhe a sugestão em vez de enviar
        escolherSugestao(sugestoes[ativa]);
        return;
      }
    }

    if (evento.key === "Escape") {
      /* stopPropagation: o Esc foi "usado" aqui e não sobe até o document
         (lá em cima, ele fecharia a conversa) */
      if (procurandoAtalho) {
        evento.stopPropagation();
        setSugestoesFechadas(true);
      } else if (respondendoA) {
        evento.stopPropagation();
        aoCancelarCitacao();
      }
      // Sem nada para cancelar, o Esc sobe e fecha a conversa (o rascunho fica salvo)
    }
  }

  const temTexto = texto.trim() !== "";

  return (
    <>
      {respondendoA && (
        <div className="citacao-envio">
          <Citacao
            autor={nomeDoAutor(respondendoA, conversa, estado)}
            texto={resumoDaMensagem(respondendoA)}
          />
          <button type="button" className="botao-cancelar-citacao" aria-label="Cancelar resposta" onClick={aoCancelarCitacao}>
            <Icone nome="fechar" />
          </button>
        </div>
      )}

      {procurandoAtalho && (
        <ul className="sugestoes" role="listbox" aria-label="Respostas rápidas">
          {sugestoes.length === 0 && <li className="lista-vazia">Nenhuma resposta rápida com esse atalho</li>}
          {sugestoes.map((resposta, indice) => (
            <li
              key={resposta.atalho}
              role="option"
              aria-selected={indice === ativa}
              className={`sugestao${indice === ativa ? " sugestao--ativa" : ""}`}
              // onMouseDown em vez de onClick: o clique não tira o foco do campo
              onMouseDown={(evento) => {
                evento.preventDefault();
                escolherSugestao(resposta);
              }}
            >
              <span className="sugestao__atalho">/{resposta.atalho}</span>
              <span className="sugestao__texto">{preencherModelo(resposta.texto, conversa, estado)}</span>
            </li>
          ))}
        </ul>
      )}

      <form className="chat__envio" onSubmit={enviar}>
        <label htmlFor="campo-mensagem" className="visualmente-oculto">
          Digite uma mensagem
        </label>
        <input
          ref={campo}
          id="campo-mensagem"
          type="text"
          autoComplete="off"
          placeholder={estreita ? "Mensagem ou / atalho" : "Digite uma mensagem ou / para respostas rápidas"}
          value={texto}
          onChange={(evento) => mudarTexto(evento.target.value)}
          onKeyDown={aoApertarTecla}
        />

        {/* Campo vazio: microfone. Com texto: enviar */}
        {temTexto ? (
          <button type="submit" id="botao-enviar" aria-label="Enviar mensagem">
            <Icone nome="enviar" />
          </button>
        ) : (
          <button
            type="button"
            id="botao-audio"
            aria-label="Gravar áudio"
            onClick={() => avisar(despachar, "A gravação de áudio chega na etapa 2b 🎤")}
          >
            <Icone nome="mic" />
          </button>
        )}
      </form>
    </>
  );
}
