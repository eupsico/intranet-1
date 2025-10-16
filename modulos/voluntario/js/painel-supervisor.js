// Arquivo: /modulos/voluntario/js/painel-supervisor.js
// Descrição: Controla a navegação por abas do Painel do Supervisor.
// Versão: ATUALIZADO para Firebase v9, mantendo a lógica original.

// As dependências do Firebase (como 'db') agora são importadas diretamente
// pelos módulos de cada aba, então não precisam ser armazenadas ou passadas globalmente daqui.
let user, userData;
const loadedTabs = new Map(); // Armazena os módulos já carregados para otimização

/**
 * Carrega o conteúdo de uma aba (HTML e o respectivo módulo JavaScript).
 * @param {string} tabId - O identificador da aba, que corresponde ao nome do arquivo .js e .html.
 */
async function loadTabContent(tabId) {
  const contentArea = document.getElementById("painel-supervisor-content");
  if (!contentArea) {
    console.error(
      "Área de conteúdo '#painel-supervisor-content' não encontrada."
    );
    return;
  }

  contentArea.innerHTML = '<div class="loading-spinner"></div>';

  try {
    // 1. Carrega o arquivo HTML da aba (mesma lógica de antes)
    const pageResponse = await fetch(`../page/${tabId}.html`);
    if (!pageResponse.ok) {
      throw new Error(`Falha ao carregar o HTML da aba: ${tabId}`);
    }
    contentArea.innerHTML = await pageResponse.text();

    // 2. Carrega o arquivo JavaScript (módulo) da aba dinamicamente (mesma lógica de antes)
    const module = await import(`./${tabId}.js`);

    // 3. Verifica se o módulo tem uma função 'init' e a executa
    if (module && typeof module.init === "function") {
      // --- ALTERAÇÃO PRINCIPAL PARA V9 ---
      // Não passamos mais o 'db'. Os módulos das abas agora importam
      // o 'db' de 'firebase-init.js' por conta própria.
      module.init(user, userData);
      loadedTabs.set(tabId, { module }); // Salva o módulo para referência futura
    } else {
      throw new Error(
        `O módulo para a aba '${tabId}' não possui uma função 'init' exportada.`
      );
    }
  } catch (error) {
    console.error(`Erro ao carregar a aba '${tabId}':`, error);
    contentArea.innerHTML =
      '<p class="alert alert-error">Ocorreu um erro ao carregar esta seção.</p>';
  }
}

/**
 * Lida com o evento de clique nas abas.
 * @param {Event} e - O objeto do evento de clique.
 */
function handleTabClick(e) {
  if (
    e.target.tagName === "BUTTON" &&
    e.target.classList.contains("tab-link")
  ) {
    const tabId = e.target.dataset.tab;

    // Atualiza a classe 'active' nos botões
    document
      .querySelectorAll("#painel-supervisor-tabs .tab-link")
      .forEach((btn) => btn.classList.remove("active"));
    e.target.classList.add("active");

    // Carrega o conteúdo da aba clicada
    loadTabContent(tabId);
  }
}

/**
 * Função de inicialização do painel do supervisor.
 * É exportada para ser chamada pelo script principal que gerencia o portal.
 * @param {object} userRef - O objeto do usuário autenticado do Firebase Auth.
 * @param {object} userDataRef - O objeto com os dados do usuário do Firestore.
 */
export function init(userRef, userDataRef) {
  user = userRef;
  userData = userDataRef;

  const tabs = document.getElementById("painel-supervisor-tabs");
  if (tabs) {
    tabs.addEventListener("click", handleTabClick);

    // Carrega o conteúdo da primeira aba (que está 'active' por padrão no HTML)
    const activeTab = tabs.querySelector(".tab-link.active");
    if (activeTab) {
      loadTabContent(activeTab.dataset.tab);
    }
  }
}
