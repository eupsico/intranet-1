// Arquivo: /modulos/financeiro/js/painel-financeiro.js
// Versão: 3.0 (Migrado para a sintaxe modular do Firebase v9)
console.log("✔️ [DEBUG] Carregando painel-financeiro.js (v3.0)");

import { db, functions } from "../../../assets/js/firebase-init.js";

export function initFinancePanel(user, userData) {
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

  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu");

  const icons = {
    dashboard:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>',
    configuracoes:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-4.22a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.38"/><path d="M16 2l6 6"/><path d="M15 8h-5"/><path d="M15 12h-5"/><path d="M15 16h-5"/></svg>',
    resumo_horas:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    cobranca_mensal:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>',
    controle_pagamentos:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    devedores:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
    acordos:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
    lancamentos:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>',
    repasse:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    relatorios:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>',
  };

  const views = [
    {
      id: "dashboard",
      name: "Dashboard",
      roles: ["admin", "financeiro", "rh"],
      icon: icons.dashboard,
    },
    {
      id: "configuracoes",
      name: "Configurações",
      roles: ["admin", "financeiro"],
      icon: icons.configuracoes,
    },
    {
      id: "resumo_horas",
      name: "Resumo de Horas",
      roles: ["admin", "financeiro"],
      icon: icons.resumo_horas,
    },
    {
      id: "cobranca_mensal",
      name: "Cobrança Mensal",
      roles: ["admin", "financeiro"],
      icon: icons.cobranca_mensal,
    },
    {
      id: "controle_pagamentos",
      name: "Controle de Pagamentos",
      roles: ["admin", "financeiro"],
      icon: icons.controle_pagamentos,
    },
    {
      id: "devedores",
      name: "Devedores",
      roles: ["admin", "financeiro"],
      icon: icons.devedores,
    },
    {
      id: "acordos",
      name: "Acordos",
      roles: ["admin", "financeiro"],
      icon: icons.acordos,
    },
    {
      id: "lancamentos",
      name: "Lançamentos",
      roles: ["admin", "financeiro"],
      icon: icons.lancamentos,
    },
    {
      id: "repasse",
      name: "Repasse Profissionais",
      roles: ["admin", "financeiro"],
      icon: icons.repasse,
    },
    {
      id: "relatorios",
      name: "Relatórios e Backup",
      roles: ["admin", "financeiro"],
      icon: icons.relatorios,
    },
  ];

  function buildFinanceSidebarMenu(userRoles = []) {
    if (!sidebarMenu) return;
    sidebarMenu.innerHTML = "";

    const backLink = document.createElement("li");
    backLink.innerHTML = `
            <a href="../../../index.html" class="back-link">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                <span>Voltar à Intranet</span>
            </a>
        `;
    sidebarMenu.appendChild(backLink);

    const separator = document.createElement("li");
    separator.className = "menu-separator";
    sidebarMenu.appendChild(separator);

    views.forEach((view) => {
      const hasPermission =
        view.roles.length === 0 ||
        view.roles.some((role) => userRoles.includes(role.trim()));
      if (hasPermission) {
        const menuItem = document.createElement("li");
        const link = document.createElement("a");
        link.href = `#${view.id}`;
        link.dataset.view = view.id;
        link.innerHTML = `${view.icon}<span>${view.name}</span>`;
        menuItem.appendChild(link);
        sidebarMenu.appendChild(menuItem);
      }
    });
  }

  async function loadView(viewName) {
    console.log(`[DEBUG] Tentando carregar a view: ${viewName}`);
    const menuLinks = sidebarMenu.querySelectorAll("a[data-view]");
    menuLinks.forEach((link) => {
      link.classList.toggle("active", link.dataset.view === viewName);
    });

    try {
      contentArea.innerHTML = '<div class="loading-spinner"></div>';

      const response = await fetch(`./${viewName}.html`);
      if (!response.ok) {
        throw new Error(`Arquivo da view não encontrado: ${viewName}.html`);
      }
      contentArea.innerHTML = await response.text();

      const oldScript = document.getElementById("dynamic-view-script");
      if (oldScript) oldScript.remove();

      const scriptPath = `../js/${viewName}.js`;
      try {
        const viewModule = await import(scriptPath);
        if (viewModule && typeof viewModule.init === "function") {
          // CORREÇÃO: Passando o objeto 'db' importado para a função init do módulo.
          // Muitos módulos precisam do 'db' como primeiro argumento.
          viewModule.init(db, user, userData);
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

  const userRoles = userData.funcoes || [];
  buildFinanceSidebarMenu(userRoles);

  const hash = window.location.hash.substring(1);
  const viewExists = views.some((v) => v.id === hash);
  const hasPermissionForHash =
    viewExists &&
    views
      .find((v) => v.id === hash)
      .roles.some((role) => userRoles.includes(role.trim()));

  if (hash && viewExists && hasPermissionForHash) {
    loadView(hash);
  } else {
    const firstAvailableLink = sidebarMenu.querySelector("a[data-view]");
    if (firstAvailableLink) {
      window.location.hash = firstAvailableLink.dataset.view;
    } else {
      contentArea.innerHTML =
        "<h2>Você não tem permissão para acessar nenhuma seção deste módulo.</h2>";
    }
  }

  window.addEventListener("hashchange", () => {
    const viewName = window.location.hash.substring(1);
    if (viewName) loadView(viewName);
  });
}
