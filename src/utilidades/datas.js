/* Datas "humanas", como no WhatsApp.
   Lista:      hoje "14:20" | ontem "Ontem" | até 6 dias "Sábado" | este ano "08/10" | antes "08/10/25"
   Separador:  "Hoje" | "Ontem" | "Segunda-feira" | "8 de outubro" | "8 de outubro de 2025" */

/* Quantos dias de CALENDÁRIO se passaram (não horas!): comparamos
   as meias-noites. Uma mensagem de ontem às 23h, vista hoje à 1h, é de "Ontem" */
export function diasAtras(data) {
  const meiaNoiteHoje = new Date();
  meiaNoiteHoje.setHours(0, 0, 0, 0);
  const meiaNoiteDaData = new Date(data);
  meiaNoiteDaData.setHours(0, 0, 0, 0);
  // Math.round: em dias de horário de verão, um "dia" pode ter 23 ou 25 horas
  return Math.round((meiaNoiteHoje - meiaNoiteDaData) / (24 * 60 * 60 * 1000));
}

// "sábado" -> "Sábado"
function primeiraMaiuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function formatarHoraMensagem(iso) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatarHoraLista(iso) {
  const data = new Date(iso);
  const dias = diasAtras(data);

  if (dias === 0) return formatarHoraMensagem(iso);
  if (dias === 1) return "Ontem";
  if (dias > 1 && dias < 7) {
    // Na lista o espaço é curto: "Segunda-feira" vira "Segunda"
    const semana = data.toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
    return primeiraMaiuscula(semana);
  }
  if (data.getFullYear() === new Date().getFullYear()) {
    return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function formatarDia(iso) {
  const data = new Date(iso);
  const dias = diasAtras(data);

  if (dias === 0) return "Hoje";
  if (dias === 1) return "Ontem";
  if (dias > 1 && dias < 7) {
    return primeiraMaiuscula(data.toLocaleDateString("pt-BR", { weekday: "long" }));
  }
  // O ano só aparece quando não é o ano atual
  const opcoes = { day: "numeric", month: "long" };
  if (data.getFullYear() !== new Date().getFullYear()) opcoes.year = "numeric";
  return data.toLocaleDateString("pt-BR", opcoes);
}

/* As datas do dados.json são fixas. Para os exemplos nunca ficarem "velhos",
   empurramos TODAS as datas a mesma quantidade de dias, até a mensagem mais
   recente cair em hoje (ou ontem, se cairia no futuro).
   Atenção: esta função ALTERA os objetos que recebe. Por isso só é usada
   nos dados recém-baixados, antes de irem para o estado do React. */
export function trazerDatasParaPerto(conversas, auditoria = []) {
  const campos = ["horario", "editadaEm", "apagadaEm"];
  const todasAsMensagens = conversas.flatMap((c) => c.mensagens);
  if (todasAsMensagens.length === 0) return;

  const maisRecente = new Date(Math.max(...todasAsMensagens.map((m) => new Date(m.horario))));

  let deslocamento = diasAtras(maisRecente);
  const comoFicaria = new Date(maisRecente);
  comoFicaria.setDate(comoFicaria.getDate() + deslocamento);
  if (comoFicaria > new Date()) deslocamento -= 1; // não pode ficar no futuro
  if (deslocamento <= 0) return;

  const empurrar = (iso) => {
    const data = new Date(iso);
    data.setDate(data.getDate() + deslocamento);
    return data.toISOString();
  };

  conversas.forEach((conversa) => {
    if (conversa.fixadaEm) conversa.fixadaEm = empurrar(conversa.fixadaEm);
    conversa.mensagens.forEach((msg) => {
      campos.forEach((campo) => {
        if (msg[campo]) msg[campo] = empurrar(msg[campo]);
      });
    });
  });
  auditoria.forEach((registro) => {
    registro.quando = empurrar(registro.quando);
  });
}
