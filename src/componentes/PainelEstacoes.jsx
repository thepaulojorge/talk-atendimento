import { useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { puxarEstacao, soltarEstacao } from "../api.js";
import { buscarPorId } from "../utilidades/conversas.js";
import { formatarNumero } from "../utilidades/texto.js";
import { turnoDe } from "../utilidades/turnos.js";
import Icone from "./Icone.jsx";

/* ESTAÇÕES: a "rendição".
   Quem cobre o intervalo de outra estação (ou fica com 3 ou 4 no fim de
   semana) marca aqui as estações que vai atender. As conversas delas
   entram na SUA lista, cada uma com o selo da estação (E02...).

   Tudo manual, sem cronômetro: puxou, fica com você até desmarcar
   ou sair do sistema. Quem guarda isso é o SERVIDOR (tabela "puxadas") */
export default function PainelEstacoes({ aoFechar }) {
  const { estado, despachar, recarregar } = useEstado();
  const { sessao } = estado;
  // A estação que está mudando agora (desliga a caixinha até o servidor responder)
  const [mudando, setMudando] = useState(null);

  /* O turno de AGORA, para mostrar quem está escalado em cada estação.
     new Date() muda a cada chamada, então não pode ir direto no corpo do
     componente: no useState com função, é calculado UMA vez, ao abrir */
  const [turnoAgora] = useState(() => turnoDe(new Date())?.id);

  async function alternar(estacao, puxar) {
    setMudando(estacao.id);
    try {
      if (puxar) await puxarEstacao(sessao.token, estacao.id);
      else await soltarEstacao(sessao.token, estacao.id);
      await recarregar(); // busca de novo: as conversas da estação entram (ou saem)
      avisar(despachar, puxar ? `${estacao.nome} está com você` : `Você soltou a ${estacao.nome}`);
    } catch (erro) {
      avisar(despachar, erro.message);
    } finally {
      setMudando(null);
    }
  }

  function aoApertarTecla(evento) {
    if (evento.key === "Escape") {
      evento.stopPropagation();
      aoFechar();
    }
  }

  return (
    <section className="painel-contatos painel-estacoes" aria-label="Estações" onKeyDown={aoApertarTecla}>
      <div className="painel-contatos__topo">
        <button type="button" aria-label="Voltar para conversas" onClick={aoFechar}>
          <Icone nome="voltar" />
        </button>
        <h2>Estações</h2>
      </div>

      <p className="painel-estacoes__dica">
        Marque as estações que você vai cobrir. As conversas delas aparecem na sua lista, com o selo da estação. Ao sair
        do sistema, elas são soltas.
      </p>

      <ul className="lista-contatos">
        {estado.estacoes.map((estacao) => {
          const minha = estacao.id === sessao?.estacaoId;
          const puxadaPor = estacao.puxadaPor || [];
          const comigo = minha || puxadaPor.includes(estado.atendenteLogadoId);
          // Outras pessoas que também puxaram esta estação
          const outros = puxadaPor
            .filter((id) => id !== estado.atendenteLogadoId)
            .map((id) => buscarPorId(estado.atendentes, id)?.nome)
            .filter(Boolean);
          const escalado = buscarPorId(estado.atendentes, estacao.escala?.[turnoAgora])?.nome;
          const linha = estado.linhas.find((l) => l.estacaoId === estacao.id);

          return (
            <li key={estacao.id} className={`estacao${comigo ? " estacao--comigo" : ""}`}>
              {/* <label> em volta: clicar em qualquer lugar da linha marca a caixinha */}
              <label className="estacao__rotulo">
                <input
                  type="checkbox"
                  checked={comigo}
                  // A sua estação não dá para soltar: é por ela que você entrou
                  disabled={minha || mudando !== null}
                  onChange={(evento) => alternar(estacao, evento.target.checked)}
                />
                <span className="estacao__sigla">{estacao.sigla}</span>
                <span className="estacao__info">
                  <span className="estacao__nome">
                    {estacao.nome}
                    {minha && <span className="selo">Sua estação</span>}
                    {mudando === estacao.id && <span className="estacao__esperando">Atualizando…</span>}
                  </span>
                  <span className="estacao__detalhe">
                    {escalado ? `Escala agora: ${escalado}` : "Ninguém na escala agora"}
                    {/* A linha só chega para quem atende a estação; para as outras, o servidor não manda o número */}
                    {linha && ` · ${formatarNumero(linha.numero)}`}
                  </span>
                  {outros.length > 0 && <span className="estacao__outros">Também com: {outros.join(", ")}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
