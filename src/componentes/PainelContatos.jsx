import { useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { novoId } from "../utilidades/ids.js";
import { formatarNumero, normalizar, somenteDigitos } from "../utilidades/texto.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";

/* Aba de Contatos: escolher alguém (ou digitar um número) e já conversar.
   A busca daqui é estado LOCAL e some quando a aba fecha. De propósito:
   ao abrir de novo, o campo começa vazio */
export default function PainelContatos({ aoFechar, aoIniciarConversa }) {
  const { estado, despachar } = useEstado();
  const [busca, setBusca] = useState("");

  /* Por qual LINHA (número de WhatsApp) a conversa vai começar.
     Começa na linha da sua estação; quem puxou outras estações escolhe.
     Função no useState: o valor inicial é calculado uma vez só */
  const [linhaId, setLinhaId] = useState(
    () => (estado.linhas.find((l) => l.estacaoId === estado.sessao?.estacaoId) ?? estado.linhas[0])?.id
  );

  const termo = normalizar(busca);
  const digitos = somenteDigitos(busca);
  // Número completo (DDD + número) já no formato guardado: "5521999998888"
  const numeroCompleto = digitos.length >= 10 ? somenteDigitos(formatarNumero(digitos)) : "";

  /* Os itens da lista, como DADOS. O Enter no campo abre o primeiro,
     então é útil ter a lista pronta antes de desenhar */
  const contatos = estado.contatos
    .filter(
      (c) =>
        // Contatos salvos; um "não salvo" só aparece se você digitar o número dele
        (c.salvo !== false || somenteDigitos(c.numero) === numeroCompleto) &&
        (!termo || normalizar(c.nome).includes(termo) || (digitos && somenteDigitos(c.numero).includes(digitos)))
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((c) => ({ chave: c.id, contatoId: c.id, nome: c.nome, detalhe: c.numero }));

  // Número que ninguém tem? Oferece conversar com ele, no topo
  const ninguemTem = numeroCompleto && !estado.contatos.some((c) => somenteDigitos(c.numero) === numeroCompleto);
  const itens = ninguemTem
    ? [
        { chave: "novo", novoNumero: numeroCompleto, nome: `Conversar com ${formatarNumero(digitos)}`, detalhe: "Número não salvo" },
        ...contatos,
      ]
    : contatos;

  function iniciar(item) {
    // Ids criados AQUI, no clique, nunca no reducer (ele é puro)
    let contatoId = item.contatoId;
    let novoContato = null;

    if (item.novoNumero) {
      const numero = formatarNumero(item.novoNumero);
      contatoId = novoId("ct");
      // Sem nome, mostramos o número (como no WhatsApp)
      novoContato = { id: contatoId, nome: numero, numero, email: null, empresa: null, observacao: null, salvo: false };
    }

    despachar({ tipo: "iniciarConversa", contatoId, conversaId: novoId("c"), linhaId, novoContato });
    aoIniciarConversa();
  }

  function aoApertarTeclaBusca(evento) {
    // Enter abre o primeiro: digitar o número + Enter já inicia a conversa
    if (evento.key === "Enter" && itens.length > 0) iniciar(itens[0]);
    if (evento.key === "Escape") {
      evento.stopPropagation();
      aoFechar();
    }
  }

  function aoApertarTeclaItem(evento, item) {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      iniciar(item);
    }
  }

  return (
    <section className="painel-contatos" aria-label="Contatos">
      <div className="painel-contatos__topo">
        <button type="button" id="botao-fechar-contatos" aria-label="Voltar para conversas" onClick={aoFechar}>
          <Icone nome="voltar" />
        </button>
        <h2>Contatos</h2>
      </div>

      <div className="busca">
        <label htmlFor="campo-busca-contatos" className="visualmente-oculto">
          Buscar contato
        </label>
        <span className="busca__icone">
          <Icone nome="buscar" />
        </span>
        {/* autoFocus: abriu a aba, já pode digitar */}
        <input
          type="search"
          id="campo-busca-contatos"
          placeholder="Buscar contato ou digitar número com DDD"
          autoComplete="off"
          autoFocus
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          onKeyDown={aoApertarTeclaBusca}
        />
      </div>

      {/* Só aparece para quem atende mais de uma linha */}
      {estado.linhas.length > 1 && (
        <label className="contatos__linha">
          <span>Conversar pela linha</span>
          <select value={linhaId} onChange={(evento) => setLinhaId(evento.target.value)}>
            {estado.linhas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.sigla} · {formatarNumero(l.numero)}
              </option>
            ))}
          </select>
        </label>
      )}

      <ul className="lista-contatos">
        {itens.length === 0 && (
          <li className="lista-vazia">Nenhum contato encontrado. Digite o número com DDD para iniciar uma conversa.</li>
        )}
        {itens.map((item) => (
          <li
            key={item.chave}
            className={`contato${item.novoNumero ? " contato--novo" : ""}`}
            tabIndex={0}
            onClick={() => iniciar(item)}
            onKeyDown={(evento) => aoApertarTeclaItem(evento, item)}
          >
            {item.novoNumero ? (
              <span className="avatar" aria-hidden="true">
                +
              </span>
            ) : (
              <Avatar nome={item.nome} />
            )}
            <div className="contato__info">
              <div className="contato__nome">{item.nome}</div>
              <div className="contato__numero">{item.detalhe}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
