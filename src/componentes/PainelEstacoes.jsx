import { useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { puxarEstacao, soltarEstacao } from "../api.js";
import { buscarPorId } from "../utilidades/conversas.js";
import { formatarNumero, normalizar } from "../utilidades/texto.js";
import Icone from "./Icone.jsx";

/* ESTAÇÕES: a "rendição".
   Quem cobre o intervalo de outra estação (ou fica com 3 ou 4 no fim de
   semana) marca aqui as estações que vai atender. As conversas delas
   entram na SUA lista, cada uma com o selo da estação (E02...).

   Tudo manual, sem cronômetro: puxou, fica com você até desmarcar
   ou sair do sistema. Quem guarda isso é o SERVIDOR (tabela "puxadas").

   São dezenas de estações: por isso a busca, e as que estão com você
   aparecem primeiro */
export default function PainelEstacoes({ aoFechar }) {
  const { estado, despachar, recarregar } = useEstado();
  const { sessao } = estado;
  // A estação que está mudando agora (desliga a caixinha até o servidor responder)
  const [mudando, setMudando] = useState(null);
  const [busca, setBusca] = useState("");

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

  const comigo = (estacao) =>
    estacao.id === sessao?.estacaoId || (estacao.puxadaPor || []).includes(estado.atendenteLogadoId);

  /* A lista na ordem de uso: a sua estação, depois as que você puxou,
     depois as outras (por nome). E só as que combinam com a busca */
  const termo = normalizar(busca);
  const lista = estado.estacoes
    .filter((e) => !termo || normalizar(`${e.nome} ${e.sigla}`).includes(termo))
    .sort((a, b) => {
      const peso = (e) => (e.id === sessao?.estacaoId ? 0 : comigo(e) ? 1 : 2);
      return peso(a) - peso(b) || a.nome.localeCompare(b.nome, "pt-BR", { numeric: true });
    });
  const quantasComigo = estado.estacoes.filter(comigo).length;

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
        do sistema, elas são soltas.{" "}
        <strong>{quantasComigo === 1 ? "1 estação" : `${quantasComigo} estações`} com você.</strong>
      </p>

      <div className="busca">
        <label htmlFor="campo-busca-estacoes" className="visualmente-oculto">
          Buscar estação
        </label>
        <span className="busca__icone">
          <Icone nome="buscar" />
        </span>
        <input
          type="search"
          id="campo-busca-estacoes"
          placeholder="Buscar estação pelo nome ou sigla"
          autoComplete="off"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
        />
      </div>

      <ul className="lista-contatos">
        {lista.length === 0 && <li className="lista-vazia">Nenhuma estação encontrada para &quot;{busca}&quot;</li>}
        {lista.map((estacao) => {
          const minha = estacao.id === sessao?.estacaoId;
          // Outras pessoas (estações) que também puxaram esta
          const outros = (estacao.puxadaPor || [])
            .filter((id) => id !== estado.atendenteLogadoId)
            .map((id) => buscarPorId(estado.atendentes, id)?.nome)
            .filter(Boolean);
          // O número só chega para as estações que você atende (o servidor não manda o das outras)
          const linha = estado.linhas.find((l) => l.estacaoId === estacao.id);

          return (
            <li key={estacao.id} className={`estacao${comigo(estacao) ? " estacao--comigo" : ""}`}>
              {/* <label> em volta: clicar em qualquer lugar da linha marca a caixinha */}
              <label className="estacao__rotulo">
                <input
                  type="checkbox"
                  checked={comigo(estacao)}
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
                  {linha && <span className="estacao__detalhe">{formatarNumero(linha.numero)}</span>}
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
