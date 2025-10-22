// Arquivo: /modulos/servico-social/js/servico-social-painel.js
// --- VERSÃO CORRIGIDA (Remove Fila do menu principal) ---

import { db, functions } from "../../../assets/js/firebase-init.js";

export function initsocialPanel(user, userData) {
  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu");

  // Ícones (mantidos como estavam)
  const icons = {
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    agendamentos: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    // fila: `<svg ... >`, // Ícone não mais necessário aqui
    calculo: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    disponibilidade: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    script: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
    drive: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
  };

  // *** CORRIGIDO: Remove a view 'fila-atendimento' da lista principal ***
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
    // { // REMOVIDO
    //   id: "fila-atendimento",
    //   name: "Fila de Atendimento",
    //   roles: ["admin", "servico_social"],
    //   icon: icons.fila,
    // },
    {
      id: "calculo-contribuicao",
      name: "Cálculo de Contribuição",
      roles: ["admin", "servico_social"],
      icon: icons.calculo,
    },
    {
      id: "disponibilidade-assistente",
      name: "Minha Disponibilidade",
      roles: ["admin", "servico_social"], // Mantém para assistentes gerenciarem
      icon: icons.disponibilidade,
    },
    {
      id: "disponibilidade-agendamentos", // Tela para agendar Triagem/Reavaliação
      name: "Agendar Paciente", // Nome mais claro para o menu
      roles: ["admin", "servico_social"],
      icon: icons.agendamentos, // Reutiliza ícone
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

  // Constrói o menu lateral baseado nas views permitidas
  function buildSocialSidebarMenu(userRoles = []) {
    if (!sidebarMenu) {
      console.error("Elemento do menu lateral (#sidebar-menu) não encontrado.");
      return;
    }
    // Adiciona link "Voltar"
    sidebarMenu.innerHTML = `
            <li><a href="../../../index.html" class="back-link"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg><span>Voltar à Intranet</span></a></li>
            <li class="menu-separator"></li>`;

    const currentHashBase = window.location.hash.substring(1).split("/")[0]; // Pega a parte principal da hash atual

    views.forEach((view) => {
      // Verifica permissão
      const hasPermission = view.roles.some((role) =>
        userRoles.includes(role.trim())
      );
      if (hasPermission) {
        const menuItem = document.createElement("li");
        const link = document.createElement("a");
        link.dataset.view = view.id; // Guarda o ID da view no link
        link.href = view.isExternal ? view.url : `#${view.id}`; // Define o link (interno ou externo)
        if (view.isExternal) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        link.innerHTML = `${view.icon || ""}<span>${view.name}</span>`; // Adiciona ícone e nome

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
    // viewName: ID da view (ex: 'dashboard-servico-social')
    // param: Parâmetro opcional da URL (ex: ID do paciente em '#fila-atendimento/ID')

    if (!contentArea) {
      console.error(
        "Área de conteúdo principal (#content-area) não encontrada."
      );
      return;
    }

    // Verifica se é um link externo (não carrega conteúdo)
    const viewData = views.find((v) => v.id === viewName);
    if (viewData && viewData.isExternal) {
      // Apenas garante que nenhum item interno fique ativo
      sidebarMenu
        .querySelectorAll("a[data-view].active")
        .forEach((l) => l.classList.remove("active"));
      // Encontra o link externo e adiciona 'active' (se necessário visualmente)
      const externalLink = sidebarMenu.querySelector(
        `a[data-view="${viewName}"]`
      );
      if (externalLink) externalLink.classList.add("active");
      return; // Não carrega HTML/JS para links externos
    }

    // Atualiza a classe 'active' no menu lateral
    if (sidebarMenu) {
      sidebarMenu.querySelectorAll("a[data-view]").forEach((link) => {
        link.classList.toggle("active", link.dataset.view === viewName);
      });
    }

    contentArea.innerHTML = '<div class="loading-spinner"></div>'; // Mostra carregando
    try {
      // 1. Carrega o HTML da view
      const response = await fetch(`./${viewName}.html`); // Ex: ./agendamentos-view.html
      if (!response.ok) {
        // Verifica se a view 'fila-atendimento' está sendo acessada diretamente (o que não deveria mais acontecer pelo menu)
        if (viewName === "fila-atendimento") {
          throw new Error(
            `A Fila de Atendimento deve ser acessada a partir da lista de Agendamentos.`
          );
        } else {
          throw new Error(`Arquivo HTML não encontrado: ${viewName}.html`);
        }
      }
      contentArea.innerHTML = await response.text(); // Insere o HTML na área de conteúdo

      // 2. Tenta carregar e executar o módulo JS correspondente
      const scriptPath = `../js/${viewName}.js`; // Ex: ../js/agendamentos-view.js
      try {
        const viewModule = await import(scriptPath);
        // Verifica se o módulo exporta uma função 'init' e a executa
        if (viewModule && typeof viewModule.init === "function") {
          console.log(
            `Inicializando módulo para view: ${viewName} com param: ${param}`
          );
          viewModule.init(user, userData, param); // Passa user, userData e o parâmetro da URL
        }
      } catch (e) {
        // Ignora erro se o JS não existir (nem todas as views precisam de JS)
        if (
          !e.message.includes("Failed to fetch dynamically imported module")
        ) {
          console.warn(
            `Erro ao importar ou executar script para '${viewName}':`,
            e
          );
        } else {
          console.log(
            `Nenhum script JS encontrado ou necessário para '${viewName}'.`
          );
        }
      }
    } catch (error) {
      console.error(`Erro ao carregar a view ${viewName}:`, error);
      contentArea.innerHTML = `<h2>Erro ao carregar '${viewName}'.</h2><p>${error.message}.</p>`;
    }
  }

  // Função que inicia o roteamento e carrega a view inicial
  function start() {
    const userRoles = userData.funcoes || [];
    buildSocialSidebarMenu(userRoles); // Monta o menu lateral

    // Função que lida com mudanças na URL hash
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      // Separa a hash em nome da view e parâmetro(s)
      const hashParts = hash.split("/");
      const viewName = hashParts[0]; // Primeira parte é o ID da view
      const param = hashParts[1]; // Segunda parte (se existir) é o parâmetro (ex: ID do paciente)
      // Nota: Se precisar de mais parâmetros (como na reavaliação), o JS da view específica (fila-atendimento.js) deve tratar hashParts[2], etc.

      // Carrega a view apenas se viewName não for vazio
      if (viewName) {
        // Verifica se a view solicitada existe na lista de views (exceto externas)
        const viewExists = views.some(
          (v) => v.id === viewName && !v.isExternal
        );
        if (viewExists) {
          loadView(viewName, param); // Carrega a view com o parâmetro
        } else if (!views.some((v) => v.id === viewName && v.isExternal)) {
          console.warn(`View "${viewName}" não encontrada ou não permitida.`);
          // Opcional: Redirecionar para a view padrão ou mostrar erro
          window.location.hash = views.find((v) => !v.isExternal)?.id || ""; // Vai para a primeira view interna
        }
        // Se for externa, o clique no link já redirecionou
      } else {
        // Se a hash estiver vazia, carrega a primeira view interna disponível
        const firstInternalView = views.find(
          (v) =>
            !v.isExternal &&
            v.roles.some((role) => userRoles.includes(role.trim()))
        );
        if (firstInternalView) {
          window.location.hash = firstInternalView.id; // Define a hash, o que vai disparar handleHashChange novamente
        } else {
          contentArea.innerHTML = "<h2>Nenhuma seção disponível.</h2>";
        }
      }
    };

    // Adiciona o listener para mudanças na hash
    window.addEventListener("hashchange", handleHashChange);

    // Chama handleHashChange uma vez para carregar a view inicial (ou a definida na URL)
    handleHashChange();
  }

  start(); // Inicia o painel
}
