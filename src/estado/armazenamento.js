/* SALVAR NO NAVEGADOR (localStorage)
   O localStorage só guarda TEXTO: JSON.stringify para salvar
   (objeto -> texto) e JSON.parse para ler (texto -> objeto).

   ⚠️ É temporário: cada navegador tem a SUA cópia, e ninguém da equipe vê
   o que o outro fez. Com o backend, quem guarda tudo é o banco de dados. */

import { MARCA_PADRAO } from "../configuracao.js";

// Nome novo: a versão 1 (clonewpp) usa "espelho-dados" no mesmo domínio
const CHAVE_DADOS = "talk-dados";
/* A sessão (quem está logado) fica numa chave SEPARADA: "Restaurar dados
   de exemplo" apaga os dados, mas não tira ninguém do sistema */
const CHAVE_SESSAO = "talk-sessao";

/* Versão do FORMATO dos dados. Se um dia a estrutura mudar (um campo
   novo obrigatório, por exemplo), aumentamos este número e os dados
   antigos, incompatíveis, são ignorados em vez de quebrar o app */
const VERSAO_DADOS = 1;

// O que vale a pena guardar (o resto vem do dados.json ou é da tela)
export function montarPacote(estado) {
  return {
    versao: VERSAO_DADOS,
    salvoEm: new Date().toISOString(),
    conversas: estado.conversas,
    contatos: estado.contatos,
    etiquetas: estado.etiquetas,
    auditoria: estado.auditoria,
    rascunhos: estado.rascunhos,
    marca: estado.marca,
    estacoes: estado.estacoes,
  };
}

/* try/catch em tudo: em aba anônima ou com o armazenamento bloqueado,
   o localStorage dá erro. O app continua funcionando, só não lembra */
export function salvar(pacote) {
  try {
    localStorage.setItem(CHAVE_DADOS, JSON.stringify(pacote));
    return true;
  } catch {
    return false; // aba anônima, ou espaço cheio (uns 5 MB por site; áudio ocupa bastante)
  }
}

export function lerSalvos() {
  try {
    const texto = localStorage.getItem(CHAVE_DADOS);
    if (!texto) return null; // primeira visita
    const salvos = JSON.parse(texto);
    // Só aceita dados no formato que este código entende
    if (salvos.versao !== VERSAO_DADOS || !Array.isArray(salvos.conversas)) return null;
    return salvos;
  } catch {
    return null; // texto corrompido ou armazenamento bloqueado: começa do zero
  }
}

export function apagarSalvos() {
  try {
    localStorage.removeItem(CHAVE_DADOS);
  } catch {
    // armazenamento bloqueado: não havia nada salvo mesmo
  }
}

/* Junta o dados.json com o que foi salvo.
   - conversas, contatos, auditoria e rascunhos: do que foi salvo
   - atendentes e respostas rápidas: sempre do dados.json (são "da empresa")
   - marca e escala das estações: do salvo (a diretoria pode ter mudado)
   - etiquetas: a LISTA vem do dados.json (se surgir uma etiqueta nova no
     arquivo, ela aparece), mas o NOME das personalizáveis vem do salvo
   Adaptar dados salvos a um formato que mudou se chama MIGRAÇÃO */
export function juntarComSalvos(dados, salvos) {
  const etiquetas = (dados.etiquetas || []).map((etiqueta) => {
    const salva = (salvos.etiquetas || []).find((e) => e.id === etiqueta.id);
    return etiqueta.editavel && salva ? { ...etiqueta, nome: salva.nome } : etiqueta;
  });

  return {
    atendentes: dados.atendentes,
    respostasRapidas: dados.respostasRapidas || [],
    contatos: salvos.contatos || dados.contatos,
    conversas: salvos.conversas,
    etiquetas,
    auditoria: Array.isArray(salvos.auditoria) ? salvos.auditoria : [],
    rascunhos: salvos.rascunhos || {},
    marca: salvos.marca || MARCA_PADRAO,
    // Dados salvos ANTES da escala existir não têm "estacoes": usa a do dados.json
    estacoes: salvos.estacoes || dados.estacoes || [],
  };
}

/* ---------- Sessão ----------
   sessao = { email, atendenteId, estacaoId?, turnoId?, desde } */
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
    return sessao?.atendenteId ? sessao : null;
  } catch {
    return null;
  }
}
