// Arquivo: /modulos/voluntario/js/recursos.js
// Versão 3.1 (Híbrida: Estrutura V3.0 + Importação Dinâmica V1)
// Esta versão irá carregar a página e conter erros DENTRO de cada aba,
// em vez de quebrar a página inteira.

export function init(user, userData) {
  console.log("[Recursos Init V3.1] Módulo Iniciado (Padrão Dinâmico).");
  const view = document.querySelector(".view-container");
  if (!view) {
    console.error(
      "[Recursos Init] Erro Fatal: .view-container não encontrado."
    );
    return;
  }

  let tabContainer = view.querySelector(".tabs-container"); // Container dos botões/links // O HTML V2 tem um container pai <div class="tab-content"> que envolve todas as seções
  const tabContentContainer = view.querySelector(".tab-content"); // Container PAI dos conteúdos

  if (!tabContainer) {
    console.error("[Recursos Init] Erro: .tabs-container não encontrado.");
  }
  if (!tabContentContainer) {
    console.error(
      "[Recursos Init] Erro CRÍTICO: Container PAI .tab-content não encontrado. As abas não funcionarão."
    );
    return;
  } // Guarda os IDs das abas cujo JS já foi inicializado com sucesso

  const initializedTabs = new Set(); // --- FUNÇÃO initializeTabScript (MODIFICADA) --- // Responsável por carregar e chamar a função init do módulo da aba, apenas uma vez.

  const initializeTabScript = async (tabId) => {
    // Não inicializa se ID for inválido OU se já foi inicializado com SUCESSO antes
    if (!tabId || initializedTabs.has(tabId)) {
      return;
    }
    console.log(
      `[InitializeTab ${tabId}] Tentando carregar e inicializar script...`
    ); // Busca o elemento de conteúdo da aba (ex: <div id="disponibilidade">)

    const targetContentEl = tabContentContainer.querySelector(`#${tabId}`);

    if (!targetContentEl) {
      console.error(
        `[InitializeTab ${tabId}] ERRO CRÍTICO: Elemento de conteúdo #${tabId} NÃO encontrado no HTML.`
      );
      return; // Não pode inicializar sem o container
    }

    // Mostra o spinner de "Carregando..." que está no HTML
    let spinner = targetContentEl.querySelector(".loading-spinner");
    if (
      (targetContentEl.innerHTML.trim() === "" ||
        targetContentEl.textContent.includes("Carregando")) &&
      !spinner
    ) {
      // Se não houver spinner, limpa o texto "Carregando..." e adiciona um
      targetContentEl.innerHTML =
        '<div class="loading-spinner" style="margin: 30px auto; display: block;"></div>';
      spinner = targetContentEl.querySelector(".loading-spinner");
    } else if (spinner) {
      // Se o spinner já existe no HTML, apenas o exibe
      spinner.style.display = "block";
    }

    // Lógica de importação dinâmica (como na V1)
    // Isso é envolvido em um try...catch para que um erro
    // em um "disponibilidade.js" não quebre o "recursos.js"
    try {
      let module;
      let initParams = [user, userData];

      // Mapeamento dinâmico: decide qual arquivo importar baseado no ID da aba
      switch (tabId) {
        case "disponibilidade":
          module = await import("./disponibilidade.js");
          break;
        case "grade-online":
          module = await import("./grade-view.js");
          initParams.push("online"); // Adiciona o parâmetro extra
          break;
        case "grade-presencial":
          module = await import("./grade-view.js");
          initParams.push("presencial"); // Adiciona o parâmetro extra
          break;
        case "alterar-grade":
          module = await import("./alterar-grade.js");
          break;
        default:
          // Caso a aba (tabId) não precise de um script JS
          console.warn(
            `[InitializeTab ${tabId}] Nenhum módulo JS mapeado para esta aba.`
          );
          if (spinner) spinner.remove(); // Remove o spinner
          // Limpa o texto "Carregando..." se houver
          if (targetContentEl.textContent.includes("Carregando")) {
            targetContentEl.innerHTML = `<p>Recurso não configurado.</p>`;
          }
          return; // Encerra a função
      }

      // Se o módulo foi carregado com sucesso e tem a função "init", execute-a
      if (module && typeof module.init === "function") {
        console.log(`[InitializeTab ${tabId}] Chamando init() do módulo...`);
        await module.init(...initParams); // Chama a função init do módulo
        console.log(
          `[InitializeTab ${tabId}] Script inicializado com sucesso.`
        );
        initializedTabs.add(tabId); // Marca como inicializado SOMENTE após sucesso

        // Remove o spinner APÓS a inicialização bem-sucedida
        if (spinner && spinner.parentNode) {
          spinner.remove();
        } else if (targetContentEl.querySelector(".loading-spinner")) {
          // Garante que qualquer outro spinner seja removido
          targetContentEl.querySelector(".loading-spinner").remove();
        }
      } else {
        // O arquivo JS foi carregado, mas não tem a função "init"
        console.warn(
          `[InitializeTab ${tabId}] Módulo carregado, mas não possui a função init().`
        );
        if (spinner) spinner.remove();
      }
    } catch (error) {
      // --- PONTO CRUCIAL ---
      // Se a importação falhar (ex: erro 404 no fetch do disponibilidade.js)
      // o erro é capturado aqui, e não quebra a página inteira.
      console.error(
        `[InitializeTab ${tabId}] ERRO CRÍTICO ao importar ou inicializar o módulo:`,
        error
      );
      if (targetContentEl) {
        // Limpa o "Carregando..." e o spinner
        const errorSpinner = targetContentEl.querySelector(".loading-spinner");
        if (errorSpinner) errorSpinner.remove();

        const pCarregando = targetContentEl.querySelector("p");
        if (pCarregando && pCarregando.textContent.includes("Carregando")) {
          pCarregando.remove();
        }

        // Mostra uma mensagem de erro dentro da aba
        targetContentEl.innerHTML = `<p class="alert alert-error" style="color: red; padding: 10px; border: 1px solid red;">Ocorreu um erro grave ao carregar este recurso (${tabId}).</p>`;
      }
    }
  }; // --- FIM DA FUNÇÃO initializeTabScript --- // --- FUNÇÃO switchTab --- // Apenas gerencia a visibilidade (CSS) e chama a inicialização do script

  const switchTab = (tabId) => {
    console.log(`[SwitchTab V3.1] Tentando trocar para aba: ${tabId}`);

    if (!tabContainer || !tabContentContainer) {
      console.error(
        "[SwitchTab] Erro: Container de botões ou de conteúdo não encontrados."
      );
      return;
    }

    // Encontra o elemento de conteúdo da aba alvo
    const targetContent = tabContentContainer.querySelector(`#${tabId}`); // --- VERIFICAÇÃO ESSENCIAL ---

    if (!targetContent) {
      console.error(
        `[SwitchTab] Erro CRÍTICO: Conteúdo da aba #${tabId} não encontrado no DOM. Verifique o HTML.`
      ); // Tenta voltar para a aba padrão se a alvo não existe
      const defaultTabId = "disponibilidade"; // Aba padrão do HTML V2
      if (
        tabId !== defaultTabId &&
        tabContentContainer.querySelector(`#${defaultTabId}`)
      ) {
        console.warn(
          `[SwitchTab] Redirecionando para aba padrão '${defaultTabId}'.`
        );
        // Força a mudança do hash, que disparará o handleHashChange novamente
        window.location.hash = `#recursos/${defaultTabId}`;
      } else {
        console.error("[SwitchTab] Aba padrão também não encontrada!");
      }
      return; // Não continua se o conteúdo alvo não existe
    } // 1. ATUALIZA BOTÕES (Adiciona/Remove classe "active" dos botões)

    let foundButton = false;
    tabContainer.querySelectorAll(".tab-link").forEach((btn) => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle("active", isActive);
      if (isActive) foundButton = true;
    });
    if (!foundButton)
      console.warn(`[SwitchTab] Botão para aba ${tabId} não encontrado.`); // 2. ATUALIZA CONTEÚDO (Adiciona/Remove classe "active" e muda o display)

    // Pega todos os filhos diretos do container pai que são .tab-content
    const allContentSections = tabContentContainer.querySelectorAll(
      ":scope > .tab-content"
    );
    let foundContent = false;
    allContentSections.forEach((section) => {
      const isActive = section.id === tabId;
      section.classList.toggle("active", isActive);
      section.style.display = isActive ? "block" : "none"; // Controle direto de display
      if (isActive) foundContent = true;
    });

    if (!foundContent) {
      // Isso é uma segurança, caso a estrutura do HTML V2 mude
      console.error(
        `[SwitchTab] Div de conteúdo #${tabId} não encontrada entre os filhos do container.`
      );
      targetContent.classList.add("active");
      targetContent.style.display = "block";
    } // 3. CHAMA A INICIALIZAÇÃO DO SCRIPT DA ABA (se necessário) // A função interna `initializeTabScript` verifica se já foi inicializada.

    console.log(
      `[SwitchTab ${tabId}] Chamando initializeTabScript (se necessário)...`
    );
    initializeTabScript(tabId); // Não precisa de await, pode inicializar em background

    console.log(`[SwitchTab ${tabId}] Troca visual concluída.`);
  }; // --- Lógica de Clonagem e Event Listeners (Mantida) --- // Isso garante que não haja listeners duplicados se o init() for chamado mais de uma vez

  if (tabContainer) {
    const newTabContainer = tabContainer.cloneNode(true); // Clona os botões
    if (tabContainer.parentNode) {
      tabContainer.parentNode.replaceChild(newTabContainer, tabContainer); // Substitui o antigo pelo novo
      tabContainer = newTabContainer; // Atualiza a variável para apontar para o novo container
      console.log("[Recursos Init] tabContainer clonado e substituído.");

      // Adiciona o listener de clique no container clonado
      tabContainer.addEventListener("click", (e) => {
        const clickedTab = e.target.closest(".tab-link"); // Acha o botão clicado
        if (clickedTab && clickedTab.dataset.tab) {
          e.preventDefault(); // Previne comportamento padrão
          const tabId = clickedTab.dataset.tab;
          const newHash = `#recursos/${tabId}`;
          if (window.location.hash !== newHash) {
            console.log(
              `[Click Listener] Aba ${tabId} clicada. Mudando hash para ${newHash}`
            );
            window.location.hash = newHash; // Muda o hash (isso dispara o 'hashchange')
          } else {
            console.log(
              `[Click Listener] Aba ${tabId} clicada, hash já é ${newHash}. Forçando inicialização (se pendente).`
            ); // Se clicar na aba que já está ativa, garante que o script tente inicializar
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
  } else {
    console.warn(
      "[Recursos Init] .tabs-container (botões das abas) não encontrado."
    );
  }

  // --- handleHashChange (Função que lê a URL e decide qual aba mostrar) ---

  // Declara a função no escopo
  const handleHashChange = () => {
    console.log(`[HashChange V3.1] Hash atual: ${window.location.hash}`);
    const hashParts = window.location.hash.substring(1).split("/"); // Ex: #recursos/disponibilidade -> ["recursos", "disponibilidade"]
    // Aba padrão do HTML V2
    let targetTabId = "disponibilidade";

    if (hashParts[0] === "recursos" && hashParts[1]) {
      const hashTabId = hashParts[1]; // Ex: "disponibilidade" // Verifica se existe um BOTÃO e um CONTEÚDO para a aba na URL
      if (
        tabContainer &&
        tabContainer.querySelector(`.tab-link[data-tab="${hashTabId}"]`) &&
        tabContentContainer &&
        tabContentContainer.querySelector(`#${hashTabId}`)
      ) {
        // Se a aba da URL existir, ela se torna o alvo
        targetTabId = hashTabId;
        console.log(
          `[HashChange] Hash aponta para aba existente: ${targetTabId}`
        );
      } else {
        // Se a aba da URL não existir, usa a padrão
        console.warn(
          `[HashChange] Aba "${hashTabId}" (do hash) não encontrada no HTML. Usando padrão '${targetTabId}'.`
        );
        // Corrige a URL para refletir a aba padrão
        if (window.location.hash !== `#recursos/${targetTabId}`) {
          window.history.replaceState(null, "", `#recursos/${targetTabId}`);
        }
      }
    } else {
      // Se o hash não for "#recursos/algo", usa a padrão
      console.log(
        `[HashChange] Hash não corresponde a '#recursos/[aba]'. Usando padrão '${targetTabId}'.`
      );
      // Define o hash padrão na URL
      if (window.location.hash !== `#recursos/${targetTabId}`) {
        window.history.replaceState(null, "", `#recursos/${targetTabId}`);
      }
    } // Chama a função que efetivamente muda a aba (visual) e carrega o script

    switchTab(targetTabId);
  };

  // Remove qualquer listener antigo de 'hashchange' para evitar duplicidade
  window.removeEventListener("hashchange", handleHashChange); // Adiciona o listener para quando o hash na URL muda
  window.addEventListener("hashchange", handleHashChange); // --- INICIALIZAÇÃO ---

  console.log(
    "[Recursos Init] Chamando handleHashChange para carregar aba inicial."
  ); // Chama a função pela primeira vez (após um pequeno atraso)

  // O timeout dá tempo para o navegador renderizar o HTML da view
  // antes que os scripts tentem encontrar seus elementos (ex: #disponibilidade-container)
  setTimeout(handleHashChange, 100);

  console.log("[Recursos Init] Inicialização V3.1 concluída.");
} // Fim da função init
