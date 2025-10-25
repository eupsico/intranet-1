// Arquivo: modulos/voluntario/js/detalhe-paciente.js
// Controlador principal para a página de detalhes do paciente.
// Versão: Corrigida (Chamadas corretas para carregador-dados.js)

// Importações de Módulos
import * as estado from "./detalhes-paciente/estado.js";
import * as carregador from "./detalhes-paciente/carregador-dados.js";
import * as interfaceUI from "./detalhes-paciente/interface.js";
import * as eventos from "./detalhes-paciente/configurar-eventos.js";
// Funções de loading foram removidas na correção anterior

// Inicialização e Orquestração
// =============================================================================

/**
 * Função principal de inicialização da view de detalhes do paciente.
 * Chamada pelo roteador (portal-voluntario.js) quando a view é carregada.
 * @param {object} user - Objeto do usuário autenticado (Firebase Auth).
 * @param {object} userData - Dados do usuário do Firestore.
 * @param {string} pacienteId - O ID do paciente a ser carregado.
 */
export async function init(user, userData, pacienteId) {
  console.log("Inicializando detalhe-paciente.js (Controlador)");

  // 1. Resetar o estado global específico desta página
  estado.resetEstado(); // Chamada corrigida na etapa anterior

  // 2. Armazenar dados essenciais no estado
  estado.setUserDataGlobal(userData);
  estado.setUserGlobal(user);
  // Armazena o ID do paciente também, pois carregador.carregarSessoes() pode precisar
  estado.setPacienteIdGlobal(pacienteId);

  // 3. Carregar Dados e Configurar UI
  try {
    // showLoading(); // Removido

    console.log("Iniciando carregamento de dados essenciais...");

    // --- CORREÇÃO APLICADA ---
    // Chamar as funções de carregamento corretas do módulo 'carregador'
    await carregador.carregarDadosPaciente(pacienteId); // Carrega dados do paciente
    await carregador.carregarSystemConfigs(); // Carrega configs e grade
    // --- FIM DA CORREÇÃO ---

    // Verifica se o paciente foi realmente carregado antes de continuar
    if (!estado.pacienteDataGlobal) {
      throw new Error(
        `Paciente com ID ${pacienteId} não encontrado ou falha ao carregar.`
      );
    }

    console.log("Dados essenciais carregados.");

    console.log("Configurando UI e Listeners...");

    // Preenche os formulários com os dados carregados
    console.log("Chamando preencherFormularios...");
    interfaceUI.preencherFormularios();

    // Atualiza a visibilidade dos botões com base no status
    console.log("Chamando atualizarVisibilidadeBotoesAcao...");
    interfaceUI.atualizarVisibilidadeBotoesAcao(
      estado.pacienteDataGlobal?.status
    );

    // Carrega e renderiza as sessões e pendências
    console.log("Chamando carregarSessoes...");
    // A função carregarSessoes usa estado.pacienteIdGlobal internamente
    await carregador.carregarSessoes(); // Carrega dados das sessões
    console.log("Sessões carregadas. Renderizando...");
    interfaceUI.renderizarSessoes(); // Desenha a lista de sessões
    interfaceUI.renderizarPendencias(); // Desenha a lista de pendências
    console.log("Sessões e Pendências renderizadas.");

    // Adiciona todos os event listeners necessários
    console.log("Chamando adicionarEventListeners...");
    eventos.adicionarEventListeners();
    console.log("Event listeners adicionados.");

    console.log("Página de detalhes do paciente inicializada com sucesso.");
  } catch (error) {
    console.error(
      "Erro fatal durante a inicialização de detalhe-paciente:",
      error
    );
    // Mostrar mensagem de erro para o usuário na UI
    const contentArea = document.getElementById("content-area");
    if (contentArea) {
      contentArea.innerHTML = `<div class="view-container"><p class="alert alert-error">Erro ao carregar os dados do paciente. Tente novamente mais tarde.</p><p><small>${error.message}</small></p></div>`;
    }
  } finally {
    // hideLoading(); // Removido
    console.log("Inicialização de detalhe-paciente finalizada.");
  }
}

// =============================================================================
// Funções Adicionais (se necessário, como limpeza ao sair da view)
// =============================================================================

/**
 * Função opcional para limpar event listeners ou estados quando o usuário
 * navega para fora desta view. Pode ser chamada pelo roteador se necessário.
 */
export function cleanup() {
  console.log("Limpando detalhe-paciente.js...");
  // Remover event listeners específicos desta página para evitar memory leaks
  // eventos.removerEventListeners(); // (Implementar essa função em configurar-eventos.js se necessário)
  estado.resetEstado(); // Limpa os dados do estado global
}
