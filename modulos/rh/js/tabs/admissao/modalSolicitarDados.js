/**
 * Arquivo: modulos/rh/js/tabs/admissao/modalSolicitarDados.js
 * Descrição: Gerencia o modal de solicitação de dados para admissão.
 */

import {
  functions,
  httpsCallable,
} from "../../../../../assets/js/firebase-init.js";

let candidatoAtual = null;
const modal = document.getElementById("modal-solicitar-dados");

// Listeners de Fechamento
if (modal) {
  modal.querySelectorAll(".fechar-modal-solicitacao").forEach((btn) => {
    btn.addEventListener("click", () => {
      modal.classList.remove("is-visible");
      resetModal();
    });
  });
}

function resetModal() {
  document.getElementById("container-link-gerado").classList.add("hidden");
  document.getElementById("btn-gerar-link-ficha").classList.remove("hidden");
  document.getElementById("link-ficha-admissao").value = "";
}

export function abrirModalSolicitarDados(candidatoId, dadosCandidato) {
  if (!modal) return console.error("Modal de solicitação não encontrado.");

  candidatoAtual = { id: candidatoId, ...dadosCandidato };

  // Preenche dados visuais
  document.getElementById("solicitacao-nome-candidato").textContent =
    dadosCandidato.nome_candidato || "Candidato";

  resetModal();

  // Listener do botão gerar
  const btnGerar = document.getElementById("btn-gerar-link-ficha");
  btnGerar.onclick = handleGerarLink;

  modal.classList.add("is-visible");
}

async function handleGerarLink() {
  const btn = document.getElementById("btn-gerar-link-ficha");
  const prazo = document.getElementById("solicitacao-prazo").value;

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

  try {
    const gerarTokenFunc = httpsCallable(functions, "gerarTokenAdmissao");
    const result = await gerarTokenFunc({
      candidatoId: candidatoAtual.id,
      prazoDias: parseInt(prazo),
    });

    const { url, token } = result.data;

    // Exibe o link
    document.getElementById("container-link-gerado").classList.remove("hidden");
    document.getElementById("link-ficha-admissao").value = url;
    btn.classList.add("hidden"); // Esconde botão gerar

    // Configura botão WhatsApp
    const btnWhats = document.getElementById("btn-enviar-ficha-whatsapp");
    btnWhats.onclick = () => enviarWhatsApp(url);

    // Configura Copiar
    document.getElementById("btn-copiar-link-ficha").onclick = () => {
      navigator.clipboard.writeText(url);
      window.showToast?.("Link copiado!", "success");
    };
  } catch (error) {
    console.error("Erro ao gerar link:", error);
    window.showToast?.("Erro ao gerar link: " + error.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-link me-2"></i> Gerar Link';
  }
}

function enviarWhatsApp(url) {
  const nome = candidatoAtual.nome_candidato.split(" ")[0];
  const telefone = candidatoAtual.telefone_contato || "";

  const msg =
    `Olá ${nome}! Parabéns por avançar em nosso processo.\n\n` +
    `Precisamos que você preencha sua ficha cadastral e envie seus documentos para admissão.\n` +
    `Acesse o link seguro: ${url}\n\n` +
    `Por favor, preencha o quanto antes.`;

  const link = `https://api.whatsapp.com/send?phone=55${telefone.replace(
    /\D/g,
    ""
  )}&text=${encodeURIComponent(msg)}`;
  window.open(link, "_blank");
}
