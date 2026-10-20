/* ⚠️ CONTAS DE DEMONSTRAÇÃO
   Sem backend, as senhas ficam AQUI, no código do site. Qualquer pessoa
   que abrir o código no GitHub consegue lê-las. Então elas servem para
   DEMONSTRAR o fluxo de login, não para proteger nada.

   Com o backend, esta lista sai daqui: as senhas ficam no servidor,
   guardadas com hash (embaralhadas de um jeito que não dá para desfazer),
   e o navegador só recebe "deu certo" ou "não deu".

   Dois tipos de conta:
   - "estacao": o computador de atendimento. Quem está nele depende do
     HORÁRIO: a escala (Configurações) diz quem cobre cada turno
   - "pessoal": a conta é de UMA pessoa (supervisão e diretoria) */
export const CONTAS = [
  { email: "estacao01@talk.com", senha: "demo123", tipo: "estacao", estacaoId: "est01" },
  { email: "estacao02@talk.com", senha: "demo123", tipo: "estacao", estacaoId: "est02" },
  { email: "supervisao@talk.com", senha: "demo123", tipo: "pessoal", atendenteId: "at4" },
  { email: "diretoria@talk.com", senha: "demo123", tipo: "pessoal", atendenteId: "at5" },
];

// A conta usada pelo botão "Entrar na demonstração"
export const CONTA_DEMONSTRACAO = "estacao01@talk.com";
