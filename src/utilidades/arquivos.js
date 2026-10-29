/* ARQUIVOS no front: regras, textos e o "cache" dos arquivos já baixados */
import { buscarArquivo } from "../api.js";

export const LIMITE_ARQUIVO = 10 * 1024 * 1024; // 10 MB: o mesmo limite do servidor

/* O que cada opção do menu "+" deixa escolher.
   "accept" filtra a janela de arquivos do sistema; "tipos" é a lista que
   conferimos de verdade (a mesma do servidor). A janela é só uma ajuda:
   dá para escolher "Todos os arquivos" nela e passar qualquer coisa */
export const CATEGORIAS = {
  documento: {
    accept: ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv",
    tipos: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
    ],
  },
  foto: { accept: "image/jpeg,image/png,image/webp,image/gif", tipos: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  audio: {
    accept: "audio/*",
    tipos: ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/aac"],
  },
};

// "audio/webm;codecs=opus" -> "audio/webm"
export const tipoBase = (tipo = "") => tipo.split(";")[0].trim().toLowerCase();

/* O Windows às vezes não informa o tipo de .csv, .doc ou .xls (vem "").
   Aí descobrimos pela extensão do nome */
const PELA_EXTENSAO = {
  csv: "text/csv",
  txt: "text/plain",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  pdf: "application/pdf",
};
export function tipoDoArquivo(arquivo) {
  const tipo = tipoBase(arquivo.type);
  if (tipo) return tipo;
  const extensao = arquivo.name?.split(".").pop()?.toLowerCase();
  return PELA_EXTENSAO[extensao] || "";
}

// Algum problema com este arquivo? Devolve a explicação, ou null
export function problemaDoArquivo(arquivo, categoria) {
  if (arquivo.size === 0) return `"${arquivo.name}" está vazio.`;
  if (arquivo.size > LIMITE_ARQUIVO) return `"${arquivo.name}" passa do limite de 10 MB.`;
  if (!CATEGORIAS[categoria].tipos.includes(tipoDoArquivo(arquivo))) return `"${arquivo.name}": este tipo de arquivo não é aceito.`;
  return null;
}

// 1536 -> "1,5 KB"; 2400000 -> "2,3 MB"
export function formatarTamanho(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

// "audio/webm" -> "audio-14h32.webm" (o nome do áudio gravado, com a hora)
export function nomeDoAudioGravado(tipo) {
  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  return `audio-${hora}.${tipo.split("/")[1] || "webm"}`;
}

export const ehImagem = (arquivo) => tipoBase(arquivo?.tipo).startsWith("image/");

// "orcamento.pdf" -> "PDF" (o selo no cartão do documento)
export function extensao(nome = "") {
  const partes = nome.split(".");
  return partes.length > 1 ? partes.pop().toUpperCase().slice(0, 4) : "ARQ";
}

/* ---------- O "cache" ----------
   Buscar um arquivo custa um pedido ao servidor. Guardamos o resultado
   num Map (id -> Promise do endereço), para cada arquivo ser buscado UMA
   vez só, mesmo que apareça em vários lugares (ou role para fora e volte).

   URL.createObjectURL(blob) cria um endereço "blob:http://..." que aponta
   para os bytes na memória do navegador. Esse endereço funciona no
   <img src>, no <audio> e em links de download */
const cache = new Map();

export function enderecoDoArquivo(token, id) {
  if (!cache.has(id)) {
    const promessa = buscarArquivo(token, id).then((blob) => URL.createObjectURL(blob));
    // Deu erro? Tira do cache: na próxima vez, tenta de novo
    promessa.catch(() => cache.delete(id));
    cache.set(id, promessa);
  }
  return cache.get(id);
}

// Acabou de enviar? Já temos os bytes: guarda direto, sem baixar de volta
export function guardarNoCache(id, blob) {
  cache.set(id, Promise.resolve(URL.createObjectURL(blob)));
}

// Baixar com o nome original: um link <a download> "clicado" pelo código
export async function baixarArquivo(token, arquivo) {
  const endereco = await enderecoDoArquivo(token, arquivo.id);
  const link = document.createElement("a");
  link.href = endereco;
  link.download = arquivo.nome;
  link.click();
}

/* Quanto dura um arquivo de áudio? O navegador lê o começo do arquivo
   (os "metadados") e descobre. Se não conseguir em 5 segundos: 0 */
export function medirDuracao(blob) {
  return new Promise((resolver) => {
    const audio = new Audio();
    const endereco = URL.createObjectURL(blob);
    const terminar = (segundos) => {
      URL.revokeObjectURL(endereco); // libera a memória do endereço temporário
      resolver(segundos);
    };
    audio.addEventListener("loadedmetadata", () => terminar(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0));
    audio.addEventListener("error", () => terminar(0));
    setTimeout(() => terminar(0), 5000);
    audio.src = endereco;
  });
}
