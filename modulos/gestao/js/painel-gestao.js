// /modulos/gestao/js/painel-gestao.js
// VERSÃO 4.0 (Com separação de Agendar e Registar)

const views = {
  "dashboard-reunioes": {
    html: "dashboard-reunioes.html",
    js: "../js/dashboard-reunioes.js",
  },
  "agendar-reuniao": {
    html: "agendar-reuniao.html",
    js: "../js/agendar-reuniao.js",
  },
  "ata-de-reuniao": {
    html: "ata-de-reuniao.html",
    js: "../js/ata-de-reuniao.js",
  },
  "plano-de-acao": { html: "plano-de-acao.html", js: "../js/plano-de-acao.js" },
  "relatorio-feedback": {
    html: "relatorio-feedback.html",
    js: "../js/relatorio-feedback.js",
  },
};

let appUser, appUserData;

export function init(user, userData) {
  appUser = user;
  appUserData = userData;
  buildGestaoSidebarMenu();
  window.addEventListener("hashchange", handleNavigation);
  handleNavigation();
}

function buildGestaoSidebarMenu() {
  const sidebarMenu = document.getElementById("sidebar-menu");
  if (!sidebarMenu) return;

  const menuItems = [
    { id: "dashboard-reunioes", name: "Dashboard", icon: "dashboard" },
    { id: "agendar-reuniao", name: "Agendar Reunião", icon: "event" },
    { id: "ata-de-reuniao", name: "Registar Ata", icon: "edit_document" },
    { id: "plano-de-acao", name: "Plano de Ação", icon: "task_alt" },
    { id: "relatorio-feedback", name: "Relatórios", icon: "analytics" },
  ];

  let menuHtml = `
    <li><a href="../../../index.html" class="back-link"><i class="material-symbols-outlined">arrow_back</i><span>Voltar à Intranet</span></a></li>
    <li class="menu-separator"></li>`;

  menuItems.forEach((item) => {
    menuHtml += `<li><a href="#${item.id}" data-view="${item.id}"><i class="material-symbols-outlined">${item.icon}</i><span>${item.name}</span></a></li>`;
  });
  sidebarMenu.innerHTML = menuHtml;
}

// O restante do ficheiro (handleNavigation, loadView, updateActiveMenu) permanece exatamente o mesmo.
function handleNavigation() {
  const viewId = window.location.hash.substring(1) || "dashboard-reunioes";
  loadView(viewId);
}

async function loadView(viewId) {
  const contentArea = document.getElementById("content-area");
  if (!views[viewId]) {
    contentArea.innerHTML = `<div class="alert alert-danger">Página não encontrada.</div>`;
    return;
  }
  contentArea.innerHTML = '<div class="loading-spinner"></div>';
  updateActiveMenu(viewId);
  try {
    const viewConfig = views[viewId];
    const response = await fetch(`./${viewConfig.html}`);
    if (!response.ok) throw new Error(`Falha ao carregar ${viewConfig.html}.`);
    contentArea.innerHTML = await response.text();
    if (viewConfig.js) {
      const module = await import(viewConfig.js);
      if (module.init) module.init(appUser, appUserData);
    }
  } catch (error) {
    console.error("Erro ao carregar a view:", error);
    contentArea.innerHTML = `<div class="alert alert-danger">Ocorreu um erro.</div>`;
  }
}

function updateActiveMenu(viewId) {
  const sidebarMenu = document.getElementById("sidebar-menu");
  if (!sidebarMenu) return;
  sidebarMenu.querySelectorAll("a[data-view]").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === viewId);
  });
  const pageTitle = document.querySelector("#page-title-container");
  if (pageTitle) {
    const menuItem = sidebarMenu.querySelector(`a[data-view="${viewId}"] span`);
    if (menuItem) pageTitle.textContent = menuItem.textContent;
  }
}
