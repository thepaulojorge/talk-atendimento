/* O REDUCER: o único lugar onde o estado muda.

   Funciona como um "balcão de pedidos":
   - os componentes NÃO mexem no estado; eles DESPACHAM uma ação,
     um objeto descrevendo o que aconteceu: { tipo: "abrirConversa", id: "c1" }
   - o reducer recebe o estado atual + a ação e devolve o PRÓXIMO estado
   - o React percebe que o estado mudou e redesenha só o que depende dele

   REGRA DE OURO: nunca alterar o estado recebido. Sempre devolver um objeto
   NOVO (com "..." para copiar o que não mudou). É assim que o React descobre
   o que mudou: comparando o objeto velho com o novo. */
import { MARCA_PADRAO, ATENDENTE_PADRAO } from "../configuracao.js";

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
  atendenteLogadoId: ATENDENTE_PADRAO,
  conversaAbertaId: null,
};

export function reducer(estado, acao) {
  switch (acao.tipo) {
    case "dadosCarregados":
      return { ...estado, ...acao.dados, carregando: false };

    case "erroAoCarregar":
      return { ...estado, carregando: false, erro: acao.mensagem };

    /* Abrir a conversa também a marca como lida.
       Repare: nada é alterado "no lugar". .map() cria uma lista nova; só a
       conversa aberta vira um objeto novo, e dentro dela só as mensagens não
       lidas viram objetos novos. Todo o resto é reaproveitado como está */
    case "abrirConversa":
      return {
        ...estado,
        conversaAbertaId: acao.id,
        conversas: estado.conversas.map((conversa) => {
          if (conversa.id !== acao.id) return conversa;
          return {
            ...conversa,
            marcadaNaoLida: false,
            mensagens: conversa.mensagens.map((msg) =>
              msg.direcao === "recebida" && !msg.lida ? { ...msg, lida: true } : msg
            ),
          };
        }),
      };

    case "fecharConversa":
      return { ...estado, conversaAbertaId: null };

    default:
      // Ação com nome errado? Melhor avisar do que falhar em silêncio
      throw new Error(`Ação desconhecida: ${acao.tipo}`);
  }
}
