// Arquivo: /modulos/voluntario/js/painel-supervisionado.js
// Versão: 4.0 (Atualizado para a sintaxe modular do Firebase v9 e passagem de parâmetros corrigida)
// Descrição: Controla as abas "Acompanhamentos" e "Supervisores", e navega para a ficha.

export function init(user, userData) {
  const view = document.querySelector(".view-container");
  if (!view) return;

  const tabContainer = view.querySelector("#supervisionado-tabs");
  const contentSections = view.querySelectorAll(".tab-content");
  const loadedTabs = new Set();

  const loadTabModule = async (tabId) => {
    if (loadedTabs.has(tabId)) return;

    try {
      let module;
      // Parâmetros para os módulos filhos agora não incluem mais o 'db'
      const params = [user, userData];

      switch (tabId) {
        case "acompanhamentos":
          module = await import("./fichas-supervisao.js");
          break;
        case "ver-supervisores":
          module = await import("./ver-supervisores.js");
          break;
        default:
          return;
      }

      if (module && typeof module.init === "function") {
        await module.init(...params);
        loadedTabs.add(tabId);
      }
    } catch (error) {
      console.error(`Erro ao carregar o módulo da aba '${tabId}':`, error);
      const tabContent = view.querySelector(`#${tabId}`);
      if (tabContent) {
        tabContent.innerHTML = `<div class="info-card" style="border-left-color: var(--cor-erro);">Ocorreu um erro ao carregar este recurso.</div>`;
      }
    }
  };

  if (tabContainer) {
    tabContainer.addEventListener("click", (e) => {
      const target = e.target.closest(".tab-link");
      if (target) {
        e.preventDefault();
        const tabId = target.dataset.tab;

        // A navegação para a ficha de supervisão é tratada pelo roteador principal
        if (tabId === "ficha-supervisao") {
          window.location.hash = "#ficha-supervisao/new";
          return;
        }

        // Lógica para as outras abas
        tabContainer
          .querySelectorAll(".tab-link")
          .forEach((btn) => btn.classList.remove("active"));
        target.classList.add("active");

        contentSections.forEach((section) => {
          section.style.display = section.id === tabId ? "block" : "none";
        });

        loadTabModule(tabId);
      }
    });
  }

  // Lógica de inicialização da aba correta
  const currentHash = window.location.hash.substring(1);
  const activeTabButton = tabContainer?.querySelector(
    `.tab-link[data-tab="${currentHash}"]`
  );

  if (activeTabButton && currentHash !== "ficha-supervisao") {
    activeTabButton.click();
  } else {
    const firstTab = tabContainer?.querySelector(".tab-link");
    if (firstTab) {
      firstTab.click(); // Simula o clique na primeira aba para garantir a inicialização correta
    }
  }
}
