// Arquivo: /modulos/rh/js/rh-painel.js
// Versão: 2.0 (Roteamento Interno por Hash - Padrão Intranet)

// Importa os utilitários de terceiros para garantir que arrayUnion funcione no escopo
import { arrayUnion } from "../../../assets/js/firebase-init.js";
export function initrhPanel(user, db, userData) {
  console.log("🔹 Iniciando painel de RH e roteador interno por Hash...");

  window.db = db;
  const userRoles = userData.funcoes || [];
  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu"); // Configuração de Views (o Dashboard será o fallback)

  const icons = {
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17l-6-6L7 14"/></svg>`,
    gestao_profissionais: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
    gestao_vagas: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-2-2h-4l-3-3H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4l3 3h7a2 2 0 0 0 2-2z"/></svg>`,
    onboarding_colaboradores: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-4l-3 6L9 3l3 6h4z"/></svg>`,
    desligamento: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M17 17l5 5M22 17l-5 5"/></svg>`,
    comunicados: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2z"></path></svg>`,
  };
  const views = [
    {
      id: "dashboard",
      name: "Dashboard RH",
      roles: ["admin", "rh"],
      icon: icons.dashboard,
    },
    {
      id: "gestao_vagas",
      name: "Gestão de Vagas",
      roles: ["admin", "rh"],
      icon: icons.gestao_vagas,
    },
    {
      id: "onboarding_colaboradores",
      name: "Onboarding",
      roles: ["admin", "rh"],
      icon: icons.onboarding_colaboradores,
    },
    {
      id: "desligamento",
      name: "Desligamento",
      roles: ["admin", "rh"],
      icon: icons.desligamento,
    },
    {
      id: "gestao_profissionais",
      name: "Profissionais",
      roles: ["admin", "rh"],
      icon: icons.gestao_profissionais,
    },
    {
      id: "comunicados",
      name: "Comunicação",
      roles: ["admin", "rh"],
      icon: icons.comunicados,
    },
  ]; // --- Função para renderizar o Dashboard de Opções (Cartões) ---

  function renderDashboard() {
    contentArea.innerHTML = `
        <div class="description-box">
            <p>Selecione uma opção no menu lateral ou clique em um cartão abaixo para iniciar a gestão.</p>
        </div>
        <div class="rh-dashboard-grid">
            ${views
      .filter((v) => v.id !== "dashboard")
      .map((view) => {
        // Filtra o próprio dashboard
        const hasPermission = view.roles.some((role) =>
          userRoles.includes(role.trim())
        );
        if (hasPermission) {
          return `
                        <a href="#${view.id}" class="rh-card card-link">
                            ${view.icon}
                            <h3>${view.name}</h3>
                            <p>Gerencie o fluxo de ${view.name
            .toLowerCase()
            .replace("gestão de ", "")
            .replace("profissionais", "profissionais/voluntários")}.</p>
                        </a>
                    `;
        }
        return "";
      })
      .join("")}
        </div>
    `;
  } // --- Função para carregar a view (HTML + JS) ---

  async function loadView(viewName) {
    const viewData = views.find((v) => v.id === viewName);

    if (
      !viewData ||
      !viewData.roles.some((role) => userRoles.includes(role.trim()))
    ) {
      contentArea.innerHTML =
        "<h2>Acesso Negado</h2><p>Você não tem permissão para visualizar este módulo.</p>";
      return;
    } // 1. Atualiza a classe ativa do sidebar

    sidebarMenu.querySelectorAll("a[data-view]").forEach((link) => {
      link.classList.toggle("active", link.dataset.view === viewName);
    });

    // 2. Carrega o Dashboard se for a view padrão
    if (viewName === "dashboard") {
      renderDashboard();
      return;
    }

    contentArea.innerHTML =
      '<div class="loading-spinner">Carregando módulo...</div>';
    // 3. Carrega o HTML da view
    try {
      const htmlPath = `./page/${viewName}.html`; // Caminho relativo, pois estamos em /modulos/rh/page/
      const response = await fetch(htmlPath);
      if (!response.ok) {
        throw new Error(`Arquivo da view não encontrado: ${viewName}.html`);
      }

      const htmlContent = await response.text();

      // Remove scripts antigos e injeta o novo HTML
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlContent;
      tempDiv.querySelectorAll("script").forEach((script) => script.remove());
      contentArea.innerHTML = tempDiv.innerHTML;

      // 4. Importa e executa o JS da view
      const jsPath = `../js/${viewName}.js`;
      console.log(`Tentando importar JS: ${jsPath}`);

      // CORRIGIDO: O JS está em ../js/ (relativo à pasta /page/)
      const viewModule = await import(jsPath + "?t=" + Date.now());

      const initFuncName = `init${viewName.replace(/[-_]/g, "")}`;

      if (typeof viewModule[initFuncName] === "function") {
        await viewModule[initFuncName](user, userData);
      } else if (typeof viewModule.init === "function") {
        await viewModule.init(user, userData);
      } else {
        console.warn(
          `Função de inicialização '${initFuncName}' ou 'init' não encontrada em ${viewName}.js.`
        );
      }
    } catch (error) {
      console.error(`Erro ao carregar a view ${viewName}:`, error);
      contentArea.innerHTML = `<h2>Erro ao carregar o módulo.</h2><p>${error.message}</p>`;
    }
  }

  // --- Funções de Navegação e Inicialização ---
  function buildRHSidebarMenu() {
    if (!sidebarMenu) return;
    // ... (menu HTML)
    sidebarMenu.innerHTML = `
            <li><a href="../../../index.html" class="back-link">${icons.dashboard}<span>Voltar à Intranet</span></a></li>
            <li class="menu-separator"></li>
        `;

    views.forEach((view) => {
      const hasPermission = view.roles.some((role) =>
        userRoles.includes(role.trim())
      );
      if (hasPermission) {
        // Usa o Hash (#) para navegação interna
        sidebarMenu.innerHTML += `<li><a href="#${view.id}" data-view="${view.id}">${view.icon}<span>${view.name}</span></a></li>`;
      }
    });
  }

  function handleNavigation() {
    const requestedHash = window.location.hash.substring(1);
    const firstPermittedView = views.find((v) =>
      v.roles.some((r) => userRoles.includes(r.trim()))
    );

    let targetViewId =
      requestedHash ||
      (firstPermittedView ? firstPermittedView.id : "dashboard");

    if (targetViewId) {
      // Atualiza o Hash na URL e carrega a view
      window.history.replaceState(null, "", `#${targetViewId}`);
      loadView(targetViewId);
    } else {
      contentArea.innerHTML =
        "<h2>Você não tem permissão para acessar nenhuma seção deste módulo.</h2>";
    }
  }

  buildRHSidebarMenu();
  window.addEventListener("hashchange", handleNavigation);
  handleNavigation(); // Executa na carga inicial da página
}
