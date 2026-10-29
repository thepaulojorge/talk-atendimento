import { useEffect, useState } from "react";
import { useEstado } from "../estado/useEstado.js";
import { enderecoDoArquivo } from "../utilidades/arquivos.js";

/* Busca um arquivo e devolve o endereço para mostrar ("blob:..."):
   { endereco, erro }. Enquanto carrega, os dois são null.
   ativo = false: não busca (ex.: um PDF só é baixado quando a pessoa pede) */
export function useArquivo(arquivoId, ativo = true) {
  const { estado } = useEstado();
  const token = estado.sessao?.token;
  // O resultado guarda DE QUAL arquivo ele é: trocou o id, o resultado antigo não vale
  const [resultado, setResultado] = useState({ id: null, endereco: null, erro: null });

  useEffect(() => {
    if (!arquivoId || !ativo) return;
    let cancelado = false;
    enderecoDoArquivo(token, arquivoId)
      .then((endereco) => !cancelado && setResultado({ id: arquivoId, endereco, erro: null }))
      .catch((erro) => !cancelado && setResultado({ id: arquivoId, endereco: null, erro: erro.message }));
    // Saiu da tela antes de terminar? Ignora a resposta
    return () => {
      cancelado = true;
    };
  }, [arquivoId, ativo, token]);

  return resultado.id === arquivoId ? resultado : { endereco: null, erro: null };
}
