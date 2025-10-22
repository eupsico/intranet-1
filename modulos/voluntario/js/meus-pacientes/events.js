// Arquivo: /modulos/voluntario/js/meus-pacientes/events.js

import { db, doc, getDoc } from "../../../../assets/js/firebase-init.js";
import { gerarPdfContrato } from "./actions.js";
import {
  abrirModalEncerramento,
  abrirModalHorariosPb,
  abrirModalDesfechoPb,
  abrirModalSolicitarSessoes,
  abrirModalMensagens,
  // --- INÍCIO DA MODIFICAÇÃO ---
  abrirModalAlterarHorario, // Importa a nova função
  handleAlterarHorarioSubmit, // Importa a nova função de submit
  // --- FIM DA MODIFICAÇÃO ---

  // --- INÍCIO DA ALTERAÇÃO (Reavaliação) ---
  abrirModalReavaliacao,
  handleReavaliacaoSubmit,
  // --- FIM DA ALTERAÇÃO (Reavaliação) ---
  handleEncerramentoSubmit, // Mantém as existentes
  handleHorariosPbSubmit,
  handleSolicitarSessoesSubmit,
  handleMensagemSubmit,
} from "./modals.js";

export function adicionarEventListenersGerais(user, userData, loadedData) {
  const container = document.getElementById("pacientes-accordion-container");
  if (!container) return;

  // Listener global para fechar modais pelo botão Cancelar/Fechar
  document.body.addEventListener("click", function (e) {
    if (
      e.target.matches(".modal-cancel-btn") ||
      e.target.closest(".modal-cancel-btn") ||
      e.target.matches(".close-button") || // Adiciona listener para spans com classe close-button
      e.target.closest(".close-button")
    ) {
      const modalAberto = e.target.closest(".modal-overlay, .modal");
      if (modalAberto) {
        modalAberto.style.display = "none";
      }
    }
  });

  // Listener principal para o container de pacientes
  container.addEventListener("click", async (e) => {
    // Lógica para abrir/fechar accordion (mantida)
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

    // Lógica para botões de ação
    const botao = e.target.closest(".action-button");
    if (!botao) return;

    const accordion = botao.closest(".paciente-accordion");
    const pacienteId = accordion.dataset.id;
    const atendimentoId = accordion.dataset.atendimentoId;
    const tipoDeAcao = botao.dataset.tipo;

    // Busca dados do paciente (mantida)
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

    const dependencies = { user, userData, ...loadedData }; // Agrupa dados necessários

    // Direciona a ação baseada no data-tipo do botão
    switch (tipoDeAcao) {
      case "plantao":
        abrirModalEncerramento(pacienteId, dadosDoPaciente);
        break;
      case "pb_horarios":
        abrirModalHorariosPb(pacienteId, atendimentoId, dependencies);
        break;
      case "desfecho_pb":
        abrirModalDesfechoPb(dadosDoPaciente, meuAtendimento, dependencies);
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
      // --- INÍCIO DA MODIFICAÇÃO ---
      case "alterar_horario": // Novo case para o botão
        abrirModalAlterarHorario(dadosDoPaciente, meuAtendimento, dependencies);
        break;
      // --- FIM DA MODIFICAÇÃO ---
      case "whatsapp":
        abrirModalMensagens(dadosDoPaciente, meuAtendimento, dependencies);
        break;

      // --- INÍCIO DA ALTERAÇÃO (Reavaliação) ---
      case "reavaliacao":
        abrirModalReavaliacao(dadosDoPaciente, meuAtendimento, dependencies);
        break;
      // --- FIM DA ALTERAÇÃO (Reavaliação) ---
    }
  });

  // Listeners para os botões de SUBMIT dos modais
  document
    .getElementById("btn-confirmar-solicitacao")
    ?.addEventListener("click", handleSolicitarSessoesSubmit);
  document
    .getElementById("btn-gerar-enviar-whatsapp")
    ?.addEventListener("click", handleMensagemSubmit);

  // --- INÍCIO DA MODIFICAÇÃO ---
  // Listener para o botão de submit do novo modal
  document
    .getElementById("btn-confirmar-alteracao-horario")
    ?.addEventListener("click", handleAlterarHorarioSubmit);
  // --- FIM DA MODIFICAÇÃO ---

  // --- INÍCIO DA ALTERAÇÃO (Reavaliação) ---
  document
    .getElementById("btn-confirmar-reavaliacao")
    ?.addEventListener("click", handleReavaliacaoSubmit);
  // --- FIM DA ALTERAÇÃO (Reavaliação) ---

  // Os listeners de submit dos formulários #encerramento-form e #horarios-pb-form
  // são adicionados diretamente aos botões de submit dentro de modals.js
  // (Ex: via form="ID_DO_FORMULARIO" no botão e um listener no submit do form)
  // Certifique-se que handleEncerramentoSubmit e handleHorariosPbSubmit
  // estão sendo corretamente atrelados aos seus respectivos formulários/botões.
  // Pelo código em modals.js, eles parecem estar usando o atributo 'form' no botão,
  // então um listener no 'submit' do formulário é o ideal.

  const encerramentoForm = document.getElementById("encerramento-form");
  if (encerramentoForm) {
    encerramentoForm.addEventListener("submit", (e) =>
      handleEncerramentoSubmit(e, user, userData)
    );
  }

  const horariosPbForm = document.getElementById("horarios-pb-form");
  if (horariosPbForm) {
    horariosPbForm.addEventListener("submit", (e) =>
      handleHorariosPbSubmit(e, user, userData)
    );
  }

  // O listener para handleDesfechoPbSubmit é adicionado dinamicamente em abrirModalDesfechoPb
}
