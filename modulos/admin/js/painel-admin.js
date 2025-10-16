import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";

// Variáveis para armazenar os dados do usuário no escopo do módulo
let currentUser, currentUserData;

// Função de entrada do módulo, chamada pelo app.js
export function init(user, userData) {
  console.log("🔹 Painel de Administração iniciado para:", userData.nome);

  // Armazena os dados do usuário para serem usados por outras funções no módulo
  currentUser = user;
  currentUserData = userData;

  handleNavigation();
  window.addEventListener("hashchange", handleNavigation);
}

// Constrói o menu na barra lateral principal
function buildAdminSidebarMenu() {
  const sidebarMenu = document.getElementById("sidebar-menu");
  if (!sidebarMenu) return;

  const views = [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
    },
    {
      id: "gestao-pacientes",
      name: "Gestão de Pacientes",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    },
    {
      id: "agendamentos-supervisao",
      name: "Agendamentos (Supervisão)",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    },
    {
      id: "gerenciar-treinamentos",
      name: "Gerenciar Treinamentos",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>',
    },
    {
      id: "importar-pacientes",
      name: "Importar Pacientes",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>',
    },
    {
      id: "configuracoes",
      name: "Configurações",
      icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
    },
  ];

  let menuHtml = `
        <li>
            <a href="../../../index.html" class="back-link">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                <span>Voltar à Intranet</span>
            </a>
        </li>
        <li class="menu-separator"></li>
    `;

  views.forEach((view) => {
    menuHtml += `<li><a href="#${view.id}" data-view="${view.id}">${view.icon}<span>${view.name}</span></a></li>`;
  });

  sidebarMenu.innerHTML = menuHtml;
}

// Gerencia a navegação e o carregamento da view
function handleNavigation() {
  const viewId = window.location.hash.substring(1) || "dashboard";
  loadView(viewId);
}

// Carrega o HTML e o JS de uma sub-página
async function loadView(viewId) {
  const contentArea = document.getElementById("content-area");
  const sidebarMenu = document.getElementById("sidebar-menu");
  if (!contentArea || !sidebarMenu) return;

  buildAdminSidebarMenu();

  sidebarMenu.querySelectorAll("a[data-view]").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === viewId);
  });

  contentArea.innerHTML = '<div class="loading-spinner"></div>';

  try {
    let htmlPath;
    switch (viewId) {
      case "dashboard":
        htmlPath = "./dashboard-admin.html";
        break;
      case "gestao-pacientes": // Novo caso
        htmlPath = "./gestao-pacientes.html";
        break;
      case "agendamentos-supervisao":
        htmlPath = "./agendamentos-supervisao.html";
        break;
      case "gerenciar-treinamentos":
        htmlPath = "./gerenciar-treinamentos.html";
        break;
      case "importar-pacientes":
        htmlPath = "./importar-pacientes.html";
        break;
      case "configuracoes":
        htmlPath = "./configuracoes.html";
        break;
      default:
        htmlPath = "./dashboard-admin.html";
        window.location.hash = "dashboard";
        break;
    }

    const response = await fetch(htmlPath);
    if (!response.ok) throw new Error(`Não foi possível carregar ${htmlPath}`);
    contentArea.innerHTML = await response.text();

    if (viewId === "dashboard" || !viewId) {
      renderDisponibilidadeServicoSocial();
      renderGerenciamentoUsuarios();
    } else if (viewId === "gestao-pacientes") {
      // Novo bloco
      const gestaoModule = await import("./gestao-pacientes.js");
      if (gestaoModule.init) gestaoModule.init(currentUser, currentUserData);
    } else if (viewId === "agendamentos-supervisao") {
      const agendamentosModule = await import("./agendamentos-supervisao.js");
      if (agendamentosModule.init)
        agendamentosModule.init(currentUser, currentUserData);
    } else if (viewId === "gerenciar-treinamentos") {
      const treinamentosModule = await import("./gerenciar-treinamentos.js");
      if (treinamentosModule.init)
        treinamentosModule.init(currentUser, currentUserData);
    } else if (viewId === "importar-pacientes") {
      const importarModule = await import("./importar-pacientes.js");
      if (importarModule.init)
        importarModule.init(currentUser, currentUserData);
    } else if (viewId === "configuracoes") {
      const configModule = await import("./configuracoes.js");
      if (configModule.init) configModule.init(currentUser, currentUserData);
    }
  } catch (error) {
    console.error("Erro ao carregar a view:", error);
    contentArea.innerHTML = `<div class="alert alert-danger">Ocorreu um erro ao carregar esta seção.</div>`;
  }
}

// --- Funções de Renderização do Dashboard (ATUALIZADAS) ---

async function renderDisponibilidadeServicoSocial() {
  const container = document.getElementById("disponibilidade-admin-container");
  if (!container) return;
  try {
    const functions = getFunctions();
    const getDisponibilidades = httpsCallable(
      functions,
      "getTodasDisponibilidadesAssistentes"
    );
    const result = await getDisponibilidades();
    const disponibilidades = result.data.sort((a, b) =>
      a.nome.localeCompare(b.nome)
    );

    if (!disponibilidades || disponibilidades.length === 0) {
      container.innerHTML = "<p>Nenhuma disponibilidade encontrada.</p>";
      return;
    }

    let html = '<div class="disponibilidade-list">';
    disponibilidades.forEach((assistente) => {
      html += `<div class="assistente-item">`;
      html += `<h5 class="assistente-nome">${assistente.nome}</h5>`;
      const dispoMap = assistente.disponibilidade;

      if (!dispoMap || Object.keys(dispoMap).length === 0) {
        html += '<p class="no-dispo">Nenhuma disponibilidade informada.</p>';
      } else {
        html += '<ul class="disponibilidade-detalhes">';
        Object.keys(dispoMap)
          .sort()
          .forEach((mesKey) => {
            const dadosDoMes = dispoMap[mesKey];
            const [ano, mes] = mesKey.split("-");
            const nomeMes = new Date(ano, parseInt(mes) - 1, 1).toLocaleString(
              "pt-BR",
              { month: "long" }
            );
            const nomeMesCapitalizado =
              nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);

            html += `<li><strong>${nomeMesCapitalizado}:</strong></li>`;

            let hasDetails = false;
            if (dadosDoMes.online && dadosDoMes.online.dias.length > 0) {
              const dias = dadosDoMes.online.dias
                .map((d) => d.split("-")[2])
                .join(", ");
              html += `<li class="detalhe-item"><span>Online:</span> Dias ${dias} (das ${dadosDoMes.online.inicio} às ${dadosDoMes.online.fim})</li>`;
              hasDetails = true;
            }
            if (
              dadosDoMes.presencial &&
              dadosDoMes.presencial.dias.length > 0
            ) {
              const dias = dadosDoMes.presencial.dias
                .map((d) => d.split("-")[2])
                .join(", ");
              html += `<li class="detalhe-item"><span>Presencial:</span> Dias ${dias} (das ${dadosDoMes.presencial.inicio} às ${dadosDoMes.presencial.fim})</li>`;
              hasDetails = true;
            }
            if (!hasDetails) {
              html += `<li class="detalhe-item"><span>Nenhum horário informado para este mês.</span></li>`;
            }
          });
        html += "</ul>";
      }
      html += `</div>`;
    });
    container.innerHTML = html + "</div>";
  } catch (error) {
    console.error("Erro ao carregar disponibilidade:", error);
    container.innerHTML = `<div class="alert alert-danger">Não foi possível carregar os dados de disponibilidade.</div>`;
  }
}

async function renderGerenciamentoUsuarios() {
  const container = document.getElementById("usuarios-admin-container");
  if (!container) return;
  try {
    const functions = getFunctions();
    const getUsuarios = httpsCallable(functions, "getTodosUsuarios");
    const result = await getUsuarios();
    const usuarios = result.data.sort((a, b) => a.nome.localeCompare(b.nome));

    let tableHtml = `
                <div class="table-responsive">
                    <table class="table table-hover">
                        <thead>
                            <tr>
                                <th>Nome</th>
                                <th>Email</th>
                                <th>Perfil</th>
                                <th class="text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody>`;

    usuarios.forEach((user) => {
      tableHtml += `
                <tr>
                    <td>${user.nome || "Não informado"}</td>
                    <td>${user.email}</td>
                    <td><span class="badge">${
                      user.role || "Sem perfil"
                    }</span></td>
                    <td class="text-right"><button class="action-button secondary btn-sm" data-uid="${
                      user.uid
                    }">Editar</button></td>
                </tr>
            `;
    });

    container.innerHTML = tableHtml + "</tbody></table></div>";
  } catch (error) {
    console.error("Erro ao carregar usuários:", error);
    container.innerHTML = `<div class="alert alert-danger">Não foi possível carregar a lista de usuários.</div>`;
  }
}
