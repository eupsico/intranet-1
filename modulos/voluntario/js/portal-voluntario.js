// Arquivo: /modulos/voluntario/js/portal-voluntario.js
// Versão: 4.1 (Corrigido o problema de Race Condition no loadView)

// 1. Importa as funções necessárias do nosso arquivo central de inicialização
import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  updateDoc,
} from "../../../assets/js/firebase-init.js";

/**
 * Verifica se a foto do usuário no Google é diferente da salva no banco de dados
 * e atualiza se necessário.
 * @param {object} user - O objeto de usuário do Firebase Auth.
 * @param {object} userData - Os dados do usuário vindos do Firestore.
 */
async function updateUserPhotoOnLogin(user, userData) {
  const firestorePhotoUrl = userData.fotoUrl || "";
  const googlePhotoUrl = user.photoURL || "";

  // Atualiza a foto apenas se a URL do Google existir e for diferente da que está no banco
  if (googlePhotoUrl && firestorePhotoUrl !== googlePhotoUrl) {
    try {
      const userDocRef = doc(db, "usuarios", user.uid);
      await updateDoc(userDocRef, { fotoUrl: googlePhotoUrl });
      // Atualiza o objeto local para refletir a mudança imediatamente
      userData.fotoUrl = googlePhotoUrl;
    } catch (error) {
      console.error("Erro ao atualizar a foto do usuário:", error);
    }
  }
}

// 2. Ouve as mudanças no estado de autenticação usando a nova sintaxe
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Cria a referência ao documento do usuário com a nova sintaxe
    const userDocRef = doc(db, "usuarios", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      await updateUserPhotoOnLogin(user, userData);
      initPortal(user, userData); // Inicia o portal com os dados do usuário
    } else {
      console.error("Documento do usuário não encontrado no Firestore.");
      window.location.href = "../../../index.html";
    }
  } else {
    // Se não houver usuário, redireciona para a página de login
    window.location.href = "../../../index.html";
  }
});

/**
 * Inicializa todo o portal do voluntário, construindo o menu e carregando a view inicial.
 * @param {object} user - O objeto de usuário autenticado do Firebase.
 * @param {object} userData - Os dados do usuário do Firestore.
 */
function initPortal(user, userData) {
  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu");

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
    assinatura:
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
  };

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
      id: "assinaturas-termos", // Novo ID da view
      name: "Assinaturas e Termos", // Novo Nome
      icon: icons.assinatura,
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
  ];

  const funcoes = userData.funcoes || [];
  if (funcoes.includes("supervisor") || funcoes.includes("admin")) {
    views.splice(4, 0, {
      id: "painel-supervisor",
      name: "Painel Supervisor",
      icon: icons.painelSupervisor,
      roles: ["supervisor", "admin"],
    });
  }

  function buildSidebarMenu() {
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
  }
  function loadCss(path) {
    // Verifica se o CSS já não foi carregado para evitar duplicatas
    if (!document.querySelector(`link[href="${path}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = path;
      document.head.appendChild(link);
    }
  }

  // --- FUNÇÃO loadView MODIFICADA ---
  async function loadView(viewId, param = null) {
    if (!sidebarMenu || !contentArea) return;

    // Remove a classe 'active' de todos os links antes de adicionar na correta
    sidebarMenu.querySelectorAll("a").forEach((link) => {
      link.classList.remove("active");
    });
    // Adiciona a classe 'active' ao link clicado
    const activeLink = sidebarMenu.querySelector(`a[data-view="${viewId}"]`);
    if (activeLink) {
      activeLink.classList.add("active");
    }

    contentArea.innerHTML = '<div class="loading-spinner"></div>';

    const htmlPath = `./${viewId}.html`;
    const jsPath = `../js/${viewId}.js`;
    const cssPath = `../css/${viewId}.css`;

    let html = ""; // Variável para armazenar o HTML

    try {
      // --- Bloco 1: Carregar HTML e CSS ---
      loadCss(cssPath);
      const response = await fetch(htmlPath);
      if (!response.ok) {
        throw new Error(`Arquivo HTML não encontrado: ${htmlPath}`);
      }
      html = await response.text(); // Armazena o HTML
    } catch (htmlError) {
      // Apanha erros APENAS do fetch/HTML
      console.error(`Erro ao carregar o HTML da view ${viewId}:`, htmlError);
      if (htmlError.message.includes("HTML não encontrado")) {
        contentArea.innerHTML = `<div class="view-container"><p class="alert alert-error">Erro Crítico: A página <strong>${viewId}.html</strong> não foi encontrada.</p></div>`;
      } else {
        contentArea.innerHTML = `<div class="view-container"><p class="alert alert-error">Ocorreu um erro inesperado ao carregar esta página.</p></div>`;
      }
      return; // Para a execução se o HTML falhar
    }

    // --- Bloco 2: Injetar HTML e Carregar Script ---
    // Se o HTML foi carregado com sucesso:

    // 1. Injeta o HTML no DOM
    contentArea.innerHTML = html;

    // 2. [A SOLUÇÃO] Espera o DOM ser atualizado
    // Move a importação do script para um setTimeout(0)
    // Isso coloca a execução do script no final da fila de eventos,
    // dando tempo ao navegador para construir o DOM a partir do innerHTML.
    setTimeout(async () => {
      try {
        const viewModule = await import(jsPath);
        if (viewModule && typeof viewModule.init === "function") {
          viewModule.init(user, userData, param);
        }
      } catch (jsError) {
        // Apanha erros APENAS do import/init do JS
        if (
          jsError.message.includes(
            "Failed to fetch dynamically imported module"
          )
        ) {
          console.log(
            `Nenhum módulo JS encontrado ou necessário para a view '${viewId}'.`
          );
        } else {
          console.error(
            `Ocorreu um erro inesperado ao INICIALIZAR o script da view '${viewId}':`,
            jsError
          );
          // Opcional: Adicionar um erro visual sem apagar o HTML
          // contentArea.insertAdjacentHTML('afterbegin', `<p class="alert alert-error">Ocorreu um erro ao carregar os scripts desta página.</p>`);
        }
      }
    }, 0); // O delay de 0ms é a chave.
  }
  // --- FIM DA FUNÇÃO loadView MODIFICADA ---

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
      logoutButton.addEventListener("click", (e) => {
        e.preventDefault();
        auth.signOut();
      });
    }

    const layoutContainer = document.querySelector(".layout-container");
    const toggleButton = document.getElementById("sidebar-toggle");
    const overlay = document.getElementById("menu-overlay");

    if (!layoutContainer || !toggleButton || !overlay) return;

    const handleToggle = () => {
      const isMobile = window.innerWidth <= 768;
      const sidebar = document.querySelector(".sidebar");
      if (isMobile) {
        sidebar.classList.toggle("is-visible");
        layoutContainer.classList.toggle("mobile-menu-open");
      } else {
        const currentlyCollapsed =
          layoutContainer.classList.toggle("sidebar-collapsed");
        localStorage.setItem("sidebarCollapsed", currentlyCollapsed);
        toggleButton.setAttribute(
          "title",
          currentlyCollapsed ? "Expandir menu" : "Recolher menu"
        );
      }
    };

    if (window.innerWidth > 768) {
      const isCollapsed = localStorage.getItem("sidebarCollapsed") === "true";
      if (isCollapsed) {
        layoutContainer.classList.add("sidebar-collapsed");
        toggleButton.setAttribute("title", "Expandir menu");
      } else {
        toggleButton.setAttribute("title", "Recolher menu");
      }
    }

    toggleButton.addEventListener("click", handleToggle);
    overlay.addEventListener("click", handleToggle);
    sidebarMenu.addEventListener("click", (e) => {
      if (window.innerWidth <= 768 && e.target.closest("a")) {
        handleToggle();
      }
    });
  }

  function start() {
    buildSidebarMenu();
    setupLayout();

    const handleHashChange = () => {
      let hash = window.location.hash.substring(1);
      if (!hash) {
        const firstLink = sidebarMenu.querySelector("a[data-view]");
        hash = firstLink ? firstLink.dataset.view : "dashboard";
        window.location.hash = hash; // Adiciona o hash padrão à URL
        return; // O evento hashchange será disparado novamente
      }
      const [viewId, param] = hash.split("/");
      loadView(viewId, param);
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange(); // Carrega a view inicial
  }

  start();
}
