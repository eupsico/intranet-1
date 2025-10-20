// Arquivo: /modulos/voluntario/js/recursos.js
// Versão 2.3 (Lógica de abas corrigida para destacar corretamente)

export function init(user, userData) {
  const view = document.querySelector(".view-container");
  if (!view) return;

  const tabContainer = view.querySelector(".tabs-container");
  const contentSections = view.querySelectorAll(".tab-content");
  const loadedTabs = new Set();

  const loadTabModule = async (tabId) => {
    // ... (nenhuma mudança nesta função interna)
    if (loadedTabs.has(tabId)) return;
    try {
      let module;
      let initParams = [user, userData];
      switch (tabId) {
        // --- INÍCIO DA MODIFICAÇÃO ---
        /* O 'case "mensagens"' foi removido daqui
        case "mensagens":
          module = await import("./mensagens.js");
          break;
        */
        // --- FIM DA MODIFICAÇÃO ---
        case "disponibilidade":
          module = await import("./disponibilidade.js");
          break;
        case "grade-online":
          module = await import("./grade-view.js");
          initParams.push("online");
          break;
        case "grade-presencial":
          module = await import("./grade-view.js");
          initParams.push("presencial");
          break;
        default:
          return;
      }
      if (module && typeof module.init === "function") {
        await module.init(...initParams);
        loadedTabs.add(tabId);
      }
    } catch (error) {
      console.error(`Erro ao carregar o módulo da aba '${tabId}':`, error);
      const tabContent = view.querySelector(`#${tabId}`);
      if (tabContent) {
        tabContent.innerHTML = `<p class="alert alert-error">Ocorreu um erro ao carregar este recurso.</p>`;
      }
    }
  };

  const switchTab = (tabId) => {
    if (!tabContainer || !contentSections) return;

    tabContainer.querySelectorAll(".tab-link").forEach((btn) => {
      btn.classList.remove("active");
    });
    const targetButton = tabContainer.querySelector(
      `.tab-link[data-tab="${tabId}"]`
    );
    if (targetButton) {
      targetButton.classList.add("active");
    }

    contentSections.forEach((section) => {
      section.style.display = section.id === tabId ? "block" : "none";
    });

    loadTabModule(tabId);
  };

  const handleHashChange = () => {
    const hashParts = window.location.hash.substring(1).split("/");

    // --- INÍCIO DA MODIFICAÇÃO ---
    // A aba padrão agora é "disponibilidade"
    let activeTabId = "disponibilidade";
    // --- FIM DA MODIFICAÇÃO ---

    if (hashParts[0] === "recursos" && hashParts[1]) {
      const foundTab = view.querySelector(
        `.tab-link[data-tab="${hashParts[1]}"]`
      );
      if (foundTab) {
        activeTabId = hashParts[1];
      }
    }
    switchTab(activeTabId);
  };

  if (tabContainer) {
    const newTabContainer = tabContainer.cloneNode(true);
    tabContainer.parentNode.replaceChild(newTabContainer, tabContainer);

    // ATUALIZA a variável tabContainer para apontar para o novo container
    tabContainer = newTabContainer; // <--- ADICIONE ESTA LINHA

    // Adiciona o listener ao NOVO container
    tabContainer.addEventListener("click", (e) => {
      const clickedTab = e.target.closest(".tab-link");
      if (clickedTab) {
        const tabId = clickedTab.dataset.tab;
        if (window.location.hash !== `#recursos/${tabId}`) {
          window.location.hash = `recursos/${tabId}`;
        }
      }
    });
  }

  // Listener para quando o hash na URL muda
  window.addEventListener("hashchange", handleHashChange);

  // Chama para carregar a aba inicial
  handleHashChange();
}
