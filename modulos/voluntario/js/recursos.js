// Arquivo: /modulos/voluntario/js/recursos.js
// Versão 4.0 (Sem Hash - Estilo Supervisão)
// Remove toda a lógica de hash e usa apenas show/hide.

// NENHUMA IMPORTAÇÃO ESTÁTICA AQUI

export function init(user, userData) {
  console.log(
    "[Recursos Init V4.0] Módulo Iniciado (Sem Hash - Estilo Supervisão)."
  );
  const view = document.querySelector(".view-container");
  if (!view) {
    console.error(
      "[Recursos Init] Erro Fatal: .view-container não encontrado."
    );
    return;
  }

  let tabContainer = view.querySelector(".tabs-container"); // Container dos botões/links
  const allContentSections = view.querySelectorAll(".tab-content"); // Pega todas as seções

  if (!tabContainer) {
    console.error("[Recursos Init] Erro: .tabs-container não encontrado."); // Não é fatal, mas os cliques não funcionarão.
  }
  if (allContentSections.length === 0) {
    console.error(
      "[Recursos Init] Erro CRÍTICO: Nenhum .tab-content (seções de conteúdo) encontrado. As abas não funcionarão."
    );
    return;
  }

  const initializedTabs = new Set();

  // --- FUNÇÃO initializeTabScript (Mantida) ---
  // Esta função é responsável por carregar o script da aba (disponibilidade.js, etc.)
  const initializeTabScript = async (tabId) => {
    if (!tabId || initializedTabs.has(tabId)) {
      return; // Já inicializado ou ID inválido
    }
    console.log(
      `[InitializeTab ${tabId}] Tentando carregar e inicializar script...`
    );

    const targetContentEl = view.querySelector(`#${tabId}`);

    if (!targetContentEl) {
      console.error(
        `[InitializeTab ${tabId}] ERRO CRÍTICO: Elemento de conteúdo #${tabId} NÃO encontrado no HTML.`
      );
      return;
    } // Gerencia o spinner de "Carregando..."

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
    } // Lógica de importação dinâmica (robusta contra erros)

    try {
      let module;
      let initParams = [user, userData]; // Mapeamento dinâmico

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
      } // Se o módulo foi carregado e tem um init, execute-o

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
  }; // --- FIM DA FUNÇÃO initializeTabScript --- // --- FUNÇÃO switchTab (Simplificada) ---

  const switchTab = (tabId) => {
    console.log(`[SwitchTab V4.0] Trocando para aba: ${tabId}`);

    if (!tabContainer) {
      console.warn("[SwitchTab] Container de botões não encontrado."); // Não é fatal, podemos trocar o conteúdo mesmo sem botões
    }

    const targetContent = view.querySelector(`#${tabId}`);

    if (!targetContent) {
      console.error(
        `[SwitchTab] Erro CRÍTICO: Conteúdo da aba #${tabId} não encontrado no DOM.`
      );
      // Tenta carregar a aba padrão se a aba alvo não existir
      const defaultTabId = "disponibilidade";
      if (tabId !== defaultTabId) {
        console.warn(
          `[SwitchTab] Tentando voltar para a aba padrão ${defaultTabId}`
        );
        switchTab(defaultTabId); // Chama recursivamente com a padrão
      }
      return;
    } // 1. ATUALIZA BOTÕES (se existirem)

    if (tabContainer) {
      tabContainer.querySelectorAll(".tab-link").forEach((btn) => {
        const isActive = btn.dataset.tab === tabId;
        btn.classList.toggle("active", isActive);
      });
    } // 2. ATUALIZA CONTEÚDO (Visibilidade)

    allContentSections.forEach((section) => {
      const isActive = section.id === tabId; // section.classList.toggle("active", isActive); // 'active' é opcional se usarmos display
      section.style.display = isActive ? "block" : "none"; // Controle direto de display
    }); // 3. CHAMA A INICIALIZAÇÃO DO SCRIPT DA ABA (se necessário)

    console.log(
      `[SwitchTab ${tabId}] Chamando initializeTabScript (se necessário)...`
    );
    initializeTabScript(tabId); // Carrega o JS da aba (ex: disponibilidade.js)

    console.log(`[SwitchTab ${tabId}] Troca visual concluída.`);
  }; // --- Lógica de Event Listeners (MODIFICADA) ---

  if (tabContainer) {
    // Adiciona o listener de clique UMA VEZ ao container dos botões
    tabContainer.addEventListener("click", (e) => {
      const clickedTab = e.target.closest(".tab-link"); // Acha o botão clicado
      if (clickedTab && clickedTab.dataset.tab) {
        e.preventDefault(); // Previne qualquer comportamento padrão do botão
        const tabId = clickedTab.dataset.tab;

        // LÓGICA DE HASH REMOVIDA

        // LÓGICA ADICIONADA:
        // Apenas chama a função switchTab diretamente.
        console.log(`[Click Listener] Aba ${tabId} clicada.`);
        switchTab(tabId);
      }
    });
    console.log("[Recursos Init] Listener de clique (Sem Hash) adicionado.");
  } else {
    console.warn(
      "[Recursos Init] .tabs-container (botões das abas) não encontrado."
    );
  } // --- LÓGICA DE HASH REMOVIDA --- // const handleHashChange = () => { ... }; // window.removeEventListener("hashchange", handleHashChange); // window.addEventListener("hashchange", handleHashChange); // --- INICIALIZAÇÃO (MODIFICADA) ---

  // Define a aba padrão que deve ser aberta
  const defaultTabId = "disponibilidade";
  console.log(`[Recursos Init] Carregando aba padrão: ${defaultTabId}`);

  // Chama o switchTab para a aba padrão
  // Usamos um timeout para garantir que o HTML foi renderizado
  setTimeout(() => {
    switchTab(defaultTabId);
  }, 100);

  console.log("[Recursos Init] Inicialização V4.0 (Sem Hash) concluída.");
} // Fim da função init
