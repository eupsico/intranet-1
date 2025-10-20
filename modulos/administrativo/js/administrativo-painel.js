// Arquivo: /modulos/administrativo/js/administrativo-painel.js
// Versão: 2.2 (Adicionado menu e rota para Solicitações)

export function initadministrativoPanel(user, db, userData) {
  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu");

  window.showToast = function (message, type = "success") {
    const container =
      document.getElementById("toast-container") || document.body;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.right = "20px";
    toast.style.padding = "15px 20px";
    toast.style.borderRadius = "5px";
    toast.style.backgroundColor = type === "success" ? "#28a745" : "#dc3545";
    toast.style.color = "white";
    toast.style.zIndex = "1050";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.4s ease";
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(0)";
    }, 10);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      setTimeout(() => toast.remove(), 500);
    }, 3000);
  };

  function setupSidebarToggle() {
    const layoutContainer = document.querySelector(".layout-container");
    const sidebar = document.querySelector(".sidebar");
    const toggleButton = document.getElementById("sidebar-toggle");
    const overlay = document.getElementById("menu-overlay");

    if (
      !layoutContainer ||
      !toggleButton ||
      !sidebar ||
      !overlay ||
      !sidebarMenu
    ) {
      return;
    }

    const handleToggle = () => {
      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        sidebar.classList.toggle("is-visible");
        layoutContainer.classList.toggle("mobile-menu-open");
      } else {
        const currentlyCollapsed =
          layoutContainer.classList.toggle("sidebar-collapsed");
        localStorage.setItem("sidebarCollapsed", currentlyCollapsed);
        toggleButton.setAttribute(
          "title",
          currentlyCollapsed ? "Expandir menu" : "Recolher menu"
        );
      }
    };

    const newToggleButton = toggleButton.cloneNode(true);
    toggleButton.parentNode.replaceChild(newToggleButton, toggleButton);
    newToggleButton.addEventListener("click", handleToggle);

    const newOverlay = overlay.cloneNode(true);
    overlay.parentNode.replaceChild(newOverlay, overlay);
    newOverlay.addEventListener("click", handleToggle);

    const newSidebarMenu = sidebarMenu.cloneNode(true);
    sidebarMenu.parentNode.replaceChild(newSidebarMenu, sidebarMenu);
    newSidebarMenu.addEventListener("click", (e) => {
      if (window.innerWidth <= 768 && e.target.closest("a")) {
        handleToggle();
      }
    });
  }

  const views = [
    {
      id: "grade",
      name: "Grade de Horários",
      roles: ["admin", "gestor", "assistente"],
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    },
    {
      id: "gestao_agendas",
      name: "Gerir Agendas (Social)",
      roles: ["admin"],
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m10.5 14 2 2 4-4"/></svg>`,
    },
    {
      id: "cruzamento-agendas",
      name: "Cruzamento de Agendas",
      roles: ["admin", "gestor", "assistente"], // Defina os perfis que podem acessar
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    },
    {
      id: "solicitacoes-admin",
      name: "Solicitações",
      roles: ["admin", "gestor", "assistente"],
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="m9 14 2 2 4-4"></path></svg>`,
    },
    {
      id: "treinamentos",
      name: "Treinamentos",
      roles: ["admin", "gestor", "assistente"],
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`,
    },
    {
      id: "lancamentos",
      name: "Adicionar Lançamento",
      module: "financeiro",
      roles: ["admin", "gestor", "assistente"],
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`,
    },
  ];

  function buildSidebarMenu(userRoles = []) {
    if (!sidebarMenu) return;
    sidebarMenu.innerHTML = `
                <li>
                    <a href="../../../index.html" class="back-link">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        <span>Voltar à Intranet</span>
                    </a>
                </li>
                <li class="menu-separator"></li>
            `;
    views.forEach((view) => {
      const hasPermission = view.roles.some((role) => userRoles.includes(role));
      if (hasPermission) {
        sidebarMenu.innerHTML += `
                                <li>
                                    <a href="#${view.id}" data-view="${view.id}">
                                        ${view.icon}
                                        <span>${view.name}</span>
                                    </a>
                                </li>`;
      }
    });
  }

  async function loadView(viewId) {
    const view = views.find((v) => v.id === viewId);
    if (!view) {
      contentArea.innerHTML = "<h2>View não encontrada.</h2>";
      return;
    }

    sidebarMenu.querySelectorAll("a[data-view]").forEach((link) => {
      link.classList.toggle("active", link.dataset.view === viewId);
    });

    contentArea.innerHTML = '<div class="loading-spinner"></div>';
    try {
      let htmlPath, jsPath, cssPath;
      if (view.module) {
        htmlPath = `../../${view.module}/page/${viewId}.html`;
        jsPath = `../../${view.module}/js/${viewId}.js`;
        cssPath = `../../${view.module}/css/${viewId}.css`;
      } else {
        htmlPath = `./${viewId}.html`;
        jsPath = `../js/${viewId}.js`;
        cssPath = `../css/${viewId}.css`;
      }

      const response = await fetch(htmlPath);
      if (!response.ok)
        throw new Error(
          `Arquivo da view não encontrado: ${htmlPath} (Status: ${response.status})`
        );

      contentArea.innerHTML = await response.text();

      document
        .querySelectorAll("link[data-dynamic-style]")
        .forEach((el) => el.remove());
      const link = document.createElement("link");
      link.setAttribute("data-dynamic-style", "true");
      link.rel = "stylesheet";
      link.href = cssPath;
      link.onerror = () => {
        link.remove();
      };
      document.head.appendChild(link);

      try {
        const viewModule = await import(jsPath);
        if (viewModule && typeof viewModule.init === "function") {
          viewModule.init(db, user, userData);
        }
      } catch (jsError) {
        console.log(
          `Nenhum módulo JS para a view '${viewId}'. Carregando como página estática.`,
          jsError
        );
      }
    } catch (error) {
      console.error(`Erro ao carregar a view ${viewId}:`, error);
      contentArea.innerHTML = `<h2>Erro ao carregar o módulo.</h2><p>${error.message}</p>`;
    }
  }

  function setupPageHeader() {
    const pageTitleContainer = document.getElementById("page-title-container");
    if (pageTitleContainer) {
      pageTitleContainer.innerHTML = `
                        <h1>Painel Administrativo</h1>
                        <p>Gestão de configurações e dados do sistema.</p>
                    `;
    }
  }

  function start() {
    const userRoles = userData.funcoes || [];
    setupPageHeader();
    buildSidebarMenu(userRoles);
    setupSidebarToggle();

    const handleHashChange = () => {
      const viewId = window.location.hash.substring(1);
      const firstValidView = views.find((v) =>
        v.roles.some((role) => userRoles.includes(role))
      );
      const defaultViewId = firstValidView ? firstValidView.id : null;
      loadView(viewId || defaultViewId);
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();
  }

  start();
}
