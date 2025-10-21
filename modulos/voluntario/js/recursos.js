// Arquivo: /modulos/voluntario/js/recursos.js
// Versão 2.8 (Corrige ordem de carregamento e ativação de abas)

export function init(user, userData) {
  console.log("[Recursos Init] Módulo Iniciado.");
  const view = document.querySelector(".view-container");
  if (!view) {
    console.error(
      "[Recursos Init] Erro Fatal: .view-container não encontrado."
    );
    return;
  }

  // --- MODIFICAÇÃO: Seleciona o container PAI das seções ---
  const tabContentContainer = view.querySelector(".tab-content");
  if (!tabContentContainer) {
    console.error(
      "[Recursos Init] Erro: Container .tab-content não encontrado."
    );
    // return; // Decide se quer parar ou tentar continuar sem ele
  }
  // Remove a busca inicial por .tab-content individuais aqui

  let tabContainer = view.querySelector(".tabs-container"); // Container dos botões/links
  const loadedTabs = new Set(); // Guarda IDs das abas carregadas com SUCESSO

  if (!tabContainer) {
    console.error("[Recursos Init] Erro: .tabs-container não encontrado.");
  }

  // --- FUNÇÃO loadTabModule (sem alterações significativas, mas revisada) ---
  const loadTabModule = async (tabId) => {
    // Não carrega se ID for inválido OU se já foi carregado COM SUCESSO antes
    if (!tabId || loadedTabs.has(tabId)) {
      return;
    }
    console.log(
      `[LoadTabModule ${tabId}] Iniciando tentativa de carregamento...`
    );

    // --- MODIFICAÇÃO: Garante que o elemento existe antes de tentar popular ---
    let targetContentEl = view.querySelector(`#${tabId}`);
    if (!targetContentEl) {
      console.warn(
        `[LoadTabModule ${tabId}] Elemento #${tabId} não encontrado no DOM. Tentando criar...`
      );
      if (tabContentContainer) {
        targetContentEl = document.createElement("div");
        targetContentEl.id = tabId;
        targetContentEl.classList.add("tab-content"); // Adiciona a classe esperada
        targetContentEl.style.display = "none"; // Começa escondido
        tabContentContainer.appendChild(targetContentEl);
        console.log(
          `[LoadTabModule ${tabId}] Elemento #${tabId} criado dinamicamente.`
        );
      } else {
        console.error(
          `[LoadTabModule ${tabId}] FALHA CRÍTICA: Não foi possível encontrar ou criar o elemento #${tabId} pois .tab-content PAI não existe.`
        );
        return; // Aborta o carregamento do módulo se não há onde renderizar
      }
    }

    // Mostra spinner apenas se o conteúdo estiver vazio e sem spinner
    if (
      targetContentEl &&
      targetContentEl.innerHTML.trim() === "" &&
      !targetContentEl.querySelector(".loading-spinner")
    ) {
      targetContentEl.innerHTML =
        '<div class="loading-spinner" style="margin: 30px auto;"></div>';
      // Garante que a aba (mesmo carregando) fique visível se for a ativa
      if (targetContentEl.classList.contains("active")) {
        targetContentEl.style.display = "block";
      }
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
        case "alterar-grade": // ABA QUE DAVA ERRO
          module = await import("./alterar-grade.js");
          break;
        // Adicione outros casos conforme necessário
        default:
          console.warn(`[LoadTabModule ${tabId}] Nenhum módulo JS definido.`);
          if (targetContentEl)
            targetContentEl.innerHTML = `<p>Recurso '${tabId}' não possui módulo JS associado.</p>`;
          // Considera como "carregado" para não tentar de novo
          // loadedTabs.add(tabId); // Ou não adiciona, para poder tentar carregar se o código mudar
          return; // Sai da função se não há módulo
      }

      // Remove spinner ANTES de chamar init
      if (targetContentEl) {
        const spinner = targetContentEl.querySelector(".loading-spinner");
        if (spinner) spinner.remove();
      }

      if (module && typeof module.init === "function") {
        console.log(
          `[LoadTabModule ${tabId}] Módulo importado. Chamando init()...`
        );
        await module.init(...initParams); // Chama a inicialização do módulo importado
        console.log(
          `[LoadTabModule ${tabId}] Módulo inicializado com sucesso.`
        );
        loadedTabs.add(tabId); // Adiciona à lista SOMENTE APÓS SUCESSO
      } else {
        console.warn(
          `[LoadTabModule ${tabId}] Módulo importado (${tabId}.js), mas não possui função init() ou ela não é uma função.`
        );
        if (targetContentEl)
          targetContentEl.innerHTML =
            "<p>Erro: Módulo não pode ser inicializado corretamente.</p>";
      }
    } catch (error) {
      console.error(
        `[LoadTabModule ${tabId}] ERRO durante importação ou inicialização do módulo ${tabId}.js:`,
        error
      );
      if (targetContentEl) {
        // Tenta remover o spinner caso ele ainda exista no erro
        const spinner = targetContentEl.querySelector(".loading-spinner");
        if (spinner) spinner.remove();
        targetContentEl.innerHTML = `<p class="alert alert-error" style="color: red; padding: 10px; border: 1px solid red;">Ocorreu um erro grave ao carregar este recurso (${tabId}). Verifique o console.</p>`;
        // Garante que a mensagem de erro seja visível se a aba estiver ativa
        if (targetContentEl.classList.contains("active")) {
          targetContentEl.style.display = "block";
        }
      }
    }
  };

  // --- FUNÇÃO switchTab REESTRUTURADA ---
  const switchTab = (tabId) => {
    console.log(`[SwitchTab] Tentando trocar para aba: ${tabId}`);

    if (!tabContainer || !tabContentContainer) {
      console.error(
        "[SwitchTab] Erro: Container de botões (.tabs-container) ou container de conteúdo (.tab-content) não encontrados."
      );
      return;
    }

    // --- MODIFICAÇÃO: Primeiro, garante a existência do elemento container da aba ---
    let targetContent = tabContentContainer.querySelector(`#${tabId}`);
    if (!targetContent) {
      // Se não existir, tenta criar dinamicamente.
      // Isso assume que o HTML base pode não ter todos os divs.
      console.warn(
        `[SwitchTab] Elemento #${tabId} não encontrado. Tentando criar...`
      );
      targetContent = document.createElement("div");
      targetContent.id = tabId;
      targetContent.classList.add("tab-content"); // Usa a classe correta
      targetContent.style.display = "none"; // Começa escondido
      tabContentContainer.appendChild(targetContent);
      console.log(`[SwitchTab] Elemento #${tabId} criado.`);
    }

    // 1. ATUALIZA BOTÕES (Marca o botão correto como ativo)
    let foundButton = false;
    tabContainer.querySelectorAll(".tab-link").forEach((btn) => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle("active", isActive);
      if (isActive) foundButton = true;
    });
    if (!foundButton)
      console.warn(`[SwitchTab] Botão para aba ${tabId} não encontrado.`);

    // 2. ATUALIZA CONTEÚDO (Esconde todos, mostra o alvo)
    // Seleciona todos os filhos diretos do container pai que são divs de conteúdo
    const allContentSections = tabContentContainer.querySelectorAll(
      ":scope > .tab-content"
    );

    allContentSections.forEach((section) => {
      const isActive = section.id === tabId;
      section.classList.toggle("active", isActive);
      // --- MODIFICAÇÃO: Controla visibilidade diretamente ---
      section.style.display = isActive ? "block" : "none";
    });

    // Verifica se o targetContent (que agora garantidamente existe) foi encontrado entre as seções
    if (!targetContent.classList.contains("active")) {
      console.warn(
        `[SwitchTab] A div de conteúdo #${tabId} foi encontrada/criada, mas não foi ativada corretamente.`
      );
      // Força a ativação visual caso a lógica acima falhe por algum motivo
      targetContent.classList.add("active");
      targetContent.style.display = "block";
    }

    // 3. CARREGA O MÓDULO JS (SE NECESSÁRIO) DEPOIS DE ATIVAR A ABA VISUALMENTE
    // A função loadTabModule interna já verifica se precisa carregar ou não
    console.log(
      `[SwitchTab ${tabId}] Chamando loadTabModule (se necessário)...`
    );
    loadTabModule(tabId).catch((err) => {
      // Captura erros da promise do loadTabModule que podem não ter sido tratados internamente
      console.error(
        `[SwitchTab ${tabId}] Erro não capturado ao tentar carregar o módulo:`,
        err
      );
    });

    console.log(
      `[SwitchTab ${tabId}] Troca visual concluída, carregamento do módulo iniciado (se aplicável).`
    );
  };

  // --- Lógica de Clonagem e Event Listeners (Mantida) ---
  if (tabContainer) {
    const newTabContainer = tabContainer.cloneNode(true);
    if (tabContainer.parentNode) {
      tabContainer.parentNode.replaceChild(newTabContainer, tabContainer);
      tabContainer = newTabContainer; // ATUALIZA a variável
      console.log(
        "[Recursos Init] tabContainer clonado e substituído para limpar listeners antigos."
      );

      tabContainer.addEventListener("click", (e) => {
        const clickedTab = e.target.closest(".tab-link");
        if (clickedTab && clickedTab.dataset.tab) {
          e.preventDefault(); // Previne comportamento padrão do link
          const tabId = clickedTab.dataset.tab;
          const newHash = `#recursos/${tabId}`;
          if (window.location.hash !== newHash) {
            console.log(
              `[Click Listener] Aba ${tabId} clicada. Mudando hash para ${newHash}`
            );
            window.location.hash = newHash; // Dispara o hashchange
          } else {
            console.log(
              `[Click Listener] Aba ${tabId} clicada, mas hash já é ${newHash}. Forçando handleHashChange.`
            );
            // Chama handleHashChange diretamente se o hash não mudou (clique na aba já ativa)
            // Isso garante que o loadTabModule seja chamado caso não tenha carregado ainda
            handleHashChange();
          }
        }
      });
    } else {
      console.error(
        "[Recursos Init] Erro: Pai do tabContainer não encontrado durante clonagem."
      );
      tabContainer = null; // Invalida tabContainer se a clonagem falhar
    }
  } else {
    console.warn(
      "[Recursos Init] .tabs-container não encontrado inicialmente."
    );
  }

  // --- handleHashChange (Ajustado para simplificar) ---
  const handleHashChange = () => {
    console.log(`[HashChange] Hash atual: ${window.location.hash}`);
    const hashParts = window.location.hash.substring(1).split("/");
    let targetTabId = "disponibilidade"; // Aba padrão

    // Verifica se o hash é do tipo #recursos/nome-da-aba
    if (hashParts[0] === "recursos" && hashParts[1]) {
      // Verifica se existe um BOTÃO correspondente a essa aba
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
          `[HashChange] Botão para aba "${hashParts[1]}" (do hash) não encontrado. Usando padrão '${targetTabId}'.`
        );
        // Opcional: Atualizar o hash para refletir a aba padrão sendo mostrada
        // window.history.replaceState(null, '', `#recursos/${targetTabId}`);
      }
    } else {
      console.log(
        `[HashChange] Hash não corresponde a '#recursos/[aba]'. Usando padrão '${targetTabId}'.`
      );
      // Opcional: Atualizar o hash para refletir a aba padrão sendo mostrada
      // window.history.replaceState(null, '', `#recursos/${targetTabId}`);
    }

    // Chama switchTab para ativar a aba (visualmente) e disparar o carregamento do módulo (se necessário)
    switchTab(targetTabId);
  };

  // Listener para quando o hash na URL muda
  window.addEventListener("hashchange", handleHashChange);

  // --- MODIFICAÇÃO: Chama handleHashChange diretamente (ou com timeout mínimo) na inicialização ---
  console.log(
    "[Recursos Init] Chamando handleHashChange para carregar aba inicial."
  );
  // Usar setTimeout 0 pode ajudar a garantir que o DOM esteja totalmente pronto
  // antes da primeira execução, mas 50ms é geralmente seguro.
  // Se ainda houver problemas, tente aumentar ligeiramente ou chamar diretamente.
  setTimeout(handleHashChange, 0); // Ajustado para 0 para tentar executar o mais rápido possível após o fluxo atual

  console.log(
    "[Recursos Init] Inicialização concluída. Aguardando hashchange ou cliques."
  );
} // Fim da função init
