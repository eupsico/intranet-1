// Arquivo: /modulos/voluntario/js/detalhes-paciente/manipuladores.js
// Contém os handlers para submits de formulários principais e ações da lista de sessões.

// CORREÇÃO: Adicionada a importação do 'db' e funções de Storage e ArrayUnion
import {
  db,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  arrayUnion,
} from "./conexao-db.js"; // Funções do Firestore e Storage
import * as estado from "./estado.js"; // Acesso ao estado global
import * as carregador from "./carregador-dados.js"; // Para recarregar dados após salvar
import * as interfaceUI from "./interface.js"; // Para atualizar a UI após salvar
import { handleAbrirAnotacoes } from "./modais/modal-anotacoes.js";
import { gerarProntuarioPDF } from "./pdf-prontuario.js";

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
      dataNascimento: form.querySelector("#dp-data-nascimento")?.value || null, // Assume formato YYYY-MM-DD
      parceria: form.querySelector("#dp-parceria")?.value || null, // <-- ADICIONADO: Salva o campo parceria
      // Contatos (usando notação de ponto para subcampos)
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
export async function handleGerarProntuarioPDF(event) {
  event.preventDefault();
  const btn = event.target;
  const originalText = btn.textContent;

  const form = document.getElementById("form-gerar-prontuario");
  if (!form) {
    alert("Erro: Formulário de prontuário não encontrado.");
    return;
  }

  const selectedItems = Array.from(
    form.querySelectorAll('input[name="prontuario-item"]:checked')
  ).map((cb) => cb.value);

  if (selectedItems.length === 0) {
    alert("Selecione pelo menos um item para incluir no prontuário.");
    return;
  }

  if (!estado.pacienteDataGlobal) {
    alert("Dados do paciente não carregados.");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner-small"></span> Gerando...';

  try {
    // Chama a função dedicada de geração do PDF
    await gerarProntuarioPDF(
      estado.pacienteDataGlobal,
      estado.sessoesCarregadas,
      estado.userDataGlobal,
      selectedItems
    );
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert(`Ocorreu um erro ao gerar o PDF: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}
/**
 * Handler para alterar o status da sessão e abrir anotações se necessário.
 */
export async function handleAlterarStatusSessao(sessaoId, novoStatus) {
  try {
    const sessaoRef = doc(
      db,
      "trilhaPaciente",
      estado.pacienteIdGlobal,
      "sessoes",
      sessaoId
    );

    const updateData = {
      status: novoStatus,
      statusAtualizadoEm: serverTimestamp(),
    };

    if (estado.userDataGlobal) {
      updateData.statusAtualizadoPor = {
        id: estado.userDataGlobal.uid,
        nome: estado.userDataGlobal.nome,
      };
    }

    await updateDoc(sessaoRef, updateData);
    console.log(`Status da sessão ${sessaoId} atualizado para ${novoStatus}`);

    // Atualiza a UI
    await carregador.carregarSessoes();
    interfaceUI.renderizarSessoes();

    // --- LÓGICA AUTOMÁTICA ---
    // Se foi cancelado, abre o modal de anotações automaticamente para justificativa
    if (
      novoStatus === "cancelada_paciente" ||
      novoStatus === "cancelada_prof"
    ) {
      setTimeout(() => {
        alert("Por favor, registre o motivo do cancelamento nas anotações.");
        handleAbrirAnotacoes(sessaoId);
      }, 300); // Pequeno delay para a UI atualizar antes
    }
  } catch (error) {
    console.error(`Erro ao atualizar status da sessão ${sessaoId}:`, error);
    alert(`Erro ao alterar status: ${error.message}`);
  }
}

// --- NOVA FUNÇÃO DE UPLOAD ---
/**
 * Handler para o upload de arquivos complementares (Anamnese, Testes, etc.).
 */
export async function handleUploadArquivo(event) {
  const input = event.target;
  const file = input.files[0];
  const statusSpan = document.getElementById("upload-status");

  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    // 5MB limit
    alert("O arquivo é muito grande. Tamanho máximo permitido: 5MB.");
    input.value = "";
    return;
  }

  if (!estado.pacienteIdGlobal) {
    alert("Erro: ID do paciente não encontrado.");
    input.value = "";
    return;
  }

  // Feedback visual
  input.disabled = true;
  if (statusSpan) statusSpan.textContent = "Enviando...";

  try {
    // Caminho no Storage: pacientes/{idPaciente}/arquivos/{nomeArquivo}
    const storagePath = `pacientes/${
      estado.pacienteIdGlobal
    }/arquivos/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);

    // Upload
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);

    // Atualiza Firestore (adiciona ao array arquivosClinicos)
    const docRef = doc(db, "trilhaPaciente", estado.pacienteIdGlobal);
    await updateDoc(docRef, {
      arquivosClinicos: arrayUnion({
        nome: file.name,
        url: downloadURL,
        path: storagePath,
        data: new Date().toISOString(), // Salva como string ISO para compatibilidade
      }),
      lastUpdate: serverTimestamp(),
    });

    alert("Arquivo enviado com sucesso!");

    // Recarrega dados e atualiza UI
    await carregador.carregarDadosPaciente(estado.pacienteIdGlobal);
    interfaceUI.preencherFormularios();
  } catch (error) {
    console.error("Erro no upload:", error);
    alert(`Erro ao enviar arquivo: ${error.message}`);
  } finally {
    input.value = "";
    input.disabled = false;
    if (statusSpan) statusSpan.textContent = "";
  }
}
