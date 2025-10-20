// Arquivo: /modulos/servico-social/js/servico-social-painel.js
// Versão: 3.1 (CORRIGIDO - Passagem de parâmetro para a view)

import { db, functions } from "../../../assets/js/firebase-init.js";

export function initsocialPanel(user, userData) {
  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu");

  const icons = {
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    agendamentos: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    fila: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    calculo: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    disponibilidade: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    script: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
    drive: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
  };

  const views = [
    {
      id: "dashboard-servico-social",
      name: "Dashboard",
      roles: ["admin", "servico_social"],
      icon: icons.dashboard,
    },
    // --- INÍCIO DA ALTERAÇÃO ---
    {
      id: "agendamentos-view", // ID da nova view com abas
      name: "Agendamentos", // Nome genérico no menu
      roles: ["admin", "servico_social"],
      icon: icons.agendamentos,
    },
    // --- FIM DA ALTERAÇÃO ---
    {
      id: "fila-atendimento",
      name: "Fila de Atendimento",
      roles: ["admin", "servico_social"],
      icon: icons.fila,
    },
    {
      id: "calculo-contribuicao",
      name: "Cálculo de Contribuição",
      roles: ["admin", "servico_social"],
      icon: icons.calculo,
    },
    {
      id: "disponibilidade-assistente",
      name: "Minha Disponibilidade",
      roles: ["admin", "servico_social"],
      icon: icons.disponibilidade,
    },
    {
      id: "disponibilidade-agendamentos",
      name: "Disponibilidade de Agendamentos",
      roles: ["admin", "servico_social"],
      icon: icons.agendamentos,
    },
    {
      id: "script-triagem",
      name: "Script da Triagem",
      roles: ["admin", "servico_social"],
      icon: icons.script,
    },
    {
      id: "drive",
      name: "Acesso ao Drive",
      roles: ["admin", "servico_social"],
      url: "https://drive.google.com/drive/u/1/folders/0AONLPOTn6ns3Uk9PVA",
      isExternal: true,
      icon: icons.drive,
    },
  ];

  function buildSocialSidebarMenu(userRoles = []) {
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
      const hasPermission = view.roles.some((role) =>
        userRoles.includes(role.trim())
      );
      if (hasPermission) {
        const menuItem = document.createElement("li");
        const link = document.createElement("a");
        link.dataset.view = view.id;
        link.href = view.isExternal ? view.url : `#${view.id}`;
        if (view.isExternal) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        link.innerHTML = `${view.icon}<span>${view.name}</span>`;
        menuItem.appendChild(link);
        sidebarMenu.appendChild(menuItem);
      }
    });
  }

  // *** INÍCIO DA CORREÇÃO ***
  async function loadView(viewName, param) {
    const viewData = views.find((v) => v.id === viewName);
    if (viewData && viewData.isExternal) return;

    const menuLinks = sidebarMenu.querySelectorAll("a[data-view]");
    menuLinks.forEach((link) => {
      link.classList.toggle("active", link.dataset.view === viewName);
    });

    contentArea.innerHTML = '<div class="loading-spinner"></div>';
    try {
      const response = await fetch(`./${viewName}.html`);
      if (!response.ok)
        throw new Error(`Arquivo da view não encontrado: ${viewName}.html`);

      contentArea.innerHTML = await response.text();

      const scriptPath = `../js/${viewName}.js`;
      try {
        const viewModule = await import(scriptPath);
        if (viewModule && typeof viewModule.init === "function") {
          // A correção está aqui: agora passamos o 'param' (ID do paciente) para a função init do módulo.
          viewModule.init(user, userData, param);
        }
      } catch (e) {
        console.log(
          `Nenhum script de inicialização para a view '${viewName}'.`,
          e
        );
      }
    } catch (error) {
      console.error(`Erro ao carregar a view ${viewName}:`, error);
      contentArea.innerHTML = `<h2>Erro ao carregar o módulo '${viewName}'.</h2><p>${error.message}.</p>`;
    }
  }
  // *** FIM DA CORREÇÃO ***

  function start() {
    const userRoles = userData.funcoes || [];
    buildSocialSidebarMenu(userRoles);

    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      const [viewName, param] = hash.split("/");
      if (viewName) {
        loadView(viewName, param);
      }
    };

    const initialHash = window.location.hash.substring(1);
    const [initialViewName, initialParam] = initialHash.split("/");

    const viewExists = views.some(
      (v) => v.id === initialViewName && !v.isExternal
    );

    if (initialViewName && viewExists) {
      loadView(initialViewName, initialParam);
    } else {
      const firstLink = sidebarMenu.querySelector(
        'a[data-view]:not([target="_blank"])'
      );
      if (firstLink) {
        window.location.hash = firstLink.dataset.view;
      } else {
        contentArea.innerHTML =
          "<h2>Você não tem permissão para acessar nenhuma seção.</h2>";
      }
    }

    // Adiciona o listener de hashchange uma única vez, após a carga inicial.
    window.addEventListener("hashchange", handleHashChange);
  }

  start();
}
