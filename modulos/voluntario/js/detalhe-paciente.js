// Arquivo: /modulos/voluntario/js/detalhe-paciente.js
import * as estado from "./detalhes-paciente/estado.js";
import * as carregador from "./detalhes-paciente/carregador-dados.js";
import * as interfaceUI from "./detalhes-paciente/interface.js";
import * as eventos from "./detalhes-paciente/configurar-eventos.js";

export async function init(user, userData, pacienteId) {
  console.log("Inicializando detalhe-paciente.js (Controlador)");
  const viewContainer = document.getElementById("detalhe-paciente-view");

  if (viewContainer)
    viewContainer.innerHTML =
      '<div class="loading-spinner"></div> Carregando dados do paciente...';

  estado.setUserDataGlobal(userData);

  let id = pacienteId;
  if (!id) {
    // ... (lógica para pegar ID da URL mantida) ...
    if (!id) {
      const errorMsg =
        '<p class="alert alert-error">Erro: ID do paciente não fornecido.</p>';
      if (viewContainer) viewContainer.innerHTML = errorMsg;
      else console.error(errorMsg);
      return;
    }
  }
  estado.setPacienteIdGlobal(id);

  try {
    // Carrega dados PRIMEIRO
    await Promise.all([
      carregador.carregarDadosPaciente(estado.pacienteIdGlobal),
      carregador.carregarSystemConfigs(),
    ]);

    if (!estado.pacienteDataGlobal) {
      throw new Error("Paciente não encontrado no banco de dados.");
    }

    // --- AGORA QUE OS DADOS FORAM CARREGADOS, ESPERE UM POUCO APÓS INSERIR O HTML ---
    // (Esta função assume que o HTML base JÁ FOI INSERIDO pelo portal-voluntario.js)
    // Vamos garantir que o navegador "respire" antes de tentar manipular o DOM

    // Usamos requestAnimationFrame para esperar o próximo ciclo de pintura do navegador
    requestAnimationFrame(async () => {
      try {
        console.log("DOM potencialmente pronto, executando UI e Listeners...");

        // Preenche os formulários
        interfaceUI.preencherFormularios();

        // Atualiza botões
        interfaceUI.atualizarVisibilidadeBotoesAcao(
          estado.pacienteDataGlobal.status
        );

        // Carrega e Renderiza Sessões/Pendências (precisa rodar após preencherFormularios?)
        await carregador.carregarSessoes();
        interfaceUI.renderizarSessoes();
        interfaceUI.renderizarPendencias(); // Tenta renderizar pendências aqui

        // Adiciona Event Listeners AOS ELEMENTOS QUE AGORA DEVEM EXISTIR
        eventos.adicionarEventListenersGerais();
        eventos.adicionarEventListenersModais();

        console.log(
          "Página de detalhes do paciente inicializada com sucesso (após RAF)."
        );
      } catch (uiError) {
        console.error(
          "Erro durante a inicialização da UI ou Listeners:",
          uiError
        );
        if (viewContainer) {
          // Mostra erro na UI se falhar nesta fase
          viewContainer.innerHTML += `<p class="alert alert-error">Erro ao configurar a interface: ${uiError.message}</p>`;
        }
      }
    });
  } catch (error) {
    console.error("Erro fatal durante o carregamento inicial de dados:", error);
    const errorMsg = `<p class="alert alert-error">Erro ao carregar dados do paciente: ${error.message}</p>`;
    if (viewContainer) viewContainer.innerHTML = errorMsg;
    else console.error(errorMsg);
  }
}
