/**
 * Arquivo: modulos/rh/js/rh-painel.js
 * Versão: 2.6.0 (Adicionando Módulo de Admissão e Documentos)
 * Data: 04/11/2025
 * Descrição: Gerenciador principal do painel RH com roteamento por hash
 */

import { arrayUnion } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

/**
 * Inicializa o painel de RH e configura o sistema de roteamento
 * @param {Object} user - Objeto do usuário autenticado
 * @param {Object} db - Instância do Firestore
 * @param {Object} userData - Dados do usuário (incluindo funções/permissões)
 */
export function initrhPanel(user, db, userData) {
  console.log("🔹 RH Panel: Inicializando painel de RH..."); // Torna o db acessível globalmente (para módulos filhos)

  window.db = db;

  const userRoles = userData.funcoes || [];
  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu"); // ============================================ // ÍCONES SVG DO MENU // ============================================

  const icons = {
    voltar: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>`,
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    gestao_vagas: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
    recrutamento: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>`,
    gestao_estudos_de_caso: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`, // NOVO ÍCONE ADICIONADO (Processo de Admissão - user-check)
    admissao: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>`, // NOVO ÍCONE ADICIONADO (Gestão de Documentos - file-text)
    gestao_documentos: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    desligamento: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/></svg>`,
    gestao_profissionais: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    comunicados: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    avaliacao_continua: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  }; // ============================================ // DEFINIÇÃO DE VIEWS E PERMISSÕES // ============================================

  const views = [
    {
      id: "dashboard",
      name: "Dashboard RH",
      roles: ["admin", "rh"],
      icon: icons.dashboard,
    },
    {
      id: "gestao_vagas",
      name: "Criação e Arte de Vagas",
      roles: ["admin", "rh"],
      icon: icons.gestao_vagas,
    },
    {
      id: "recrutamento",
      name: "Recrutamento e Fluxo",
      roles: ["admin", "rh"],
      icon: icons.recrutamento,
    },
    {
      id: "admissao",
      name: "Processo de Admissão",
      roles: ["admin", "rh"],
      icon: icons.admissao,
    },
    {
      id: "detalhes_teste",
      name: "Detalhes do Teste (Avaliação)",
      roles: ["admin", "rh"],
      icon: icons.gestao_estudos_de_caso,
      hideInMenu: true, // Oculta do menu lateral, pois é uma tela de detalhes
    },
    {
      id: "avaliacao_continua", // NOVA VIEW
      name: "Avaliação Contínua",
      roles: ["admin", "rh"],
      icon: icons.avaliacao_continua,
    },
    {
      id: "desligamento",
      name: "Desligamento",
      roles: ["admin"],
      icon: icons.desligamento,
    },
    {
      id: "comunicados",
      name: "Comunicação",
      roles: ["admin"],
      icon: icons.comunicados,
    },
    {
      id: "gestao_profissionais",
      name: "Profissionais",
      roles: ["admin"],
      icon: icons.gestao_profissionais,
    },
    {
      id: "gestao_estudos_de_caso",
      name: "Gerenciar Estudos/Testes",
      roles: ["admin", "rh"],
      icon: icons.gestao_estudos_de_caso,
    }, // NOVA ROTA ADICIONADA

    {
      id: "gestao_documentos",
      name: "Gerenciar Documentos",
      roles: ["admin", "rh"],
      icon: icons.gestao_documentos,
    },
  ]; // ============================================ // FUNÇÃO DE NOTIFICAÇÃO (TOAST) // ============================================
  /**
   * Exibe notificações temporárias na tela
   * @param {string} message - Mensagem a ser exibida
   * @param {string} type - Tipo de notificação: success, error, warning, info
   */

  window.showToast = function (message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
   <div class="toast-content">
    <span class="toast-icon">${getToastIcon(type)}</span>
    <span class="toast-message">${message}</span>
   </div>
  `;

    document.body.appendChild(toast); // Adiciona classe de entrada

    setTimeout(() => toast.classList.add("show"), 10); // Remove após 3 segundos

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };
  /**
   * Retorna o ícone apropriado para cada tipo de toast
   */

  function getToastIcon(type) {
    const icons = {
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ",
    };
    return icons[type] || icons.info;
  } // ============================================ // CARREGAMENTO DE VIEWS (HTML + JS) // ============================================
  /**
   * Carrega dinamicamente uma view (HTML e JavaScript)
   * @param {string} viewName - Nome da view a ser carregada (pode incluir parâmetros)
   */

  async function loadView(viewName) {
    // Extrai view base e parâmetros da URL (ex: recrutamento?vaga=123)
    const [baseView, params] = viewName.split("?");
    const viewData = views.find((v) => v.id === baseView); // Validação de permissões

    if (
      !viewData ||
      !viewData.roles.some((role) => userRoles.includes(role.trim()))
    ) {
      contentArea.innerHTML = `
    <div class="dashboard-section">
     <h2>🚫 Acesso Negado</h2>
     <p>Você não tem permissão para visualizar este módulo.</p>
    </div>
   `;
      return;
    } // Atualiza classe ativa no sidebar (apenas para views visíveis no menu)

    if (!viewData.hideInMenu) {
      sidebarMenu.querySelectorAll("a[data-view]").forEach((link) => {
        link.classList.toggle("active", link.dataset.view === baseView);
      });
    } // Exibe loading

    contentArea.innerHTML = '<div class="loading-spinner"></div>';

    try {
      // 1. Carrega o HTML da view
      const htmlPath = `./${baseView}.html`;
      console.log(`🔹 RH Panel: Carregando HTML de ${htmlPath}`);

      const response = await fetch(htmlPath);
      if (!response.ok) {
        throw new Error(`Arquivo HTML não encontrado: ${baseView}.html`);
      }

      const htmlContent = await response.text(); // Remove scripts inline do HTML (para segurança)

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlContent;
      tempDiv.querySelectorAll("script").forEach((script) => script.remove());
      contentArea.innerHTML = tempDiv.innerHTML; // 2. Carrega e executa o JavaScript da view

      const jsPath = `./${baseView}.js`;
      console.log(`🔹 RH Panel: Importando JS de ${jsPath}`);

      const viewModule = await import(jsPath + "?t=" + Date.now()); // Tenta diferentes padrões de nome de função de inicialização

      const initFuncName = `init${baseView.replace(/[-_]/g, "")}`;

      if (typeof viewModule[initFuncName] === "function") {
        console.log(`🔹 RH Panel: Executando ${initFuncName}()`);
        await viewModule[initFuncName](user, userData);
      } else if (typeof viewModule.init === "function") {
        console.log(`🔹 RH Panel: Executando init()`);
        await viewModule.init(user, userData);
      } else if (typeof viewModule.initRecrutamento === "function") {
        console.log(`🔹 RH Panel: Executando initRecrutamento()`);
        await viewModule.initRecrutamento(user, userData);
      } else {
        console.warn(
          `⚠️ RH Panel: Função de inicialização não encontrada em ${baseView}.js`
        );
      }

      console.log(`✅ RH Panel: View ${baseView} carregada com sucesso`);
    } catch (error) {
      console.error(`❌ RH Panel: Erro ao carregar view ${baseView}:`, error);
      contentArea.innerHTML = `
    <div class="dashboard-section">
     <h2>❌ Erro ao Carregar Módulo</h2>
     <p class="alert alert-error">${error.message}</p>
     <p>Verifique o console para mais detalhes.</p>
    </div>
   `;
    }
  } // ============================================ // CONSTRUÇÃO DO MENU LATERAL // ============================================
  /**
   * Constrói o menu da sidebar com base nas permissões do usuário
   */

  function buildRHSidebarMenu() {
    if (!sidebarMenu) {
      console.error("❌ RH Panel: Elemento sidebar-menu não encontrado");
      return;
    } // Link de voltar à intranet

    sidebarMenu.innerHTML = `
   <li>
    <a href="../../../index.html" class="back-link">
     ${icons.voltar}
     <span>Voltar à Intranet</span>
    </a>
   </li>
   <li class="menu-separator"></li>
  `; // Adiciona links das views permitidas

    views.forEach((view) => {
      // Não exibe no menu se hideInMenu for true
      if (view.hideInMenu) return;

      const hasPermission = view.roles.some((role) =>
        userRoles.includes(role.trim())
      );

      if (hasPermission) {
        sidebarMenu.innerHTML += `
     <li>
      <a href="#rh/${view.id}" data-view="${view.id}">
       ${view.icon}
       <span>${view.name}</span>
      </a>
     </li>
    `;
      }
    });

    console.log("✅ RH Panel: Menu lateral construído com sucesso");
  } // ============================================ // SISTEMA DE NAVEGAÇÃO (HASH ROUTING) // ============================================
  /**
   * Manipula mudanças na URL (hash) e carrega a view correspondente
   */

  function handleNavigation() {
    const requestedHash = window.location.hash.substring(1); // Remove o #
    const cleanHash = requestedHash.replace(/^rh\//, ""); // Remove o prefixo "rh/" // Encontra a primeira view permitida para usar como fallback

    const firstPermittedView = views.find(
      (v) => !v.hideInMenu && v.roles.some((r) => userRoles.includes(r.trim()))
    ); // Define qual view carregar

    let targetViewId =
      cleanHash || (firstPermittedView ? firstPermittedView.id : "dashboard");

    if (targetViewId) {
      // Garante que a URL esteja sempre no formato #rh/view
      if (!window.location.hash.startsWith("#rh/")) {
        window.history.replaceState(null, "", `#rh/${targetViewId}`);
      }
      loadView(targetViewId);
    } else {
      contentArea.innerHTML = `
    <div class="dashboard-section">
     <h2>🚫 Sem Permissões</h2>
     <p>Você não tem permissão para acessar nenhuma seção deste módulo.</p>
    </div>
   `;
    }
  } // ============================================ // INICIALIZAÇÃO // ============================================

  console.log("🔹 RH Panel: Construindo menu e configurando navegação...");

  buildRHSidebarMenu();
  window.addEventListener("hashchange", handleNavigation);
  handleNavigation(); // Carrega a view inicial

  console.log("✅ RH Panel: Inicialização completa");
}
