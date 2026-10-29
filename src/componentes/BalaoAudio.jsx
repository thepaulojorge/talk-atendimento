import { usePlayer } from "../audio/usePlayer.js";
import { formatarDuracao } from "../utilidades/texto.js";
import Icone from "./Icone.jsx";

/* O conteúdo de uma mensagem de áudio: ▶/⏸, barra e tempo.
   Separado da Mensagem de propósito: só ESTE componente "escuta" o player,
   então só ele é redesenhado enquanto o áudio toca */
export default function BalaoAudio({ msg }) {
  const { tocandoId, tocando, tempo, duracaoDoArquivo, tocarOuPausar, avancar } = usePlayer();

  const ehOAtual = tocandoId === msg.id;
  // Sem duração salva (áudio do WhatsApp)? Usa a que o player leu do arquivo
  const duracao = msg.duracao || (ehOAtual ? duracaoDoArquivo : 0);
  const progresso = ehOAtual && duracao ? Math.min(100, (tempo / duracao) * 100) : 0;
  const tempoNaTela = ehOAtual ? Math.floor(tempo) : duracao;

  function aoClicarNaBarra(evento) {
    // currentTarget = o elemento que tem o onClick (a barra), não um filho dela
    const caixa = evento.currentTarget.getBoundingClientRect();
    avancar(msg, (evento.clientX - caixa.left) / caixa.width);
  }

  return (
    <div className="audio">
      <button
        type="button"
        className="audio__play"
        aria-label={ehOAtual && tocando ? "Pausar áudio" : "Reproduzir áudio"}
        onClick={() => tocarOuPausar(msg)}
      >
        <Icone nome={ehOAtual && tocando ? "pausar" : "tocar"} />
      </button>
      <div className="audio__barra" title="Clique para avançar ou voltar" onClick={aoClicarNaBarra}>
        <div className="audio__progresso" style={{ width: `${progresso}%` }} />
      </div>
      <span className="audio__duracao">{formatarDuracao(tempoNaTela)}</span>
    </div>
  );
}
