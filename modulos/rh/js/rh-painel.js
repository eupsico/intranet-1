// Arquivo: /modulos/rh/js/rh-painel.js
// Versão: 1.3 (Com Onboarding, Desligamento e Dashboard de Opções)
// Descrição: Arquivo principal para o Painel de Recursos Humanos.

export function initrhPanel(user, db, userData) {
  console.log("🔹 Iniciando painel de RH...");

  window.db = db; // Função para exibir notificações (toasts)

  window.showToast = function (message, type = "success") {
    const container =
      document.getElementById("toast-container") || document.body;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message; // (Estilos para o toast podem ser adicionados via CSS)
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu");

  const icons = {
    gestao_profissionais: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
    gestao_vagas: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-2-2h-4l-3-3H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4l3 3h7a2 2 0 0 0 2-2z"/></svg>`,
    // NOVOS ÍCONES
    onboarding_colaboradores: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-4l-3 6L9 3l3 6h4z"/></svg>`,
    desligamento: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M17 17l5 5M22 17l-5 5"/></svg>`,
    // FIM NOVOS ÍCONES
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
    // NOVAS VIEWS
    {
      id: "onboarding_colaboradores",
      name: "Onboarding de Colaboradores",
      roles: ["admin", "rh"],
      icon: icons.onboarding_colaboradores,
    },
    {
      id: "desligamento",
      name: "Desligamento",
      roles: ["admin", "rh"],
      icon: icons.desligamento,
    },
    // FIM NOVAS VIEWS
    {
      id: "comunicados",
      name: "Comunicados",
      roles: ["admin", "rh"],
      icon: icons.comunicados,
    },
  ];

  // --- NOVO: Função para renderizar o Dashboard de Opções ---
  function renderDashboard(userRoles) {
    contentArea.innerHTML = `
        <div class="rh-dashboard-grid">
            ${views
              .map((view) => {
                const hasPermission = view.roles.some((role) =>
                  userRoles.includes(role.trim())
                );
                if (hasPermission) {
                  // Utiliza o data-view-id para que o listener no app.js possa capturar e rotear via ?view=
                  return `
                        <div class="rh-card card-link" data-view-id="${
                          view.id
                        }">
                            ${view.icon}
                            <h3>${view.name}</h3>
                            <p>Gerencie todo o ciclo de ${view.name
                              .toLowerCase()
                              .replace("de ", "")} da equipe.</p>
                        </div>
                    `;
                }
                return "";
              })
              .join("")}
        </div>
        <p style="text-align: center; margin-top: 30px;">Selecione uma opção no menu lateral ou clique em um cartão acima.</p>
    `;
  }

  function buildRHSidebarMenu(userRoles = []) {
    if (!sidebarMenu) return;

    // Inclui um link para o Dashboard inicial
    const dashboardIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17l-6-6L7 14"/></svg>`;

    sidebarMenu.innerHTML = `
    <li>
      <a href="../../../index.html" class="back-link">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
          <span>Voltar à Intranet</span>
      </a>
    </li>
    <li class="menu-separator"></li>
    <li id="rh-dashboard-link"><a href="?view=dashboard" data-view="dashboard">${dashboardIcon}<span>Dashboard RH</span></a></li>
`;
    // Adiciona links para os módulos
    views.forEach((view) => {
      const hasPermission = view.roles.some((role) =>
        userRoles.includes(role.trim())
      );
      if (hasPermission) {
        // Altera o href para usar a estrutura de query param para o router global (app.js)
        const currentPath = window.location.pathname.split("?")[0];
        const linkUrl = `${currentPath}?view=${view.id}`;
        sidebarMenu.innerHTML += `<li><a href="${linkUrl}" data-view="${view.id}">${view.icon}<span>${view.name}</span></a></li>`;
      }
    });
  }

  // Mantida a função loadView original, apenas para compatibilidade
  async function loadView(viewName) {
    sidebarMenu.querySelectorAll("a[data-view]").forEach((link) => {
      link.classList.toggle("active", link.dataset.view === viewName);
    });

    contentArea.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const response = await fetch(`./page/${viewName}.html`);
      if (!response.ok)
        throw new Error(`Arquivo da view não encontrado: ${viewName}.html`);

      contentArea.innerHTML = await response.text();
      // O script do módulo será carregado pelo HTML injetado
    } catch (error) {
      console.error(`Erro ao carregar a view ${viewName}:`, error);
      contentArea.innerHTML = `<h2>Erro ao carregar o módulo.</h2><p>${error.message}</p>`;
    }
  } // Função unificada para lidar com a navegação inicial e mudanças de aba

  function handleNavigation() {
    const userRoles = userData.funcoes || [];
    const urlParams = new URLSearchParams(window.location.search);
    const requestedQueryView = urlParams.get("view");

    // O router global em app.js é quem fará a maior parte do trabalho,
    // esta função apenas garante que o estado inicial (Dashboard ou View) seja definido.

    let targetViewId = null;

    // 1. Verifica se há uma view solicitada pelo router global
    if (requestedQueryView && requestedQueryView !== "dashboard") {
      targetViewId = requestedQueryView;
    }

    // 2. Tenta encontrar a view solicitada na lista permitida
    if (targetViewId) {
      const viewData = views.find((v) => v.id === targetViewId);

      if (
        viewData &&
        viewData.roles.some((role) => userRoles.includes(role.trim()))
      ) {
        // O app.js já deve ter carregado o conteúdo via loadRhSubModule,
        // aqui apenas ativamos o link do sidebar e o título.
        sidebarMenu.querySelectorAll("a[data-view]").forEach((link) => {
          link.classList.toggle("active", link.dataset.view === targetViewId);
        });
        document
          .getElementById("rh-dashboard-link")
          ?.classList.remove("active");
        return; // Termina, pois o conteúdo já foi carregado pelo app.js
      }
    }

    // 3. Se não há view válida ou permissão, carrega o Dashboard de Opções.
    sidebarMenu
      .querySelectorAll("a[data-view]")
      .forEach((link) => link.classList.remove("active"));
    document.getElementById("rh-dashboard-link")?.classList.add("active");
    renderDashboard(userRoles);
  }

  buildRHSidebarMenu(userData.funcoes || []);
  // NOTE: Mantemos o hashchange para compatibilidade, mas a navegação principal é via query param
  window.addEventListener("hashchange", handleNavigation);
  handleNavigation(); // Executa na carga inicial da página
}
