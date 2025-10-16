// Arquivo: /modulos/voluntario/js/supervisao.js
// Versão 3.1 (COM LOGS PARA DEPURAÇÃO AVANÇADA)

const tabContent = {
  "ficha-supervisao": "ficha-supervisao.html",
  "meus-acompanhamentos": "fichas-preenchidas.html",
  "ver-supervisores": "ver-supervisores.html",
};
const tabScripts = {
  "ficha-supervisao": "./ficha-supervisao.js",
  "meus-acompanhamentos": "./fichas-preenchidas.js",
  "ver-supervisores": "./ver-supervisores.js",
};

let db, user, userData;

export function init(dbRef, userRef, userDataRef) {
  db = dbRef;
  user = userRef;
  userData = userDataRef;

  const tabsContainer = document.getElementById("supervisao-tabs");
  if (tabsContainer) {
    const newTabsContainer = tabsContainer.cloneNode(true);
    tabsContainer.parentNode.replaceChild(newTabsContainer, tabsContainer);

    newTabsContainer.addEventListener("click", (event) => {
      const clickedTab = event.target.closest(".tab-link");
      if (clickedTab) {
        event.preventDefault();
        loadTabContent(clickedTab.dataset.tab);
      }
    });
    const initialTab = newTabsContainer.querySelector(".tab-link.active");
    if (initialTab) {
      loadTabContent(initialTab.dataset.tab);
    }
  }
}

async function loadTabContent(tabName) {
  // --- LOG DE INÍCIO ---
  console.log(`[DEBUG] Iniciando loadTabContent para a aba: ${tabName}`);

  const contentArea = document.getElementById("supervisao-content");
  if (!contentArea) {
    console.error("[DEBUG] Erro: #supervisao-content não encontrado.");
    return;
  }

  document
    .querySelectorAll("#supervisao-tabs .tab-link")
    .forEach((tab) => tab.classList.remove("active"));
  document
    .querySelector(`.tab-link[data-tab="${tabName}"]`)
    ?.classList.add("active");

  contentArea.innerHTML = '<div class="loading-spinner"></div>';

  const htmlFile = `../page/${tabContent[tabName]}`;
  const scriptFile = tabScripts[tabName];

  // --- LOG DOS CAMINHOS ---
  console.log(`[DEBUG] Caminho relativo do HTML definido: ${htmlFile}`);
  console.log(`[DEBUG] Caminho relativo do Script definido: ${scriptFile}`);

  try {
    if (scriptFile) {
      // --- LOG DA URL RESOLVIDA (O MAIS IMPORTANTE) ---
      // 'import.meta.url' nos dá a URL completa do script atual (supervisao.js)
      // A classe URL resolve o caminho relativo do 'scriptFile' a partir da URL do script atual.
      const resolvedUrl = new URL(scriptFile, import.meta.url);
      console.log(
        `[DEBUG] URL absoluta que o navegador VAI TENTAR buscar para o import: ${resolvedUrl.href}`
      );

      const module = await import(scriptFile);
      console.log(`[DEBUG] Módulo ${scriptFile} importado com SUCESSO.`);

      const response = await fetch(htmlFile);
      if (!response.ok) throw new Error(`HTML não encontrado: ${htmlFile}`);
      contentArea.innerHTML = await response.text();
      console.log(`[DEBUG] HTML ${htmlFile} carregado com SUCESSO.`);

      if (module.init) {
        console.log(`[DEBUG] Executando init() de ${scriptFile}...`);
        module.init(db, user, userData);
        console.log(`[DEBUG] init() de ${scriptFile} finalizado.`);
      }
    } else {
      // Carrega apenas o HTML se não houver script
      const response = await fetch(htmlFile);
      if (!response.ok) throw new Error(`HTML não encontrado: ${htmlFile}`);
      contentArea.innerHTML = await response.text();
      console.log(`[DEBUG] Apenas HTML ${htmlFile} carregado com SUCESSO.`);
    }
  } catch (error) {
    // --- LOG DE ERRO DETALHADO ---
    console.error(`[DEBUG] ERRO DETALHADO ao carregar aba ${tabName}:`, error);
    contentArea.innerHTML =
      '<p class="alert alert-error">Ocorreu um erro ao carregar o conteúdo. Verifique o console para detalhes (Ctrl+Shift+I).</p>';
  }
}
