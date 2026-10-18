/* Funções de texto. Não dependem de React nem do estado:
   recebem um valor e devolvem outro ("funções puras"). */

/* Deixa o texto "comparável": sem acento e minúsculo.
   "Lúcia" -> "lucia" | "JOÃO" -> "joao" */
export function normalizar(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// "+55 21 98811-0001" -> "5521988110001"
export function somenteDigitos(texto) {
  return (texto || "").replace(/\D/g, "");
}

// "Mariana Souza" -> "MS"
export function iniciais(nome) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("");
}

/* Cor do avatar a partir do nome (um "hash"): o mesmo nome dá sempre
   o mesmo número, então a cor nunca precisa ser guardada.
   Devolve um tom do círculo de cores: 0°, 20°, 40°... 340° */
export function matizDoNome(nome) {
  let numero = 0;
  for (const letra of normalizar(nome)) {
    numero = (numero * 31 + letra.codePointAt(0)) >>> 0;
  }
  return (numero % 18) * 20;
}

// 14 -> "0:14" | 75 -> "1:15"
export function formatarDuracao(segundos) {
  const min = Math.floor(segundos / 60);
  const seg = String(segundos % 60).padStart(2, "0");
  return `${min}:${seg}`;
}
