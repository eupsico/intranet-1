// Arquivo: /modulos/voluntario/js/detalhe-paciente.js
// Responsável por orquestrar a inicialização da página de detalhes do paciente.
// *** ALTERAÇÕES: Lógica modularizada na pasta 'detalhes-paciente/' ***

import * as estado from "./detalhes-paciente/estado.js";
import * as carregador from "./detalhes-paciente/carregador-dados.js";
import * as interfaceUI from "./detalhes-paciente/interface.js";
import * as eventos from "./detalhes-paciente/configurar-eventos.js";

// --- Inicialização da Página ---
export async function init(user, userData, pacienteId) {
  console.log("Inicializando detalhe-paciente.js (Controlador)");
  const viewContainer = document.getElementById("detalhe-paciente-view"); // Container principal da view

  // Mostra um loading inicial (opcional, mas bom para UX)
  if (viewContainer)
    viewContainer.innerHTML =
      '<div class="loading-spinner"></div> Carregando dados do paciente...';

  estado.setUserDataGlobal(userData); // Armazena dados do usuário logado // Valida e define o ID do paciente

  let id = pacienteId;
  if (!id) {
    console.error("ID do paciente não foi passado para a função init.");
    const urlParams = new URLSearchParams(window.location.search);
    id = urlParams.get("id");
    if (!id) {
      const errorMsg =
        '<p class="alert alert-error">Erro: ID do paciente não fornecido.</p>';
      if (viewContainer) viewContainer.innerHTML = errorMsg;
      else console.error(errorMsg); // Fallback se o container não existir
      return;
    }
    console.warn("ID do paciente obtido da URL como fallback:", id);
  }
  estado.setPacienteIdGlobal(id);

  try {
    // Carregar dados essenciais em paralelo
    await Promise.all([
      carregador.carregarDadosPaciente(estado.pacienteIdGlobal),
      carregador.carregarSystemConfigs(), // Carrega configs, salas e grade
    ]);

    if (!estado.pacienteDataGlobal) {
      console.error(
        ">>> Dados do paciente NULOS antes de preencher formulários."
      );
      throw new Error("Paciente não encontrado no banco de dados.");
    } // Preenche os formulários com os dados carregados

    // --- Renderização Inicial da UI ---
    // (Assumindo que o HTML base da página já existe e só precisa ser preenchido)
    // Se a view inteira fosse carregada dinamicamente, seria feito aqui.

    // Esconde o loading inicial (se houver) - Adicione ID ao seu elemento de loading se necessário
    // const initialLoading = document.getElementById('initial-page-loading');
    // if (initialLoading) initialLoading.style.display = 'none';

    interfaceUI.preencherFormularios();

    // Atualiza quais botões de ação devem estar visíveis
    interfaceUI.atualizarVisibilidadeBotoesAcao(
      estado.pacienteDataGlobal.status
    ); // Carrega as sessões (isso atualiza o estado.sessoesCarregadas)

    await carregador.carregarSessoes();

    // Renderiza a lista de sessões e as pendências AGORA que os dados foram carregados
    interfaceUI.renderizarSessoes(); // Usa estado.sessoesCarregadas
    interfaceUI.renderizarPendencias(); // Usa estado.pacienteDataGlobal e estado.sessoesCarregadas // --- Adicionar Event Listeners ---

    // Adiciona todos os listeners para formulários, botões, modais, etc.
    eventos.adicionarEventListenersGerais();
    eventos.adicionarEventListenersModais();

    console.log("Página de detalhes do paciente inicializada com sucesso.");
  } catch (error) {
    console.error(
      "Erro fatal ao inicializar página de detalhes do paciente:",
      error
    );
    const errorMsg = `<p class="alert alert-error">Erro ao carregar dados do paciente: ${error.message}</p>`;
    if (viewContainer)
      viewContainer.innerHTML = errorMsg; // Exibe erro no container principal
    else console.error(errorMsg);
  }
}
