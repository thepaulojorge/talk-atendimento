/* A ÚNICA parte do front que conversa com o servidor.
   Os componentes não chamam fetch direto: pedem para cá.

   VITE_API_URL vem dos arquivos .env do Vite:
   - .env.development (npm run dev): http://localhost:3000, a API no seu PC
   - .env.production (o site no GitHub Pages): a API publicada no Render
   Só variáveis que começam com VITE_ chegam ao navegador. De propósito:
   assim um segredo do .env nunca vaza para o site sem querer */
export const API_URL = import.meta.env.VITE_API_URL || "";

/* Um pedido à API, com tudo o que se repete num lugar só:
   - o endereço completo
   - o corpo em JSON (nos pedidos que mandam dados)
   - o token de login ("Authorization: Bearer ..."), nas rotas protegidas
   - erros com uma mensagem que a pessoa entende
   Devolve a resposta já convertida de JSON, ou LANÇA um erro com
   .status (401, 403...) para quem chamou poder decidir o que fazer */
async function pedir(caminho, { metodo = "GET", corpo, token } = {}) {
  if (!API_URL) throw new Error("O endereço da API (VITE_API_URL) não está configurado.");

  const cabecalhos = {};
  if (corpo) cabecalhos["Content-Type"] = "application/json";
  if (token) cabecalhos.Authorization = `Bearer ${token}`;

  let resposta;
  try {
    resposta = await fetch(`${API_URL}/api${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    // fetch só "quebra" assim quando nem chegou ao servidor (desligado, sem internet)
    const dica = API_URL.includes("localhost") ? " Ele está ligado? (npm run dev na pasta talk-atendimento-api)" : "";
    throw new Error(`Não foi possível falar com o servidor.${dica}`);
  }

  /* A API responde em JSON, inclusive os erros: { erro: "..." }.
     O 204 ("deu certo, sem conteúdo") não tem corpo: o .catch devolve {} */
  const conteudo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = new Error(conteudo.erro || `O servidor respondeu com erro ${resposta.status}.`);
    erro.status = resposta.status;
    throw erro;
  }
  return conteudo;
}

// Pública (sem login): o nome da empresa e se o modo demonstração está ligado
export const buscarConfiguracaoPublica = () => pedir("/publico/configuracao");

// Login: devolvem { token, sessao }
export const entrar = (email, senha) => pedir("/auth/entrar", { metodo: "POST", corpo: { email, senha } });
export const entrarDemonstracao = () => pedir("/auth/demonstracao", { metodo: "POST" });

// Protegida: precisa do token
export const buscarDados = (token) => pedir("/dados", { token });

// Puxar e soltar estações (atendentes)
export const puxarEstacao = (token, estacaoId) => pedir(`/estacoes/${estacaoId}/puxar`, { metodo: "POST", token });
export const soltarEstacao = (token, estacaoId) => pedir(`/estacoes/${estacaoId}/puxar`, { metodo: "DELETE", token });

// Sair: o servidor solta as estações puxadas
export const sairNoServidor = (token) => pedir("/auth/sair", { metodo: "POST", token });

// Configurações da empresa (diretoria)
export const buscarConfiguracoes = (token) => pedir("/configuracoes", { token });
export const salvarConfiguracoes = (token, configuracoes) =>
  pedir("/configuracoes", { metodo: "PUT", corpo: configuracoes, token });

/* B5: GRAVAR uma ação no banco. Quem monta o pedido (método, endereço e
   corpo) é o estado/sincronizar.js; aqui só enviamos */
export const gravar = (token, { metodo, caminho, corpo }) => pedir(caminho, { metodo, corpo, token });

// Modo demonstração: volta o banco inteiro aos exemplos
export const restaurarDemonstracao = (token) => pedir("/demonstracao/restaurar", { metodo: "POST", token });
