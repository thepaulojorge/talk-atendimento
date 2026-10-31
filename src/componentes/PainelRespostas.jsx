import { useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { apagarResposta, criarResposta, salvarResposta } from "../api.js";
import { normalizar } from "../utilidades/texto.js";
import Icone from "./Icone.jsx";
import DialogoConfirmacao from "./DialogoConfirmacao.jsx";

/* RESPOSTAS RÁPIDAS: as mensagens prontas do "/" no campo de mensagem.
   TODA a operação pode criar, editar e apagar: no meio de um atendimento,
   ninguém deve ficar esperando a supervisão para ter uma resposta nova.

   Aqui NÃO usamos a atualização otimista (a fila do ProvedorEstado):
   o atalho pode já existir, ou estar num formato errado, e o erro precisa
   aparecer NO FORMULÁRIO, para a pessoa corrigir. Então esperamos o
   servidor responder e só depois mudamos a tela */
const LIMITE_TEXTO = 1000;

/* Enquanto digita o atalho, ele já vai ficando no formato aceito:
   "Segunda Via!" -> "segunda-via". Sem acento, minúsculo, espaço vira "-" */
function limparAtalho(texto) {
  // Sem o normalizar(): ele apaga o espaço do fim, e "segunda " viraria "segunda" antes do "-"
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^\//, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 20);
}

export default function PainelRespostas({ aoFechar }) {
  const { estado, despachar } = useEstado();
  const [busca, setBusca] = useState("");
  /* O formulário aberto: null (fechado), { atalhoAntigo: null } (nova)
     ou { atalhoAntigo: "boleto" } (editando a "/boleto") */
  const [formulario, setFormulario] = useState(null);
  const [apagando, setApagando] = useState(null); // a resposta esperando confirmação

  function aoApertarTecla(evento) {
    // Esc: fecha o formulário primeiro; sem formulário, volta para as conversas
    if (evento.key !== "Escape" || document.querySelector("dialog[open]")) return;
    evento.stopPropagation();
    if (formulario) setFormulario(null);
    else aoFechar();
  }

  async function apagar(resposta) {
    try {
      await apagarResposta(estado.sessao.token, resposta.atalho);
      despachar({ tipo: "respostaApagada", atalho: resposta.atalho });
      avisar(despachar, `Resposta /${resposta.atalho} apagada`);
    } catch (erro) {
      avisar(despachar, erro.message);
    }
  }

  // Em ordem alfabética do atalho, e só as que combinam com a busca
  const termo = normalizar(busca);
  const lista = [...estado.respostasRapidas]
    .filter((r) => !termo || normalizar(`${r.atalho} ${r.texto}`).includes(termo))
    .sort((a, b) => a.atalho.localeCompare(b.atalho));

  return (
    <section className="painel-contatos painel-respostas" aria-label="Respostas rápidas" onKeyDown={aoApertarTecla}>
      <div className="painel-contatos__topo">
        <button type="button" aria-label="Voltar para conversas" onClick={aoFechar}>
          <Icone nome="voltar" />
        </button>
        <h2>Respostas rápidas</h2>
      </div>

      <p className="painel-estacoes__dica">
        Na conversa, digite <strong>/</strong> e o atalho para usar. Qualquer pessoa da operação pode criar, editar e
        apagar: a mudança vale na hora para todos.
      </p>

      {formulario ? (
        <FormularioResposta
          // key: trocar de resposta "recria" o formulário, com os campos da nova
          key={formulario.atalhoAntigo ?? "nova"}
          atalhoAntigo={formulario.atalhoAntigo}
          aoTerminar={() => setFormulario(null)}
        />
      ) : (
        <div className="painel-respostas__acoes">
          <div className="busca">
            <label htmlFor="campo-busca-respostas" className="visualmente-oculto">
              Buscar resposta rápida
            </label>
            <span className="busca__icone">
              <Icone nome="buscar" />
            </span>
            <input
              type="search"
              id="campo-busca-respostas"
              placeholder="Buscar resposta"
              autoComplete="off"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </div>
          <button type="button" className="config__botao" onClick={() => setFormulario({ atalhoAntigo: null })}>
            <Icone nome="adicionar" /> Nova resposta
          </button>
        </div>
      )}

      <ul className="lista-contatos">
        {lista.length === 0 && (
          <li className="lista-vazia">
            {busca ? `Nenhuma resposta encontrada para "${busca}"` : "Nenhuma resposta rápida ainda"}
          </li>
        )}
        {lista.map((resposta) => (
          <li
            key={resposta.atalho}
            className={`resposta${formulario?.atalhoAntigo === resposta.atalho ? " resposta--editando" : ""}`}
          >
            <div className="resposta__info">
              <span className="sugestao__atalho">/{resposta.atalho}</span>
              <span className="resposta__texto">{resposta.texto}</span>
            </div>
            <div className="resposta__botoes">
              <button
                type="button"
                aria-label={`Editar /${resposta.atalho}`}
                title="Editar"
                onClick={() => setFormulario({ atalhoAntigo: resposta.atalho })}
              >
                <Icone nome="lapis" />
              </button>
              <button
                type="button"
                aria-label={`Apagar /${resposta.atalho}`}
                title="Apagar"
                onClick={() => setApagando(resposta)}
              >
                <Icone nome="lixeira" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {apagando && (
        <DialogoConfirmacao
          titulo={`Apagar /${apagando.atalho}?`}
          texto="A resposta some para toda a operação. Mensagens já enviadas com ela não mudam."
          rotulo="Apagar"
          perigo
          aoConfirmar={() => apagar(apagando)}
          aoFechar={() => setApagando(null)}
        />
      )}
    </section>
  );
}

/* O formulário de criar ou editar. atalhoAntigo: null = resposta nova */
function FormularioResposta({ atalhoAntigo, aoTerminar }) {
  const { estado, despachar } = useEstado();
  const original = estado.respostasRapidas.find((r) => r.atalho === atalhoAntigo);
  const [atalho, setAtalho] = useState(original?.atalho ?? "");
  const [texto, setTexto] = useState(original?.texto ?? "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento) {
    evento.preventDefault(); // o <form> não recarrega a página
    const resposta = { atalho, texto: texto.trim() };
    if (!resposta.atalho) return setErro("Escolha um atalho.");
    if (!resposta.texto) return setErro("Escreva o texto da resposta.");

    setSalvando(true);
    setErro("");
    try {
      const token = estado.sessao.token;
      const salva = atalhoAntigo
        ? await salvarResposta(token, atalhoAntigo, resposta)
        : await criarResposta(token, resposta);
      despachar({ tipo: "respostaSalva", atalhoAntigo, resposta: salva });
      avisar(despachar, atalhoAntigo ? `Resposta /${salva.atalho} salva` : `Resposta /${salva.atalho} criada`);
      aoTerminar();
    } catch (falha) {
      setErro(falha.message); // "Já existe uma resposta com esse atalho." etc.
      setSalvando(false);
    }
  }

  return (
    <form className="formulario-lateral" onSubmit={salvar}>
      <h3>{atalhoAntigo ? `Editar /${atalhoAntigo}` : "Nova resposta rápida"}</h3>

      <label className="config__campo">
        Atalho
        <span className="formulario-lateral__atalho">
          <span aria-hidden="true">/</span>
          <input
            value={atalho}
            onChange={(evento) => setAtalho(limparAtalho(evento.target.value))}
            placeholder="segunda-via"
            autoComplete="off"
            autoFocus
            required
          />
        </span>
      </label>

      <label className="config__campo">
        Texto
        <textarea
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          rows={5}
          maxLength={LIMITE_TEXTO}
          placeholder="Olá, {nome}! Aqui é {atendente}. Como posso ajudar?"
          required
        />
      </label>
      <p className="formulario-lateral__dica">
        <code>{"{nome}"}</code> vira o primeiro nome do cliente e <code>{"{atendente}"}</code> o seu. {texto.length}/
        {LIMITE_TEXTO}
      </p>

      {erro && (
        <p className="etiquetas__erro" role="alert">
          {erro}
        </p>
      )}

      <div className="confirmacao__botoes">
        <button type="button" onClick={aoTerminar}>
          Cancelar
        </button>
        <button type="submit" className="confirmacao__ok" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
