/* Ids únicos: um prefixo + um UUID (um identificador aleatório de 36
   caracteres, praticamente impossível de repetir).
   "m" -> "m-3f2a9c1e-7b4d-4e8a-9c0f-1a2b3c4d5e6f"

   Antes usávamos o horário (Date.now()). Com um navegador só, funcionava.
   Agora o id vai para o BANCO, e duas pessoas mandando mensagem no mesmo
   milissegundo gerariam o mesmo id: o segundo envio seria recusado.

   Chame SEMPRE dentro de eventos (clique, Enter...), nunca durante a
   renderização: cada chamada dá um valor diferente */
export function novoId(prefixo) {
  /* crypto.randomUUID só existe em sites seguros (https ou localhost).
     Abrindo pelo IP da rede (http://192.168...), no celular, ele não
     existe: aí usamos o horário + um número sorteado */
  const aleatorio = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefixo}-${aleatorio}`;
}
