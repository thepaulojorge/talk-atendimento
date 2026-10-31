import { useEffect, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { salvarContato } from "../api.js";
import { buscarPorId, nomeDaConversa } from "../utilidades/conversas.js";
import Avatar from "./Avatar.jsx";
import Icone from "./Icone.jsx";

/* Coluna da direita: os dados do contato (ou do grupo) da conversa aberta.
   Só existe enquanto estado.painelDadosAberto for true (quem decide é o App) */
export default function PainelDados({ conversa }) {
  const { estado, despachar } = useEstado();
  const fechar = () => despachar({ tipo: "fecharDados" });
  /* Guardamos QUAL conversa está em edição (e não só true/false): trocou
     de conversa, o id não bate mais e a edição some sozinha */
  const [editandoId, setEditandoId] = useState(null);
  const editando = editandoId === conversa.id;
  const setEditando = (sim) => setEditandoId(sim ? conversa.id : null);

  /* Esc fecha o PAINEL primeiro (e não a conversa inteira).
     Fase de captura + stopPropagation: chegamos antes do Esc do chat */
  useEffect(() => {
    function aoApertarTecla(evento) {
      if (evento.key !== "Escape" || document.querySelector("dialog[open]")) return;
      evento.stopPropagation();
      // Editando? O Esc só cancela a edição
      if (editando) setEditandoId(null);
      else despachar({ tipo: "fecharDados" });
    }
    document.addEventListener("keydown", aoApertarTecla, true);
    return () => document.removeEventListener("keydown", aoApertarTecla, true);
  }, [despachar, editando]);


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
        {/* Só contatos (grupo não tem número para editar) */}
        {contatoEditavel(grupo, estado, conversa) && !editando && (
          <button
            type="button"
            className="painel-dados__editar"
            aria-label="Editar nome e número do contato"
            title="Editar contato"
            onClick={() => setEditando(true)}
          >
            <Icone nome="lapis" />
          </button>
        )}
      </div>

      <div className="painel-dados__conteudo">
        <Avatar nome={nome} grupo={grupo} />
        {editando && contato ? (
          <FormularioContato key={contato.id} contato={contato} aoTerminar={() => setEditando(false)} />
        ) : (
          <h3 className="painel-dados__nome">{nome}</h3>
        )}

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
              {!editando && <Dado rotulo="Número" valor={contato.numero} />}
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

const contatoEditavel = (grupo, estado, conversa) => !grupo && Boolean(buscarPorId(estado.contatos, conversa.contatoId));

/* EDITAR CONTATO: só o NOME e o NÚMERO.
   Esperamos o servidor (sem atualização otimista): o número pode ser
   inválido ou já ser de outro contato, e o erro aparece aqui mesmo.
   O número pode ser digitado de qualquer jeito: "(21) 98811-0001",
   "21988110001", "+55 21 98811-0001". O servidor coloca no formato padrão */
function FormularioContato({ contato, aoTerminar }) {
  const { estado, despachar } = useEstado();
  const [nome, setNome] = useState(contato.nome);
  const [numero, setNumero] = useState(contato.numero);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvar(evento) {
    evento.preventDefault();
    if (!nome.trim()) return setErro("Escreva o nome do contato.");
    setSalvando(true);
    setErro("");
    try {
      const salvo = await salvarContato(estado.sessao.token, contato.id, { nome: nome.trim(), numero });
      // A mesma ação do tempo real: troca o contato antigo pelo novo na lista
      despachar({ tipo: "contatoDoServidor", contato: salvo });
      avisar(despachar, "Contato salvo");
      aoTerminar();
    } catch (falha) {
      setErro(falha.message);
      setSalvando(false);
    }
  }

  return (
    <form className="formulario-lateral formulario-lateral--dados" onSubmit={salvar}>
      <label className="config__campo">
        Nome
        <input value={nome} onChange={(evento) => setNome(evento.target.value)} maxLength={60} autoFocus required />
      </label>
      <label className="config__campo">
        Número
        <input
          type="tel"
          value={numero}
          onChange={(evento) => setNumero(evento.target.value)}
          placeholder="(21) 98811-0001"
          required
        />
      </label>
      {contato.whatsapp && (
        <p className="formulario-lateral__dica">
          Este cliente veio pelo WhatsApp. Se mudar o número, as próximas respostas vão para o número novo.
        </p>
      )}
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
