// Arquivo: /modulos/voluntario/js/portal-voluntario.js
// Versão: 4.0 (Atualizado para a sintaxe modular do Firebase v9)

// 1. Importa as funções necessárias do nosso arquivo central de inicialização
import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  updateDoc,
} from "../../../assets/js/firebase-init.js"; // <<< PASSO 1: CONFIRME ABSOLUTAMENTE SE ESTE CAMINHO ESTÁ CORRETO

/**
 * Verifica se a foto do usuário no Google é diferente da salva no banco de dados
 * e atualiza se necessário.
 * @param {object} user - O objeto de usuário do Firebase Auth.
 * @param {object} userData - Os dados do usuário vindos do Firestore.
 */
async function updateUserPhotoOnLogin(user, userData) {
  const firestorePhotoUrl = userData.fotoUrl || "";
  const googlePhotoUrl = user.photoURL || "";

  if (googlePhotoUrl && firestorePhotoUrl !== googlePhotoUrl) {
    try {
      const userDocRef = doc(db, "usuarios", user.uid);
      await updateDoc(userDocRef, { fotoUrl: googlePhotoUrl });
      userData.fotoUrl = googlePhotoUrl;
      console.log("Foto do usuário atualizada no Firestore.");
    } catch (error) {
      console.error("Erro ao atualizar a foto do usuário:", error);
    }
  }
}

// 2. Ouve as mudanças no estado de autenticação
onAuthStateChanged(auth, async (user) => {
  console.log("[Auth] State changed. User:", user ? user.uid : "null");
  if (user) {
    try {
      const userDocRef = doc(db, "usuarios", user.uid);
      console.log("[Auth] Buscando documento do usuário:", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log("[Auth] Documento do usuário encontrado:", userData.nome);
        await updateUserPhotoOnLogin(user, userData);
        initPortal(user, userData); // Inicia o portal
      } else {
        console.error(
          "[Auth] Documento do usuário não encontrado no Firestore para UID:",
          user.uid
        );
        alert(
          "Erro: Seu usuário não foi encontrado em nosso banco de dados. Contate o suporte."
        );
        window.location.href = "../../../index.html";
      }
    } catch (error) {
      console.error(
        "[Auth] Erro ao buscar dados do usuário no Firestore:",
        error
      );
      alert(
        "Erro ao verificar seus dados de usuário. Tente novamente mais tarde."
      );
      window.location.href = "../../../index.html";
    }
  } else {
    console.log("[Auth] Usuário não autenticado. Redirecionando para login.");
    window.location.href = "../../../index.html";
  }
});

/**
 * Inicializa todo o portal do voluntário.
 * @param {object} user - Objeto do Firebase Auth.
 * @param {object} userData - Dados do Firestore.
 */
function initPortal(user, userData) {
  console.log("[initPortal] Iniciando portal para:", userData.nome);
  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu"); // Definições de ícones (COMPLETO)

  const icons = {
    dashboard:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    perfil:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    pacientes:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    voluntarios:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    supervisao:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    comprovantes:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>',
    recursos:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    solicitacoes:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/></svg>',
    gestao:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    painelSupervisor:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    plantao: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81 .7A2 2 0 0 1 22 16.92z"/></svg>`,
  }; // Definição das Views (COMPLETO)

  const views = [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: icons.dashboard,
      roles: ["todos"],
    },
    {
      id: "meu-perfil",
      name: "Meu Perfil",
      icon: icons.perfil,
      roles: ["todos"],
    },
    {
      id: "meus-pacientes",
      name: "Meus Pacientes",
      icon: icons.pacientes,
      roles: ["atendimento"],
    },
    {
      id: "voluntarios",
      name: "Voluntários",
      icon: icons.voluntarios,
      roles: ["todos"],
    },
    {
      id: "supervisao",
      name: "Supervisão",
      icon: icons.supervisao,
      roles: ["todos"],
    },
    {
      id: "envio_comprovantes",
      name: "Enviar Comprovante",
      icon: icons.comprovantes,
      roles: ["todos"],
    },
    {
      id: "recursos",
      name: "Recursos do Voluntário",
      icon: icons.recursos,
      roles: ["todos"],
    },
    {
      id: "plantao-psicologico",
      name: "Guia do Plantão",
      icon: icons.plantao,
      roles: ["todos"],
    },
    {
      id: "gestao",
      name: "Nossa Gestão",
      icon: icons.gestao,
      roles: ["todos"],
    },
  ]; // Adiciona Painel Supervisor condicionalmente

  const funcoes = userData.funcoes || [];
  if (funcoes.includes("supervisor") || funcoes.includes("admin")) {
    views.splice(4, 0, {
      // Insere na posição 4
      id: "painel-supervisor",
      name: "Painel Supervisor",
      icon: icons.painelSupervisor,
      roles: ["supervisor", "admin"],
    });
  } /** Constrói o menu lateral */

  function buildSidebarMenu() {
    if (!sidebarMenu) {
      console.error(
        "[buildSidebarMenu] Elemento #sidebar-menu não encontrado."
      );
      return;
    }
    sidebarMenu.innerHTML = `
            <li>
                <a href="../../../index.html" class="back-link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    <span>Voltar à Intranet</span>
                </a>
            </li>
            <li class="menu-separator"></li>
        `;

    const userRoles = userData.funcoes || [];
    views.forEach((view) => {
      const hasPermission =
        view.roles.includes("todos") ||
        view.roles.some((role) => userRoles.includes(role));
      if (hasPermission) {
        sidebarMenu.innerHTML += `
                <li>
                    <a href="#${view.id}" data-view="${view.id}">
                        ${view.icon}
                        <span>${view.name}</span>
                    </a>
                </li>`;
      }
    });
    console.log("[buildSidebarMenu] Menu construído.");
  } /** Carrega um arquivo CSS dinamicamente */

  function loadCss(path) {
    if (!document.querySelector(`link[href="${path}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = path;
      document.head.appendChild(link);
      console.log(`[loadCss] CSS carregado: ${path}`);
    } else {
      console.log(`[loadCss] CSS já existe: ${path}`);
    }
  } // ========================================================== // FUNÇÃO loadView LIMPA (SEM LOGS INTERNOS EXCESSIVOS) // ==========================================================

  async function loadView(viewId, param = null) {
    if (!sidebarMenu || !contentArea) {
      console.error(
        "[loadView] Erro: sidebarMenu ou contentArea não encontrados no DOM."
      );
      return;
    }
    console.log(
      `[loadView] Iniciando carregamento para view: ${viewId}, Param: ${param}`
    ); // Marca o link ativo no menu

    sidebarMenu
      .querySelectorAll("a")
      .forEach((link) => link.classList.remove("active"));
    const activeLink = sidebarMenu.querySelector(`a[data-view="${viewId}"]`);
    if (activeLink) activeLink.classList.add("active");

    contentArea.innerHTML = '<div class="loading-spinner"></div> Carregando...'; // Mostra loading // --- Definição dos Caminhos ---

    const htmlPath = `./${viewId}.html`; // <<< PASSO 2: AJUSTE ESTE CAMINHO SE NECESSÁRIO >>> // Este caminho DEVE ser correto para que `import()` encontre o JS da view // Ex: Se portal-voluntario.js está em /js/ e detalhe-paciente.js também:
    const jsPath = `./${viewId}.js`; // Ex: Se portal-voluntario.js está em /js/ e detalhe-paciente.js está em /modulos/voluntario/js/ // const jsPath = `../modulos/voluntario/js/${viewId}.js`;
    const cssPath = `../css/${viewId}.css`; // Relativo à pasta 'page'

    console.log(
      `[loadView] Paths definidos - HTML: ${htmlPath}, JS: ${jsPath}, CSS: ${cssPath}`
    );

    try {
      // Carrega CSS
      loadCss(cssPath); // Carrega HTML

      const response = await fetch(htmlPath);
      if (!response.ok)
        throw new Error(
          `Arquivo HTML não encontrado: ${htmlPath} (Status: ${response.status})`
        );
      contentArea.innerHTML = await response.text();
      console.log(`[loadView] HTML ${htmlPath} carregado.`); // <<< INÍCIO DA CORREÇÃO >>> // Espera o DOM ser atualizado pelo navegador antes de importar e executar o JS. // Isso resolve a condição de corrida (race condition).

      await new Promise((resolve) => setTimeout(resolve, 0)); // <<< FIM DA CORREÇÃO >>> // Tenta importar o módulo JS dinamicamente
      console.log(`[loadView] Tentando importar ${jsPath}...`);
      const viewModule = await import(jsPath); // <<< Ponto onde o SyntaxError pode ser lançado durante a importação
      console.log(`[loadView] Módulo ${jsPath} importado com sucesso.`); // Executa a função init se existir

      if (viewModule && typeof viewModule.init === "function") {
        console.log(`[loadView] Chamando init() de ${viewId}...`);
        await viewModule.init(user, userData, param); // <<< Ponto onde o SyntaxError pode ser lançado durante a execução do init
        console.log(`[loadView] init() de ${viewId} concluído.`);
      } else {
        console.warn(`[loadView] Módulo ${jsPath} não possui função init().`);
      }
    } catch (error) {
      // Bloco que captura erros (incluindo SyntaxError)
      console.error(
        `[loadView] ERRO CAPTURADO ao carregar ou executar view '${viewId}':`,
        error
      ); // Log crucial do erro // Tratamento de erro (mantido da versão anterior)

      if (
        error instanceof TypeError &&
        (error.message.includes("dynamically imported module") ||
          error.message.includes("Module not found"))
      ) {
        console.warn(
          `[loadView] Nenhum módulo JS encontrado ou falha ao carregar para '${viewId}'. Verifique o caminho: ${jsPath}. Erro original: ${error.message}`
        );
        if (!contentArea.innerHTML.includes("alert-error")) {
          console.warn(
            `[loadView] View ${viewId} carregada sem script funcional.`
          );
        }
      } else if (error.message.includes("HTML não encontrado")) {
        console.error(
          `[loadView] Erro ao carregar HTML da view ${viewId}:`,
          error
        );
        contentArea.innerHTML = `<div class="view-container"><p class="alert alert-error">Erro Crítico: A página <strong>${viewId}.html</strong> não foi encontrada (${error.message}).</p></div>`;
      } else {
        // Erro inesperado (como o SyntaxError)
        contentArea.innerHTML = `<div class="view-container"><p class="alert alert-error">Ocorreu um erro inesperado (${error.name}) ao carregar ou executar o script desta página (${viewId}.js). Verifique o console para detalhes técnicos.</p></div>`;
      }
    }
  } /** Configura elementos do layout principal */ // ========================================================== // FIM DA FUNÇÃO loadView LIMPA // ==========================================================
  function setupLayout() {
    const userPhoto = document.getElementById("user-photo-header");
    if (userPhoto) {
      userPhoto.src =
        userData.fotoUrl || "../../../assets/img/avatar-padrao.png";
      userPhoto.onerror = () => {
        userPhoto.src = "../../../assets/img/avatar-padrao.png";
      };
    }

    const userGreeting = document.getElementById("user-greeting");
    if (userGreeting && userData.nome) {
      const firstName = userData.nome.split(" ")[0];
      const hour = new Date().getHours();
      const greeting =
        hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
      userGreeting.textContent = `${greeting}, ${firstName}!`;
    }

    const logoutButton = document.getElementById("logout-button-dashboard");
    if (logoutButton) {
      logoutButton.replaceWith(logoutButton.cloneNode(true)); // Remove listeners antigos
      document
        .getElementById("logout-button-dashboard")
        .addEventListener("click", (e) => {
          e.preventDefault();
          console.log("[Logout] Botão Sair clicado.");
          auth.signOut().catch((error) => {
            console.error("[Logout] Erro ao fazer logout:", error);
            alert("Erro ao tentar sair. Tente novamente.");
          });
        });
    } // Lógica do Sidebar Toggle

    const layoutContainer = document.querySelector(".layout-container");
    const toggleButton = document.getElementById("sidebar-toggle");
    const overlay = document.getElementById("menu-overlay");

    if (!layoutContainer || !toggleButton || !overlay || !sidebarMenu) {
      console.warn(
        "[setupLayout] Elementos do layout (container, toggle, overlay ou sidebarMenu) não encontrados."
      );
      return;
    }

    const handleToggle = () => {
      const isCollapsed =
        layoutContainer.classList.contains("sidebar-collapsed");
      layoutContainer.classList.toggle("sidebar-collapsed"); // Em telas maiores, salva a preferência

      if (window.innerWidth > 768) {
        localStorage.setItem("sidebarCollapsed", !isCollapsed);
      } // Em telas menores, mostra/esconde o overlay

      if (window.innerWidth <= 768) {
        layoutContainer.classList.toggle("sidebar-mobile-open");
      }
    }; // Aplica estado inicial no desktop

    if (window.innerWidth > 768) {
      const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
      if (isCollapsed) {
        layoutContainer.classList.add("sidebar-collapsed");
      }
    } // Adiciona listeners (removendo antigos)

    toggleButton.removeEventListener("click", handleToggle);
    toggleButton.addEventListener("click", handleToggle);
    overlay.removeEventListener("click", handleToggle);
    overlay.addEventListener("click", handleToggle);

    const handleMobileMenuLinkClick = (e) => {
      // Verifica se está em modo mobile e se o clique foi em um link (A)
      if (
        window.innerWidth <= 768 &&
        e.target.closest("a") &&
        layoutContainer.classList.contains("sidebar-mobile-open")
      ) {
        // Fecha o menu mobile
        layoutContainer.classList.remove("sidebar-mobile-open");
      }
    };
    sidebarMenu.removeEventListener("click", handleMobileMenuLinkClick);
    sidebarMenu.addEventListener("click", handleMobileMenuLinkClick);

    console.log("[setupLayout] Layout configurado.");
  } /** Função principal que configura e inicia o roteamento */

  function start() {
    console.log("[start] Configurando portal...");
    buildSidebarMenu();
    setupLayout();

    const handleHashChange = () => {
      console.log("[handleHashChange] Hash mudou:", window.location.hash);
      let hash = window.location.hash.substring(1);

      if (!hash) {
        const firstLink = sidebarMenu?.querySelector("a[data-view]");
        hash = firstLink ? firstLink.dataset.view : "dashboard";
        console.log(`[handleHashChange] Hash vazio, definindo para: ${hash}`);
        history.replaceState(null, "", `#${hash}`); // Atualiza URL sem disparar evento de novo
        loadView(hash, null); // Chama loadView diretamente aqui
        return; // Evita chamar loadView duas vezes
      }

      const hashParts = hash.split("/");
      const viewId = hashParts[0];
      const param = hashParts.length > 1 ? hashParts.slice(1).join("/") : null;

      console.log(
        `[handleHashChange] Carregando view: ${viewId}, Param: ${param}`
      );
      loadView(viewId, param);
    };

    window.removeEventListener("hashchange", handleHashChange); // Garante remoção
    window.addEventListener("hashchange", handleHashChange);
    console.log("[start] Adicionou listener hashchange.");

    console.log("[start] Chamando handleHashChange inicial.");
    handleHashChange(); // Carrega a view inicial
  } // Inicia o processo

  start();
} // Fim da função initPortal
