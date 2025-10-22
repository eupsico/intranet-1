// Arquivo: /modulos/servico-social/js/servico-social-painel.js
// --- VERSÃO COMPLETA E CORRIGIDA (Remove Fila do menu, SVGs completos) ---

import { db, functions } from "../../../assets/js/firebase-init.js";

export function initsocialPanel(user, userData) {
  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu");

  // Ícones SVG completos
  const icons = {
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    agendamentos: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    // fila: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`, // Removido
    calculo: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    disponibilidade: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    script: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
    drive: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
  };

  // Lista de views principais acessíveis pelo menu deste módulo
  const views = [
    {
      id: "dashboard-servico-social",
      name: "Dashboard",
      roles: ["admin", "servico_social"],
      icon: icons.dashboard,
    },
    {
      id: "agendamentos-view", // View que contém as abas Triagem e Reavaliação
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
      id: "disponibilidade-agendamentos", // Tela para agendar Triagem/Reavaliação
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

  // Constrói o menu lateral específico do Serviço Social
  function buildSocialSidebarMenu(userRoles = []) {
    if (!sidebarMenu) {
      console.error("Elemento do menu lateral (#sidebar-menu) não encontrado.");
      return;
    }
    // Adiciona link "Voltar"
    sidebarMenu.innerHTML = `
            <li><a href="../../../index.html" class="back-link"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg><span>Voltar à Intranet</span></a></li>
            <li class="menu-separator"></li>`;

    const currentHashBase = window.location.hash.substring(1).split("/")[0];

    views.forEach((view) => {
      // Verifica permissão do usuário para ver este item
      const hasPermission = view.roles.some((role) =>
        userRoles.includes(role.trim())
      );
      if (hasPermission) {
        const menuItem = document.createElement("li");
        const link = document.createElement("a");
        link.dataset.view = view.id; // Guarda o ID da view no link
        link.href = view.isExternal ? view.url : `#${view.id}`;
        if (view.isExternal) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        link.innerHTML = `${view.icon || ""}<span>${view.name}</span>`;

        // Marca como ativo se a hash atual corresponder ao ID da view
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

    // Verifica link externo
    const viewData = views.find((v) => v.id === viewName);
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

    // Atualiza classe 'active' no menu lateral
    if (sidebarMenu) {
      sidebarMenu.querySelectorAll("a[data-view]").forEach((link) => {
        link.classList.toggle("active", link.dataset.view === viewName);
      });
    }

    contentArea.innerHTML = '<div class="loading-spinner"></div>';
    try {
      // 1. Carrega o HTML da view
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
            viewModule.init(user, userData, param);
          } catch (initError) {
            // Captura ERRO DENTRO DO INIT DO SUBMÓDULO
            console.error(
              `Erro DURANTE a execução de init() para ${viewName}.js:`,
              initError
            );
            contentArea.innerHTML = `<h2>Erro ao inicializar ${viewName}.</h2><p>Detalhes: ${initError.message}. Verifique o console.</p>`;
            return; // Interrompe o carregamento
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
      // Captura erro ao carregar HTML ou outros erros em loadView
      console.error(`Erro GERAL ao carregar a view ${viewName}:`, error);
      contentArea.innerHTML = `<h2>Erro ao carregar '${viewName}'.</h2><p>${error.message}.</p>`;
    }
  }

  // Função que inicia o roteamento e carrega a view inicial
  function start() {
    const userRoles = userData.funcoes || [];
    buildSocialSidebarMenu(userRoles);

    // Função que lida com mudanças na URL hash
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      const hashParts = hash.split("/");
      const viewName = hashParts[0]; // ID da view
      const param = hashParts[1]; // Parâmetro (ex: ID do paciente)
      // Outros parâmetros (hashParts[2], etc.) são tratados pelo JS da view específica

      console.log(
        `Hash changed: hash=${hash}, viewName=${viewName}, param=${param}`
      );

      if (viewName) {
        const viewExists = views.some((v) => v.id === viewName); // Verifica se a view (interna ou externa) está na lista
        if (viewExists) {
          loadView(viewName, param); // Carrega a view
        } else {
          console.warn(
            `View "${viewName}" não encontrada. Redirecionando para default.`
          );
          // Tenta ir para a primeira view interna disponível
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
          window.location.hash = firstInternalView.id; // Dispara hashchange novamente
        } else {
          contentArea.innerHTML = "<h2>Nenhuma seção disponível.</h2>";
        }
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    // Chama para carregar view inicial
    handleHashChange();
  }

  start(); // Inicia o painel
}
