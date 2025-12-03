// Arquivo: /modulos/voluntario/js/detalhes-paciente/configurar-eventos.js
// Responsável por adicionar todos os event listeners da página.

import * as handlers from "./manipuladores.js";
import * as interfaceUI from "./interface.js";
import * as estado from "./estado.js"; // Pode ser necessário para alguns handlers delegados

// --- Importação dos Handlers de Modais ---
import {
  handleAbrirAnotacoes,
  handleSalvarAnotacoes,
} from "./modais/modal-anotacoes.js";
import {
  abrirModalMensagens,
  handleMensagemSubmit,
} from "./modais/modal-mensagens.js";
import {
  abrirModalReavaliacao,
  handleReavaliacaoSubmit,
} from "./modais/modal-reavaliacao.js";
import {
  abrirModalDesfechoPb,
  handleDesfechoPbSubmit,
  abrirModalEncerramento,
  handleEncerramentoSubmit,
  abrirModalEncaminhamentoPb, // ADICIONADO: Nova função de abertura de Encaminhamento
  handleEncaminhamentoPbSubmit, // ADICIONADO: Novo handler de submit de Encaminhamento
} from "./modais/modal-desfecho.js"; // Módulo que agora contém a lógica de Desfecho e Encaminhamento
import {
  abrirModalHorariosPb,
  handleHorariosPbSubmit,
} from "./modais/modal-horarios-pb.js";
import {
  abrirModalSolicitarSessoes,
  handleSolicitarSessoesSubmit,
  abrirModalAlterarHorario,
  handleAlterarHorarioSubmit,
} from "./modais/modal-antigos.js";
// -----------------------------------------------------------

/**
 * Adiciona os event listeners gerais da página (abas, formulários, acordeão, lista de sessões).
 */
export function adicionarEventListenersGerais() {
  console.log("Adicionando event listeners gerais..."); // Abas Principais Verticais

  document
    .querySelectorAll(".detalhe-paciente-tabs-column .tab-link")
    .forEach((link) => {
      link.removeEventListener("click", interfaceUI.handleTabClick); // Remove listener antigo se houver
      link.addEventListener("click", interfaceUI.handleTabClick);
    }); // Forms Editáveis (usando 'click' para botões de salvar, 'submit' para forms)

  document
    .getElementById("btn-salvar-info-pessoais")
    ?.addEventListener("click", handlers.handleSalvarDadosPessoaisEEndereco);
  document
    .getElementById("btn-salvar-endereco")
    ?.addEventListener("click", handlers.handleSalvarDadosPessoaisEEndereco); // Mesmo handler
  document
    .getElementById("form-info-financeiras")
    ?.addEventListener("submit", handlers.handleSalvarInfoFinanceiras);
  document
    .getElementById("acompanhamento-clinico-form")
    ?.addEventListener("submit", handlers.handleSalvarAcompanhamento); // Ações da Lista de Sessões (delegação de evento)

  const sessionListContainer = document.getElementById(
    "session-list-container"
  );

  if (sessionListContainer) {
    // Remove listener antigo para evitar duplicação (boa prática)
    const newContainer = sessionListContainer.cloneNode(true);
    sessionListContainer.parentNode.replaceChild(
      newContainer,
      sessionListContainer
    );

    newContainer.addEventListener("click", (event) => {
      // 1. Lógica para abrir/fechar o menu dropdown
      const toggleBtn = event.target.closest(
        '[data-action="toggle-status-menu"]'
      );
      if (toggleBtn) {
        const menu = toggleBtn.nextElementSibling;
        // Fecha outros menus abertos
        document
          .querySelectorAll(".status-dropdown-menu.active")
          .forEach((m) => {
            if (m !== menu) m.classList.remove("active");
          });
        menu.classList.toggle("active");
        event.stopPropagation(); // Impede que o clique feche imediatamente
        return;
      }

      // 2. Lógica para clique nos itens do menu ou anotações
      const button = event.target.closest("button");
      if (!button) return;

      const sessaoItem = button.closest(".session-item");
      const sessaoId = sessaoItem?.dataset.sessaoId;
      const action = button.dataset.action;

      if (!sessaoId || !action) return;

      if (action === "mudar-status") {
        const novoStatus = button.dataset.novoStatus;
        // Fecha o menu
        button.closest(".status-dropdown-menu").classList.remove("active");
        // Chama o manipulador
        handlers.handleAlterarStatusSessao(sessaoId, novoStatus);
      } else if (action === "anotacoes") {
        handleAbrirAnotacoes(sessaoId);
      }
    });

    // Fecha menus ao clicar fora
    document.addEventListener("click", () => {
      document
        .querySelectorAll(".status-dropdown-menu.active")
        .forEach((m) => m.classList.remove("active"));
    });
  }

  document
    .getElementById("btn-gerar-prontuario-pdf")
    ?.addEventListener("click", handlers.handleGerarProntuarioPDF); // Listener para Acordeão (delegação)

  const accordionContainer = document.querySelector(".accordion-container");
  if (accordionContainer) {
    accordionContainer.addEventListener("click", (event) => {
      const button = event.target.closest(".accordion-button");
      if (button) {
        const accordionItem = button.closest(".accordion-item");
        if (accordionItem) {
          interfaceUI.handleAccordionToggle(accordionItem); // Função da UI
        }
      }
    });
  } // Botão do Menu Hamburger de Ações

  const btnPacienteActions = document.getElementById(
    "btn-paciente-actions-toggle"
  );
  if (btnPacienteActions) {
    btnPacienteActions.addEventListener("click", (event) => {
      event.stopPropagation(); // Impede que o clique feche o menu imediatamente
      const menuContainer = btnPacienteActions.closest(
        ".action-buttons-container.main-actions"
      );
      interfaceUI.togglePacienteActionsMenu(menuContainer); // Função da UI
    });
  }

  // --- NOVO LISTENER: Upload de Arquivo ---
  const fileInput = document.getElementById("ac-novo-arquivo");
  if (fileInput) {
    fileInput.addEventListener("change", handlers.handleUploadArquivo);
  }
}

/**
 * Adiciona os event listeners relacionados aos modais (abertura, fechamento global, submits).
 */
export function adicionarEventListenersModais() {
  console.log("Adicionando event listeners dos modais..."); // --- Listener Global para Fechar Modais e Dropdowns --- // Adiciona UMA VEZ ao body.

  document.body.removeEventListener("click", handleGlobalClick); // Garante que não haja duplicatas
  document.body.addEventListener("click", handleGlobalClick); // --- Botões que ABREM os modais --- // Mapeia ID do botão para a função que abre o modal correspondente

  const modalOpeners = {
    "btn-abrir-modal-mensagem": abrirModalMensagens,
    "btn-abrir-modal-solicitar-sessoes": abrirModalSolicitarSessoes, // Legado
    "btn-abrir-modal-alterar-horario": abrirModalAlterarHorario, // Legado
    "btn-abrir-modal-reavaliacao": abrirModalReavaliacao,
    "btn-abrir-modal-desfecho-pb": abrirModalDesfechoPb,
    "btn-abrir-modal-encerramento-plantao": abrirModalEncerramento,
    "btn-abrir-modal-horarios-pb": abrirModalHorariosPb, // Novo fluxo
    "btn-abrir-modal-encaminhamento-pb": abrirModalEncaminhamentoPb, // ADICIONADO NOVO BOTÃO
  };

  Object.entries(modalOpeners).forEach(([buttonId, openFunction]) => {
    const button = document.getElementById(buttonId);
    if (button) {
      // Remove listener antigo (se houver) para evitar adicionar múltiplos
      // Isso requer que 'openFunction' seja uma referência estável (não uma função anônima)
      // button.removeEventListener('click', openFunction); // Pode ser necessário se init rodar mais de uma vez
      button.addEventListener("click", openFunction);
    } else {
      console.warn(`Botão ${buttonId} para abrir modal não encontrado.`);
    }
  }); // --- Submits dos Forms DENTRO dos Modais --- // Usamos delegação no body para forms que são carregados dinamicamente (Desfecho PB) // ou para simplificar.

  document.body.removeEventListener("submit", handleModalFormSubmit); // Evita duplicatas
  document.body.addEventListener("submit", handleModalFormSubmit); // Adiciona listener para cliques em botões específicos dentro dos modais legados (delegação no body)

  document.body.removeEventListener("click", handleModalButtonClick); // Evita duplicatas
  document.body.addEventListener("click", handleModalButtonClick); // Listener específico para abas DENTRO do modal de anotações (se ele já existir no HTML inicial)

  const anotacoesModalBody = document.querySelector(
    "#anotacoes-sessao-modal .modal-body"
  );
  if (anotacoesModalBody) {
    anotacoesModalBody.addEventListener("click", (event) => {
      const clickedTabLink = event.target.closest(
        "#anotacoes-tabs-nav .tab-link"
      );
      if (clickedTabLink && !clickedTabLink.classList.contains("active")) {
        interfaceUI.handleTabClick({ currentTarget: clickedTabLink }); // Reusa a função de tab da UI
      }
    });
  }
}

// --- Funções Auxiliares para os Listeners ---

/**
 * Handler global para cliques no body, usado para fechar modais/dropdowns.
 */
function handleGlobalClick(e) {
  const target = e.target;
  let closeModal = false;
  let clickedInsideModalContent = false;
  let clickedInsideDropdown = false; // Verifica clique em botão de fechar/cancelar modal

  if (
    target.matches(".modal-cancel-btn, .close-button") ||
    target.closest(".modal-cancel-btn, .close-button")
  ) {
    closeModal = true;
  } // Verifica se o clique foi dentro do conteúdo de um modal aberto

  clickedInsideModalContent = !!target.closest(".modal-content"); // Verifica se o clique foi dentro de um dropdown ou menu de ações

  clickedInsideDropdown = !!target.closest(
    ".dropdown-container, .action-buttons-container.main-actions"
  ); // Fecha Modal se clicou no botão fechar/cancelar OU fora do conteúdo do modal

  const modalAberto = target.closest(".modal-overlay[style*='display: flex']");
  if (
    modalAberto &&
    (closeModal ||
      (!clickedInsideModalContent && !target.closest(".dropdown-item")))
  ) {
    // A condição !target.closest('.dropdown-item') evita fechar modal ao clicar em item de dropdown DENTRO do modal
    modalAberto.style.display = "none";
  } // Fecha dropdowns se o clique foi fora deles

  if (!clickedInsideDropdown) {
    interfaceUI.closeDropdownOnClickOutside(e);
  }
}

/**
 * Handler delegado para submits de forms DENTRO de modais.
 */
async function handleModalFormSubmit(e) {
  const form = e.target; // Mapeia IDs de forms para suas funções de submit
  const formSubmitHandlers = {
    "anotacoes-sessao-form": handleSalvarAnotacoes,
    "encerramento-form": (ev) =>
      handleEncerramentoSubmit(
        ev,
        estado.userDataGlobal?.uid,
        estado.userDataGlobal
      ), // Precisa passar dados do user
    "horarios-pb-form": (ev) =>
      handleHorariosPbSubmit(
        ev,
        estado.userDataGlobal?.uid,
        estado.userDataGlobal
      ), // Precisa passar dados do user
    "form-atendimento-pb": handleDesfechoPbSubmit, // Desfecho (Alta/Desistência)
    "form-encaminhamento-pb": handleEncaminhamentoPbSubmit, // NOVO HANDLER: Encaminhamento
    "reavaliacao-form": handleReavaliacaoSubmit, // Adicionado // Forms dos modais legados (se eles usarem submit e não click no botão) // "solicitar-sessoes-form": handleSolicitarSessoesSubmit, // Se fosse submit // "alterar-horario-form": handleAlterarHorarioSubmit, // Se fosse submit
  };

  if (form.id in formSubmitHandlers) {
    e.preventDefault(); // Previne o submit padrão do HTML
    try {
      await formSubmitHandlers[form.id](e); // Chama o handler específico
    } catch (error) {
      console.error(`Erro no submit do form ${form.id}:`, error); // Poderia mostrar uma mensagem genérica de erro aqui se o handler não o fizer
    }
  }
}

/**
 * Handler delegado para cliques em BOTÕES específicos dentro de modais (principalmente os legados).
 */
async function handleModalButtonClick(e) {
  const button = e.target.closest("button");
  if (!button) return; // Verifica se o clique foi DENTRO do modal Horarios PB para ignorar botões legados que podem ter o mesmo ID

  const isInHorariosPbModal = !!button.closest("#horarios-pb-modal");
  if (isInHorariosPbModal) return; // Ignora cliques nos botões se estiverem dentro do modal Horários PB (que usa submit)

  const buttonClickHandlers = {
    "btn-confirmar-solicitacao": handleSolicitarSessoesSubmit, // Legado
    "btn-confirmar-alteracao-horario": handleAlterarHorarioSubmit, // Legado
    "btn-gerar-enviar-whatsapp": handleMensagemSubmit, // O submit de reavaliação foi movido para handleModalFormSubmit // "btn-confirmar-reavaliacao": handleReavaliacaoSubmit,
  };

  if (button.id in buttonClickHandlers) {
    e.preventDefault(); // Previne comportamento padrão do botão se for type="submit" por engano
    try {
      await buttonClickHandlers[button.id](e); // Chama o handler específico
    } catch (error) {
      console.error(`Erro no clique do botão ${button.id}:`, error);
    }
  }
}
