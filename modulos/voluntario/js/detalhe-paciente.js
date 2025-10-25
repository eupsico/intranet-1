// Arquivo: /modulos/voluntario/js/detalhe-paciente.js
// Responsável por orquestrar a inicialização da página de detalhes do paciente.
// *** ALTERAÇÕES: Lógica modularizada na pasta 'detalhes-paciente/' e uso de requestAnimationFrame ***

import * as estado from "./detalhes-paciente/estado.js";
import * as carregador from "./detalhes-paciente/carregador-dados.js";
import * as interfaceUI from "./detalhes-paciente/interface.js";
import * as eventos from "./detalhes-paciente/configurar-eventos.js";

// --- Inicialização da Página ---
export async function init(user, userData, pacienteId) {
  console.log("Inicializando detalhe-paciente.js (Controlador)");
  const viewContainer = document.getElementById("detalhe-paciente-view"); // Container principal da view

  // Mostra um loading inicial
  if (viewContainer) {
    viewContainer.innerHTML =
      '<div class="loading-spinner"></div> Carregando dados do paciente...';
  } else {
    console.error(
      "Erro Crítico: Container da view #detalhe-paciente-view não encontrado no DOM inicial."
    );
    // Se o container principal não existe, não há onde renderizar nada.
    return;
  }

  estado.setUserDataGlobal(userData); // Armazena dados do usuário logado

  // Valida e define o ID do paciente
  let id = pacienteId;
  if (!id) {
    console.warn(
      "ID do paciente não foi passado diretamente para init(). Tentando obter da URL."
    );
    const urlParams = new URLSearchParams(window.location.search);
    id = urlParams.get("id");
    if (!id) {
      // Se ainda não tem ID, exibe erro e para a execução
      const errorMsg =
        '<p class="alert alert-error">Erro: ID do paciente não fornecido na URL.</p>';
      if (viewContainer) viewContainer.innerHTML = errorMsg;
      else console.error(errorMsg); // Fallback se o container sumir
      return; // Interrompe a função init
    }
    console.log("ID do paciente obtido da URL:", id);
  }
  estado.setPacienteIdGlobal(id);

  try {
    // Carrega dados essenciais PRIMEIRO (paciente e configurações/grade)
    console.log("Iniciando carregamento de dados essenciais...");
    await Promise.all([
      carregador.carregarDadosPaciente(estado.pacienteIdGlobal),
      carregador.carregarSystemConfigs(), // Carrega configs, salas e grade
    ]);
    console.log("Dados essenciais carregados.");

    // Verifica se os dados do paciente foram carregados com sucesso
    if (!estado.pacienteDataGlobal) {
      // Se o paciente não foi encontrado, joga um erro específico
      throw new Error(
        `Paciente com ID ${estado.pacienteIdGlobal} não encontrado no banco de dados.`
      );
    }

    // --- AGUARDA O PRÓXIMO FRAME PARA MANIPULAR O DOM ---
    // Isso é crucial porque o HTML da view foi inserido por innerHTML
    // na função loadView, e o navegador precisa de um ciclo para processá-lo.
    console.log(
      "Solicitando próximo frame de animação para renderizar UI e adicionar listeners..."
    );
    requestAnimationFrame(async () => {
      // Este bloco de código será executado logo antes da próxima repintura do navegador
      console.log(
        "[RAF] Frame iniciado. Tentando configurar UI e Listeners..."
      );
      try {
        // Nova verificação: Garante que o container da view ainda está presente
        if (!document.getElementById("detalhe-paciente-view")) {
          console.error(
            "[RAF] Container #detalhe-paciente-view desapareceu antes da renderização da UI."
          );
          return; // Impede a continuação se o container sumiu
        }

        // 1. Preenche os formulários com os dados do paciente (já carregados no 'estado')
        console.log("[RAF] Chamando preencherFormularios...");
        interfaceUI.preencherFormularios();

        // 2. Atualiza a visibilidade dos botões de ação com base no status do paciente
        console.log("[RAF] Chamando atualizarVisibilidadeBotoesAcao...");
        interfaceUI.atualizarVisibilidadeBotoesAcao(
          estado.pacienteDataGlobal.status
        );

        // 3. Carrega os dados das sessões (requer outra chamada ao Firestore)
        console.log("[RAF] Chamando carregarSessoes...");
        await carregador.carregarSessoes(); // Atualiza estado.sessoesCarregadas
        console.log("[RAF] Sessões carregadas. Renderizando...");

        // 4. Renderiza a lista de sessões e as pendências na UI
        interfaceUI.renderizarSessoes(); // Usa estado.sessoesCarregadas
        interfaceUI.renderizarPendencias(); // Usa dados do paciente e sessões carregadas
        console.log("[RAF] Sessões e Pendências renderizadas.");

        // 5. Adiciona os event listeners aos elementos HTML que agora devem existir no DOM
        console.log("[RAF] Chamando adicionarEventListeners...");
        eventos.adicionarEventListenersGerais();
        eventos.adicionarEventListenersModais();
        console.log("[RAF] Event listeners adicionados.");

        console.log(
          "Página de detalhes do paciente inicializada com sucesso (dentro do requestAnimationFrame)."
        );
      } catch (uiError) {
        // Captura erros que podem ocorrer durante a manipulação da UI ou adição de listeners
        console.error(
          "[RAF] Erro durante a inicialização da UI ou Listeners:",
          uiError
        );
        if (viewContainer) {
          // Adiciona a mensagem de erro ao container, tentando preservar o que já foi renderizado
          viewContainer.innerHTML += `<p class="alert alert-error" style="margin-top: 20px;">Erro ao configurar a interface: ${uiError.message}</p>`;
        }
      }
    }); // Fim do requestAnimationFrame
  } catch (dataLoadError) {
    // Captura erros que ocorrem DURANTE o carregamento inicial dos dados (antes do RAF)
    // Ex: Paciente não encontrado, erro ao carregar configs, erro de permissão Firestore
    console.error(
      "Erro fatal durante o carregamento inicial de dados (Paciente/Configs):",
      dataLoadError
    );
    // Exibe a mensagem de erro diretamente no container da view, substituindo o loading
    const errorMsg = `<p class="alert alert-error">Erro Crítico ao carregar dados essenciais do paciente: ${dataLoadError.message}</p>`;
    if (viewContainer) viewContainer.innerHTML = errorMsg;
    else console.error(errorMsg); // Fallback se o container sumir
  }
} // Fim da função init
