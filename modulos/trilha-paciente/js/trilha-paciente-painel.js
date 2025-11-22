// Arquivo: /modulos/trilha-paciente/js/trilha-paciente-painel.js
// Versão: 9.1 (Adiciona Logs de Depuração)

import { init as initKanban } from "./trilha-paciente.js";

const menuFilters = {
  entrada: ["inscricao_documentos", "triagem_agendada"],
  plantao: ["encaminhar_para_plantao", "em_atendimento_plantao"],
  pb: [
    "encaminhar_para_pb",
    "aguardando_info_horarios",
    "cadastrar_horario_psicomanager",
    "em_atendimento_pb",
  ],
  outros: ["pacientes_parcerias", "grupos", "aguardando_reavaliacao"],
  encerramento: ["desistencia", "alta"],
};

// Variáveis que serão inicializadas
let firestoreDb, authUser, authUserData;

export function init(db, user, userData) {
  console.log("--- [LOG] Iniciando 'trilha-paciente-painel.js' ---");
  firestoreDb = db;
  authUser = user;
  authUserData = userData;

  const sidebarMenu = document.getElementById("sidebar-menu");
  const contentArea = document.getElementById("content-area");

  if (!sidebarMenu || !contentArea) {
    console.error(
      "[LOG] Erro Crítico: Elementos 'sidebar-menu' ou 'content-area' não encontrados no DOM."
    );
    return;
  }

  console.log("[LOG] Passo 1: Construindo o submenu da Trilha.");
  buildSubmenu(sidebarMenu);

  console.log("[LOG] Passo 2: Inserindo área de conteúdo do módulo.");
  contentArea.innerHTML = `
    <div id="module-content-area" class="module-content" style="height: 100%;">
        <div class="loading-spinner"></div>
    </div>
 `;

  console.log("[LOG] Passo 3: Configurando os listeners do submenu.");
  setupSubmenuListeners(sidebarMenu);

  const initialView = window.location.hash.replace("#", "") || "entrada";
  console.log(`[LOG] Passo 4: Carregando a visão inicial: '${initialView}'`);
  loadView(initialView);
}

function buildSubmenu(sidebarMenu) {
  sidebarMenu.innerHTML = `
    <li>
        <a href="../../../index.html" class="back-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            <span>Voltar à Intranet</span>
        </a>
    </li>
    <li class="menu-separator"></li>
    <li><a href="#entrada" data-view="entrada" class="active">Entrada</a></li>
    <li><a href="#plantao" data-view="plantao">Plantão</a></li>
    <li><a href="#pb" data-view="pb">PB</a></li>
    <li><a href="#outros" data-view="outros">Outros</a></li>
    <li><a href="#encerramento" data-view="encerramento">Encerramento</a></li>
 `;
}

function setupSubmenuListeners(sidebarMenu) {
  sidebarMenu.addEventListener("click", (e) => {
    const link = e.target.closest("a[data-view]");
    if (link && !link.classList.contains("back-link")) {
      e.preventDefault();
      console.log(
        `[LOG] Clique no submenu detectado. Visão selecionada: '${link.dataset.view}'`
      );

      sidebarMenu
        .querySelectorAll("a[data-view]")
        .forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      const view = link.getAttribute("data-view");
      window.location.hash = view;
      loadView(view);
    }
  });
}

async function loadView(view) {
  const moduleContentArea = document.getElementById("module-content-area");
  if (!moduleContentArea) {
    console.error(
      "[LOG] Erro Crítico: 'module-content-area' não encontrado para carregar a visão."
    );
    return;
  }

  console.log(`[LOG] Carregando a visão '${view}'...`);
  moduleContentArea.innerHTML = `<div class="loading-spinner"></div>`;

  try {
    const filter = menuFilters[view];
    if (!filter) {
      throw new Error(`Filtro de visão não encontrado para: ${view}`);
    }
    console.log(`[LOG] Filtro para a visão '${view}':`, filter);
    console.log(
      "[LOG] Chamando 'initKanban' do arquivo 'trilha-paciente.js'..."
    );

    await initKanban(
      firestoreDb,
      authUser,
      authUserData,
      moduleContentArea,
      filter
    );

    console.log(
      `[LOG] 'initKanban' para a visão '${view}' foi concluído com sucesso.`
    );
  } catch (error) {
    console.error(`[LOG] ERRO ao carregar a visão ${view}:`, error);
    moduleContentArea.innerHTML = `<div class="error-message">Ocorreu um erro ao carregar esta visualização. Verifique o console.</div>`;
  }
}
