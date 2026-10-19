/* Ids únicos simples: um prefixo + o horário em milissegundos.
   "c" + 1739999999999 -> "c1739999999999"
   Chame SEMPRE dentro de eventos (clique, Enter...), nunca durante a
   renderização: cada chamada dá um valor diferente */
export function novoId(prefixo) {
  return `${prefixo}${Date.now()}`;
}
