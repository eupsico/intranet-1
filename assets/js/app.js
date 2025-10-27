// Arquivo: assets/js/app.js
// Versão: 9.2 (Com integração do Painel de Gestão e Módulos de RH)

// 1. Importa os serviços e funções necessários do nosso arquivo de configuração central
export let currentUserData = {};
import {
  auth,
  db,
  onAuthStateChanged,
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from "./firebase-init.js";

// Importa funções específicas de autenticação que usaremos
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

// --- Função Exportada ---

/**
 * Carrega uma lista de profissionais no elemento <select> fornecido.
 * @param {Firestore} dbInstance - A instância do Firestore (não é mais necessária, pois `db` é importado diretamente).
 * @param {string} funcao - A função/role a ser buscada (ex: 'atendimento').
 * @param {HTMLSelectElement} selectElement - O elemento <select> a ser preenchido.
 */
export async function carregarProfissionais(dbInstance, funcao, selectElement) {
  if (!selectElement) return;
  try {
    // Sintaxe v9 para criar e executar a consulta
    const usuariosRef = collection(db, "usuarios"); // Usa o 'db' importado
    const q = query(
      usuariosRef,
      where("funcoes", "array-contains", funcao),
      orderBy("nome")
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      selectElement.innerHTML =
        '<option value="">Nenhum profissional encontrado</option>';
      return;
    }
    let options = '<option value="">Selecione um profissional</option>';
    snapshot.forEach((doc) => {
      options += `<option value="${doc.id}">${doc.data().nome}</option>`;
    });
    selectElement.innerHTML = options;
  } catch (error) {
    console.error(
      `Erro ao carregar profissionais com a função ${funcao}:`,
      error
    );
    selectElement.innerHTML = '<option value="">Erro ao carregar</option>';
  }
}
// --- Lógica Principal da Aplicação ---

// --- NOVO: Função de carregamento dinâmico para submódulos do RH ---
async function loadRhSubModule(subModuleId, user, userData) {
  const contentArea = document.getElementById("content-area");
  const pageTitleContainer = document.getElementById("page-title-container");

  if (!contentArea) {
    console.error("Elemento #content-area não encontrado.");
    return;
  }

  contentArea.innerHTML =
    '<div class="loading-spinner">Carregando módulo...</div>';

  const titles = {
    gestao_vagas: {
      title: "Gestão de Vagas e Recrutamento",
      subtitle: "Definição de vagas, aprovação e pipeline de candidatos.",
    },
    onboarding_colaboradores: {
      title: "Onboarding de Colaboradores",
      subtitle:
        "Checklist de integração, documentação e acompanhamento inicial.",
    },
    desligamento: {
      title: "Gestão de Desligamentos (Offboarding)",
      subtitle:
        "Checklist de encerramento, recuperação de ativos e baixa de acessos.",
    },
    gestao_profissionais: {
      title: "Gestão de Profissionais",
      subtitle: "Gerenciamento de dados e funções da equipe.",
    },
    comunicados: {
      title: "Comunicados",
      subtitle: "Envio e histórico de comunicações internas.",
    },
  };

  const moduleInfo = titles[subModuleId];
  if (!moduleInfo) {
    contentArea.innerHTML = `<p class="alert alert-error">Módulo '${subModuleId}' não encontrado.</p>`;
    return;
  }

  if (pageTitleContainer) {
    pageTitleContainer.innerHTML = `<h1>${moduleInfo.title}</h1><p>${moduleInfo.subtitle}</p>`;
  }

  // Caminhos relativos a partir de assets/js/app.js para modulos/rh
  const htmlPath = `../../modulos/rh/page/${subModuleId}.html`;
  const jsPath = `../../modulos/rh/js/${subModuleId}.js`;

  try {
    let response = await fetch(htmlPath);
    if (!response.ok) {
      throw new Error(`Arquivo HTML '${htmlPath}' não encontrado.`);
    }

    const htmlContent = await response.text();
    contentArea.innerHTML = htmlContent;

    // Remove scripts embutidos
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = contentArea.innerHTML;
    tempDiv.querySelectorAll("script").forEach((script) => script.remove());
    contentArea.innerHTML = tempDiv.innerHTML;

    // Importa JS dinamicamente
    const module = await import(jsPath + "?t=" + Date.now());

    // Inicializa o módulo
    if (typeof module.init === "function") {
      await module.init(user, userData);
    } else if (
      typeof module[`init${subModuleId.replace(/[-_]/g, "")}`] === "function"
    ) {
      await module[`init${subModuleId.replace(/[-_]/g, "")}`](user, userData);
    } else if (typeof module.initrhPanel === "function") {
      await module.initrhPanel(user, db, userData);
    }

    console.log(`Submódulo ${subModuleId}.js inicializado.`);
  } catch (error) {
    console.error(`Erro ao carregar o submódulo RH ${subModuleId}:`, error);
    contentArea.innerHTML = `<div class="container-fluid"><p class="alert alert-error">Erro ao carregar a seção '${subModuleId}'. Verifique o console para detalhes técnicos.</p></div>`;
  }
}

// --- FIM NOVO: Função de carregamento dinâmico para submódulos do RH ---

document.addEventListener("DOMContentLoaded", function () {
  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  let inactivityTimer; // Gerencia o timer de inatividade

  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      alert("Você foi desconectado por inatividade.");
      signOut(auth); // Usa a função signOut da v9
    }, 20 * 60 * 1000); // 20 minutos
  }

  function setupInactivityListeners() {
    const events = [
      "mousemove",
      "mousedown",
      "keypress",
      "scroll",
      "touchstart",
    ];
    events.forEach((event) =>
      window.addEventListener(event, resetInactivityTimer)
    );
    resetInactivityTimer();
  } // Função principal de autenticação

  function handleAuth() {
    // onAuthStateChanged já foi importado do firebase-init.js
    onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // Se o usuário está logado, busca seus dados
          const userDocRef = doc(db, "usuarios", user.uid); // Sintaxe v9
          const userDoc = await getDoc(userDocRef); // Sintaxe v9

          if (userDoc.exists() && userDoc.data().funcoes?.length > 0) {
            const userData = userDoc.data();
            await renderLayoutAndContent(user, userData);
            setupInactivityListeners();
          } else {
            renderAccessDenied();
          }
        } else {
          renderLogin();
        }
      } catch (error) {
        console.error("Erro de autenticação:", error);
        renderLogin(`Ocorreu um erro: ${error.message}`);
        signOut(auth); // Usa a função signOut da v9
      }
    });
  } // Renderiza a tela de login

  function renderLogin(message = "Por favor, faça login para continuar.") {
    if (!loginView || !dashboardView) return;
    dashboardView.style.display = "none";
    loginView.style.display = "block";

    const isSubPage = window.location.pathname.includes("/modulos/");
    const pathPrefix = isSubPage ? "../../../" : "./";

    loginView.innerHTML = `
    <div class="login-container">
    <div class="login-card">
    <img src="${pathPrefix}assets/img/logo-eupsico.png" alt="Logo EuPsico" class="login-logo">
    <h2>Intranet EuPsico</h2>
    <p>${message}</p>
    <p class="login-email-info" style="font-size: 0.9em; font-weight: 500; color: var(--cor-primaria); background-color: var(--cor-fundo); padding: 10px; border-radius: 5px; margin-top: 20px; margin-bottom: 25px;">Utilize seu e-mail @eupsico.org.br para acessar.</p>
    <button id="login-button" class="action-button login-button">Login com Google</button>
    </div>
    </div>`;
    document.getElementById("login-button").addEventListener("click", () => {
      loginView.innerHTML = `<p style="text-align:center; margin-top: 50px;">Aguarde...</p>`;
      const provider = new GoogleAuthProvider(); // Sintaxe v9
      signInWithPopup(auth, provider).catch((error) => console.error(error)); // Sintaxe v9
    });
  } // Renderiza a tela de acesso negado

  function renderAccessDenied() {
    if (!loginView || !dashboardView) return;
    dashboardView.style.display = "none";
    loginView.style.display = "block";
    loginView.innerHTML = `<div class="content-box" style="max-width: 800px; margin: 50px auto; text-align: center;"><h2>Acesso Negado</h2><p>Você está autenticado, mas seu usuário não tem permissões definidas. Contate o administrador.</p><button id="denied-logout">Sair</button></div>`;
    document
      .getElementById("denied-logout")
      .addEventListener("click", () => signOut(auth));
  } // Retorna a saudação apropriada com base na hora

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Bom dia";
    if (hour >= 12 && hour < 18) return "Boa tarde";
    return "Boa noite";
  } // Renderiza o layout principal e carrega o módulo da página atual

  async function renderLayoutAndContent(user, userData) {
    if (!loginView || !dashboardView) return;
    loginView.style.display = "none";
    dashboardView.style.display = "block";

    const userPhoto = document.getElementById("user-photo-header");
    const userGreeting = document.getElementById("user-greeting");
    const logoutButton = document.getElementById("logout-button-dashboard");

    if (userGreeting && userData.nome) {
      const firstName = userData.nome.split(" ")[0];
      userGreeting.textContent = `${getGreeting()}, ${firstName}!`;
    }
    if (userPhoto) {
      userPhoto.src =
        user.photoURL ||
        "https://www.eupsico.org.br/wp-content/uploads/2024/02/user-1.png";
    }
    if (logoutButton) {
      logoutButton.addEventListener("click", (e) => {
        e.preventDefault();
        signOut(auth);
      });
    }

    const modules = getVisibleModules(userData);
    setupSidebarToggle();
    renderSidebarMenu(modules); // Lógica para carregar o módulo JS da página correta

    const path = window.location.pathname; // Mapeia o caminho do arquivo para a função de inicialização do módulo

    const moduleMap = {
      "painel-admin.html": async () => {
        const pageTitleContainer = document.getElementById(
          "page-title-container"
        );
        if (pageTitleContainer) {
          pageTitleContainer.innerHTML = `<h1>Painel de Controle</h1><p>Configurações gerais e gerenciamento do sistema.</p>`;
        }
        const module = await import("../../modulos/admin/js/painel-admin.js"); // Chama a função 'init' exportada pelo módulo, passando o contexto do usuário
        module.init(user, userData);
      },
      "painel-gestao.html": async () => {
        const pageTitleContainer = document.getElementById(
          "page-title-container"
        );
        if (pageTitleContainer) {
          pageTitleContainer.innerHTML = `<h1>Painel de Gestão</h1><p>Registro de atas, plano de ação e dashboards.</p>`;
        }
        const module = await import("../../modulos/gestao/js/painel-gestao.js");
        module.init(user, userData);
      },
      "painel-financeiro.html": async () => {
        const pageTitleContainer = document.getElementById(
          "page-title-container"
        );
        if (pageTitleContainer) {
          pageTitleContainer.innerHTML = `<h1>Painel Financeiro</h1><p>Gestão de pagamentos, cobranças e relatórios.</p>`;
        }
        const module = await import(
          "../../modulos/financeiro/js/painel-financeiro.js"
        );
        module.initFinancePanel(user, userData);
      },
      "administrativo-painel.html": async () => {
        const pageTitleContainer = document.getElementById(
          "page-title-container"
        );
        if (pageTitleContainer) {
          pageTitleContainer.innerHTML = `<h2>Painel Administrativo</h2><p>Gestão de configurações e dados dos usuários.</p>`;
        }
        const module = await import(
          "../../modulos/administrativo/js/administrativo-painel.js"
        );
        module.initadministrativoPanel(user, db, userData);
      },
      "trilha-paciente-painel.html": async () => {
        const pageTitleContainer = document.getElementById(
          "page-title-container"
        );
        if (pageTitleContainer) {
          pageTitleContainer.innerHTML = `<h2>Trilha do Paciente</h2><p>Acompanhe o fluxo de pacientes desde a inscrição até o atendimento.</p>`;
        }
        const module = await import(
          "../../modulos/trilha-paciente/js/trilha-paciente-painel.js"
        );
        module.init(user, userData);
      },
      "servico-social-painel.html": async () => {
        const pageTitleContainer = document.getElementById(
          "page-title-container"
        );
        if (pageTitleContainer) {
          pageTitleContainer.innerHTML = `<h2>Serviço Social</h2><p>Gestão de triagens, reavaliações.</p>`;
        }
        const module = await import(
          "../../modulos/servico-social/js/servico-social-painel.js"
        );
        module.initsocialPanel(user, userData);
      },
      "rh-painel.html": async () => {
        const pageTitleContainer = document.getElementById(
          "page-title-container"
        );
        const contentArea = document.getElementById("content-area");

        if (pageTitleContainer) {
          pageTitleContainer.innerHTML = `<h2>Recursos Humanos</h2><p>Gestão de profissionais, vagas e comunicados.</p>`;
        }

        // --- LÓGICA DE SUBMÓDULOS RH ---
        const urlParams = new URLSearchParams(window.location.search);
        const subModuleId = urlParams.get("view"); // Assume que a navegação interna usa ?view=...

        if (subModuleId) {
          // Carrega o submódulo dinamicamente (gestao_vagas, onboarding, desligamento)
          await loadRhSubModule(subModuleId, user, userData);
        } else {
          // Se não houver ?view=, carrega o dashboard padrão do RH
          const module = await import("../../modulos/rh/js/rh-painel.js");
          module.initrhPanel(user, db, userData);
        }

        // Adiciona listeners para navegação interna do RH (via #rh-views)
        document
          .getElementById("rh-views")
          .addEventListener("click", async (e) => {
            const target = e.target.closest("div[data-view-id]");
            if (target) {
              const viewId = target.getAttribute("data-view-id");
              e.preventDefault();

              // Mude a URL para refletir o estado (sem recarregar a página)
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.set("view", viewId);
              window.history.pushState({ path: newUrl.href }, "", newUrl.href);

              // Carrega o novo submódulo
              await loadRhSubModule(viewId, user, userData);
            }
          });

        // Adiciona listener para os links/botões no conteúdo principal do RH (opcional, se forem botões)
        contentArea.addEventListener("click", async (e) => {
          const btn = e.target.closest("button[data-view-id]");
          if (btn) {
            const viewId = btn.getAttribute("data-view-id");
            e.preventDefault();

            // Mude a URL para refletir o estado (sem recarregar a página)
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set("view", viewId);
            window.history.pushState({ path: newUrl.href }, "", newUrl.href);

            // Carrega o novo submódulo
            await loadRhSubModule(viewId, user, userData);
          }
        });

        // --- FIM LÓGICA DE SUBMÓDULOS RH ---
      },
      "portal-voluntario.html": async () => {
        const pageTitleContainer = document.getElementById(
          "page-title-container"
        ); // Define um título padrão inicial, que pode ser sobrescrito pelo submódulo
        if (pageTitleContainer)
          pageTitleContainer.innerHTML = "<h1>Portal do Voluntário</h1>"; // Verifica se há parâmetros p= e s= na URL atual

        const urlParams = new URLSearchParams(window.location.search);
        const moduloParam = urlParams.get("p");
        const secaoParam = urlParams.get("s");

        const contentArea = document.getElementById("content-area"); // Área onde o conteúdo será carregado
        if (!contentArea) {
          console.error(
            "Elemento #content-area não encontrado no HTML principal (portal-voluntario.html)."
          ); // Tenta encontrar main-content como fallback
          const mainContent = document.querySelector(".main-content");
          if (mainContent) {
            mainContent.innerHTML =
              '<p class="alert alert-error">Erro: Área de conteúdo principal não encontrada com o ID #content-area.</p>';
          }
          return; // Não pode carregar conteúdo sem a área designada
        }
        contentArea.innerHTML = '<div class="loading-spinner"></div>'; // Mostra loading inicial // *** LÓGICA PRINCIPAL DA CORREÇÃO ***

        if (moduloParam && secaoParam && moduloParam === "voluntario") {
          // Se p=voluntario e s= existem, carrega o HTML e JS do SUBMÓDULO VOLUNTARIO específico
          console.log(`Carregando submódulo voluntário: ${secaoParam}`);
          try {
            // 1. Carrega o HTML da seção na #content-area
            //    O caminho é relativo ao portal-voluntario.html
            const htmlPath = `./page/${secaoParam}.html`;
            console.log("Tentando carregar HTML do submódulo:", htmlPath);
            const response = await fetch(htmlPath);
            if (!response.ok) {
              throw new Error(
                `Arquivo HTML da seção '${secaoParam}' não encontrado (${response.status}) em ./page/`
              );
            }
            contentArea.innerHTML = await response.text();
            console.log(`HTML de ${secaoParam}.html carregado.`); // Atualiza o título da página se houver h2 no conteúdo carregado

            const pageTitleElement = contentArea.querySelector("h2");
            if (pageTitleContainer && pageTitleElement) {
              pageTitleContainer.innerHTML = `<h1>${pageTitleElement.textContent}</h1>`; // Poderia adicionar subtítulo se houver <p class="description-box">
              const descriptionElement =
                contentArea.querySelector("p.description-box");
              if (descriptionElement) {
                pageTitleContainer.innerHTML += `<p>${descriptionElement.textContent}</p>`;
              }
            } else if (pageTitleContainer) {
              // Se não achar H2, usa um título genérico baseado na seção
              pageTitleContainer.innerHTML = `<h1>${secaoParam
                .replace(/[-_]/g, " ")
                .replace(/\b\w/g, (l) => l.toUpperCase())}</h1>`;
            } // 2. Importa e executa o JS do submódulo //    O caminho é relativo ao app.js

            const jsPath = `../../modulos/${moduloParam}/js/${secaoParam}.js`;
            console.log("Tentando importar JS do submódulo:", jsPath); // Adiciona cache busting simples para tentar forçar recarregamento do JS
            const module = await import(jsPath + "?t=" + Date.now()); // Chama a função 'init' exportada pelo submódulo

            if (module && typeof module.init === "function") {
              // Passa o user e userData para o init do submódulo (ex: meus-pacientes.js ou detalhe-paciente.js)
              await module.init(user, userData);
              console.log(`Submódulo ${secaoParam}.js inicializado.`);
            } else {
              console.warn(
                `Módulo ${jsPath} não exporta a função 'init'. A página pode não ser interativa.`
              );
            }
          } catch (error) {
            console.error(
              `Erro ao carregar submódulo ${moduloParam}/${secaoParam}:`,
              error
            );
            contentArea.innerHTML = `<div class="container-fluid"><p class="alert alert-error">Erro ao carregar a seção '${secaoParam}'. Verifique o console para detalhes técnicos.</p></div>`;
            if (pageTitleContainer)
              pageTitleContainer.innerHTML = `<h1>Erro</h1>`;
          }
        } else {
          // Se não há p= e s= OU p não é 'voluntario', carrega o portal-voluntario.js
          // que cuidará da navegação interna via hash (#) e carregará o dashboard padrão.
          console.log(
            "Carregando portal-voluntario.js para navegação via hash..."
          );
          try {
            // Importa o JS do portal principal (que contém initPortal, start, loadView, etc.)
            // Caminho relativo ao app.js
            const portalJsPath =
              "../../modulos/voluntario/js/portal-voluntario.js";
            const module = await import(portalJsPath + "?t=" + Date.now()); // Cache busting

            if (module && typeof module.initPortal === "function") {
              // Chama a função principal do portal-voluntario.js
              // Esta função (initPortal) é responsável por
              // construir o menu, configurar listeners de hash e carregar a view inicial (geralmente dashboard)
              module.initPortal(user, userData);
              console.log("portal-voluntario.js inicializado."); // O título será definido pela lógica interna do portal-voluntario (handleHashChange -> loadView)
            } else {
              console.error(
                `Módulo ${portalJsPath} não exporta a função 'initPortal'.`
              );
              contentArea.innerHTML = `<p class="alert alert-error">Erro ao inicializar o portal do voluntário.</p>`;
            }
          } catch (error) {
            console.error("Erro ao carregar portal-voluntario.js:", error);
            contentArea.innerHTML = `<p class="alert alert-error">Erro fatal ao carregar o módulo principal do portal. Verifique o console.</p>`;
            if (pageTitleContainer)
              pageTitleContainer.innerHTML = `<h1>Erro Crítico</h1>`;
          }
        }
      },
    };

    let moduleLoaded = false;
    for (const page in moduleMap) {
      if (path.includes(page)) {
        try {
          await moduleMap[page]();
          moduleLoaded = true;
        } catch (error) {
          console.error(`Erro ao carregar o módulo para ${page}:`, error);
          const contentArea = document.getElementById("content-area");
          if (contentArea)
            contentArea.innerHTML = `<h2>Falha ao carregar o módulo da página.</h2>`;
        }
        break;
      }
    } // Se nenhum módulo foi carregado, define um título padrão
    if (!moduleLoaded) {
      const pageTitleContainer = document.getElementById(
        "page-title-container"
      );
      if (pageTitleContainer) {
        pageTitleContainer.innerHTML = "<h1>Intranet EuPsico</h1>";
      }
    }
  }

  function setupSidebarToggle() {
    const layoutContainer = document.querySelector(".layout-container");
    const sidebar = document.querySelector(".sidebar");
    const toggleButton = document.getElementById("sidebar-toggle");
    const overlay = document.getElementById("menu-overlay");
    const sidebarMenu = document.getElementById("sidebar-menu");

    if (
      !layoutContainer ||
      !toggleButton ||
      !sidebar ||
      !overlay ||
      !sidebarMenu
    ) {
      return;
    }

    const handleToggle = () => {
      const isMobile = window.innerWidth <= 768;
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
      }
      toggleButton.setAttribute(
        "title",
        isCollapsed ? "Expandir menu" : "Recolher menu"
      );
    }

    toggleButton.addEventListener("click", handleToggle);
    overlay.addEventListener("click", handleToggle);

    sidebarMenu.addEventListener("click", (e) => {
      if (window.innerWidth <= 768) {
        if (e.target.closest("a")) {
          handleToggle();
        }
      }
    });
  }

  function renderSidebarMenu(modules) {
    const menu = document.getElementById("sidebar-menu");
    if (!menu) return;
    menu.innerHTML = "";
    modules.forEach((config) => {
      const menuItem = document.createElement("li");
      const link = document.createElement("a");
      link.href = config.url;
      link.innerHTML = `${config.icon || ""}<span>${config.titulo}</span>`; // Adiciona a classe 'active' se o link corresponder à página atual

      if (window.location.pathname.includes(config.url.replace("./", "/"))) {
        menuItem.classList.add("active");
      }

      menuItem.appendChild(link);
      menu.appendChild(menuItem);
    });
  }

  function getVisibleModules(userData) {
    const icons = {
      admin: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
      intranet: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 12c0-5.25-4.25-9.5-9.5-9.5S2.5 6.75 2.5 12s4.25 9.5 9.5 9.5s9.5-4.25 9.5-9.5Z"/><path d="M12 2.5v19"/><path d="M2.5 12h19"/></svg>`,
      administrativo: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
      captacao: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`,
      financeiro: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
      grupos: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      marketing: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>`,
      rh: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
      supervisao: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
      servico_social: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      trilha_paciente: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
      gestao: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v9l-4-4h-2a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2Z"/></svg>`,
    };

    const areas = {
      admin: {
        titulo: "Admin",
        descricao: "Configurações gerais do sistema e gerenciamento.",
        url: "./modulos/admin/page/painel-admin.html",
        roles: ["admin"], // Apenas usuários com a função 'admin' verão este item
        icon: icons.admin,
      },

      portal_voluntario: {
        titulo: "Portal do Voluntário",
        descricao: "Avisos, notícias e ferramentas para todos os voluntários.",
        url: "./modulos/voluntario/page/portal-voluntario.html",
        roles: ["todos"],
        icon: icons.intranet,
      },
      administrativo: {
        titulo: "Administrativo",
        descricao: "Acesso aos processos, documentos e organização da equipe.",
        url: "./modulos/administrativo/page/administrativo-painel.html",
        roles: ["admin", "gestor", "assistente"],
        icon: icons.administrativo,
      },
      trilha_paciente: {
        titulo: "Trilha do Paciente",
        descricao:
          "Acompanhe o fluxo de pacientes desde a inscrição até o atendimento.",
        url: "./modulos/trilha-paciente/page/trilha-paciente-painel.html",
        roles: ["admin", "assistente", "servico_social"],
        icon: icons.trilha_paciente,
      },
      captacao: {
        titulo: "Captação",
        descricao:
          "Ferramentas e informações para a equipe de captação de recursos.",
        url: "#",
        roles: ["admin", "captacao"],
        icon: icons.captacao,
      },
      financeiro: {
        titulo: "Financeiro",
        descricao: "Acesso ao painel de controle financeiro e relatórios.",
        url: "./modulos/financeiro/page/painel-financeiro.html",
        roles: ["admin", "financeiro"],
        icon: icons.financeiro,
      },
      grupos: {
        titulo: "Grupos",
        descricao:
          "Informações e materiais para a equipe de coordenação de grupos.",
        url: "#",
        roles: ["admin", "grupos"],
        icon: icons.grupos,
      },
      marketing: {
        titulo: "Marketing",
        descricao: "Acesso aos materiais de marketing e campanhas da EuPsico.",
        url: "#",
        roles: ["admin", "marketing"],
        icon: icons.marketing,
      },
      rh: {
        titulo: "Recursos Humanos",
        descricao:
          "Informações sobre vagas, comunicados e gestão de voluntários.",
        url: "./modulos/rh/page/rh-painel.html",
        roles: ["admin", "rh"],
        icon: icons.rh,
      },
      gestao: {
        titulo: "Gestão",
        descricao: "Registro de atas, plano de ação e dashboards de reuniões.",
        url: "./modulos/gestao/page/painel-gestao.html",
        roles: ["admin", "gestao"], // Usuários com 'admin' ou 'gestao' poderão ver
        icon: icons.gestao,
      },
      servico_social: {
        titulo: "Serviço Social",
        descricao: "Documentos, orientações e fichas para o serviço social.",
        url: "./modulos/servico-social/page/servico-social-painel.html",
        roles: ["admin", "servico_social"],
        icon: icons.servico_social,
      },
    };

    const userFuncoes = (userData.funcoes || []).map((f) => f.toLowerCase());
    let modulesToShow = [];
    for (const key in areas) {
      const area = areas[key];
      const rolesLowerCase = (area.roles || []).map((r) => r.toLowerCase());
      let hasPermission = false;
      if (userFuncoes.includes("admin") || rolesLowerCase.includes("todos")) {
        hasPermission = true;
      } else if (rolesLowerCase.some((role) => userFuncoes.includes(role))) {
        hasPermission = true;
      }
      if (hasPermission) {
        modulesToShow.push(area);
      }
    }
    modulesToShow.sort((a, b) => {
      if (a.titulo === "Portal do Voluntário") return -1;
      if (b.titulo === "Portal do Voluntário") return 1;
      return a.titulo.localeCompare(b.titulo);
    });
    return modulesToShow;
  } // Inicia o processo de autenticação

  handleAuth();
});
