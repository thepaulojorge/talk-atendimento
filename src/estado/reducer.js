/* O REDUCER: o único lugar onde o estado muda.

   Funciona como um "balcão de pedidos":
   - os componentes NÃO mexem no estado; eles DESPACHAM uma ação,
     um objeto descrevendo o que aconteceu: { tipo: "abrirConversa", id: "c1" }
   - o reducer recebe o estado atual + a ação e devolve o PRÓXIMO estado
   - o React percebe que o estado mudou e redesenha só o que depende dele

   REGRAS DE OURO:
   1. Nunca alterar o estado recebido. Sempre devolver um objeto NOVO
      (com "..." para copiar o que não mudou). É assim que o React descobre
      o que mudou: comparando o objeto velho com o novo.
   2. Ser PURO: com o mesmo estado e a mesma ação, devolver sempre o mesmo
      resultado. Por isso nada de Date.now() ou new Date() aqui dentro:
      ids e horários são criados ANTES, no componente, e vêm na ação. */
import { MARCA_PADRAO, LIMITE_FIXADAS } from "../configuracao.js";
import { buscarPorId, estaResolvida, nomeDaConversa } from "../utilidades/conversas.js";
import { podeApagarMensagem, podeEditarMensagem, podeVerAuditoria } from "../utilidades/permissoes.js";
import { formatarDuracao, normalizar } from "../utilidades/texto.js";

export const estadoInicial = {
  carregando: true,
  erro: null,
  marca: MARCA_PADRAO,
  atendentes: [],
  contatos: [],
  conversas: [],
  etiquetas: [],
  respostasRapidas: [],
  auditoria: [],
  estacoes: [], // as estações de atendimento e a escala de turnos de cada uma
  modoDemonstracao: false, // o servidor aceita o "Entrar na demonstração"?
  sessao: null, // quem entrou: { email, atendenteId, estacaoId?, turnoId?, desde }
  atendenteLogadoId: null, // a PESSOA por trás da sessão (null = tela de login)
  conversaAbertaId: null,
  rascunhos: {}, // texto não enviado de cada conversa: { c1: "Olá...", c3: "..." }
  aviso: null, // o aviso flutuante: { id, texto } ou null
  painelDadosAberto: false, // a coluna da direita, com os dados do contato
  /* A seção escolhida na barra de ícones:
     "conversas" | "contatos" (as duas na coluna da esquerda)
     "supervisao" (o painel ocupa o lugar das conversas) */
  secao: "conversas",
  mensagemEmFoco: null, // id da mensagem a destacar ao abrir a conversa (vindo da supervisão)
};

/* Ajudante: devolve uma lista de conversas nova, trocando só a conversa
   "id" pelo resultado de "mudar(conversa)". As outras ficam como estão */
function mudarConversa(conversas, id, mudar) {
  return conversas.map((conversa) => (conversa.id === id ? mudar(conversa) : conversa));
}

// O mesmo, um nível abaixo: troca só uma mensagem dentro de uma conversa
function mudarMensagem(conversas, conversaId, mensagemId, mudar) {
  return mudarConversa(conversas, conversaId, (conversa) => ({
    ...conversa,
    mensagens: conversa.mensagens.map((msg) => (msg.id === mensagemId ? mudar(msg) : msg)),
  }));
}

/* Registro para o painel de supervisão. Áudio vira uma descrição em texto:
   o arquivo continua na mensagem (soft delete), não precisa ser copiado */
function registroDeAuditoria(estado, acao, conversa, msg, extra) {
  return {
    id: acao.auditoriaId,
    conversaId: conversa.id,
    conversaNome: nomeDaConversa(conversa, estado.contatos),
    mensagemId: msg.id,
    autorId: estado.atendenteLogadoId,
    ...deOndeVeio(estado),
    quando: acao.agora,
    tipoMensagem: msg.tipo,
    antes: msg.tipo === "audio" ? `🎤 Áudio de ${formatarDuracao(msg.duracao)}` : msg.texto,
    ...extra, // tipo ("edicao" ou "exclusao") e, na edição, o "depois"
  };
}

/* Estação e turno de quem fez a ação, para a auditoria.
   Numa estação, o registro diz "Paulo, Estação 01, turno da manhã" */
function deOndeVeio(estado) {
  return { estacaoId: estado.sessao?.estacaoId || null, turnoId: estado.sessao?.turnoId || null };
}

/* Marcar como lida: as recebidas ganham "lida" e a marcação manual some.
   Usada ao ABRIR a conversa e na opção "Marcar como lida" do menu */
function marcarComoLida(conversa) {
  return {
    ...conversa,
    marcadaNaoLida: false,
    mensagens: conversa.mensagens.map((msg) => (msg.direcao === "recebida" && !msg.lida ? { ...msg, lida: true } : msg)),
  };
}

// Fecha a conversa SE for ela que está aberta (junto vai o painel de dados)
function fecharSeAberta(estado, id) {
  return estado.conversaAbertaId === id ? { ...estado, conversaAbertaId: null, painelDadosAberto: false } : estado;
}

/* Nome de quem escreveu, para REGISTRO. Diferente do nomeDoAutor da tela,
   nunca devolve "Você": o registro é lido depois, por outra pessoa */
function quemEscreveu(msg, conversa, estado) {
  if (msg.tipo === "nota") return `📝 ${buscarPorId(estado.atendentes, msg.autor)?.nome || "Equipe"}`;
  if (msg.direcao === "enviada") return buscarPorId(estado.atendentes, msg.autor)?.nome || "Equipe";
  if (conversa.tipo === "grupo" && msg.autor) return msg.autor;
  return nomeDaConversa(conversa, estado.contatos);
}

/* Um evento no histórico da conversa: "Carla assumiu a conversa".
   Fica no meio das mensagens, para toda a equipe ver quem fez o quê e quando */
function evento(id, texto, agora) {
  return { id, tipo: "sistema", texto, horario: agora, direcao: "interna", lida: true, autor: null };
}

function nomeDoLogado(estado) {
  return buscarPorId(estado.atendentes, estado.atendenteLogadoId)?.nome || "Atendente";
}

// Acrescenta mensagens (ou eventos) no fim de uma conversa
function acrescentar(conversa, ...novas) {
  return { ...conversa, mensagens: [...conversa.mensagens, ...novas] };
}

// Acha conversa + mensagem de uma vez (ou devolve null)
function acharMensagem(estado, conversaId, mensagemId) {
  const conversa = buscarPorId(estado.conversas, conversaId);
  const msg = conversa?.mensagens.find((m) => m.id === mensagemId);
  return msg ? { conversa, msg } : null;
}

export function reducer(estado, acao) {
  switch (acao.tipo) {
    case "dadosCarregados":
      return { ...estado, ...acao.dados, carregando: false };

    // Volta tudo ao exemplo: fecha a conversa e esquece os rascunhos
    case "dadosRestaurados":
      return { ...estado, ...acao.dados, conversaAbertaId: null, painelDadosAberto: false, secao: "conversas" };

    // Ninguém logado: a tela de login já pode aparecer, com o nome da empresa
    case "prontoParaLogin":
      return { ...estado, carregando: false, marca: acao.marca, modoDemonstracao: acao.modoDemonstracao };

    case "erroAoCarregar":
      return { ...estado, carregando: false, erro: acao.mensagem };

    /* Abrir a conversa também a marca como lida. Nada é alterado "no lugar":
       .map() cria listas novas, e só o que mudou vira objeto novo */
    case "abrirConversa":
      return {
        ...estado,
        conversaAbertaId: acao.id,
        mensagemEmFoco: null,
        // Trocou de conversa: o painel de dados (da conversa anterior) fecha
        painelDadosAberto: acao.id === estado.conversaAbertaId && estado.painelDadosAberto,
        conversas: mudarConversa(estado.conversas, acao.id, marcarComoLida),
      };

    /* Iniciar conversa pela aba de Contatos. A ação traz:
       { contatoId, conversaId, novoContato? }
       - novoContato: número não salvo; entra na lista com salvo: false
       - já existe conversa com o contato? Reaproveita (e desarquiva)
       - não existe? Cria uma vazia, já com quem iniciou como responsável */
    case "iniciarConversa": {
      const contatos = acao.novoContato ? [...estado.contatos, acao.novoContato] : estado.contatos;
      const existente = estado.conversas.find((c) => c.tipo === "contato" && c.contatoId === acao.contatoId);

      let conversas;
      let id;
      if (existente) {
        id = existente.id;
        // Procurou o contato de propósito: a conversa volta das arquivadas
        conversas = mudarConversa(estado.conversas, id, (c) => ({ ...c, arquivada: false }));
      } else {
        id = acao.conversaId;
        conversas = [
          ...estado.conversas,
          {
            id,
            tipo: "contato",
            contatoId: acao.contatoId,
            atendenteId: estado.atendenteLogadoId,
            marcadaNaoLida: false,
            arquivada: false,
            status: "aberta",
            etiquetas: [],
            fixadaEm: null,
            mensagens: [],
          },
        ];
      }

      /* Reaproveita a ação "abrirConversa" chamando o próprio reducer:
         assim a regra "abrir = marcar como lida" fica num lugar só */
      // Iniciou pelos Contatos: a coluna da esquerda volta para as conversas
      return reducer({ ...estado, contatos, conversas, secao: "conversas" }, { tipo: "abrirConversa", id });
    }

    case "fecharConversa":
      return { ...estado, conversaAbertaId: null, painelDadosAberto: false };

    case "abrirDados":
      return { ...estado, painelDadosAberto: true };

    case "fecharDados":
      return { ...estado, painelDadosAberto: false };

    /* ---------- Ações da conversa (menu ⋮ e clique direito) ---------- */

    /* Fixar: { id, agora }. A regra do limite fica AQUI, no reducer: a tela
       avisa antes, mas a regra vale mesmo que alguém esqueça de conferir */
    case "alternarFixada": {
      const conversa = buscarPorId(estado.conversas, acao.id);
      if (!conversa) return estado;
      const fixadas = estado.conversas.filter((c) => c.fixadaEm).length;
      if (!conversa.fixadaEm && (fixadas >= LIMITE_FIXADAS || conversa.arquivada)) return estado;

      return {
        ...estado,
        conversas: mudarConversa(estado.conversas, acao.id, (c) => ({
          ...c,
          fixadaEm: c.fixadaEm ? null : acao.agora,
        })),
      };
    }

    case "marcarLida":
      return { ...estado, conversas: mudarConversa(estado.conversas, acao.id, marcarComoLida) };

    /* Não lida: se for a conversa aberta, ela fecha. Aberta, continuaria
       "sendo lida" e a marcação não faria sentido */
    case "marcarNaoLida":
      return fecharSeAberta(
        { ...estado, conversas: mudarConversa(estado.conversas, acao.id, (c) => ({ ...c, marcadaNaoLida: true })) },
        acao.id
      );

    /* Arquivar também desafixa (no WhatsApp é igual) e fecha a conversa.
       Desarquivar só traz de volta para a lista */
    case "alternarArquivada": {
      const conversa = buscarPorId(estado.conversas, acao.id);
      if (!conversa) return estado;
      const arquivando = !conversa.arquivada;
      const conversas = mudarConversa(estado.conversas, acao.id, (c) => ({
        ...c,
        arquivada: arquivando,
        fixadaEm: arquivando ? null : c.fixadaEm,
      }));
      return arquivando ? fecharSeAberta({ ...estado, conversas }, acao.id) : { ...estado, conversas };
    }

    /* Excluir: { id, agora, auditoriaId }
       Apagar a conversa inteira seria um jeito de "esconder" mensagens da
       supervisão. Por isso, antes, guardamos uma cópia em texto na auditoria */
    case "excluirConversa": {
      const conversa = buscarPorId(estado.conversas, acao.id);
      if (!conversa) return estado;

      const copia = conversa.mensagens
        .filter((m) => m.tipo !== "sistema")
        .map((m) => ({
          quem: quemEscreveu(m, conversa, estado),
          quando: m.horario,
          texto:
            (m.tipo === "audio" ? `🎤 Áudio de ${formatarDuracao(m.duracao)}` : m.texto) +
            (m.apagada ? " (já estava apagada)" : ""),
        }));

      const rascunhos = { ...estado.rascunhos };
      delete rascunhos[acao.id];

      return fecharSeAberta(
        {
          ...estado,
          rascunhos,
          // filter devolve uma lista NOVA, sem a conversa excluída
          conversas: estado.conversas.filter((c) => c.id !== acao.id),
          auditoria: [
            ...estado.auditoria,
            {
              id: acao.auditoriaId,
              tipo: "conversa",
              conversaId: conversa.id,
              conversaNome: nomeDaConversa(conversa, estado.contatos),
              autorId: estado.atendenteLogadoId,
              ...deOndeVeio(estado),
              quando: acao.agora,
              mensagens: copia,
            },
          ],
        },
        acao.id
      );
    }

    case "definirRascunho":
      return { ...estado, rascunhos: { ...estado.rascunhos, [acao.conversaId]: acao.texto } };

    /* Enviar mensagem (texto ou áudio), com as mesmas regras da versão antiga:
       - conversa da fila: quem respondeu assume
       - conversa resolvida: reabre
       Cada regra deixa um evento no histórico ("Paulo assumiu a conversa") */
    case "enviarMensagem": {
      const nomeLogado = nomeDoLogado(estado);
      // Nota interna não conta como atender: não assume nem reabre a conversa
      const ehNota = acao.conteudo.tipo === "nota";

      const conversas = mudarConversa(estado.conversas, acao.conversaId, (conversa) => {
        const eventos = [];
        let { atendenteId, status } = conversa;

        if (!ehNota && !atendenteId) {
          atendenteId = estado.atendenteLogadoId;
          eventos.push(`${nomeLogado} assumiu a conversa`);
        }
        if (!ehNota && estaResolvida(conversa)) {
          status = "aberta";
          eventos.push(`${nomeLogado} reabriu a conversa`);
        }

        /* acao.conteudo traz o que muda entre os tipos:
           { tipo: "texto", texto }, { tipo: "audio", audioUrl, duracao }
           ou { tipo: "nota", texto } */
        const novaMensagem = ehNota
          ? {
              id: acao.id,
              ...acao.conteudo,
              horario: acao.agora,
              direcao: "interna", // nunca vai para o cliente
              lida: true,
              autor: estado.atendenteLogadoId,
            }
          : {
              id: acao.id,
              ...acao.conteudo,
              horario: acao.agora,
              direcao: "enviada",
              lida: false, // ✓✓ cinza: o cliente ainda não leu
              autor: estado.atendenteLogadoId,
              respostaA: acao.respostaA || null,
            };

        return acrescentar(
          { ...conversa, atendenteId, status },
          ...eventos.map((texto, i) => evento(`${acao.id}-e${i}`, texto, acao.agora)),
          novaMensagem
        );
      });

      // Encaminhar envia para OUTRA conversa: o rascunho de lá fica intacto
      if (acao.limparRascunho === false) return { ...estado, conversas };

      // Enviou: o rascunho desta conversa some. Copiamos e apagamos da CÓPIA
      // (apagar do estado.rascunhos original quebraria a regra 1)
      const rascunhos = { ...estado.rascunhos };
      delete rascunhos[acao.conversaId];
      return { ...estado, conversas, rascunhos };
    }

    /* Editar: { conversaId, mensagemId, texto, agora, auditoriaId }
       O reducer confere a permissão de novo: é a última barreira, mesmo
       que algum botão apareça onde não devia */
    case "editarMensagem": {
      const achado = acharMensagem(estado, acao.conversaId, acao.mensagemId);
      if (!achado || !podeEditarMensagem(estado, achado.msg)) return estado;
      const { conversa, msg } = achado;
      if (acao.texto === msg.texto) return estado; // nada mudou, nada a registrar

      return {
        ...estado,
        auditoria: [
          ...estado.auditoria,
          registroDeAuditoria(estado, acao, conversa, msg, { tipo: "edicao", depois: acao.texto }),
        ],
        conversas: mudarMensagem(estado.conversas, conversa.id, msg.id, (m) => ({
          ...m,
          // A versão anterior não se perde: vai para o histórico
          versoesAnteriores: [...(m.versoesAnteriores || []), m.texto],
          texto: acao.texto,
          editadaEm: acao.agora,
        })),
      };
    }

    /* Apagar: { conversaId, mensagemId, agora, auditoriaId }
       Soft delete: a mensagem continua no array, só ganha "apagada: true".
       Assim citações e o histórico da supervisão continuam fazendo sentido */
    case "apagarMensagem": {
      const achado = acharMensagem(estado, acao.conversaId, acao.mensagemId);
      if (!achado || !podeApagarMensagem(estado, achado.msg)) return estado;
      const { conversa, msg } = achado;

      return {
        ...estado,
        auditoria: [...estado.auditoria, registroDeAuditoria(estado, acao, conversa, msg, { tipo: "exclusao" })],
        conversas: mudarMensagem(estado.conversas, conversa.id, msg.id, (m) => ({
          ...m,
          apagada: true,
          apagadaPor: estado.atendenteLogadoId,
          apagadaEm: acao.agora,
        })),
      };
    }

    /* ---------- Etiquetas ---------- */

    // Marca ou desmarca uma etiqueta na conversa: { conversaId, etiquetaId }
    case "alternarEtiqueta":
      return {
        ...estado,
        conversas: mudarConversa(estado.conversas, acao.conversaId, (c) => {
          const atuais = c.etiquetas || [];
          return {
            ...c,
            etiquetas: atuais.includes(acao.etiquetaId)
              ? atuais.filter((id) => id !== acao.etiquetaId) // tira
              : [...atuais, acao.etiquetaId], // põe
          };
        }),
      };

    /* Renomear uma etiqueta personalizável: { id, nome }
       Só as "editavel: true" mudam de nome, e nunca para um nome vazio ou
       repetido. A janela também confere (para explicar o erro), mas a
       regra vale aqui de qualquer jeito */
    case "renomearEtiqueta": {
      const nome = acao.nome.trim();
      const etiqueta = buscarPorId(estado.etiquetas, acao.id);
      const repetida = estado.etiquetas.some((e) => e.id !== acao.id && normalizar(e.nome) === normalizar(nome));
      if (!etiqueta?.editavel || !nome || repetida) return estado;

      // Todas as conversas com essa etiqueta mudam juntas: elas guardam só o ID
      return {
        ...estado,
        etiquetas: estado.etiquetas.map((e) => (e.id === acao.id ? { ...e, nome } : e)),
      };
    }

    /* ---------- Equipe ---------- */

    // { id, eventoId, agora }
    case "assumirConversa": {
      const conversa = buscarPorId(estado.conversas, acao.id);
      if (!conversa || conversa.atendenteId === estado.atendenteLogadoId) return estado;
      return {
        ...estado,
        conversas: mudarConversa(estado.conversas, acao.id, (c) =>
          acrescentar(
            { ...c, atendenteId: estado.atendenteLogadoId },
            evento(acao.eventoId, `${nomeDoLogado(estado)} assumiu a conversa`, acao.agora)
          )
        ),
      };
    }

    /* { id, destinoId, eventoId, agora }
       destinoId = id de um atendente, ou null para devolver à fila */
    case "transferirConversa": {
      const conversa = buscarPorId(estado.conversas, acao.id);
      if (!conversa || conversa.atendenteId === acao.destinoId) return estado;
      const destino = buscarPorId(estado.atendentes, acao.destinoId);
      const texto = destino
        ? `${nomeDoLogado(estado)} transferiu a conversa para ${destino.nome}`
        : `${nomeDoLogado(estado)} devolveu a conversa para a fila`;
      return {
        ...estado,
        conversas: mudarConversa(estado.conversas, acao.id, (c) =>
          acrescentar({ ...c, atendenteId: acao.destinoId }, evento(acao.eventoId, texto, acao.agora))
        ),
      };
    }

    // { id, eventoId, agora }
    case "alternarResolvida": {
      const conversa = buscarPorId(estado.conversas, acao.id);
      if (!conversa) return estado;
      const resolvendo = !estaResolvida(conversa);
      const texto = resolvendo
        ? `${nomeDoLogado(estado)} marcou a conversa como resolvida`
        : `${nomeDoLogado(estado)} reabriu a conversa`;
      return {
        ...estado,
        conversas: mudarConversa(estado.conversas, acao.id, (c) =>
          acrescentar({ ...c, status: resolvendo ? "resolvida" : "aberta" }, evento(acao.eventoId, texto, acao.agora))
        ),
      };
    }

    /* Mensagem do cliente chegando: { conversaId, id, agora, texto, autor }
       ⚠️ Por enquanto só a simulação usa. Com o backend, quem despacha
       esta ação é o aviso do WhatsApp (pelo Socket.io) */
    case "receberMensagem": {
      const conversa = buscarPorId(estado.conversas, acao.conversaId);
      if (!conversa) return estado;
      const aberta = conversa.id === estado.conversaAbertaId;

      const novas = [];
      // Cliente escreveu numa conversa resolvida: ela reabre sozinha
      if (estaResolvida(conversa)) {
        novas.push(evento(`${acao.id}-e0`, "Conversa reaberta: o cliente enviou uma nova mensagem", acao.agora));
      }
      novas.push({
        id: acao.id,
        tipo: "texto",
        texto: acao.texto,
        horario: acao.agora,
        direcao: "recebida",
        lida: aberta, // com a conversa aberta na tela, você já está lendo
        autor: acao.autor || null,
      });

      return {
        ...estado,
        conversas: mudarConversa(estado.conversas, conversa.id, (c) =>
          // Arquivada continua arquivada (como no WhatsApp); o atalho mostra as não lidas
          acrescentar({ ...c, status: "aberta" }, ...novas)
        ),
        // Aviso só se você NÃO estiver olhando para a conversa
        aviso: aberta ? estado.aviso : { id: acao.id, texto: `Nova mensagem de ${nomeDaConversa(conversa, estado.contatos)}` },
      };
    }

    /* ---------- Login ---------- */

    /* Sair: volta para a tela de login e as conversas SAEM DA MEMÓRIA.
       A próxima pessoa no computador não deve ver nada de quem saiu.
       Ficam só o nome da empresa e o modo demonstração (são públicos) */
    case "sair":
      return {
        ...estadoInicial,
        carregando: false,
        marca: estado.marca,
        modoDemonstracao: estado.modoDemonstracao,
      };

    /* ---------- Supervisão ---------- */

    /* Trocar de seção pela barra de ícones: { secao }
       Supervisão: só para supervisão e diretoria (o ícone já some para os outros) */
    case "irPara":
      if (acao.secao === "supervisao" && !podeVerAuditoria(estado)) return estado;
      return { ...estado, secao: acao.secao };

    /* Clicou no nome da conversa num registro: volta para as conversas,
       abre a conversa e destaca a mensagem editada ou apagada.
       { conversaId, mensagemId? } */
    case "verNaConversa": {
      const aberta = reducer({ ...estado, secao: "conversas" }, { tipo: "abrirConversa", id: acao.conversaId });
      return { ...aberta, mensagemEmFoco: acao.mensagemId || null };
    }

    /* Configurações (só a diretoria): { marca, estacoes }
       A tela já confere a permissão; o reducer confere de novo */
    case "salvarConfiguracoes":
      if (buscarPorId(estado.atendentes, estado.atendenteLogadoId)?.papel !== "diretoria") return estado;
      return { ...estado, marca: acao.marca, estacoes: acao.estacoes };

    // ✓✓ fica azul (por enquanto, quem avisa é uma simulação)
    case "mensagemLida":
      return {
        ...estado,
        conversas: mudarMensagem(estado.conversas, acao.conversaId, acao.mensagemId, (msg) => ({ ...msg, lida: true })),
      };

    case "mostrarAviso":
      return { ...estado, aviso: { id: acao.id, texto: acao.texto } };

    case "esconderAviso":
      // Só esconde se ainda for o MESMO aviso (um novo pode ter chegado)
      return estado.aviso?.id === acao.id ? { ...estado, aviso: null } : estado;

    default:
      // Ação com nome errado? Melhor avisar do que falhar em silêncio
      throw new Error(`Ação desconhecida: ${acao.tipo}`);
  }
}
