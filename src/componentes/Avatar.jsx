import { iniciais, matizDoNome } from "../utilidades/texto.js";

/* A bolinha com as iniciais, colorida a partir do nome.
   Uso: <Avatar nome="Mariana Souza" />  ou  <Avatar nome="Frota" grupo />

   "props" são os "parâmetros" do componente: tudo o que vem entre < > */
export default function Avatar({ nome, grupo = false, className = "" }) {
  // Monta a lista de classes, descartando as vazias (filter(Boolean))
  const classes = ["avatar", "avatar--cor", grupo && "avatar--grupo", className].filter(Boolean).join(" ");

  return (
    <span
      className={classes}
      /* style recebe um OBJETO no React. Variáveis CSS (--algo) passam direto,
         e o CSS monta a cor com hsl(), como na versão antiga */
      style={{ "--avatar-matiz": matizDoNome(nome) }}
      aria-hidden="true"
    >
      {iniciais(nome)}
    </span>
  );
}
