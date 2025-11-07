/**
 * Arquivo: modulos/rh/js/rh-painel.js
 * Versão: 2.9.0 (Correção: Caminho correto do dashboard)
 */

console.log("🟢 1. rh-painel.js carregado");

export function initrhPanel(user, db, userData) {
  console.log("🟢 2. initrhPanel chamado");
  console.log("🟢 3. User:", user?.uid);
  console.log("🟢 4. UserData:", userData);

  window.db = db;
  console.log("🟢 5. window.db definido");

  const userRoles = userData?.funcoes || [];
  console.log("🟢 6. Roles do usuário:", userRoles);

  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu");

  console.log("🟢 7. contentArea encontrado:", !!contentArea);
  console.log("🟢 8. sidebarMenu encontrado:", !!sidebarMenu);

  if (!contentArea || !sidebarMenu) {
    console.error("❌ ERRO: Elementos não encontrados!");
    return;
  }

  let isLoadingModule = false;
  let lastLoadedModule = null;
  let loadAttempts = 0;
  const MAX_LOAD_ATTEMPTS = 3;

  const icons = {
    voltar: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2z"/></svg>`,
    dashboard: `<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>`,
  };

  const views = [
    {
      id: "dashboard",
      name: "Dashboard RH",
      roles: ["admin", "rh"],
      icon: icons.dashboard,
    },
  ];

  console.log("🟢 9. Views definidas:", views.length);

  window.showToast = function (message, type = "success") {
    console.log(`📢 Toast (${type}):`, message);
    const colors = {
      success: "#28a745",
      error: "#dc3545",
      warning: "#ffc107",
      info: "#17a2b8",
    };

    const toast = document.createElement("div");
    toast.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${colors[type]};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-weight: 500;
        max-width: 350px;
      ">
        ${message}
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  function renderSidebarMenu() {
    console.log("🟢 10. Renderizando menu...");

    const allowedViews = views.filter((view) => {
      const hasRole = view.roles.some((role) => userRoles.includes(role));
      console.log(`   - View "${view.id}": hasRole=${hasRole}`);
      return hasRole;
    });

    console.log("🟢 11. Views permitidas:", allowedViews.length);

    let menuHTML = `
      <li>
        <a href="#/main" class="back-link">
          ${icons.voltar}
          <span>Voltar ao Dashboard</span>
        </a>
      </li>
      <li class="menu-separator"></li>
    `;

    if (allowedViews.length === 0) {
      menuHTML += `
        <li style="padding: 15px; color: #666; font-size: 0.9rem;">
          Você não tem permissão para acessar nenhuma seção deste módulo.
        </li>
      `;
    } else {
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
    }

    sidebarMenu.innerHTML = menuHTML;
    console.log("🟢 12. Menu renderizado");
  }

  function updateActiveMenuItem() {
    const currentHash = window.location.hash.replace("#/rh/", "");
    console.log("🟢 13. Atualizando item ativo:", currentHash);

    const menuLinks = sidebarMenu?.querySelectorAll("a[data-view]");
    menuLinks?.forEach((link) => {
      const viewId = link.getAttribute("data-view");
      if (viewId === currentHash) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  function hasPermission(viewId) {
    const view = views.find((v) => v.id === viewId);
    if (!view) return false;
    return view.roles.some((role) => userRoles.includes(role));
  }

  async function loadModule(viewId) {
    console.log(`🟢 14. loadModule chamado para: "${viewId}"`);
    console.log(`   - isLoadingModule: ${isLoadingModule}`);
    console.log(`   - lastLoadedModule: ${lastLoadedModule}`);
    console.log(`   - loadAttempts: ${loadAttempts}`);

    if (loadAttempts >= MAX_LOAD_ATTEMPTS) {
      console.error("❌ LOOP DETECTADO! Máximo de tentativas atingido.");
      contentArea.innerHTML = `
        <div style="padding: 40px; text-align: center;">
          <h2 style="color: #dc3545;">⚠️ Erro de Carregamento</h2>
          <p>O módulo entrou em loop. Verifique o console para mais detalhes.</p>
          <button onclick="location.reload()" style="
            padding: 10px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 20px;
          ">Recarregar Página</button>
        </div>
      `;
      return;
    }

    if (isLoadingModule) {
      console.warn("⚠️ Carregamento já em andamento. Aguarde...");
      return;
    }

    if (lastLoadedModule === viewId) {
      console.log(
        `✅ Módulo "${viewId}" já carregado. Apenas atualizando menu.`
      );
      updateActiveMenuItem();
      return;
    }

    loadAttempts++;
    isLoadingModule = true;

    console.log(`🟢 15. Verificando permissão para "${viewId}"...`);
    if (!hasPermission(viewId)) {
      console.error(`❌ Sem permissão para "${viewId}"`);
      contentArea.innerHTML = `
        <div style="padding: 40px; text-align: center;">
          <h2 style="color: #dc3545;">🔒 Sem Permissão</h2>
          <p>Você não tem permissão para visualizar este módulo.</p>
        </div>
      `;
      isLoadingModule = false;
      return;
    }

    console.log(`🟢 16. Permissão OK para "${viewId}"`);

    const view = views.find((v) => v.id === viewId);
    if (!view) {
      console.error(`❌ View "${viewId}" não encontrada`);
      contentArea.innerHTML = `
        <div style="padding: 40px; text-align: center;">
          <h2 style="color: #dc3545;">❌ Módulo Não Encontrado</h2>
          <p>O módulo "${viewId}" não existe.</p>
        </div>
      `;
      isLoadingModule = false;
      return;
    }

    console.log(`🟢 17. View encontrada:`, view.name);

    // ✅ CORREÇÃO: Caminhos corretos baseados na estrutura do projeto
    const moduleFiles = {
      dashboard: {
        html: "../page/dashboard.html", // ✅ Caminho correto
        js: "./dashboard.js", // ✅ Caminho correto
      },
    };

    const moduleFile = moduleFiles[viewId];
    if (!moduleFile) {
      console.error(`❌ Arquivo não mapeado para "${viewId}"`);
      contentArea.innerHTML = `
        <div style="padding: 40px; text-align: center;">
          <h2 style="color: #dc3545;">❌ Arquivo Não Mapeado</h2>
          <p>O arquivo do módulo "${viewId}" não foi configurado.</p>
        </div>
      `;
      isLoadingModule = false;
      return;
    }

    console.log(`🟢 18. Arquivo HTML:`, moduleFile.html);
    console.log(`🟢 18. Arquivo JS:`, moduleFile.js);

    try {
      // CARREGAR HTML
      console.log(`🟢 19. Carregando HTML:`, moduleFile.html);

      const htmlResponse = await fetch(moduleFile.html);
      console.log(
        `🟢 20. Resposta HTML: ${htmlResponse.status} ${htmlResponse.statusText}`
      );

      if (!htmlResponse.ok) {
        throw new Error(
          `Erro HTTP ${htmlResponse.status}: ${htmlResponse.statusText}`
        );
      }

      const htmlContent = await htmlResponse.text();
      console.log(`🟢 21. HTML carregado (${htmlContent.length} caracteres)`);

      contentArea.innerHTML = htmlContent;
      console.log(`🟢 22. HTML inserido no DOM`);

      // CARREGAR E EXECUTAR JS
      const initFunctionName = "initDashboard";
      console.log(`🟢 23. Importando módulo JS:`, moduleFile.js);
      console.log(`🟢 24. Procurando função:`, initFunctionName);

      const cacheBuster = `?t=${Date.now()}`;
      const module = await import(`${moduleFile.js}${cacheBuster}`);
      console.log(
        `🟢 25. Módulo importado. Funções disponíveis:`,
        Object.keys(module)
      );

      if (typeof module[initFunctionName] !== "function") {
        throw new Error(
          `Função "${initFunctionName}" não encontrada. Disponíveis: ${Object.keys(
            module
          ).join(", ")}`
        );
      }

      console.log(
        `🟢 26. Função encontrada! Executando ${initFunctionName}...`
      );
      await module[initFunctionName](user, userData);

      lastLoadedModule = viewId;
      loadAttempts = 0;
      console.log(`🟢 27. ✅ Módulo "${viewId}" carregado com SUCESSO!`);

      updateActiveMenuItem();
    } catch (error) {
      console.error(`❌ ERRO ao carregar módulo "${viewId}":`, error);
      console.error(`   Stack:`, error.stack);

      contentArea.innerHTML = `
        <div style="padding: 40px;">
          <h2 style="color: #dc3545;">❌ Erro ao Carregar Módulo</h2>
          <p><strong>Módulo:</strong> ${view.name}</p>
          <p><strong>Erro:</strong> ${error.message}</p>
          <details style="margin-top: 20px;">
            <summary style="cursor: pointer; color: #667eea;">Ver Stack Trace</summary>
            <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow: auto; margin-top: 10px;">${error.stack}</pre>
          </details>
          <button onclick="location.reload()" style="
            padding: 10px 20px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 20px;
          ">Recarregar Página</button>
        </div>
      `;
    } finally {
      isLoadingModule = false;
      console.log(`🟢 28. isLoadingModule resetado para false`);
    }
  }

  function handleRouting() {
    const hash = window.location.hash;
    console.log(`🟢 29. handleRouting chamado. Hash:`, hash);

    if (hash.startsWith("#/rh/")) {
      const viewId = hash.replace("#/rh/", "");
      console.log(`🟢 30. Detectado viewId:`, viewId);
      loadModule(viewId);
    } else if (!hash || hash === "#/rh" || hash === "#/rh/") {
      console.log(
        `🟢 31. Hash vazio ou #/rh. Redirecionando para dashboard...`
      );
      window.location.hash = "#/rh/dashboard";
    } else {
      console.log(`🟢 32. Hash não reconhecido:`, hash);
    }
  }

  console.log("🟢 33. Iniciando renderização do menu...");
  renderSidebarMenu();

  console.log("🟢 34. Configurando event listener para hashchange...");
  window.addEventListener("hashchange", handleRouting);

  console.log("🟢 35. Chamando handleRouting inicial...");
  handleRouting();

  console.log("🟢 36. ✅ initrhPanel concluído!");
}
