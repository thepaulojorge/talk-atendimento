import { useEffect, useRef } from "react";

/* Janela de confirmação ("Apagar mensagem?"), com o <dialog> nativo do HTML.
   O componente só existe enquanto a janela está aberta: quem usa faz
     {apagando && <DialogoConfirmacao ... />}

   Props: titulo, texto, rotulo (do botão de confirmar), perigo (botão vermelho),
          aoConfirmar, aoFechar (chamado sempre que a janela fecha) */
export default function DialogoConfirmacao({ titulo, texto, rotulo, perigo = false, aoConfirmar, aoFechar }) {
  const dialogo = useRef(null);

  /* showModal() é um comando do navegador, não algo que o JSX faz sozinho.
     O "if" protege do StrictMode, que roda o efeito duas vezes em
     desenvolvimento (abrir uma janela já aberta daria erro) */
  useEffect(() => {
    if (!dialogo.current.open) dialogo.current.showModal();
  }, []);

  /* form method="dialog": clicar num botão fecha a janela e guarda o
     "value" dele em returnValue. O Esc também fecha (com returnValue vazio).
     Tudo termina no evento "close": lá decidimos o que fazer */
  function aoFecharDialogo() {
    if (dialogo.current.returnValue === "confirmar") aoConfirmar();
    aoFechar();
  }

  return (
    <dialog className="confirmacao" ref={dialogo} onClose={aoFecharDialogo}>
      <form method="dialog">
        <h2 className="confirmacao__titulo">{titulo}</h2>
        <p className="confirmacao__texto">{texto}</p>
        <div className="confirmacao__botoes">
          <button type="submit" value="cancelar">
            Cancelar
          </button>
          <button type="submit" value="confirmar" className={perigo ? "confirmacao__excluir" : "confirmacao__ok"}>
            {rotulo}
          </button>
        </div>
      </form>
    </dialog>
  );
}
