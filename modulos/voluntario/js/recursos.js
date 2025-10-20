// Arquivo: /modulos/voluntario/js/recursos.js
// Versão 2.5 (Tentativa de corrigir carregamento com classList/RAF + Logging)

export function init(user, userData) {
  console.log("[Recursos Init] Módulo Iniciado.");
  const view = document.querySelector(".view-container");
  if (!view) {
    console.error(
      "[Recursos Init] Erro Fatal: .view-container não encontrado."
    );
    return;
  }

  let tabContainer = view.querySelector(".tabs-container");
  const contentSections = view.querySelectorAll(".tab-content");
  const loadedTabs = new Set();

  if (!tabContainer) {
    console.error("[Recursos Init] Erro: .tabs-container não encontrado.");
  }
  if (!contentSections || contentSections.length === 0) {
    console.error("[Recursos Init] Erro: Nenhum .tab-content encontrado.");
  }

  const loadTabModule = async (tabId) => {
    // Não carrega se já estiver na lista ou se o ID for inválido
    if (!tabId || loadedTabs.has(tabId)) {
      // console.log(`[LoadTabModule ${tabId}] Módulo já carregado ou ID inválido.`);
      return;
    }
    console.log(`[LoadTabModule ${tabId}] Iniciando carregamento...`);
    loadedTabs.add(tabId); // Adiciona ANTES para evitar múltiplas tentativas se demorar

    // Mostra spinner temporariamente (se não houver um)
    const targetContentEl = view.querySelector(`#${tabId}`);
    if (
      targetContentEl &&
      !targetContentEl.querySelector(".loading-spinner") &&
      targetContentEl.innerHTML.trim() === ""
    ) {
      targetContentEl.innerHTML =
        '<div class="loading-spinner" style="margin: 30px auto;"></div>';
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
        default:
          console.warn(`[LoadTabModule ${tabId}] Nenhum módulo definido.`);
          if (targetContentEl)
            targetContentEl.innerHTML = "<p>Recurso não implementado.</p>"; // Limpa spinner
          // loadedTabs.delete(tabId); // Remove se falhou? Ou mantém para não tentar de novo? Mantém por enquanto.
          return;
      }
      if (module && typeof module.init === "function") {
        console.log(
          `[LoadTabModule ${tabId}] Módulo importado. Chamando init()...`
        );
        // Garante que o spinner seja removido antes de chamar init, caso init falhe
        if (targetContentEl) {
          const spinner = targetContentEl.querySelector(".loading-spinner");
          if (spinner) spinner.remove();
        }
        await module.init(...initParams);
        console.log(
          `[LoadTabModule ${tabId}] Módulo inicializado com sucesso.`
        );
      } else {
        console.warn(
          `[LoadTabModule ${tabId}] Módulo importado, mas não possui função init().`
        );
        if (targetContentEl)
          targetContentEl.innerHTML =
            "<p>Erro: Módulo não pode ser inicializado.</p>"; // Limpa spinner
        // loadedTabs.delete(tabId);
      }
    } catch (error) {
      console.error(
        `[LoadTabModule ${tabId}] Erro durante importação ou inicialização:`,
        error
      );
      if (targetContentEl) {
        targetContentEl.innerHTML = `<p class="alert alert-error" style="color: red; padding: 10px; border: 1px solid red;">Ocorreu um erro grave ao carregar este recurso.</p>`;
      }
      // Considerar remover do loadedTabs se a falha for crítica para permitir nova tentativa?
      // loadedTabs.delete(tabId);
    }
  };

  // --- FUNÇÃO switchTab ---
  const switchTab = (tabId) => {
    console.log(`[SwitchTab] Tentando trocar para aba: ${tabId}`);

    if (!tabContainer || !contentSections) {
      console.error(
        "[SwitchTab] Erro: Containers de aba ou conteúdo não encontrados."
      );
      return;
    }

    const targetContent = document.getElementById(tabId);
    if (!targetContent) {
      console.error(
        `[SwitchTab] Erro: Conteúdo da aba #${tabId} não encontrado no DOM.`
      );
      const defaultTabId = "disponibilidade";
      if (tabId !== defaultTabId && document.getElementById(defaultTabId)) {
        console.warn(
          `[SwitchTab] Redirecionando para aba padrão '${defaultTabId}'.`
        );
        switchTab(defaultTabId);
      } else {
        console.error(
          "[SwitchTab] Erro Crítico: Conteúdo da aba alvo e padrão não encontrados."
        );
      }
      return;
    }

    // 1. ATUALIZA BOTÕES
    if (tabContainer) {
      let foundButton = false;
      tabContainer.querySelectorAll(".tab-link").forEach((btn) => {
        const isActive = btn.dataset.tab === tabId;
        btn.classList.toggle("active", isActive);
        if (isActive) foundButton = true;
      });
      if (!foundButton)
        console.warn(`[SwitchTab] Botão para aba ${tabId} não encontrado.`);
    } else {
      console.warn(
        "[SwitchTab] tabContainer inválido ao tentar atualizar botões."
      );
    }

    // 2. ATUALIZA CONTEÚDO (Visibilidade via CSS)
    let foundContent = false;
    contentSections.forEach((section) => {
      const isActive = section.id === tabId;
      section.classList.toggle("active", isActive);
      if (isActive) foundContent = true;
    });
    if (!foundContent) {
      // Isso não deveria acontecer se targetContent foi encontrado acima, mas por segurança...
      console.error(
        `[SwitchTab] Div de conteúdo #${tabId} não encontrado entre contentSections.`
      );
      return; // Para a execução se o conteúdo não pode ser ativado
    }

    // 3. CARREGA O MÓDULO (com delay)
    console.log(
      `[SwitchTab ${tabId}] Agendando carregamento do módulo via requestAnimationFrame.`
    );
    requestAnimationFrame(() => {
      console.log(
        `[RAF ${tabId}] Executando callback. Verificando se ${tabId} ainda é a aba ativa.`
      );
      // Verifica se a aba ativa AINDA é a que agendamos
      const currentActiveButton = tabContainer
        ? tabContainer.querySelector(".tab-link.active")
        : null;
      const currentActiveTabId = currentActiveButton
        ? currentActiveButton.dataset.tab
        : null;

      if (currentActiveTabId === tabId) {
        console.log(
          `[RAF ${tabId}] Aba ainda ativa. Chamando loadTabModule se não carregado.`
        );
        // Só carrega se não foi carregado ainda
        if (!loadedTabs.has(tabId)) {
          loadTabModule(tabId);
        } else {
          console.log(`[RAF ${tabId}] Módulo já estava na lista 'loadedTabs'.`);
        }
      } else {
        console.log(
          `[RAF ${tabId}] Aba mudou para ${currentActiveTabId} antes do carregamento. Cancelando.`
        );
      }
    });
    console.log(`[SwitchTab ${tabId}] Função switchTab concluída.`);
  };

  // --- Lógica de Clonagem e Event Listeners ---
  if (tabContainer) {
    const newTabContainer = tabContainer.cloneNode(true);
    if (tabContainer.parentNode) {
      tabContainer.parentNode.replaceChild(newTabContainer, tabContainer);
      tabContainer = newTabContainer; // ATUALIZA a variável
      console.log("[Recursos Init] tabContainer clonado e substituído.");

      tabContainer.addEventListener("click", (e) => {
        const clickedTab = e.target.closest(".tab-link");
        if (clickedTab && clickedTab.dataset.tab) {
          const tabId = clickedTab.dataset.tab;
          const newHash = `#recursos/${tabId}`;
          if (window.location.hash !== newHash) {
            console.log(
              `[Click Listener] Aba ${tabId} clicada. Mudando hash para ${newHash}`
            );
            window.location.hash = newHash; // Dispara hashchange
          } else {
            console.log(
              `[Click Listener] Aba ${tabId} clicada, mas hash já é ${newHash}.`
            );
            // Força re-avaliação pode ser útil se algo falhar, mas arriscado
            // handleHashChange();
          }
        }
      });
    } else {
      console.error(
        "[Recursos Init] Erro: Pai do tabContainer não encontrado durante clonagem."
      );
      tabContainer = null;
    }
  } else {
    console.warn(
      "[Recursos Init] .tabs-container não encontrado inicialmente."
    );
  }

  const handleHashChange = () => {
    console.log(`[HashChange] Hash atual: ${window.location.hash}`);
    const hashParts = window.location.hash.substring(1).split("/");
    let targetTabId = "disponibilidade"; // Aba padrão

    if (hashParts[0] === "recursos" && hashParts[1]) {
      // Verifica se o botão da aba existe
      if (
        tabContainer &&
        tabContainer.querySelector(`.tab-link[data-tab="${hashParts[1]}"]`)
      ) {
        targetTabId = hashParts[1];
        console.log(
          `[HashChange] Hash aponta para aba existente: ${targetTabId}`
        );
      } else {
        console.warn(
          `[HashChange] Aba "${hashParts[1]}" do hash não encontrada ou tabContainer inválido. Usando padrão.`
        );
        // Opcional: Corrigir o hash para a aba padrão
        // window.history.replaceState(null, '', `#recursos/${targetTabId}`);
      }
    } else {
      console.log(
        "[HashChange] Hash não corresponde a 'recursos/[aba]', usando padrão."
      );
      // Opcional: Corrigir o hash para a aba padrão
      // window.history.replaceState(null, '', `#recursos/${targetTabId}`);
    }

    switchTab(targetTabId);
  };

  // Listener para quando o hash na URL muda
  window.addEventListener("hashchange", handleHashChange);

  // Chama para carregar a aba inicial baseada no hash atual ou no padrão
  console.log(
    "[Recursos Init] Agendando primeira chamada a handleHashChange via setTimeout."
  );
  setTimeout(handleHashChange, 50);
} // Fim da função init
