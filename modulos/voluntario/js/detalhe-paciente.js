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
  estado.setUserDataGlobal(userData); // Armazena dados do usuário logado // Valida e define o ID do paciente

  let id = pacienteId;
  if (!id) {
    console.error("ID do paciente não foi passado para a função init.");
    const urlParams = new URLSearchParams(window.location.search);
    id = urlParams.get("id");
    if (!id) {
      document.getElementById("detalhe-paciente-view").innerHTML =
        '<p class="alert alert-error">Erro: ID do paciente não fornecido.</p>';
      return;
    }
    console.warn("ID do paciente obtido da URL como fallback:", id);
  }
  estado.setPacienteIdGlobal(id);

  try {
    // Carregar dados essenciais em paralelo
    // Note que carregarSystemConfigs agora também carrega a grade internamente
    await Promise.all([
      carregador.carregarDadosPaciente(estado.pacienteIdGlobal),
      carregador.carregarSystemConfigs(),
    ]);

    if (!estado.pacienteDataGlobal) {
      throw new Error("Paciente não encontrado no banco de dados.");
    } // --- Popular a interface --- // (Estas funções serão movidas para interface.js no próximo passo) // Por enquanto, vamos assumir que elas existem globalmente ou serão importadas // preencherFormularios(); // atualizarVisibilidadeBotoesAcao(estado.pacienteDataGlobal.status); // Carregar sessões e pendências

    await carregador.carregarSessoes(); // Precisa carregar antes de checar pendências // renderizarPendencias(); // Será movida para interface.js // --- Adicionar Event Listeners --- // (Estas funções serão movidas para configurar-eventos.js no próximo passo) // adicionarEventListenersGerais(); // adicionarEventListenersModais(); // --- PLACEHOLDERS PARA AS PRÓXIMAS ETAPAS --- // Chamadas às funções que estarão em interface.js e configurar-eventos.js // Aguardando a criação desses módulos para descomentar e ajustar as chamadas
    console.warn(
      "Aguardando módulos interface.js e configurar-eventos.js para completar a inicialização da UI e eventos."
    );
  } catch (error) {
    console.error("Erro ao inicializar página de detalhes do paciente:", error);
    document.getElementById(
      "detalhe-paciente-view"
    ).innerHTML = `<p class="alert alert-error">Erro ao carregar dados do paciente: ${error.message}</p>`;
  }
}

// TODO: Remover as funções que serão movidas para os outros módulos (preencherFormularios, carregarSessoes, etc.)
// A função init acima será ajustada para chamar as funções importadas dos módulos corretos (ui, listeners)
// quando estes forem criados.
