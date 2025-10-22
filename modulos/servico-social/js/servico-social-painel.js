// Arquivo: /modulos/servico-social/js/servico-social-painel.js
// --- VERSÃO CORRIGIDA FINAL v2 (Permite carregar Fila via hash) ---

import { db, functions } from "../../../assets/js/firebase-init.js";

export function initsocialPanel(user, userData) {
  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu");

  // Ícones SVG completos
  const icons = {
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    agendamentos: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    calculo: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    disponibilidade: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    script: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
    drive: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
  };

  // Lista de views PRINCIPAIS (acessíveis pelo menu)
  const views = [
    {
      id: "dashboard-servico-social",
      name: "Dashboard",
      roles: ["admin", "servico_social"],
      icon: icons.dashboard,
    },
    {
      id: "agendamentos-view",
      name: "Agendamentos",
      roles: ["admin", "servico_social"],
      icon: icons.agendamentos,
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
      name: "Agendar Paciente",
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

  // Constrói o menu lateral
  function buildSocialSidebarMenu(userRoles = []) {
    if (!sidebarMenu) {
      console.error("#sidebar-menu não encontrado.");
      return;
    }
    sidebarMenu.innerHTML = `<li><a href="../../../index.html" class="back-link"><svg ...></svg><span>Voltar à Intranet</span></a></li><li class="menu-separator"></li>`; // Link Voltar
    const currentHashBase = window.location.hash.substring(1).split("/")[0];
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
        link.innerHTML = `${view.icon || ""}<span>${view.name}</span>`;
        if (currentHashBase === view.id) {
          link.classList.add("active");
        }
        menuItem.appendChild(link);
        sidebarMenu.appendChild(menuItem);
      }
    });
  }

  // Carrega o conteúdo HTML e executa o JS da view solicitada
  async function loadView(viewName, param) {
    if (!contentArea) {
      console.error("#content-area não encontrada.");
      return;
    }

    const viewData = views.find((v) => v.id === viewName);
    // Trata links externos primeiro
    if (viewData && viewData.isExternal) {
      if (sidebarMenu)
        sidebarMenu
          .querySelectorAll("a[data-view].active")
          .forEach((l) => l.classList.remove("active"));
      const externalLink = sidebarMenu?.querySelector(
        `a[data-view="${viewName}"]`
      );
      if (externalLink) externalLink.classList.add("active");
      contentArea.innerHTML = `<p>Redirecionando para ${viewData.name}...</p>`;
      return;
    }

    // Atualiza classe 'active' no menu lateral (para views internas)
    if (sidebarMenu) {
      sidebarMenu.querySelectorAll("a[data-view]").forEach((link) => {
        // Marca como ativo se o viewName corresponder OU se viewName for 'fila-atendimento' e o link for 'agendamentos-view'
        const shouldBeActive =
          link.dataset.view === viewName ||
          (viewName === "fila-atendimento" &&
            link.dataset.view === "agendamentos-view");
        link.classList.toggle("active", shouldBeActive);
      });
    }

    contentArea.innerHTML = '<div class="loading-spinner"></div>';
    try {
      // 1. Carrega o HTML (agora funciona para fila-atendimento também)
      const htmlPath = `./${viewName}.html`;
      console.log(`Tentando carregar HTML: ${htmlPath}`);
      const response = await fetch(htmlPath);
      if (!response.ok) {
        throw new Error(`Arquivo HTML não encontrado: ${viewName}.html`);
      }
      contentArea.innerHTML = await response.text();

      // 2. Tenta carregar e executar o JS correspondente
      const scriptPath = `../js/${viewName}.js`;
      try {
        console.log(`Tentando importar JS: ${scriptPath}`);
        const viewModule = await import(scriptPath);

        // 3. Executa a função 'init' DENTRO de um try...catch específico
        if (viewModule && typeof viewModule.init === "function") {
          try {
            console.log(
              `Executando init() para ${viewName} com param: ${param}`
            );
            viewModule.init(user, userData, param); // Passa user, userData e o parâmetro da URL
          } catch (initError) {
            console.error(
              `Erro DURANTE a execução de init() para ${viewName}.js:`,
              initError
            );
            contentArea.innerHTML = `<h2>Erro ao inicializar ${viewName}.</h2><p>Detalhes: ${initError.message}. Verifique o console.</p>`;
            return; // Interrompe
          }
        } else {
          console.log(
            `Módulo ${viewName}.js carregado, mas sem função init().`
          );
        }
      } catch (importError) {
        if (
          !importError.message.includes(
            "Failed to fetch dynamically imported module"
          )
        ) {
          console.warn(`Erro ao importar script ${scriptPath}:`, importError);
        } else {
          console.log(
            `Nenhum script JS encontrado ou necessário para '${viewName}'.`
          );
        }
      }
    } catch (error) {
      console.error(`Erro GERAL ao carregar a view ${viewName}:`, error);
      contentArea.innerHTML = `<h2>Erro ao carregar '${viewName}'.</h2><p>${error.message}.</p>`;
    }
  }

  // Função que inicia o roteamento
  function start() {
    const userRoles = userData.funcoes || [];
    buildSocialSidebarMenu(userRoles);

    // Função que lida com mudanças na URL hash
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      const hashParts = hash.split("/");
      const viewName = hashParts[0]; // ID da view (ex: 'agendamentos-view' ou 'fila-atendimento')
      const param = hashParts[1]; // Parâmetro (ex: ID do paciente)

      console.log(
        `Hash changed: hash=${hash}, viewName=${viewName}, param=${param}`
      );

      if (viewName) {
        // *** CORRIGIDO: Permite carregar 'fila-atendimento' mesmo não estando em 'views' ***
        const isKnownView =
          views.some((v) => v.id === viewName) ||
          viewName === "fila-atendimento";

        if (isKnownView) {
          loadView(viewName, param); // Carrega a view se for conhecida (do menu ou a fila)
        } else {
          console.warn(
            `View "${viewName}" desconhecida. Redirecionando para default.`
          );
          // Redireciona para a primeira view interna disponível
          const firstInternalView = views.find(
            (v) =>
              !v.isExternal &&
              v.roles.some((role) => userRoles.includes(role.trim()))
          );
          if (firstInternalView) {
            window.location.hash = firstInternalView.id;
          } else {
            contentArea.innerHTML = "<h2>Nenhuma seção disponível.</h2>";
          }
        }
      } else {
        // Hash vazia, carrega a primeira view interna
        const firstInternalView = views.find(
          (v) =>
            !v.isExternal &&
            v.roles.some((role) => userRoles.includes(role.trim()))
        );
        if (firstInternalView) {
          console.log(
            "Hash vazia, carregando view padrão:",
            firstInternalView.id
          );
          window.location.hash = firstInternalView.id;
        } else {
          contentArea.innerHTML = "<h2>Nenhuma seção disponível.</h2>";
        }
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    // Carrega view inicial
    handleHashChange();
  }

  start(); // Inicia o painel
}
