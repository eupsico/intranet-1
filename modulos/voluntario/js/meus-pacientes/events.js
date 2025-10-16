// Arquivo: /modulos/voluntario/js/meus-pacientes/events.js

import { db, doc, getDoc } from "../../../../assets/js/firebase-init.js";
import { gerarPdfContrato } from "./actions.js";
import {
  abrirModalEncerramento,
  abrirModalHorariosPb,
  abrirModalDesfechoPb,
  abrirModalSolicitarSessoes,
  abrirModalMensagens,
  handleEncerramentoSubmit,
  handleHorariosPbSubmit,
  handleSolicitarSessoesSubmit,
  handleMensagemSubmit,
} from "./modals.js";

export function adicionarEventListenersGerais(user, userData, loadedData) {
  const container = document.getElementById("pacientes-accordion-container");
  if (!container) return;

  // --- CORREÇÃO DEFINITIVA: Listener global para fechar TODOS os modais ---
  document.body.addEventListener("click", function (e) {
    // Verifica se o clique foi em um botão com a classe 'close-modal-btn'
    if (
      e.target.matches(".close-modal-btn") ||
      e.target.closest(".close-modal-btn")
    ) {
      // Encontra o modal pai que está visível e o esconde
      const modalAberto = e.target.closest(".modal-overlay, .modal");
      if (modalAberto) {
        modalAberto.style.display = "none";
      }
    }
  });

  // Listener principal para o container de pacientes
  container.addEventListener("click", async (e) => {
    const header = e.target.closest(".accordion-header");
    if (header) {
      const content = header.nextElementSibling;
      const isActive = header.classList.contains("active");
      document.querySelectorAll(".accordion-header.active").forEach((h) => {
        if (h !== header) {
          h.classList.remove("active");
          h.nextElementSibling.style.maxHeight = null;
        }
      });
      header.classList.toggle("active", !isActive);
      content.style.maxHeight = !isActive ? content.scrollHeight + "px" : null;
      return;
    }

    const botao = e.target.closest(".action-button");
    if (!botao) return;

    const accordion = botao.closest(".paciente-accordion");
    const pacienteId = accordion.dataset.id;
    const atendimentoId = accordion.dataset.atendimentoId;
    const tipoDeAcao = botao.dataset.tipo;

    const docRef = doc(db, "trilhaPaciente", pacienteId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      alert("Paciente não encontrado!");
      return;
    }
    const dadosDoPaciente = { id: docSnap.id, ...docSnap.data() };
    const meuAtendimento = dadosDoPaciente.atendimentosPB?.find(
      (at) => at.atendimentoId === atendimentoId
    );

    const dependencies = { user, userData, ...loadedData };

    switch (tipoDeAcao) {
      case "plantao":
        abrirModalEncerramento(pacienteId, dadosDoPaciente);
        break;
      case "pb_horarios":
        abrirModalHorariosPb(pacienteId, atendimentoId, dependencies);
        break;
      case "desfecho_pb":
        abrirModalDesfechoPb(dadosDoPaciente, meuAtendimento);
        break;
      case "pdf_contrato":
        gerarPdfContrato(dadosDoPaciente, meuAtendimento);
        break;
      case "solicitar_sessoes":
        abrirModalSolicitarSessoes(
          dadosDoPaciente,
          meuAtendimento,
          dependencies
        );
        break;
      case "whatsapp":
        abrirModalMensagens(dadosDoPaciente, meuAtendimento, dependencies);
        break;
    }
  });

  // Listeners para os botões de SUBMIT dos modais
  document
    .getElementById("btn-confirmar-solicitacao")
    ?.addEventListener("click", handleSolicitarSessoesSubmit);
  document
    .getElementById("btn-gerar-enviar-whatsapp")
    ?.addEventListener("click", handleMensagemSubmit);

  // Os listeners de submit dos outros formulários são adicionados dinamicamente em modals.js
}
