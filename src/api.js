/* A ÚNICA parte do front que sabe ONDE está o servidor.
   Os componentes não chamam fetch direto: pedem para cá. Quando o endereço
   mudar (do seu PC para o Render), só este arquivo e o .env mudam.

   VITE_API_URL vem dos arquivos .env do Vite:
   - .env.development (npm run dev): http://localhost:3000, a API no seu PC
   - no build do GitHub Pages ainda não existe: o site continua lendo o
     public/dados.json até a API ser publicada (etapa B6)
   Só variáveis que começam com VITE_ chegam ao navegador. De propósito:
   assim um segredo do .env nunca vaza para o site sem querer */
export const API_URL = import.meta.env.VITE_API_URL || "";

/* Busca os dados iniciais (atendentes, conversas, contatos...).
   Devolve o objeto, ou LANÇA um erro com uma mensagem que a pessoa entende */
export async function buscarDados() {
  const url = API_URL ? `${API_URL}/api/dados` : `${import.meta.env.BASE_URL}dados.json`;

  let resposta;
  try {
    resposta = await fetch(url);
  } catch {
    // fetch só "quebra" assim quando nem chegou ao servidor (desligado, sem internet)
    throw new Error(
      API_URL
        ? `Não foi possível falar com o servidor em ${API_URL}. Ele está ligado? (npm run dev na pasta talk-atendimento-api)`
        : "Não foi possível carregar as conversas. Verifique a sua conexão."
    );
  }

  // Chegou ao servidor, mas a resposta é de erro (404, 500...)
  if (!resposta.ok) throw new Error(`O servidor respondeu com erro ${resposta.status}.`);
  return resposta.json();
}
