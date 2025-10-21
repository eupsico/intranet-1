// Arquivo: /modulos/voluntario/js/recursos.js
// Versão 4.2 (Corrigido o Seletor - Sem Hash)
// O problema era o seletor allContentSections que ocultava o container pai.

// NENHUMA IMPORTAÇÃO ESTÁTICA AQUI

export function init(user, userData) {
  console.log("[Recursos Init V4.2] Módulo Iniciado (Corrigido Seletor Pai).");
  const view = document.querySelector(".view-container");
  if (!view) {
    console.error(
      "[Recursos Init] Erro Fatal: .view-container não encontrado."
    );
    return;
  }

  let tabContainer = view.querySelector(".tabs-container"); // Container dos botões/links

  // --- A CORREÇÃO CRÍTICA ESTÁ AQUI ---
  // Seleciona APENAS os .tab-content que têm um ID, ignorando o PAI.
  const allContentSections = view.querySelectorAll(".tab-content[id]");

  if (!tabContainer) {
    console.error("[Recursos Init] Erro: .tabs-container não encontrado.");
  }
  if (allContentSections.length === 0) {
    console.error(
      "[Recursos Init] Erro CRÍTICO: Nenhum .tab-content com [id] (seções de conteúdo) encontrado."
    );
    return;
  }

  const initializedTabs = new Set();

  // --- FUNÇÃO initializeTabScript (Sem alterações) ---
  const initializeTabScript = async (tabId) => {
    if (!tabId || initializedTabs.has(tabId)) {
      return;
    }
    const targetContentEl = view.querySelector(`#${tabId}`);
    if (!targetContentEl) {
      console.error(
        `[InitializeTab ${tabId}] ERRO: Elemento #${tabId} NÃO encontrado.`
      );
      return;
    }

    let spinner = targetContentEl.querySelector(".loading-spinner");
    if (
      (targetContentEl.innerHTML.trim() === "" ||
        targetContentEl.textContent.includes("Carregando")) &&
      !spinner
    ) {
      targetContentEl.innerHTML =
        '<div class="loading-spinner" style="margin: 30px auto; display: block;"></div>';
      spinner = targetContentEl.querySelector(".loading-spinner");
    } else if (spinner) {
      spinner.style.display = "block";
    }

    try {
      let module;
      let initParams = [user, userData];

      switch (tabId) {
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
        case "alterar-grade":
          module = await import("./alterar-grade.js");
          break;
        default:
          console.warn(`[InitializeTab ${tabId}] Nenhum módulo JS mapeado.`);
          if (spinner) spinner.remove();
          if (targetContentEl.textContent.includes("Carregando")) {
            targetContentEl.innerHTML = `<p>Recurso não configurado.</p>`;
          }
          return;
      }

      if (module && typeof module.init === "function") {
        await module.init(...initParams);
        console.log(
          `[Recursos Init V4.2] Script ${tabId} inicializado com SUCESSO.`
        );
        initializedTabs.add(tabId);

        if (targetContentEl.querySelector(".loading-spinner")) {
          targetContentEl.querySelector(".loading-spinner").remove();
        }
      } else {
        console.warn(
          `[InitializeTab ${tabId}] Módulo carregado, mas não possui a função init().`
        );
        if (spinner) spinner.remove();
      }
    } catch (error) {
      console.error(
        `[InitializeTab ${tabId}] ERRO CRÍTICO ao importar ou inicializar o módulo:`,
        error
      );
      if (targetContentEl) {
        if (targetContentEl.querySelector(".loading-spinner")) {
          targetContentEl.querySelector(".loading-spinner").remove();
        }
        targetContentEl.innerHTML = `<p class="alert alert-error" style="color: red; padding: 10px; border: 1px solid red;">Ocorreu um erro grave ao carregar este recurso (${tabId}). Verifique o console (F12).</p>`;
      }
    }
  }; // --- FIM DA FUNÇÃO initializeTabScript --- // --- FUNÇÃO switchTab (Agora segura) ---

  const switchTab = (tabId) => {
    console.log(`[SwitchTab V4.2] Trocando para aba: ${tabId}`);

    const targetContent = view.querySelector(`#${tabId}`);

    if (!targetContent) {
      console.error(
        `[SwitchTab] Erro CRÍTICO: Conteúdo da aba #${tabId} não encontrado.`
      );
      return;
    } // 1. ATUALIZA BOTÕES

    if (tabContainer) {
      tabContainer.querySelectorAll(".tab-link").forEach((btn) => {
        const isActive = btn.dataset.tab === tabId;
        btn.classList.toggle("active", isActive);
      });
    } // 2. ATUALIZA CONTEÚDO (Visibilidade)

    // Esta lista agora contém APENAS os filhos, então é seguro
    allContentSections.forEach((section) => {
      const isActive = section.id === tabId;
      section.style.display = isActive ? "block" : "none";
    }); // 3. CHAMA A INICIALIZAÇÃO DO SCRIPT DA ABA

    initializeTabScript(tabId);
  }; // --- Lógica de Event Listeners ---

  if (tabContainer) {
    const newTabContainer = tabContainer.cloneNode(true);
    tabContainer.parentNode.replaceChild(newTabContainer, tabContainer);
    tabContainer = newTabContainer;

    tabContainer.addEventListener("click", (e) => {
      const clickedTab = e.target.closest(".tab-link");
      if (clickedTab && clickedTab.dataset.tab) {
        e.preventDefault();
        const tabId = clickedTab.dataset.tab;
        switchTab(tabId);
      }
    });
    console.log(
      "[Recursos Init V4.2] Listener de clique (Sem Hash) ADICIONADO."
    );
  } else {
    console.warn(
      "[Recursos Init V4.2] .tabs-container (botões) não encontrado."
    );
  } // --- INICIALIZAÇÃO ---

  // Verifica se há uma aba de destino vinda de outro link (ex: dashboard)
  const targetTab = sessionStorage.getItem("targetTab");
  let defaultTabId = "disponibilidade"; // Define o padrão

  if (targetTab) {
    defaultTabId = targetTab; // Sobrescreve o padrão
    sessionStorage.removeItem("targetTab"); // Limpa o storage para não afetar recarregamentos
    console.log(
      `[Recursos Init V4.2] Carregando aba de destino: ${defaultTabId}`
    );
  } else {
    console.log(`[Recursos Init V4.2] Carregando aba padrão: ${defaultTabId}`);
  }

  setTimeout(() => {
    switchTab(defaultTabId);
  }, 100);

  console.log(
    "[Recursos Init] Inicialização V4.2 (Seletor Corrigido) concluída."
  );
} // Fim da função init
