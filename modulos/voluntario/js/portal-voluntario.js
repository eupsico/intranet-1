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
} from "../../../assets/js/firebase-init.js"; // <<< CONFIRME SE ESTE CAMINHO ESTÁ CORRETO PARA ESTE ARQUIVO

/**
 * Verifica se a foto do usuário no Google é diferente da salva no banco de dados
 * e atualiza se necessário.
 * @param {object} user - O objeto de usuário do Firebase Auth.
 * @param {object} userData - Os dados do usuário vindos do Firestore.
 */
async function updateUserPhotoOnLogin(user, userData) {
  const firestorePhotoUrl = userData.fotoUrl || "";
  const googlePhotoUrl = user.photoURL || ""; // Atualiza a foto apenas se a URL do Google existir e for diferente da que está no banco

  if (googlePhotoUrl && firestorePhotoUrl !== googlePhotoUrl) {
    try {
      const userDocRef = doc(db, "usuarios", user.uid);
      await updateDoc(userDocRef, { fotoUrl: googlePhotoUrl }); // Atualiza o objeto local para refletir a mudança imediatamente
      userData.fotoUrl = googlePhotoUrl;
      console.log("Foto do usuário atualizada no Firestore."); // Log adicional
    } catch (error) {
      console.error("Erro ao atualizar a foto do usuário:", error);
    }
  }
}

// 2. Ouve as mudanças no estado de autenticação usando a nova sintaxe
onAuthStateChanged(auth, async (user) => {
  console.log("[Auth] State changed. User:", user ? user.uid : "null"); // Log de autenticação
  if (user) {
    try {
      // Cria a referência ao documento do usuário com a nova sintaxe
      const userDocRef = doc(db, "usuarios", user.uid);
      console.log("[Auth] Buscando documento do usuário:", user.uid); // Log busca Firestore
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log("[Auth] Documento do usuário encontrado:", userData); // Log dados encontrados
        await updateUserPhotoOnLogin(user, userData);
        initPortal(user, userData); // Inicia o portal com os dados do usuário
      } else {
        console.error(
          "[Auth] Documento do usuário não encontrado no Firestore para UID:",
          user.uid
        ); // Considerar mostrar uma mensagem de erro antes de redirecionar
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
    // Se não houver usuário, redireciona para a página de login
    console.log("[Auth] Usuário não autenticado. Redirecionando para login.");
    window.location.href = "../../../index.html";
  }
});

/**
 * Inicializa todo o portal do voluntário, construindo o menu e carregando a view inicial.
 * @param {object} user - O objeto de usuário autenticado do Firebase.
 * @param {object} userData - Os dados do usuário do Firestore.
 */
function initPortal(user, userData) {
  console.log("[initPortal] Iniciando portal para:", userData.nome); // Log início portal
  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu"); // Definições de ícones

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
  }; // Definição das Views

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
      // Insere na posição 4 (depois de Voluntários)
      id: "painel-supervisor",
      name: "Painel Supervisor",
      icon: icons.painelSupervisor,
      roles: ["supervisor", "admin"],
    });
  } /** Constrói o menu lateral com base nas views e permissões do usuário */

  function buildSidebarMenu() {
    if (!sidebarMenu) {
      console.error(
        "[buildSidebarMenu] Elemento #sidebar-menu não encontrado."
      );
      return;
    } // Limpa menu existente e adiciona link Voltar
    sidebarMenu.innerHTML = `
            <li>
                <a href="../../../index.html" class="back-link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    <span>Voltar à Intranet</span>
                </a>
            </li>
            <li class="menu-separator"></li>
        `;

    const userRoles = userData.funcoes || []; // Pega as funções do usuário logado // Adiciona itens de menu permitidos

    views.forEach((view) => {
      const hasPermission =
        view.roles.includes("todos") ||
        view.roles.some((role) => userRoles.includes(role)); // Verifica se o usuário tem alguma das roles necessárias

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
    console.log("[buildSidebarMenu] Menu construído."); // Log menu construído
  } /** Carrega um arquivo CSS dinamicamente se ainda não estiver carregado */

  function loadCss(path) {
    if (!document.querySelector(`link[href="${path}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = path;
      document.head.appendChild(link);
      console.log(`[loadCss] CSS carregado: ${path}`); // Log CSS
    } else {
      console.log(`[loadCss] CSS já existe: ${path}`);
    }
  }

  // ==========================================================
  // FUNÇÃO loadView COM LOGS ADICIONADOS
  // ==========================================================
  async function loadView(viewId, param = null) {
    if (!sidebarMenu || !contentArea) {
      console.error(
        "[loadView] Erro: sidebarMenu ou contentArea não encontrados no DOM."
      );
      return;
    }

    console.log(`[loadView] Navegando para view: ${viewId}, Param: ${param}`); // Log navegação // Remove a classe 'active' de todos os links antes de adicionar na correta

    sidebarMenu.querySelectorAll("a").forEach((link) => {
      link.classList.remove("active");
    }); // Adiciona a classe 'active' ao link clicado
    const activeLink = sidebarMenu.querySelector(`a[data-view="${viewId}"]`);
    if (activeLink) {
      activeLink.classList.add("active");
    } else {
      console.warn(
        `[loadView] Link de menu não encontrado para data-view="${viewId}"`
      );
    }

    contentArea.innerHTML = '<div class="loading-spinner"></div> Carregando...'; // Feedback visual

    // --- Definição dos Caminhos ---
    const htmlPath = `./${viewId}.html`; // Relativo à pasta 'page' onde portal-voluntario.html está

    // Caminho para o JS - ASSUMINDO que portal-voluntario.js está em /js/ e os scripts das views também
    // Se portal-voluntario.js está em /modulos/voluntario/js/ e os scripts das views também:
    const jsPath = `./${viewId}.js`; // <<--- AJUSTE AQUI SE NECESSÁRIO (relativo ao HTML) // --- LOG 1 ---
    // Se os scripts das views estiverem em uma subpasta 'views' dentro de 'js': const jsPath = `./views/${viewId}.js`;
    // Se o portal-voluntario.js está em /js/ e o detalhe-paciente.js está em /modulos/voluntario/js/
    // const jsPath = `../modulos/voluntario/js/${viewId}.js`; // <<--- Exemplo de caminho relativo diferente

    console.log(
      `[loadView LOG 1] Tentando carregar view: ${viewId}, HTML: ${htmlPath}, JS: ${jsPath}`
    );

    const cssPath = `../css/${viewId}.css`; // Relativo à pasta 'page'

    try {
      // Carrega o CSS
      loadCss(cssPath); // Carrega o HTML

      const response = await fetch(htmlPath);
      if (!response.ok)
        throw new Error(
          `Arquivo HTML não encontrado: ${htmlPath} (Status: ${response.status})`
        );
      contentArea.innerHTML = await response.text();
      console.log(`[loadView] HTML ${htmlPath} carregado com sucesso.`); // Log sucesso HTML // --- LOG 2 ---

      console.log(
        `[loadView LOG 2] Antes de importar dinamicamente: ${jsPath}`
      ); // Tenta importar o módulo JS dinamicamente

      const viewModule = await import(jsPath); // <<< O SyntaxError pode ocorrer aqui // --- LOG 3 ---

      console.log(
        `[loadView LOG 3] Importação de ${jsPath} concluída. Módulo:`,
        viewModule
      ); // Verifica se o módulo e a função init existem

      if (viewModule && typeof viewModule.init === "function") {
        // --- LOG 4 ---
        console.log(
          `[loadView LOG 4] Antes de chamar init() para ${viewId} com user, userData e param:`,
          param
        ); // Chama a função init do módulo carregado

        await viewModule.init(user, userData, param); // <<< O SyntaxError pode ocorrer aqui dentro // --- LOG 5 ---

        console.log(
          `[loadView LOG 5] Chamada init() para ${viewId} concluída.`
        );
      } else {
        // --- LOG 6 ---
        console.warn(
          `[loadView LOG 6] Módulo ${jsPath} carregado, mas não possui uma função init() exportada.`
        );
        // Se não há init, consideramos carregado com sucesso, mas sem ação JS específica
      }
    } catch (error) {
      // Linha ~242 está neste bloco
      // --- LOG 7 ---
      console.error(
        `[loadView LOG 7] ERRO CAPTURADO ao carregar view '${viewId}':`,
        error
      ); // Mostra o erro exato // Tratamento de erro aprimorado

      if (
        error instanceof TypeError &&
        (error.message.includes("dynamically imported module") ||
          error.message.includes("Module not found"))
      ) {
        // Erro específico ao tentar importar o JS (404 ou falha ao carregar)
        console.warn(
          // Mudar para warn para diferenciar de outros erros
          `[loadView] Nenhum módulo JS encontrado ou necessário para a view '${viewId}'. Verifique o caminho: ${jsPath}. Erro original: ${error.message}`
        );
        // Mantém o HTML carregado, mas avisa que o JS falhou
        if (!contentArea.innerHTML.includes("alert-error")) {
          // Evita sobrescrever erro de HTML
          console.warn(
            `[loadView] View ${viewId} carregada sem script funcional.`
          );
          // Poderia adicionar uma mensagem discreta na UI aqui se desejado
        }
      } else if (error.message.includes("HTML não encontrado")) {
        // Erro ao carregar o HTML
        console.error(
          `[loadView] Erro ao carregar HTML da view ${viewId}:`,
          error
        );
        contentArea.innerHTML = `<div class="view-container"><p class="alert alert-error">Erro Crítico: A página <strong>${viewId}.html</strong> não foi encontrada (${error.message}).</p></div>`;
      } else {
        // Outros erros (incluindo o SyntaxError)
        console.error(
          // Esta é a linha original ~242
          `[loadView] Ocorreu um erro inesperado ao carregar ou executar a view '${viewId}':`,
          error // O erro capturado (ex: SyntaxError)
        );
        contentArea.innerHTML = `<div class="view-container"><p class="alert alert-error">Ocorreu um erro inesperado (${error.name}) ao carregar ou executar o script desta página (${viewId}.js). Verifique o console para detalhes técnicos.</p></div>`; // Mensagem mais informativa
      }
    }
  } /** Configura elementos do layout principal (header, sidebar toggle, etc.) */
  // ==========================================================
  // FIM DA FUNÇÃO loadView COM LOGS
  // ==========================================================

  function setupLayout() {
    const userPhoto = document.getElementById("user-photo-header");
    if (userPhoto) {
      userPhoto.src =
        userData.fotoUrl || "../../../assets/img/avatar-padrao.png"; // Caminho padrão
      userPhoto.onerror = () => {
        // Fallback se a foto falhar
        userPhoto.src = "../../../assets/img/avatar-padrao.png";
      };
    }

    const userGreeting = document.getElementById("user-greeting");
    if (userGreeting && userData.nome) {
      const firstName = userData.nome.split(" ")[0]; // Pega o primeiro nome
      const hour = new Date().getHours();
      const greeting =
        hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
      userGreeting.textContent = `${greeting}, ${firstName}!`;
    }

    const logoutButton = document.getElementById("logout-button-dashboard");
    if (logoutButton) {
      // Garante que o listener seja adicionado apenas uma vez
      logoutButton.replaceWith(logoutButton.cloneNode(true)); // Clona para remover listeners antigos
      document
        .getElementById("logout-button-dashboard")
        .addEventListener("click", (e) => {
          e.preventDefault();
          console.log("[Logout] Botão Sair clicado."); // Log logout
          auth.signOut().catch((error) => {
            // Adiciona catch para erros no signOut
            console.error("[Logout] Erro ao fazer logout:", error);
            alert("Erro ao tentar sair. Tente novamente.");
          });
        });
    } // Lógica do Sidebar Toggle e Overlay

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
      const isMobile = window.innerWidth <= 768;
      const sidebar = document.querySelector(".sidebar");
      if (!sidebar) return;

      if (isMobile) {
        // Alterna visibilidade no mobile
        sidebar.classList.toggle("is-visible");
        layoutContainer.classList.toggle("mobile-menu-open");
      } else {
        // Alterna colapso no desktop e salva preferência
        const currentlyCollapsed =
          layoutContainer.classList.toggle("sidebar-collapsed");
        try {
          localStorage.setItem("sidebarCollapsed", currentlyCollapsed);
        } catch (e) {
          console.warn(
            "[setupLayout] Não foi possível salvar preferência do sidebar no localStorage:",
            e
          );
        }
        toggleButton.setAttribute(
          "title",
          currentlyCollapsed ? "Expandir menu" : "Recolher menu"
        );
      }
      console.log("[handleToggle] Sidebar state toggled."); // Log toggle
    };

    // Aplica estado inicial no desktop
    if (window.innerWidth > 768) {
      let isCollapsed = false;
      try {
        isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
      } catch (e) {
        console.warn(
          "[setupLayout] Não foi possível ler preferência do sidebar no localStorage:",
          e
        );
      }
      if (isCollapsed) {
        layoutContainer.classList.add("sidebar-collapsed");
        toggleButton.setAttribute("title", "Expandir menu");
      } else {
        toggleButton.setAttribute("title", "Recolher menu");
      }
    }

    // Adiciona listeners (removendo os antigos primeiro para segurança)
    toggleButton.removeEventListener("click", handleToggle);
    toggleButton.addEventListener("click", handleToggle);
    overlay.removeEventListener("click", handleToggle);
    overlay.addEventListener("click", handleToggle);

    // Listener para fechar menu mobile ao clicar em um link
    // Usa uma função nomeada para poder remover depois se necessário
    const handleMobileMenuLinkClick = (e) => {
      if (window.innerWidth <= 768 && e.target.closest("a[data-view]")) {
        // Apenas links de view
        handleToggle(); // Fecha o menu
      }
    };
    sidebarMenu.removeEventListener("click", handleMobileMenuLinkClick);
    sidebarMenu.addEventListener("click", handleMobileMenuLinkClick);

    console.log("[setupLayout] Layout configurado."); // Log layout pronto
  } /** Função principal que configura e inicia o roteamento */

  function start() {
    console.log("[start] Configurando portal..."); // Log início start
    buildSidebarMenu();
    setupLayout();

    const handleHashChange = () => {
      console.log("[handleHashChange] Hash mudou:", window.location.hash); // Log mudança hash
      let hash = window.location.hash.substring(1); // Remove o '#' inicial // Define a view padrão se o hash estiver vazio

      if (!hash) {
        const firstLink = sidebarMenu?.querySelector("a[data-view]");
        hash = firstLink ? firstLink.dataset.view : "dashboard"; // Usa a primeira view ou dashboard
        console.log(`[handleHashChange] Hash vazio, definindo para: ${hash}`);
        // Atualiza o hash na URL sem recarregar, mas dispara o evento hashchange novamente
        history.replaceState(null, "", `#${hash}`);
        // loadView(hash, null); // Chama loadView diretamente para evitar loop infinito em alguns navegadores
        return; // Retorna para evitar chamar loadView duas vezes
      }

      // Separa viewId e param (parâmetro pode conter '/')
      const hashParts = hash.split("/");
      const viewId = hashParts[0]; // Primeira parte é a view
      const param = hashParts.length > 1 ? hashParts.slice(1).join("/") : null; // O resto é o parâmetro

      console.log(
        `[handleHashChange] Carregando view: ${viewId}, Param: ${param}`
      );
      loadView(viewId, param); // Chama a função para carregar a view e seu JS
    };

    // Adiciona o listener para mudanças no hash
    window.removeEventListener("hashchange", handleHashChange); // Garante que não haja duplicatas
    window.addEventListener("hashchange", handleHashChange);
    console.log("[start] Adicionou listener hashchange."); // Carrega a view inicial baseada no hash atual (ou define um padrão se vazio)

    console.log("[start] Chamando handleHashChange inicial.");
    handleHashChange();
  } // Inicia o processo

  start();
} // Fim da função initPortal
