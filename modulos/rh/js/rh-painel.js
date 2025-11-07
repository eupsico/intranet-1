/**
 * Arquivo: modulos/rh/js/rh-painel.js
 * Versão: 2.6.0 (Correção: Carregamento do Dashboard)
 * Data: 07/11/2025
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
  console.log("🔹 RH Panel: Inicializando painel de RH...");

  // Torna o db acessível globalmente (para módulos filhos)
  window.db = db;

  const userRoles = userData.funcoes || [];
  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu");

  // ============================================
  // ÍCONES SVG DO MENU
  // ============================================
  const icons = {
    voltar: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2z"/></svg>`,
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>`,
    gestao_vagas: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 0h-4V4h4v2z"/></svg>`,
    recrutamento: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
    gestao_estudos_de_caso: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M9 11H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm2-7h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/></svg>`,
    onboarding_colaboradores: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
    desligamento: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42C17.99 7.86 19 9.81 19 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.19 1.01-4.14 2.58-5.42L6.17 5.17C4.23 6.82 3 9.26 3 12c0 4.97 4.03 9 9 9s9-4.03 9-9c0-2.74-1.23-5.18-3.17-6.83z"/></svg>`,
    gestao_profissionais: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
    comunicados: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`,
  };

  // ============================================
  // DEFINIÇÃO DE VIEWS E PERMISSÕES
  // ============================================
  const views = [
    {
      id: "dashboard",
      name: "Dashboard RH",
      roles: ["admin", "rh"],
      icon: icons.dashboard,
    },
    {
      id: "gestao_vagas",
      name: "1. Criação e Arte de Vagas",
      roles: ["admin", "rh"],
      icon: icons.gestao_vagas,
    },
    {
      id: "recrutamento",
      name: "2. Recrutamento e Fluxo",
      roles: ["admin", "rh"],
      icon: icons.recrutamento,
    },
    {
      id: "gestao_estudos_de_caso",
      name: "3. Gerenciar Estudos/Testes",
      roles: ["admin", "rh"],
      icon: icons.gestao_estudos_de_caso,
    },
    {
      id: "gestao_profissionais",
      name: "Profissionais",
      roles: ["admin", "rh"],
      icon: icons.gestao_profissionais,
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
      id: "comunicados",
      name: "Comunicação",
      roles: ["admin", "rh"],
      icon: icons.comunicados,
    },
    // Rota oculta para cronograma (não aparece no menu)
    {
      id: "etapa_cronograma_orcamento",
      name: "Cronograma e Orçamento",
      roles: ["admin", "rh"],
      icon: null,
      hideInMenu: true,
    },
  ];

  // ============================================
  // FUNÇÃO DE NOTIFICAÇÃO (TOAST)
  // ============================================
  /**
   * Exibe notificações temporárias na tela
   * @param {string} message - Mensagem a ser exibida
   * @param {string} type - Tipo de notificação: success, error, warning, info
   */
  window.showToast = function (message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${
          type === "success"
            ? "#28a745"
            : type === "error"
            ? "#dc3545"
            : type === "warning"
            ? "#ffc107"
            : "#17a2b8"
        };
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-weight: 500;
        max-width: 350px;
        animation: slideIn 0.3s ease-out;
      ">
        ${message}
      </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "slideOut 0.3s ease-in";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  };

  // ============================================
  // RENDERIZAR MENU LATERAL
  // ============================================
  function renderSidebarMenu() {
    if (!sidebarMenu) return;

    const allowedViews = views.filter((view) => {
      if (view.hideInMenu) return false;
      return view.roles.some((role) => userRoles.includes(role));
    });

    if (allowedViews.length === 0) {
      sidebarMenu.innerHTML = `
        <li>
          <a href="#/main" class="back-link">
            ${icons.voltar}
            <span>Voltar ao Dashboard</span>
          </a>
        </li>
        <li class="menu-separator"></li>
        <li style="padding: 15px; color: var(--cor-texto-secundario); font-size: 0.9rem;">
          Você não tem permissão para acessar nenhuma seção deste módulo.
        </li>
      `;
      return;
    }

    let menuHTML = `
      <li>
        <a href="#/main" class="back-link">
          ${icons.voltar}
          <span>Voltar ao Dashboard</span>
        </a>
      </li>
      <li class="menu-separator"></li>
    `;

    allowedViews.forEach((view) => {
      menuHTML += `
        <li>
          <a href="#/rh/${view.id}" data-view="${view.id}">
            ${view.icon}
            <span>${view.name}</span>
          </a>
        </li>
      `;
    });

    sidebarMenu.innerHTML = menuHTML;

    // Marca o item ativo
    updateActiveMenuItem();
  }

  // ============================================
  // ATUALIZAR ITEM ATIVO DO MENU
  // ============================================
  function updateActiveMenuItem() {
    const currentHash = window.location.hash.replace("#/rh/", "");
    const menuLinks = sidebarMenu.querySelectorAll("a[data-view]");

    menuLinks.forEach((link) => {
      const viewId = link.getAttribute("data-view");
      if (viewId === currentHash) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  // ============================================
  // VERIFICAR PERMISSÃO DO USUÁRIO
  // ============================================
  function hasPermission(viewId) {
    const view = views.find((v) => v.id === viewId);
    if (!view) return false;
    return view.roles.some((role) => userRoles.includes(role));
  }

  // ============================================
  // CARREGAR MÓDULO DINÂMICO
  // ============================================
  async function loadModule(viewId) {
    console.log(`📦 RH Panel: Carregando módulo "${viewId}"...`);

    if (!hasPermission(viewId)) {
      contentArea.innerHTML = `
        <div class="alert alert-error">
          <i class="fas fa-exclamation-triangle"></i>
          <span>Você não tem permissão para visualizar este módulo.</span>
        </div>
      `;
      return;
    }

    const view = views.find((v) => v.id === viewId);
    if (!view) {
      contentArea.innerHTML = `
        <div class="alert alert-error">
          <i class="fas fa-times-circle"></i>
          <span>Módulo "${viewId}" não encontrado.</span>
        </div>
      `;
      return;
    }

    // ✅ CORREÇÃO: Mapeamento correto do dashboard
    const moduleMapping = {
      dashboard: "./dashboard.js",
      gestao_vagas: "./gestao-vagas.js",
      recrutamento: "./recrutamento.js",
      gestao_estudos_de_caso: "./gestao-estudos-de-caso.js",
      gestao_profissionais: "./gestao-profissionais.js",
      onboarding_colaboradores: "./onboarding-colaboradores.js",
      desligamento: "./desligamento.js",
      comunicados: "./comunicados.js",
      etapa_cronograma_orcamento: "./etapa-cronograma-orcamento.js",
    };

    const moduleFile = moduleMapping[viewId];
    if (!moduleFile) {
      contentArea.innerHTML = `
        <div class="alert alert-error">
          <i class="fas fa-times-circle"></i>
          <span>Arquivo do módulo "${viewId}" não mapeado.</span>
        </div>
      `;
      return;
    }

    try {
      // Carrega o HTML do módulo
      const htmlFile = moduleFile.replace(".js", ".html");
      const htmlResponse = await fetch(htmlFile);
      if (!htmlResponse.ok) {
        throw new Error(`Erro ao carregar HTML: ${htmlResponse.status}`);
      }
      const htmlContent = await htmlResponse.text();
      contentArea.innerHTML = htmlContent;

      // ✅ CORREÇÃO: Nome correto da função de inicialização
      const initFunctionName =
        viewId === "dashboard"
          ? "initDashboard" // Nome correto para dashboard
          : `init${viewId
              .split("_")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join("")}`;

      console.log(`🔧 RH Panel: Procurando função "${initFunctionName}"...`);

      // Importa o módulo JS
      const module = await import(moduleFile);

      if (typeof module[initFunctionName] !== "function") {
        throw new Error(
          `⚠️ RH Panel: Função de inicialização "${initFunctionName}" não encontrada em ${moduleFile}`
        );
      }

      console.log(
        `✅ RH Panel: Função "${initFunctionName}" encontrada. Executando...`
      );

      // Executa a função de inicialização
      await module[initFunctionName](user, userData);

      console.log(`✅ RH Panel: Módulo "${viewId}" carregado com sucesso!`);
      updateActiveMenuItem();
    } catch (error) {
      console.error(`❌ RH Panel: Erro ao carregar módulo "${viewId}":`, error);
      contentArea.innerHTML = `
        <div class="alert alert-error">
          <i class="fas fa-times-circle"></i>
          <div>
            <strong>Erro ao carregar módulo "${view.name}"</strong>
            <p>${error.message}</p>
            <small>Verifique o console para mais detalhes.</small>
          </div>
        </div>
      `;
    }
  }

  // ============================================
  // ROTEAMENTO POR HASH
  // ============================================
  function handleRouting() {
    const hash = window.location.hash;
    console.log(`🔄 RH Panel: Hash detectado: ${hash}`);

    if (hash.startsWith("#/rh/")) {
      const viewId = hash.replace("#/rh/", "");
      loadModule(viewId);
    } else {
      // Redireciona para o dashboard por padrão
      window.location.hash = "#/rh/dashboard";
    }
  }

  // ============================================
  // INICIALIZAÇÃO
  // ============================================
  renderSidebarMenu();
  window.addEventListener("hashchange", handleRouting);
  handleRouting();

  console.log("✅ RH Panel: Painel inicializado com sucesso!");
}
