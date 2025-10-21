// Arquivo: /modulos/voluntario/js/recursos.js
// Versão 4.1 (Debug Profundo - Sem Hash)

// NENHUMA IMPORTAÇÃO ESTÁTICA AQUI

export function init(user, userData) {
  // 1. O SCRIPT FOI CHAMADO?
  console.log(
    "[DEBUG V4.1] init() em recursos.js FOI CHAMADA. (Se você não vê isso, o erro está no 'portal-voluntario.js')"
  );
  const view = document.querySelector(".view-container"); // 2. O CONTAINER PRINCIPAL EXISTE?
  if (!view) {
    console.error(
      "[DEBUG V4.1] ERRO FATAL: .view-container não encontrado. O HTML de 'recursos.html' não foi carregado corretamente."
    );
    return;
  }
  console.log("[DEBUG V4.1] .view-container encontrado com sucesso.", view);

  let tabContainer = view.querySelector(".tabs-container"); // Container dos botões/links
  const allContentSections = view.querySelectorAll(".tab-content"); // Pega todas as seções // 3. OS BOTÕES E CONTEÚDOS EXISTEM?

  if (!tabContainer) {
    console.error(
      "[DEBUG V4.1] ERRO: .tabs-container (Botões) não encontrado."
    );
  } else {
    console.log(
      "[DEBUG V4.1] .tabs-container (Botões) encontrado.",
      tabContainer
    );
  }

  if (allContentSections.length === 0) {
    console.error(
      "[DEBUG V4.1] ERRO CRÍTICO: Nenhum .tab-content (Seções de Conteúdo) encontrado."
    );
    return;
  }
  console.log(
    `[DEBUG V4.1] ${allContentSections.length} seções .tab-content encontradas.`,
    allContentSections
  );

  const initializedTabs = new Set();

  // --- FUNÇÃO initializeTabScript ---
  const initializeTabScript = async (tabId) => {
    if (!tabId) {
      console.warn("[DEBUG V4.1] initializeTabScript chamada com tabId nulo.");
      return;
    }
    if (initializedTabs.has(tabId)) {
      console.log(
        `[DEBUG V4.1] initializeTabScript: Aba ${tabId} já inicializada. Pulando.`
      );
      return;
    }
    console.log(
      `[DEBUG V4.1] initializeTabScript: Tentando carregar e inicializar script para: ${tabId}`
    );

    const targetContentEl = view.querySelector(`#${tabId}`);

    if (!targetContentEl) {
      console.error(
        `[DEBUG V4.1] ERRO CRÍTICO: Elemento de conteúdo #${tabId} NÃO encontrado no HTML.`
      );
      return;
    }
    console.log(
      `[DEBUG V4.1] Elemento de conteúdo #${tabId} encontrado.`,
      targetContentEl
    );

    let spinner = targetContentEl.querySelector(".loading-spinner");
    if (
      (targetContentEl.innerHTML.trim() === "" ||
        targetContentEl.textContent.includes("Carregando")) &&
      !spinner
    ) {
      targetContentEl.innerHTML =
        '<div class="loading-spinner" style="margin: 30px auto; display: block;"></div>';
    } else if (spinner) {
      spinner.style.display = "block";
    }
    console.log(`[DEBUG V4.1] Spinner para #${tabId} ativado.`); // Lógica de importação dinâmica

    try {
      let module;
      let initParams = [user, userData];
      let scriptPath = ""; // Mapeamento dinâmico

      switch (tabId) {
        case "disponibilidade":
          scriptPath = "./disponibilidade.js";
          module = await import(scriptPath);
          break;
        case "grade-online":
          scriptPath = "./grade-view.js";
          module = await import(scriptPath);
          initParams.push("online");
          break;
        case "grade-presencial":
          scriptPath = "./grade-view.js";
          module = await import(scriptPath);
          initParams.push("presencial");
          break;
        case "alterar-grade":
          scriptPath = "./alterar-grade.js";
          module = await import(scriptPath);
          break;
        default:
          console.warn(
            `[DEBUG V4.1] Nenhum módulo JS mapeado para esta aba: ${tabId}.`
          );
          if (spinner) spinner.remove();
          if (targetContentEl.textContent.includes("Carregando")) {
            targetContentEl.innerHTML = `<p>Recurso não configurado.</p>`;
          }
          return;
      }

      console.log(`[DEBUG V4.1] IMPORTAÇÃO de ${scriptPath} BEM-SUCEDIDA.`); // Se o módulo foi carregado e tem um init, execute-o

      if (module && typeof module.init === "function") {
        console.log(`[DEBUG V4.1] Chamando module.init() para ${tabId}...`);
        await module.init(...initParams);
        console.log(`[DEBUG V4.1] Script ${tabId} inicializado com SUCESSO.`);
        initializedTabs.add(tabId); // Marca como inicializado SOMENTE após sucesso

        if (targetContentEl.querySelector(".loading-spinner")) {
          targetContentEl.querySelector(".loading-spinner").remove();
        }
      } else {
        console.error(
          `[DEBUG V4.1] ERRO: Módulo ${scriptPath} carregado, mas não possui a função "export function init()".`
        );
        if (spinner) spinner.remove();
      }
    } catch (error) {
      console.error(
        `[DEBUG V4.1] ERRO CRÍTICO ao IMPORTAR ou INICIALIZAR o módulo para ${tabId}:`,
        error
      );
      if (targetContentEl) {
        if (targetContentEl.querySelector(".loading-spinner")) {
          targetContentEl.querySelector(".loading-spinner").remove();
        }
        targetContentEl.innerHTML = `<p class="alert alert-error" style="color: red; padding: 10px; border: 1px solid red;">Ocorreu um erro grave ao carregar este recurso (${tabId}). Verifique o console (F12).</p>`;
      }
    }
  }; // --- FIM DA FUNÇÃO initializeTabScript --- // --- FUNÇÃO switchTab (Simplificada) ---

  const switchTab = (tabId) => {
    console.log(`[DEBUG V4.1] switchTab: Trocando para aba: ${tabId}`);

    if (!tabContainer) {
      console.warn("[DEBUG V4.1] Container de botões não encontrado.");
    }

    const targetContent = view.querySelector(`#${tabId}`);

    if (!targetContent) {
      console.error(
        `[DEBUG V4.1] ERRO CRÍTICO: Conteúdo da aba #${tabId} não encontrado no DOM.`
      );
      return;
    } // 1. ATUALIZA BOTÕES (se existirem)

    if (tabContainer) {
      tabContainer.querySelectorAll(".tab-link").forEach((btn) => {
        const isActive = btn.dataset.tab === tabId;
        btn.classList.toggle("active", isActive);
      });
    } // 2. ATUALIZA CONTEÚDO (Visibilidade)

    allContentSections.forEach((section) => {
      const isActive = section.id === tabId;
      section.style.display = isActive ? "block" : "none";
    });
    console.log(`[DEBUG V4.1] switchTab: Seção #${tabId} tornada visível.`); // 3. CHAMA A INICIALIZAÇÃO DO SCRIPT DA ABA

    initializeTabScript(tabId);

    console.log(
      `[DEBUG V4.1] switchTab: Troca visual para ${tabId} concluída.`
    );
  }; // --- Lógica de Event Listeners (MODIFICADA) ---

  if (tabContainer) {
    // Clonar para garantir que listeners antigos sejam removidos
    const newTabContainer = tabContainer.cloneNode(true);
    tabContainer.parentNode.replaceChild(newTabContainer, tabContainer);
    tabContainer = newTabContainer;

    tabContainer.addEventListener("click", (e) => {
      const clickedTab = e.target.closest(".tab-link");
      if (clickedTab && clickedTab.dataset.tab) {
        e.preventDefault();
        const tabId = clickedTab.dataset.tab;

        console.log(`[DEBUG V4.1] CLIQUE detectado no botão da aba: ${tabId}`);
        switchTab(tabId);
      }
    });
    console.log("[DEBUG V4.1] Listener de clique (Sem Hash) ADICIONADO.");
  } else {
    console.warn(
      "[DEBUG V4.1] .tabs-container (botões das abas) não encontrado. CLIQUES NÃO FUNCIONARÃO."
    );
  } // --- LÓGICA DE HASH REMOVIDA --- // --- INICIALIZAÇÃO (MODIFICADA) ---

  const defaultTabId = "disponibilidade";
  console.log(`[DEBUG V4.1] Agendando carga da aba padrão: ${defaultTabId}`);

  setTimeout(() => {
    console.log(`[DEBUG V4.1] EXECUTANDO carga da aba padrão: ${defaultTabId}`);
    switchTab(defaultTabId);
  }, 100);

  console.log("[DEBUG V4.1] Inicialização (V4.1) concluída.");
} // Fim da função init
