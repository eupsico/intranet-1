// Arquivo: /modulos/voluntario/js/recursos.js
// Versão 3.2 (Estrutura V1/V2 Sibling + Importação Dinâmica V1)

// NENHUMA IMPORTAÇÃO ESTÁTICA AQUI

export function init(user, userData) {
  console.log(
    "[Recursos Init V3.2] Módulo Iniciado (Padrão Sibling Dinâmico)."
  );
  const view = document.querySelector(".view-container");
  if (!view) {
    console.error(
      "[Recursos Init] Erro Fatal: .view-container não encontrado."
    );
    return;
  }

  let tabContainer = view.querySelector(".tabs-container"); // Container dos botões/links

  // CORREÇÃO: Pega TODAS as seções de conteúdo como "irmãs", igual ao V1
  const allContentSections = view.querySelectorAll(".tab-content");

  if (!tabContainer) {
    console.error("[Recursos Init] Erro: .tabs-container não encontrado.");
  }
  if (allContentSections.length === 0) {
    console.error(
      "[Recursos Init] Erro CRÍTICO: Nenhum .tab-content (seções de conteúdo) encontrado. As abas não funcionarão."
    );
    return;
  } // Guarda os IDs das abas cujo JS já foi inicializado com sucesso

  const initializedTabs = new Set(); // --- FUNÇÃO initializeTabScript (MODIFICADA) ---

  const initializeTabScript = async (tabId) => {
    if (!tabId || initializedTabs.has(tabId)) {
      return;
    }
    console.log(
      `[InitializeTab ${tabId}] Tentando carregar e inicializar script...`
    );

    // CORREÇÃO: Procura a div de conteúdo pelo ID diretamente dentro da view
    const targetContentEl = view.querySelector(`#${tabId}`);

    if (!targetContentEl) {
      console.error(
        `[InitializeTab ${tabId}] ERRO CRÍTICO: Elemento de conteúdo #${tabId} NÃO encontrado no HTML.`
      );
      return;
    }

    // Gerencia o spinner de "Carregando..."
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

    // Lógica de importação dinâmica (como na V1)
    try {
      let module;
      let initParams = [user, userData];

      // Mapeamento dinâmico
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
          console.warn(
            `[InitializeTab ${tabId}] Nenhum módulo JS mapeado para esta aba.`
          );
          if (spinner) spinner.remove();
          if (targetContentEl.textContent.includes("Carregando")) {
            targetContentEl.innerHTML = `<p>Recurso não configurado.</p>`;
          }
          return;
      }

      // Se o módulo foi carregado e tem um init, execute-o
      if (module && typeof module.init === "function") {
        console.log(`[InitializeTab ${tabId}] Chamando init() do módulo...`);
        await module.init(...initParams);
        console.log(
          `[InitializeTab ${tabId}] Script inicializado com sucesso.`
        );
        initializedTabs.add(tabId); // Marca como inicializado SOMENTE após sucesso

        if (spinner && spinner.parentNode) {
          spinner.remove();
        } else if (targetContentEl.querySelector(".loading-spinner")) {
          targetContentEl.querySelector(".loading-spinner").remove();
        }
      } else {
        console.warn(
          `[InitializeTab ${tabId}] Módulo carregado, mas não possui a função init().`
        );
        if (spinner) spinner.remove();
      }
    } catch (error) {
      // *** AVISO ***
      // Se a importação falhar (ex: erro 404 no fetch do disponibilidade.js)
      // O erro será mostrado AQUI, dentro da aba.
      console.error(
        `[InitializeTab ${tabId}] ERRO CRÍTICO ao importar ou inicializar o módulo:`,
        error
      );
      if (targetContentEl) {
        const errorSpinner = targetContentEl.querySelector(".loading-spinner");
        if (errorSpinner) errorSpinner.remove();

        const pCarregando = targetContentEl.querySelector("p");
        if (pCarregando && pCarregando.textContent.includes("Carregando")) {
          pCarregando.remove();
        }
        targetContentEl.innerHTML = `<p class="alert alert-error" style="color: red; padding: 10px; border: 1px solid red;">Ocorreu um erro grave ao carregar este recurso (${tabId}). Verifique o console (F12).</p>`;
      }
    }
  }; // --- FIM DA FUNÇÃO initializeTabScript --- // --- FUNÇÃO switchTab (MODIFICADA) ---

  const switchTab = (tabId) => {
    console.log(`[SwitchTab V3.2] Tentando trocar para aba: ${tabId}`);

    if (!tabContainer) {
      console.error("[SwitchTab] Erro: Container de botões não encontrado.");
      return;
    }

    // CORREÇÃO: Verifica se o conteúdo alvo existe na lista de seções
    const targetContent = view.querySelector(`#${tabId}`);

    if (!targetContent) {
      console.error(
        `[SwitchTab] Erro CRÍTICO: Conteúdo da aba #${tabId} não encontrado no DOM.`
      );
      const defaultTabId = "disponibilidade";
      if (tabId !== defaultTabId && view.querySelector(`#${defaultTabId}`)) {
        console.warn(
          `[SwitchTab] Redirecionando para aba padrão '${defaultTabId}'.`
        );
        window.location.hash = `#recursos/${defaultTabId}`;
      }
      return;
    } // 1. ATUALIZA BOTÕES

    tabContainer.querySelectorAll(".tab-link").forEach((btn) => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle("active", isActive);
    }); // 2. ATUALIZA CONTEÚDO (Visibilidade)

    // CORREÇÃO: Itera sobre a lista de seções "irmãs"
    allContentSections.forEach((section) => {
      const isActive = section.id === tabId;
      section.classList.toggle("active", isActive);
      section.style.display = isActive ? "block" : "none"; // Controle direto de display
    }); // 3. CHAMA A INICIALIZAÇÃO DO SCRIPT DA ABA (se necessário)

    console.log(
      `[SwitchTab ${tabId}] Chamando initializeTabScript (se necessário)...`
    );
    initializeTabScript(tabId);

    console.log(`[SwitchTab ${tabId}] Troca visual concluída.`);
  }; // --- Lógica de Clonagem e Event Listeners (Mantida) ---

  if (tabContainer) {
    const newTabContainer = tabContainer.cloneNode(true);
    if (tabContainer.parentNode) {
      tabContainer.parentNode.replaceChild(newTabContainer, tabContainer);
      tabContainer = newTabContainer; // ATUALIZA a variável
      console.log("[Recursos Init] tabContainer clonado e substituído.");

      tabContainer.addEventListener("click", (e) => {
        const clickedTab = e.target.closest(".tab-link");
        if (clickedTab && clickedTab.dataset.tab) {
          e.preventDefault();
          const tabId = clickedTab.dataset.tab;
          const newHash = `#recursos/${tabId}`;
          if (window.location.hash !== newHash) {
            console.log(
              `[Click Listener] Aba ${tabId} clicada. Mudando hash para ${newHash}`
            );
            window.location.hash = newHash; // Dispara o hashchange
          } else {
            console.log(
              `[Click Listener] Aba ${tabId} clicada, hash já é ${newHash}. Forçando inicialização (se pendente).`
            );
            initializeTabScript(tabId);
          }
        }
      });
    } else {
      console.error(
        "[Recursos Init] Erro: Pai do tabContainer não encontrado durante clonagem."
      );
      tabContainer = null;
    }
  }

  // --- handleHashChange (Função que lê a URL e decide qual aba mostrar) ---
  const handleHashChange = () => {
    console.log(`[HashChange V3.2] Hash atual: ${window.location.hash}`);
    const hashParts = window.location.hash.substring(1).split("/");
    let targetTabId = "disponibilidade"; // Aba padrão

    if (hashParts[0] === "recursos" && hashParts[1]) {
      const hashTabId = hashParts[1];
      // CORREÇÃO: Verifica se o elemento da aba existe na view
      if (view.querySelector(`#${hashTabId}`)) {
        targetTabId = hashTabId;
        console.log(
          `[HashChange] Hash aponta para aba existente: ${targetTabId}`
        );
      } else {
        console.warn(
          `[HashChange] Aba "${hashTabId}" (do hash) não encontrada no HTML. Usando padrão '${targetTabId}'.`
        );
        if (window.location.hash !== `#recursos/${targetTabId}`) {
          window.history.replaceState(null, "", `#recursos/${targetTabId}`);
        }
      }
    } else {
      console.log(
        `[HashChange] Hash não corresponde a '#recursos/[aba]'. Usando padrão '${targetTabId}'.`
      );
      if (window.location.hash !== `#recursos/${targetTabId}`) {
        window.history.replaceState(null, "", `#recursos/${targetTabId}`);
      }
    }

    switchTab(targetTabId);
  };

  // Remove qualquer listener antigo de 'hashchange' para evitar duplicidade
  window.removeEventListener("hashchange", handleHashChange); // Adiciona o listener para quando o hash na URL muda
  window.addEventListener("hashchange", handleHashChange); // --- INICIALIZAÇÃO ---

  console.log(
    "[Recursos Init] Chamando handleHashChange para carregar aba inicial."
  );

  setTimeout(handleHashChange, 100);

  console.log("[Recursos Init] Inicialização V3.2 concluída.");
} // Fim da função init
