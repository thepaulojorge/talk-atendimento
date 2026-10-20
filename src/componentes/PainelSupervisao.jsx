import { useEffect, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { TURNOS } from "../configuracao.js";
import {
  TIPOS_DE_ACAO,
  descricaoDaAcao,
  filtrarRegistros,
  filtrarSemAcao,
  gerarCsv,
  origemDoRegistro,
  paraNomeDeArquivo,
} from "../utilidades/auditoria.js";
import { buscarPorId } from "../utilidades/conversas.js";
import { formatarDia, formatarHoraMensagem } from "../utilidades/datas.js";
import { PAPEIS } from "../utilidades/permissoes.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";

const FILTROS_INICIAIS = { atendente: "", acao: "", periodo: "tudo", estacao: "", turno: "", busca: "" };

/* Painel de supervisão: mensagens editadas e apagadas e conversas excluídas.
   Ocupa o lugar das conversas (quem decide é o App, pela estado.secao) */
export default function PainelSupervisao() {
  const { estado, despachar } = useEstado();

  /* Os 6 filtros num objeto só. Mudar um = copiar o objeto e trocar
     aquela chave: { ...filtros, periodo: "7" } */
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const mudarFiltro = (chave, valor) => setFiltros((atuais) => ({ ...atuais, [chave]: valor }));

  const fechar = () => despachar({ tipo: "irPara", secao: "conversas" });

  // Esc volta às conversas (o painel não tem nada "por cima" para fechar antes)
  useEffect(() => {
    function aoApertarTecla(evento) {
      if (evento.key === "Escape" && !document.activeElement?.matches("input, select")) {
        despachar({ tipo: "irPara", secao: "conversas" });
      }
    }
    document.addEventListener("keydown", aoApertarTecla);
    return () => document.removeEventListener("keydown", aoApertarTecla);
  }, [despachar]);

  // DERIVADOS: calculados a cada renderização, a partir do estado e dos filtros
  const semAcao = filtrarSemAcao(estado, filtros);
  const registros = filtrarRegistros(estado, filtros);

  function exportarCsv() {
    if (registros.length === 0) return avisar(despachar, "Nada para exportar com esses filtros");

    // Cria o arquivo na memória, um link invisível para ele, e "clica" no link
    const arquivo = new Blob([gerarCsv(registros, estado)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(arquivo);
    link.download = `auditoria-${paraNomeDeArquivo(estado.marca.nome)}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href); // libera a memória
    avisar(despachar, `${registros.length} ${registros.length === 1 ? "registro exportado" : "registros exportados"}`);
  }

  return (
    <section className="supervisao" aria-labelledby="supervisao-titulo">
      <header className="supervisao__topo">
        <button type="button" className="supervisao__voltar" aria-label="Voltar às conversas" onClick={fechar}>
          <Icone nome="voltar" />
        </button>
        <div className="supervisao__titulos">
          <h1 id="supervisao-titulo">Supervisão</h1>
          <p>Mensagens editadas e apagadas, e conversas excluídas</p>
        </div>
        <button type="button" className="botao-contorno" onClick={exportarCsv}>
          <Icone nome="download" />
          <span>Exportar CSV</span>
        </button>
      </header>

      {/* Cartões com os totais. Clicar num cartão filtra por aquela ação
          (clicar de novo tira o filtro). aria-pressed: o leitor de tela
          anuncia se o cartão está "ligado" */}
      <div className="supervisao__resumo">
        {Object.entries(TIPOS_DE_ACAO).map(([tipo, rotulo]) => (
          <button
            key={tipo}
            type="button"
            className={`resumo-cartao resumo-cartao--${tipo}`}
            aria-pressed={filtros.acao === tipo}
            onClick={() => mudarFiltro("acao", filtros.acao === tipo ? "" : tipo)}
          >
            <span className="resumo-cartao__numero">{semAcao.filter((r) => r.tipo === tipo).length}</span>
            <span className="resumo-cartao__rotulo">{rotulo}</span>
          </button>
        ))}
      </div>

      <div className="supervisao__filtros">
        <Filtro rotulo="Atendente" valor={filtros.atendente} aoMudar={(v) => mudarFiltro("atendente", v)}>
          <option value="">Todos</option>
          {estado.atendentes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </Filtro>

        <Filtro rotulo="Ação" valor={filtros.acao} aoMudar={(v) => mudarFiltro("acao", v)}>
          <option value="">Todas as ações</option>
          {Object.entries(TIPOS_DE_ACAO).map(([tipo, rotulo]) => (
            <option key={tipo} value={tipo}>
              {rotulo}
            </option>
          ))}
        </Filtro>

        <Filtro rotulo="Período" valor={filtros.periodo} aoMudar={(v) => mudarFiltro("periodo", v)}>
          <option value="tudo">Todo o período</option>
          <option value="hoje">Hoje</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
        </Filtro>

        <Filtro rotulo="Estação" valor={filtros.estacao} aoMudar={(v) => mudarFiltro("estacao", v)}>
          <option value="">Todas</option>
          {estado.estacoes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Filtro>

        <Filtro rotulo="Turno" valor={filtros.turno} aoMudar={(v) => mudarFiltro("turno", v)}>
          <option value="">Todos</option>
          {TURNOS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome} ({t.inicio}h às {t.fim}h)
            </option>
          ))}
        </Filtro>

        <label className="campo-filtro campo-filtro--busca">
          <span>Buscar</span>
          <input
            type="search"
            placeholder="Texto, conversa ou atendente"
            autoComplete="off"
            value={filtros.busca}
            onChange={(evento) => mudarFiltro("busca", evento.target.value)}
          />
        </label>
      </div>

      {/* <ol>: uma lista ORDENADA (da ação mais recente para a mais antiga) */}
      <ol className="supervisao__lista" aria-live="polite">
        {registros.length === 0 ? (
          <li className="lista-vazia">
            {estado.auditoria.length === 0
              ? "Nenhuma edição ou exclusão registrada até agora."
              : "Nenhum registro com esses filtros."}
          </li>
        ) : (
          registros.map((registro) => <Registro key={registro.id} registro={registro} />)
        )}
      </ol>

      <p className="supervisao__nota">
        Protótipo: os registros ficam salvos só neste navegador. Na versão com servidor, eles serão gravados num banco de
        dados onde ninguém consegue alterar ou apagar.
      </p>
    </section>
  );
}

/* Um <select> com rótulo. "children" é o que vem ENTRE as tags:
   <Filtro ...> <option/> <option/> </Filtro>. Assim cada filtro
   escolhe as próprias opções e o componente cuida do resto */
function Filtro({ rotulo, valor, aoMudar, children }) {
  return (
    <label className="campo-filtro">
      <span>{rotulo}</span>
      <select value={valor} onChange={(evento) => aoMudar(evento.target.value)}>
        {children}
      </select>
    </label>
  );
}

/* Um registro: quem, o que fez, quando, onde, e o conteúdo */
function Registro({ registro }) {
  const { estado, despachar } = useEstado();
  const autor = buscarPorId(estado.atendentes, registro.autorId);
  const nomeAutor = autor?.nome || "Atendente removido";
  const origem = origemDoRegistro(registro, estado);
  // A conversa ainda existe? Então o nome vira um link para ela
  const conversaExiste = registro.tipo !== "conversa" && buscarPorId(estado.conversas, registro.conversaId);

  return (
    <li className={`registro registro--${registro.tipo}`}>
      <div className="registro__topo">
        <Avatar nome={nomeAutor} className="registro__avatar" />
        <p className="registro__frase">
          <strong>{nomeAutor}</strong>
          {/* O papel só aparece quando NÃO é atendente: "Beatriz [Supervisão] editou..." */}
          {autor?.papel && autor.papel !== "atendente" && <span className="registro__papel">{PAPEIS[autor.papel]}</span>}{" "}
          {descricaoDaAcao(registro)}
          {origem && <span className="registro__origem">{origem}</span>}
        </p>
        {/* <time dateTime>: a data em formato de máquina, para leitores e buscadores */}
        <time className="registro__quando" dateTime={registro.quando}>
          {formatarDia(registro.quando)}, {formatarHoraMensagem(registro.quando)}
        </time>
      </div>

      <p className="registro__onde">
        Conversa:{" "}
        {conversaExiste ? (
          <button
            type="button"
            className="registro__link"
            onClick={() => despachar({ tipo: "verNaConversa", conversaId: registro.conversaId, mensagemId: registro.mensagemId })}
          >
            {registro.conversaNome}
          </button>
        ) : (
          <span>
            {registro.conversaNome}
            {registro.tipo !== "conversa" && " (excluída)"}
          </span>
        )}
      </p>

      {registro.tipo === "edicao" && (
        /* <del> e <ins>: as tags do HTML para "texto removido" e "texto
           inserido". O significado está no próprio elemento */
        <div className="registro__diff">
          <div className="registro__antes">
            <span className="registro__rotulo">Antes</span>
            <del>{registro.antes}</del>
          </div>
          <div className="registro__depois">
            <span className="registro__rotulo">Depois</span>
            <ins>{registro.depois}</ins>
          </div>
        </div>
      )}

      {registro.tipo === "exclusao" && (
        <div className="registro__apagado">
          <span className="registro__rotulo">Conteúdo apagado</span>
          <p>{registro.antes}</p>
        </div>
      )}

      {registro.tipo === "conversa" && (
        /* <details> + <summary>: um "abre e fecha" nativo do HTML, sem
           nenhum estado. A cópia pode ser longa, então começa fechada */
        <details className="registro__copia">
          <summary>
            Ver as {registro.mensagens?.length || 0} {registro.mensagens?.length === 1 ? "mensagem" : "mensagens"} da
            conversa
          </summary>
          <ol>
            {(registro.mensagens || []).map((m, i) => (
              // Sem id próprio na cópia: o índice serve, porque a lista nunca muda de ordem
              <li key={i}>
                <span className="registro__copia-quem">
                  {m.quem} · {formatarDia(m.quando)}, {formatarHoraMensagem(m.quando)}
                </span>
                <span>{m.texto}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </li>
  );
}
