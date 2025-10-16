// Arquivo: /modulos/rh/js/rh-painel.js
// Versão: 1.2 (Navegação interna robusta)
// Descrição: Arquivo principal para o Painel de Recursos Humanos.

export function initrhPanel(user, db, userData) {
  console.log("🔹 Iniciando painel de RH...");

  window.db = db;

  // Função para exibir notificações (toasts)
  window.showToast = function (message, type = "success") {
    const container =
      document.getElementById("toast-container") || document.body;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    // (Estilos para o toast podem ser adicionados via CSS)
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu");

  const icons = {
    gestao_profissionais: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
    gestao_vagas: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-2-2h-4l-3-3H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4l3 3h7a2 2 0 0 0 2-2z"/></svg>`,
    comunicados: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2z"></path></svg>`,
  };
  const views = [
    {
      id: "gestao_profissionais",
      name: "Gestão de Profissionais",
      roles: ["admin", "rh"],
      icon: icons.gestao_profissionais,
    },
    {
      id: "gestao_vagas",
      name: "Gestão de Vagas",
      roles: ["admin", "rh"],
      icon: icons.gestao_vagas,
    },
    {
      id: "comunicados",
      name: "Comunicados",
      roles: ["admin", "rh"],
      icon: icons.comunicados,
    },
  ];

  function buildRHSidebarMenu(userRoles = []) {
    if (!sidebarMenu) return;
    sidebarMenu.innerHTML = `
            <li>
                <a href="../../../index.html" class="back-link">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                    <span>Voltar à Intranet</span>
                </a>
            </li>
            <li class="menu-separator"></li>
        `;

    views.forEach((view) => {
      const hasPermission = view.roles.some((role) =>
        userRoles.includes(role.trim())
      );
      if (hasPermission) {
        sidebarMenu.innerHTML += `<li><a href="#${view.id}" data-view="${view.id}">${view.icon}<span>${view.name}</span></a></li>`;
      }
    });
  }

  async function loadView(viewName) {
    sidebarMenu.querySelectorAll("a[data-view]").forEach((link) => {
      link.classList.toggle("active", link.dataset.view === viewName);
    });

    contentArea.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const response = await fetch(`./${viewName}.html`);
      if (!response.ok)
        throw new Error(`Arquivo da view não encontrado: ${viewName}.html`);

      contentArea.innerHTML = await response.text();

      const viewModule = await import(`../js/${viewName}.js`);
      if (viewModule && typeof viewModule.init === "function") {
        viewModule.init(db, user, userData);
      }
    } catch (error) {
      console.error(`Erro ao carregar a view ${viewName}:`, error);
      contentArea.innerHTML = `<h2>Erro ao carregar o módulo.</h2><p>${error.message}</p>`;
    }
  }

  // Função unificada para lidar com a navegação inicial e mudanças de aba
  function handleNavigation() {
    const userRoles = userData.funcoes || [];
    const requestedView = window.location.hash.substring(1);

    const firstPermittedView = views.find((v) =>
      v.roles.some((role) => userRoles.includes(role.trim()))
    );

    let targetViewId = null;
    if (requestedView) {
      const viewData = views.find((v) => v.id === requestedView);
      // Verifica se a view solicitada existe e se o usuário tem permissão
      if (
        viewData &&
        viewData.roles.some((role) => userRoles.includes(role.trim()))
      ) {
        targetViewId = requestedView;
      }
    }

    // Se nenhuma view válida foi encontrada na URL, carrega a primeira permitida
    if (!targetViewId) {
      targetViewId = firstPermittedView ? firstPermittedView.id : null;
    }

    if (targetViewId) {
      // Atualiza o hash na URL para refletir a página carregada
      if (window.location.hash !== `#${targetViewId}`) {
        window.history.replaceState(null, "", `#${targetViewId}`);
      }
      loadView(targetViewId);
    } else {
      contentArea.innerHTML =
        "<h2>Você não tem permissão para acessar nenhuma seção deste módulo.</h2>";
    }
  }

  buildRHSidebarMenu(userData.funcoes || []);
  window.addEventListener("hashchange", handleNavigation);
  handleNavigation(); // Executa na carga inicial da página
}
