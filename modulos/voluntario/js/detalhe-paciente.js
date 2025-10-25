// Arquivo: modulos/voluntario/js/detalhe-paciente.js
// Controlador principal para a página de detalhes do paciente.
// Versão: Corrigida (UI updates fora do rAF inicial)

// Importações de Módulos
import * as estado from "./detalhes-paciente/estado.js";
import * as carregador from "./detalhes-paciente/carregador-dados.js";
import * as interfaceUI from "./detalhes-paciente/interface.js";
import * as eventos from "./detalhes-paciente/configurar-eventos.js";
import { showLoading, hideLoading } from "../../../assets/js/app.js"; // Para feedback visual

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
  estado.resetEstado();

  // 2. Armazenar dados essenciais no estado
  estado.setUserDataGlobal(userData);
  estado.setUserGlobal(user);

  // 3. Carregar Dados e Configurar UI
  try {
    showLoading(); // Mostra feedback visual de carregamento

    console.log("Iniciando carregamento de dados essenciais...");
    await carregador.carregarDadosEssenciais(pacienteId);
    console.log("Dados essenciais carregados.");

    // --- CORREÇÃO APLICADA ---
    // A função 'init' já é chamada dentro de um setTimeout(0) pelo portal-voluntario.js (v4.3),
    // o que deve dar tempo suficiente para o DOM ser construído antes destas chamadas.
    // Removemos o requestAnimationFrame problemático daqui.

    console.log("Configurando UI e Listeners...");

    // Preenche os formulários com os dados carregados
    console.log("Chamando preencherFormularios...");
    interfaceUI.preencherFormularios(); // Deve encontrar os elementos agora

    // Atualiza a visibilidade dos botões com base no status
    console.log("Chamando atualizarVisibilidadeBotoesAcao...");
    interfaceUI.atualizarVisibilidadeBotoesAcao(
      estado.pacienteDataGlobal?.status
    );

    // Carrega e renderiza as sessões e pendências
    console.log("Chamando carregarSessoes...");
    await carregador.carregarSessoes(pacienteId); // Carrega dados das sessões
    console.log("Sessões carregadas. Renderizando...");
    interfaceUI.renderizarSessoes(); // Desenha a lista de sessões
    interfaceUI.renderizarPendencias(); // Desenha a lista de pendências
    console.log("Sessões e Pendências renderizadas.");

    // Adiciona todos os event listeners necessários
    console.log("Chamando adicionarEventListeners...");
    eventos.adicionarEventListeners();
    console.log("Event listeners adicionados.");

    console.log("Página de detalhes do paciente inicializada com sucesso.");
    // --- FIM DA CORREÇÃO ---
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
    hideLoading(); // Esconde o feedback visual, aconteça o que acontecer
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
