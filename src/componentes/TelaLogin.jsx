import { useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { CONTAS, CONTA_DEMONSTRACAO } from "../estado/contas.js";
import { MODO_DEMONSTRACAO } from "../configuracao.js";
import { buscarPorId } from "../utilidades/conversas.js";
import { turnoDe } from "../utilidades/turnos.js";
import Icone from "./Icone.jsx";

/* Tela de login: e-mail e senha, sem nenhum usuário listado na tela.

   ⚠️ Sem backend, a conferência acontece aqui no navegador, contra a lista
   de contas de demonstração (estado/contas.js). Serve para mostrar o FLUXO.
   Com o backend, este componente só envia e-mail e senha para o servidor */
export default function TelaLogin() {
  const { estado, despachar } = useEstado();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  /* Descobre QUEM entra com esta conta.
     Devolve { sessao } quando dá certo, ou { erro } explicando o problema */
  function resolverConta(conta) {
    const agora = new Date();

    if (conta.tipo === "pessoal") {
      return { sessao: { email: conta.email, atendenteId: conta.atendenteId, desde: agora.toISOString() } };
    }

    // Estação: quem está nela depende do horário. A escala diz quem cobre o turno
    const estacao = buscarPorId(estado.estacoes, conta.estacaoId);
    const turno = turnoDe(agora);
    const atendenteId = estacao?.escala?.[turno.id];
    if (!buscarPorId(estado.atendentes, atendenteId)) {
      return { erro: `Ninguém está escalado na ${estacao?.nome || "estação"} no turno da ${turno.nome.toLowerCase()}. Fale com a diretoria.` };
    }
    return {
      sessao: { email: conta.email, atendenteId, estacaoId: estacao.id, turnoId: turno.id, desde: agora.toISOString() },
    };
  }

  function entrarCom(conta) {
    const { sessao, erro: problema } = resolverConta(conta);
    if (problema) return setErro(problema);

    despachar({ tipo: "entrar", sessao });
    const nome = buscarPorId(estado.atendentes, sessao.atendenteId)?.nome;
    avisar(despachar, `Olá, ${nome}! Bom atendimento.`);
  }

  function aoEnviar(evento) {
    evento.preventDefault();
    // E-mail sem diferença de maiúsculas e sem espaços sobrando
    const conta = CONTAS.find((c) => c.email === email.trim().toLowerCase() && c.senha === senha);
    /* Mensagem de erro GENÉRICA de propósito: dizer "esse e-mail não existe"
       ajudaria alguém a descobrir quais e-mails existem */
    if (!conta) return setErro("E-mail ou senha incorretos.");
    entrarCom(conta);
  }

  return (
    <main className="login">
      <form className="login__cartao" onSubmit={aoEnviar}>
        <div className="login__marca">
          <Icone nome="logo" /> {estado.marca.nome}
        </div>

        <h1 className="login__titulo">Entrar</h1>
        <p className="login__texto">Use o e-mail da sua estação de atendimento ou da sua conta.</p>

        <label className="login__campo">
          <span>E-mail</span>
          {/* autoComplete: o navegador oferece salvar e preencher a senha */}
          <input
            type="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(evento) => {
              setEmail(evento.target.value);
              setErro("");
            }}
          />
        </label>

        <label className="login__campo">
          <span>Senha</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(evento) => {
              setSenha(evento.target.value);
              setErro("");
            }}
          />
        </label>

        {erro && (
          <p className="login__erro" role="alert">
            {erro}
          </p>
        )}

        {/* Enquanto o dados.json carrega, a escala ainda não existe */}
        <button type="submit" className="login__entrar" disabled={estado.carregando}>
          Entrar
        </button>

        {MODO_DEMONSTRACAO && (
          <div className="login__demo">
            <button
              type="button"
              disabled={estado.carregando}
              onClick={() => entrarCom(CONTAS.find((c) => c.email === CONTA_DEMONSTRACAO))}
            >
              Entrar na demonstração
            </button>
            <p>Versão de demonstração: as conversas são fictícias e ficam só neste navegador.</p>
          </div>
        )}
      </form>
    </main>
  );
}
