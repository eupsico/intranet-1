// Arquivo: /modulos/voluntario/js/meus-pacientes/events.js

import { db, doc, getDoc } from "../../../../assets/js/firebase-init.js";
import { handleEnviarContrato, gerarPdfContrato } from "./actions.js";
import {
  abrirModalEncerramento,
  abrirModalHorariosPb,
  abrirModalDesfechoPb,
  abrirModalSolicitarSessoes,
  abrirModalMensagens,
  handleEncerramentoSubmit,
  handleHorariosPbSubmit,
} from "./modals.js";

export function adicionarEventListenersGerais(user, userData, loadedData) {
  const container = document.getElementById("pacientes-accordion-container");
  if (!container) return;

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
      case "contrato":
        handleEnviarContrato(
          pacienteId,
          atendimentoId,
          accordion.dataset.telefone,
          dadosDoPaciente.nomeCompleto,
          dependencies
        );
        break;
      case "desfecho_pb":
        abrirModalDesfechoPb(pacienteId, atendimentoId, dadosDoPaciente);
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

  // Listeners para os formulários dos modais
  document
    .getElementById("encerramento-form")
    .addEventListener("submit", (e) =>
      handleEncerramentoSubmit(e, user, userData)
    );
  document
    .getElementById("horarios-pb-form")
    .addEventListener("submit", (e) =>
      handleHorariosPbSubmit(e, user, userData)
    );
}
