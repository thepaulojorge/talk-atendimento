import { useEstado } from "../estado/useEstado.js";
import { avisar } from "../estado/avisos.js";
import { useArquivo } from "../hooks/useArquivo.js";
import { baixarArquivo, ehImagem, enderecoDoArquivo, extensao, formatarTamanho } from "../utilidades/arquivos.js";
import Icone from "./Icone.jsx";

/* O conteúdo de uma mensagem com ARQUIVO:
   - foto: a própria imagem (clique abre em tamanho real, numa aba nova)
   - documento: um cartão com o tipo, o nome, o tamanho e o botão de baixar */
export default function BalaoArquivo({ arquivo }) {
  if (!arquivo) return <div className="anexo anexo--indisponivel">📎 Arquivo indisponível</div>;
  return ehImagem(arquivo) ? <Foto arquivo={arquivo} /> : <Documento arquivo={arquivo} />;
}

function Foto({ arquivo }) {
  // A foto é baixada assim que a mensagem aparece (como no WhatsApp)
  const { endereco, erro } = useArquivo(arquivo.id);

  if (erro) return <div className="anexo anexo--indisponivel">🖼️ {erro}</div>;
  if (!endereco) return <div className="anexo-foto anexo-foto--carregando" aria-label="Carregando foto" />;

  return (
    // Um <a> com target="_blank": abre a foto inteira numa aba nova
    <a className="anexo-foto" href={endereco} target="_blank" rel="noreferrer" title={arquivo.nome}>
      <img src={endereco} alt={arquivo.nome} />
    </a>
  );
}

function Documento({ arquivo }) {
  const { estado, despachar } = useEstado();
  const token = estado.sessao?.token;
  const pdf = arquivo.tipo === "application/pdf";

  // O documento só é baixado quando a pessoa pede (pode ser grande)
  async function abrir() {
    try {
      if (pdf) {
        // PDF o navegador sabe mostrar: abre numa aba nova
        const endereco = await enderecoDoArquivo(token, arquivo.id);
        window.open(endereco, "_blank", "noopener");
      } else {
        await baixarArquivo(token, arquivo);
      }
    } catch (erro) {
      avisar(despachar, erro.message);
    }
  }

  async function baixar(evento) {
    evento.stopPropagation(); // o clique no botão não "abre" o cartão também
    try {
      await baixarArquivo(token, arquivo);
    } catch (erro) {
      avisar(despachar, erro.message);
    }
  }

  return (
    <div className="anexo" role="button" tabIndex={0} onClick={abrir} onKeyDown={(e) => e.key === "Enter" && abrir()}>
      <span className="anexo__selo" data-tipo={extensao(arquivo.nome).toLowerCase()}>
        {extensao(arquivo.nome)}
      </span>
      <span className="anexo__info">
        <span className="anexo__nome">{arquivo.nome}</span>
        <span className="anexo__tamanho">
          {formatarTamanho(arquivo.tamanho)} · {pdf ? "clique para abrir" : "clique para baixar"}
        </span>
      </span>
      <button type="button" className="anexo__baixar" aria-label={`Baixar ${arquivo.nome}`} onClick={baixar}>
        <Icone nome="download" />
      </button>
    </div>
  );
}
