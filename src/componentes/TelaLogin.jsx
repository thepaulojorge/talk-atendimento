import { useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { entrar, entrarDemonstracao } from "../api.js";
import Icone from "./Icone.jsx";

/* Tela de login: e-mail e senha, sem nenhum usuário listado na tela.
   Quem confere é o SERVIDOR: este componente só envia o que foi digitado
   e mostra a resposta. A senha nunca fica guardada no navegador */
export default function TelaLogin() {
  const { estado, entrarComResposta } = useEstado();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  // Enquanto espera o servidor: botões desligados e "Entrando…"
  const [enviando, setEnviando] = useState(false);

  /* "pedirLogin" é a função da API a chamar (entrar ou entrarDemonstracao).
     try/finally: dando certo ou errado, o botão volta ao normal no fim */
  async function tentar(pedirLogin) {
    setErro("");
    setEnviando(true);
    try {
      const resposta = await pedirLogin();
      await entrarComResposta(resposta); // carrega as conversas e abre o app
    } catch (problema) {
      // A mensagem vem do servidor ("E-mail ou senha incorretos.", "Muitas tentativas...")
      setErro(problema.message);
      setEnviando(false); // só aqui: se deu certo, esta tela já saiu de cena
    }
  }

  function aoEnviar(evento) {
    evento.preventDefault();
    tentar(() => entrar(email, senha));
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

        <button type="submit" className="login__entrar" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>

        {/* Quem diz se o modo demonstração existe é o servidor */}
        {estado.modoDemonstracao && (
          <div className="login__demo">
            <button type="button" disabled={enviando} onClick={() => tentar(entrarDemonstracao)}>
              Entrar na demonstração
            </button>
            <p>Versão de demonstração: as conversas são fictícias.</p>
          </div>
        )}
      </form>
    </main>
  );
}
