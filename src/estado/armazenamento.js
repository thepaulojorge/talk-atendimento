/* O QUE FICA NO NAVEGADOR (localStorage)
   O localStorage só guarda TEXTO: JSON.stringify para salvar
   (objeto -> texto) e JSON.parse para ler (texto -> objeto).

   Desde a B5, as conversas moram no BANCO: toda a equipe vê a mesma
   coisa. No navegador sobraram só duas coisas pequenas e pessoais:
   - a sessão (quem está logado)
   - os rascunhos (o que você digitou e ainda não enviou) */

/* Rascunhos: uma chave POR PESSOA ("talk-rascunhos-at1"): na mesma
   estação, o rascunho de quem saiu não aparece para quem entrou */
const chaveRascunhos = (dono) => `talk-rascunhos-${dono}`;
const CHAVE_SESSAO = "talk-sessao";

/* try/catch em tudo: em aba anônima ou com o armazenamento bloqueado,
   o localStorage dá erro. O app continua funcionando, só não lembra */
export function salvarRascunhos(rascunhos, dono) {
  try {
    localStorage.setItem(chaveRascunhos(dono), JSON.stringify(rascunhos));
    return true;
  } catch {
    return false;
  }
}

export function lerRascunhos(dono) {
  try {
    const rascunhos = JSON.parse(localStorage.getItem(chaveRascunhos(dono)));
    // Só aceita um objeto simples ({ c1: "Olá..." }); qualquer outra coisa vira {}
    return rascunhos && typeof rascunhos === "object" && !Array.isArray(rascunhos) ? rascunhos : {};
  } catch {
    return {};
  }
}

/* Faxina: até a B4, cada pessoa tinha uma CÓPIA das conversas aqui
   ("talk-dados-at1"...). Agora o banco guarda tudo, e essas cópias
   antigas só ocupam espaço (e guardam conversas à toa). Apagamos */
export function apagarCopiasAntigas() {
  try {
    Object.keys(localStorage)
      .filter((chave) => chave.startsWith("talk-dados-"))
      .forEach((chave) => localStorage.removeItem(chave));
  } catch {
    // armazenamento bloqueado: não havia nada mesmo
  }
}

/* ---------- Sessão ----------
   sessao = { token, email, atendenteId, estacaoId?, turnoId?, desde }
   O token é o "crachá" que o servidor entregou no login.

   ⚠️ Por que no localStorage, e não num cookie? O mais seguro seria um
   cookie "httpOnly" (que o JavaScript nem consegue ler). Mas o site
   (github.io) e a API (onrender.com) são domínios diferentes, e os
   navegadores estão bloqueando cookies entre domínios. Com o site e a
   API no mesmo domínio (um domínio próprio da empresa), vale trocar */
export function salvarSessao(sessao) {
  try {
    if (sessao) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
    else localStorage.removeItem(CHAVE_SESSAO); // saiu: apaga
  } catch {
    // aba anônima: o login só não sobrevive a um recarregar
  }
}

export function lerSessao() {
  try {
    const sessao = JSON.parse(localStorage.getItem(CHAVE_SESSAO));
    // Sessões antigas (de antes do login no servidor) não têm token: ignora
    return sessao?.token && sessao?.atendenteId ? sessao : null;
  } catch {
    return null;
  }
}
