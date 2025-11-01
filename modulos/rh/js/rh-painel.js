// Arquivo: /modulos/rh/js/rh-painel.js
// Versão: 2.4 (Correções e adição de rota para etapa_cronograma_orcamento)

import { arrayUnion } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

export function initrhPanel(user, db, userData) {
  console.log("🔹 Iniciando painel de RH e roteador interno por Hash...");

  window.db = db;
  const userRoles = userData.funcoes || [];
  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu");

  const icons = {
    voltar: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17l-6-6L7 14"/></svg>`,
    gestao_vagas: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
    recrutamento: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/><path d="M9 10l2 2 4-4"/></svg>`,
    gestao_estudos_de_caso: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6m-9 9h6m-6-4h6"/></svg>`,
    onboarding_colaboradores: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-4l-3 6L9 3l3 6h4z"/></svg>`,
    desligamento: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M17 17l5 5M22 17l-5 5"/></svg>`,
    gestao_profissionais: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
    comunicados: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2z"></path></svg>`,
  };

  const views = [
    { id: "dashboard", name: "Dashboard RH", roles: ["admin", "rh"], icon: icons.dashboard },
    { id: "gestao_vagas", name: "1. Criação e Arte de Vagas", roles: ["admin", "rh"], icon: icons.gestao_vagas },
    { id: "recrutamento", name: "2. Recrutamento e Fluxo", roles: ["admin", "rh"], icon: icons.recrutamento },
    { id: "gestao_estudos_de_caso", name: "3. Gerenciar Estudos/Testes", roles: ["admin", "rh"], icon: icons.gestao_estudos_de_caso },
    { id: "gestao_profissionais", name: "Profissionais", roles: ["admin", "rh"], icon: icons.gestao_profissionais },
    { id: "onboarding_colaboradores", name: "Onboarding", roles: ["admin", "rh"], icon: icons.onboarding_colaboradores },
    { id: "desligamento", name: "Desligamento", roles: ["admin", "rh"], icon: icons.desligamento },
    { id: "comunicados", name: "Comunicação", roles: ["admin", "rh"], icon: icons.comunicados },
    // ✅ ROTA ADICIONADA PARA CRONOGRAMA (sem aparecer no menu lateral)
    { id: "etapa_cronograma_orcamento", name: "Cronograma e Orçamento", roles: ["admin", "rh"], icon: null, hideInMenu: true },
  ];

  // Função para exibir notificações
  window.showToast = function (message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  // Função para carregar a view (HTML + JS)
  async function loadView(viewName) {
    // Extrai parâmetros da URL (ex: rh/recrutamento?vaga=xxx)
    const [baseView, params] = viewName.split('?');
    const viewData = views.find((v) => v.id === baseView);

    if (!viewData || !viewData.roles.some((role) => userRoles.includes(role.trim()))) {
      contentArea.innerHTML = "<h2>Acesso Negado</h2><p>Você não tem permissão para visualizar este módulo.</p>";
      return;
    }

    // Atualiza a classe ativa do sidebar (apenas para views que estão no menu)
    if (!viewData.hideInMenu) {
      sidebarMenu.querySelectorAll("a[data-view]").forEach((link) => {
        link.classList.toggle("active", link.dataset.view === baseView);
      });
    }

    contentArea.innerHTML = '<div class="loading-spinner">Carregando módulo...</div>';

    try {
      const htmlPath = `./${baseView}.html`;
      console.log(`Tentando carregar HTML: ${htmlPath}`);

      const response = await fetch(htmlPath);
      if (!response.ok) {
        throw new Error(`Arquivo da view não encontrado: ${baseView}.html`);
      }

      const htmlContent = await response.text();

      // Remove scripts antigos e injeta o novo HTML
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlContent;
      tempDiv.querySelectorAll("script").forEach((script) => script.remove());
      contentArea.innerHTML = tempDiv.innerHTML;

      // Importa e executa o JS da view
      const jsPath = `../js/${baseView}.js`;
      console.log(`Tentando importar JS: ${jsPath}`);

      const viewModule = await import(jsPath + "?t=" + Date.now());

      // Tenta várias variações de nome de função
      const initFuncName = `init${baseView.replace(/[-_]/g, "")}`;

      if (typeof viewModule[initFuncName] === "function") {
        await viewModule[initFuncName](user, userData);
      } else if (typeof viewModule.init === "function") {
        await viewModule.init(user, userData);
      } else if (typeof viewModule.initRecrutamento === "function") {
        await viewModule.initRecrutamento(user, userData);
      } else {
        console.warn(`Função de inicialização '${initFuncName}' ou 'init' não encontrada em ${baseView}.js.`);
      }
    } catch (error) {
      console.error(`Erro ao carregar a view ${baseView}:`, error);
      contentArea.innerHTML = `<h2>Erro ao carregar o módulo.</h2><p>${error.message}</p>`;
    }
  }

  function buildRHSidebarMenu() {
    if (!sidebarMenu) return;

    sidebarMenu.innerHTML = `
      <li><a href="../../../index.html" class="back-link">${icons.voltar}<span>Voltar à Intranet</span></a></li>
      <li class="menu-separator"></li>
    `;

    views.forEach((view) => {
      // Não exibe no menu se hideInMenu for true
      if (view.hideInMenu) return;

      const hasPermission = view.roles.some((role) => userRoles.includes(role.trim()));
      if (hasPermission) {
        sidebarMenu.innerHTML += `<li><a href="#rh/${view.id}" data-view="${view.id}">${view.icon}<span>${view.name}</span></a></li>`;
      }
    });
  }

  function handleNavigation() {
    const requestedHash = window.location.hash.substring(1);
    
    // Remove o prefixo "rh/" se existir
    const cleanHash = requestedHash.replace(/^rh\//, '');
    
    const firstPermittedView = views.find((v) =>
      v.roles.some((r) => userRoles.includes(r.trim()))
    );

    let targetViewId = cleanHash || (firstPermittedView ? firstPermittedView.id : "dashboard");

    if (targetViewId) {
      window.history.replaceState(null, "", `#rh/${targetViewId}`);
      loadView(targetViewId);
    } else {
      contentArea.innerHTML = "<h2>Você não tem permissão para acessar nenhuma seção deste módulo.</h2>";
    }
  }

  buildRHSidebarMenu();
  window.addEventListener("hashchange", handleNavigation);
  handleNavigation();
}
