// Arquivo: /modulos/voluntario/js/detalhes-paciente/manipuladores.js
// Contém os handlers para submits de formulários principais e ações da lista de sessões.

// CORREÇÃO: Adicionada a importação do 'db'
import { db, doc, updateDoc, serverTimestamp, getDoc } from "./conexao-db.js"; // Funções do Firestore
import * as estado from "./estado.js"; // Acesso ao estado global
import * as carregador from "./carregador-dados.js"; // Para recarregar dados após salvar
import * as interfaceUI from "./interface.js"; // Para atualizar a UI após salvar

/**
 * Handler para salvar dados pessoais e de endereço.
 * Chamado por ambos os botões "Salvar" na aba de informações pessoais.
 */
export async function handleSalvarDadosPessoaisEEndereco(event) {
  event.preventDefault();
  const button = event.currentTarget;
  const form = document.getElementById("form-info-pessoais"); // Formulário principal

  if (!form || !button) {
    console.error(
      "Formulário ou botão não encontrado ao salvar dados pessoais/endereço."
    );
    alert("Erro interno ao tentar salvar.");
    return;
  }

  const originalButtonText = button.textContent;
  button.disabled = true;
  button.innerHTML = '<span class="loading-spinner-small"></span> Salvando...'; // Desabilita o outro botão de salvar também, se existir

  const otherButtonId =
    button.id === "btn-salvar-info-pessoais"
      ? "btn-salvar-endereco"
      : "btn-salvar-info-pessoais";
  const otherButton = document.getElementById(otherButtonId);
  if (otherButton) otherButton.disabled = true;

  try {
    // Coleta dados editáveis do formulário usando IDs
    const dataToUpdate = {
      telefoneCelular: form.querySelector("#dp-telefone")?.value.trim() || null,
      dataNascimento: form.querySelector("#dp-data-nascimento")?.value || null, // Assume formato YYYY-MM-DD // Contatos (usando notação de ponto para subcampos)
      "responsavel.nome":
        form.querySelector("#dp-responsavel-nome")?.value.trim() || null,
      "contatoEmergencia.nome":
        form.querySelector("#dp-contato-emergencia-nome")?.value.trim() || null,
      "contatoEmergencia.telefone":
        form.querySelector("#dp-contato-emergencia-telefone")?.value.trim() ||
        null, // Endereço (usando notação de ponto)
      "endereco.logradouro":
        form.querySelector("#dp-endereco-logradouro")?.value.trim() || null,
      "endereco.numero":
        form.querySelector("#dp-endereco-numero")?.value.trim() || null,
      "endereco.complemento":
        form.querySelector("#dp-endereco-complemento")?.value.trim() || null,
      "endereco.bairro":
        form.querySelector("#dp-endereco-bairro")?.value.trim() || null,
      "endereco.cidade":
        form.querySelector("#dp-endereco-cidade")?.value.trim() || null,
      "endereco.estado":
        form.querySelector("#dp-endereco-estado")?.value || null,
      "endereco.cep":
        form.querySelector("#dp-endereco-cep")?.value.trim() || null,
      lastUpdate: serverTimestamp(), // Timestamp da atualização
    }; // Remove chaves com valor null ou undefined para evitar sobrescrever campos existentes com null

    Object.keys(dataToUpdate).forEach((key) => {
      if (dataToUpdate[key] === null || dataToUpdate[key] === undefined) {
        // delete dataToUpdate[key]; // Firestore ignora undefined, mas null pode ser intencional.
        // Se a intenção é *apagar* um campo, o null deve ser mantido.
        // Se a intenção é só atualizar o que foi preenchido, descomente a linha acima.
        // Por segurança, vamos manter o null por enquanto, assumindo que pode ser intencional limpar um campo.
      }
    });

    const docRef = doc(db, "trilhaPaciente", estado.pacienteIdGlobal);
    await updateDoc(docRef, dataToUpdate);

    alert("Informações pessoais e de endereço atualizadas com sucesso!"); // Recarrega os dados do paciente para garantir que o estado e a UI estejam sincronizados

    await carregador.carregarDadosPaciente(estado.pacienteIdGlobal);
    interfaceUI.preencherFormularios(); // Re-renderiza os formulários com os dados atualizados
  } catch (error) {
    console.error("Erro ao salvar informações pessoais e de endereço:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = originalButtonText;
    if (otherButton) otherButton.disabled = false;
  }
}

/**
 * Handler para salvar informações financeiras.
 */
export async function handleSalvarInfoFinanceiras(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector("#btn-salvar-info-financeiras");
  const inputValor = form.querySelector("#dp-valor-contribuicao");

  if (!button || !inputValor) return;

  button.disabled = true;
  button.innerHTML = '<span class="loading-spinner-small"></span> Salvando...';

  try {
    const novoValorStr = inputValor.value || ""; // Converte aceitando vírgula ou ponto, remove outros caracteres não numéricos (exceto sinal no início, se houver)
    const valorNumerico = parseFloat(
      novoValorStr.replace(/[^\d,.-]/g, "").replace(",", ".")
    );

    if (isNaN(valorNumerico) || valorNumerico < 0) {
      throw new Error(
        "Valor da contribuição inválido. Use números positivos e, opcionalmente, vírgula ou ponto para centavos."
      );
    }

    const dataToUpdate = {
      valorContribuicao: valorNumerico,
      lastUpdate: serverTimestamp(),
    };

    const docRef = doc(db, "trilhaPaciente", estado.pacienteIdGlobal);
    await updateDoc(docRef, dataToUpdate);

    alert("Informação financeira atualizada com sucesso!"); // Atualiza o estado localmente para refletir a mudança imediatamente

    if (estado.pacienteDataGlobal) {
      estado.setPacienteDataGlobal({
        ...estado.pacienteDataGlobal,
        valorContribuicao: valorNumerico,
      });
      // Re-preenche apenas o campo alterado (ou o form inteiro se preferir)
      interfaceUI.preencherFormularios();
    }
  } catch (error) {
    console.error("Erro ao salvar informação financeira:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "Salvar Contribuição";
  }
}

/**
 * Handler para salvar dados do acompanhamento clínico.
 */
export async function handleSalvarAcompanhamento(event) {
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector("#btn-salvar-acompanhamento");

  if (!button) return;

  button.disabled = true;
  button.innerHTML = '<span class="loading-spinner-small"></span> Salvando...';

  try {
    // Usa notação de ponto para atualizar campos aninhados
    const dataToUpdate = {
      "acompanhamentoClinico.avaliacaoDemanda":
        form.querySelector("#ac-avaliacao-demanda")?.value || null,
      "acompanhamentoClinico.definicaoObjetivos":
        form.querySelector("#ac-definicao-objetivos")?.value || null,
      "acompanhamentoClinico.diagnostico":
        form.querySelector("#ac-diagnostico")?.value || null,
      "acompanhamentoClinico.registroEncerramento":
        form.querySelector("#ac-registro-encerramento")?.value || null,
      lastUpdate: serverTimestamp(),
    };

    const docRef = doc(db, "trilhaPaciente", estado.pacienteIdGlobal);
    await updateDoc(docRef, dataToUpdate);

    alert("Acompanhamento clínico atualizado com sucesso!"); // Atualiza o estado localmente (opcional, mas bom para consistência)

    if (estado.pacienteDataGlobal) {
      const currentAcompanhamento =
        estado.pacienteDataGlobal.acompanhamentoClinico || {};
      estado.setPacienteDataGlobal({
        ...estado.pacienteDataGlobal,
        acompanhamentoClinico: {
          ...currentAcompanhamento,
          avaliacaoDemanda:
            dataToUpdate["acompanhamentoClinico.avaliacaoDemanda"],
          definicaoObjetivos:
            dataToUpdate["acompanhamentoClinico.definicaoObjetivos"],
          diagnostico: dataToUpdate["acompanhamentoClinico.diagnostico"],
          registroEncerramento:
            dataToUpdate["acompanhamentoClinico.registroEncerramento"],
        },
      });
      // Re-preenche o formulário para garantir
      interfaceUI.preencherFormularios();
    }
  } catch (error) {
    console.error("Erro ao salvar acompanhamento clínico:", error);
    alert(`Erro ao salvar: ${error.message}`);
  } finally {
    button.disabled = false;
    button.textContent = "Salvar Acompanhamento Clínico";
  }
}

/**
 * Handler para cliques nos botões de Presença/Ausência de uma sessão.
 */
export async function handlePresencaAusenciaClick(
  sessaoId,
  novoStatus,
  button
) {
  const actionButtonsContainer = button.closest(".session-actions");
  const allButtonsInRow = actionButtonsContainer?.querySelectorAll("button");
  allButtonsInRow?.forEach((btn) => (btn.disabled = true)); // Desabilita todos na linha

  try {
    const sessaoRef = doc(
      db,
      "trilhaPaciente",
      estado.pacienteIdGlobal,
      "sessoes",
      sessaoId
    );

    const updateData = {
      status: novoStatus, // 'presente' ou 'ausente'
      statusAtualizadoEm: serverTimestamp(),
    }; // Guarda quem atualizou, se o usuário estiver logado
    if (estado.userDataGlobal) {
      updateData.statusAtualizadoPor = {
        id: estado.userDataGlobal.uid,
        nome: estado.userDataGlobal.nome,
      };
    }

    await updateDoc(sessaoRef, updateData);
    console.log(`Status da sessão ${sessaoId} atualizado para ${novoStatus}`); // Recarrega as sessões do Firestore para atualizar o estado

    await carregador.carregarSessoes(); // Re-renderiza a lista de sessões e as pendências
    interfaceUI.renderizarSessoes();
    interfaceUI.renderizarPendencias();
  } catch (error) {
    console.error(`Erro ao atualizar status da sessão ${sessaoId}:`, error);
    alert(`Erro ao marcar ${novoStatus}: ${error.message}`); // Reabilita botões apenas em caso de erro
    allButtonsInRow?.forEach((btn) => (btn.disabled = false));
  } // Não precisa reabilitar em caso de sucesso, pois a lista será re-renderizada
}

/**
 * Handler para o botão "Gerar Prontuário PDF".
 * (Lógica de geração do PDF não implementada).
 */
export function handleGerarProntuarioPDF() {
  console.log("Iniciando geração do PDF do prontuário...");
  const form = document.getElementById("form-gerar-prontuario");
  if (!form) {
    console.error("Formulário de geração de prontuário não encontrado.");
    alert("Erro: Formulário não encontrado.");
    return;
  }

  const selectedItems = Array.from(
    form.querySelectorAll('input[name="prontuario-item"]:checked')
  ).map((cb) => cb.value);

  if (selectedItems.length === 0) {
    alert("Selecione pelo menos um item para incluir no prontuário.");
    return;
  } // Placeholder para a lógica de geração de PDF

  alert(
    `Itens selecionados para o PDF: ${selectedItems.join(
      ", "
    )}\n\n(Lógica de geração do PDF ainda não implementada)`
  ); // Aqui você chamaria a biblioteca ou função responsável por gerar o PDF // Ex: gerarPDFProntuario(estado.pacienteDataGlobal, estado.sessoesCarregadas, selectedItems);
}
