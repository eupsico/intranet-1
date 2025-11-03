// modulos/rh/js/etapa_cronograma_orcamento.js

import {
 db,
 collection,
 getDocs,
 doc,
 updateDoc,
 query,
 where,
 serverTimestamp,
  getDoc, // Adicionado para buscar dados da vaga
} from "../../../assets/js/firebase-init.js";

let vagaIdAtual = null;

// INÍCIO: NOVAS VARIÁVEIS E FUNÇÕES PARA O MODAL
const modalEdicao = document.getElementById("modal-edicao-cronograma");
const formEdicao = document.getElementById("form-edicao-cronograma");
const selectVagas = document.getElementById("vaga-selecionada");
// Alterado para pegar o botão que agora está fixo no HTML
const btnEditarCronograma = document.getElementById("btn-editar-cronograma");

/**
 * Abre o modal de edição e carrega os dados atuais da vaga.
 * @param {string} vagaId O ID da vaga para carregar.
 * @param {object} dadosAtuais Os dados atuais de cronograma e orçamento.
 */
function abrirModalEdicao(vagaId, dadosAtuais) {
  if (!vagaId || !dadosAtuais) {
    console.error("ID da vaga ou dados não fornecidos para edição.");
    return;
  }
  
  // 1. Preenche os campos do modal com os dados atuais
  document.getElementById("modal-data-inicio-recrutamento").value = dadosAtuais.data_inicio_recrutamento || '';
  document.getElementById("modal-data-fechamento-recrutamento").value = dadosAtuais.data_fechamento_recrutamento || '';
  document.getElementById("modal-data-contratacao-prevista").value = dadosAtuais.data_contratacao_prevista || '';
  // Garante que o orçamento seja formatado como string, se existir
  document.getElementById("modal-orcamento-previsto").value = dadosAtuais.orcamento_previsto ? dadosAtuais.orcamento_previsto.toFixed(2) : '';
  document.getElementById("modal-fonte-orcamento").value = dadosAtuais.fonte_orcamento || '';
  document.getElementById("modal-detalhes-cronograma").value = dadosAtuais.detalhes_cronograma || '';
  
  // 2. Armazena o ID atual para uso na função de salvar
  modalEdicao.dataset.vagaId = vagaId;
  
  // 3. Exibe o modal
  if (modalEdicao) {
    modalEdicao.classList.add("is-visible");
  }
}

/**
 * Fecha o modal de edição.
 */
function fecharModalEdicao() {
  if (modalEdicao) {
    modalEdicao.classList.remove("is-visible");
  }
}

/**
 * Função de salvamento para o modal (Ajustar).
 */
async function salvarAjustesCronograma(e) {
  e.preventDefault();

  const btnSalvarModal = document.getElementById("btn-salvar-modal-cronograma");
  const vagaId = modalEdicao.dataset.vagaId;
  
  if (!vagaId) {
    alert("Erro: ID da vaga não encontrado.");
    return;
  }
  
  const dataInicio = document.getElementById("modal-data-inicio-recrutamento").value;
  const dataFechamento = document.getElementById("modal-data-fechamento-recrutamento").value;

  if (!dataInicio || !dataFechamento) {
    alert("Por favor, preencha as datas de início e encerramento do recrutamento.");
    return;
  }

  btnSalvarModal.disabled = true;
  btnSalvarModal.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

  const dadosEdicao = {
    data_inicio_recrutamento: dataInicio,
    data_fechamento_recrutamento: dataFechamento,
    data_contratacao_prevista: document.getElementById("modal-data-contratacao-prevista").value,
    orcamento_previsto: parseFloat(document.getElementById("modal-orcamento-previsto").value || 0),
    fonte_orcamento: document.getElementById("modal-fonte-orcamento").value,
    detalhes_cronograma: document.getElementById("modal-detalhes-cronograma").value,
    // Note: Mantemos o status existente, apenas atualizamos a data de modificação
    ultima_atualizacao_recrutamento: serverTimestamp(),
  };

  try {
    const vagaRef = doc(db, "vagas", vagaId);
    await updateDoc(vagaRef, dadosEdicao);

    console.log('✅ Cronograma ajustado com sucesso!');
    
    if (window.showToast) {
      window.showToast("Cronograma e Orçamento ajustados com sucesso!", "success");
    } else {
      alert("Cronograma e Orçamento ajustados com sucesso!");
    }

    // Atualiza os dados no formulário principal para visualização e recarrega a interface
    const selectedOption = selectVagas.querySelector(`option[value="${vagaId}"]`);
    if (selectedOption) {
        // Atualiza os dados no dataset do option (para manter o estado local)
        const currentData = JSON.parse(selectedOption.dataset.data);
        const newData = { ...currentData, ...dadosEdicao };
        selectedOption.dataset.data = JSON.stringify(newData);
        
        await carregarDadosVaga(vagaId, newData); 
    }
    
    fecharModalEdicao();

  } catch (error) {
    console.error("❌ Erro ao salvar ajustes:", error);
    
    if (window.showToast) {
      window.showToast("Erro ao salvar os ajustes: " + error.message, "error");
    } else {
      alert("Erro ao salvar os ajustes. Detalhes: " + error.message);
    }
  } finally {
    btnSalvarModal.disabled = false;
    btnSalvarModal.innerHTML = '<i class="fas fa-save me-2"></i> Salvar Ajustes';
  }
}

// FIM: NOVAS FUNÇÕES PARA O MODAL


/**
 * Preenche o formulário principal com os dados da vaga e configura o botão de edição.
 * @param {string} vagaId O ID da vaga.
 * @param {object} vagaData Os dados completos da vaga.
 */
async function carregarDadosVaga(vagaId, vagaData) {
  // Preenche os campos do formulário principal com os dados existentes para visualização
  document.getElementById("data-inicio-recrutamento").value = vagaData.data_inicio_recrutamento || '';
  document.getElementById("data-fechamento-recrutamento").value = vagaData.data_fechamento_recrutamento || '';
  document.getElementById("data-contratacao-prevista").value = vagaData.data_contratacao_prevista || '';
  // Se o valor for 0 (zero) ou null/undefined, exibe vazio no formulário. Caso contrário, exibe com 2 casas decimais.
  document.getElementById("orcamento-previsto").value = vagaData.orcamento_previsto && vagaData.orcamento_previsto !== 0 ? vagaData.orcamento_previsto.toFixed(2) : '';
  document.getElementById("fonte-orcamento").value = vagaData.fonte_orcamento || '';
  document.getElementById("detalhes-cronograma").value = vagaData.detalhes_cronograma || '';
  
  vagaIdAtual = vagaId;
  
  // Verifica se a vaga já tem um cronograma definido
  const cronogramaDefinido = !!vagaData.data_inicio_recrutamento; // Se a data de início estiver preenchida

  const btnSalvar = document.getElementById("btn-salvar-cronograma");
  const formFields = document.getElementById("form-cronograma-orcamento").querySelectorAll('input:not(#vaga-selecionada), textarea');

  if (cronogramaDefinido) {
    // 1. Configura o formulário principal para visualização (desabilitado)
    formFields.forEach(el => {
        el.disabled = true;
    });
    btnSalvar.style.display = 'none'; // Esconde o botão Salvar e Avançar

    // 2. Configura e exibe o botão de edição
    if (btnEditarCronograma) {
        btnEditarCronograma.style.display = 'block';
        // Configura o evento para abrir o modal
        btnEditarCronograma.onclick = () => abrirModalEdicao(vagaId, vagaData);
    }
    
  } else {
    // 1. Configura o formulário principal para criação (habilitado)
    formFields.forEach(el => {
        el.disabled = false;
    });
    btnSalvar.style.display = 'block'; // Mostra o botão Salvar e Avançar
    
    // 2. Esconde o botão de edição
    if (btnEditarCronograma) {
        btnEditarCronograma.style.display = 'none';
    }
  }
}

/**
 * Manipula a troca de vaga no <select>.
 */
async function handleVagaChange(e) {
  const vagaId = e.target.value;
  if (!vagaId) {
    // Se nada estiver selecionado, limpa e desabilita tudo
    document.getElementById("form-cronograma-orcamento").reset();
    document.getElementById("form-cronograma-orcamento").querySelectorAll('input:not(#vaga-selecionada), textarea').forEach(el => {
        el.disabled = true;
    });
    document.getElementById("btn-salvar-cronograma").style.display = 'none';
    if (btnEditarCronograma) {
        btnEditarCronograma.style.display = 'none';
    }
    return;
  }
  
  vagaIdAtual = vagaId;

  // Busca os dados diretamente do dataset da opção (dados já carregados)
  const selectedOption = e.target.options[e.target.selectedIndex];
  if (selectedOption && selectedOption.dataset.data) {
    const vagaData = JSON.parse(selectedOption.dataset.data);
    await carregarDadosVaga(vagaId, vagaData);
  } else {
    console.error("Dados da vaga não encontrados no dataset da opção.");
  }
}

async function carregarVagasEmRecrutamento() {
 const selectVagas = document.getElementById("vaga-selecionada");
 
 if (!selectVagas) {
  console.error("Elemento 'vaga-selecionada' não encontrado!");
  return;
 }

 selectVagas.innerHTML = '<option value="">Carregando vagas...</option>';
 selectVagas.disabled = true;

 try {
  console.log('🔍 Buscando vagas ativas para cronograma...');
  
    // Lógica de busca de vagas
  let q = query(
   collection(db, "vagas"),
   where("status", "in", [
    "em-divulgacao",
    "Em Divulgação",
    "Cronograma Pendente",
    "Cronograma Definido (Triagem Pendente)",
   ])
  );

  let snapshot = await getDocs(q);
  
  if (snapshot.empty) {
   q = query(
    collection(db, "vagas"),
    where("status_vaga", "in", [
     "em-divulgacao",
     "Em Divulgação",
     "Cronograma Pendente",
     "Cronograma Definido (Triagem Pendente)",
    ])
   );
   snapshot = await getDocs(q);
  }

  selectVagas.innerHTML = '<option value="" disabled selected>Selecione a Vaga</option>';

  if (snapshot.empty) {
   selectVagas.innerHTML = '<option value="" disabled selected>Nenhuma vaga em processo de recrutamento</option>';
      document.getElementById("form-cronograma-orcamento").querySelectorAll('input:not(#vaga-selecionada), textarea').forEach(el => {
          el.disabled = true;
      });
      document.getElementById("btn-salvar-cronograma").style.display = 'none';
      if (btnEditarCronograma) btnEditarCronograma.style.display = 'none';
   return;
  }

  snapshot.forEach((docSnap) => {
   const vaga = docSnap.data();
   const option = document.createElement("option");
   option.value = docSnap.id;
   option.textContent = `${vaga.nome || vaga.titulo_vaga} - ${vaga.departamento || 'Sem departamento'} (${vaga.status || vaga.status_vaga})`;
   // Adiciona todos os dados relevantes ao dataset do option
      option.dataset.data = JSON.stringify({
          data_inicio_recrutamento: vaga.data_inicio_recrutamento || '',
          data_fechamento_recrutamento: vaga.data_fechamento_recrutamento || '',
          data_contratacao_prevista: vaga.data_contratacao_prevista || '',
          orcamento_previsto: vaga.orcamento_previsto || 0,
          fonte_orcamento: vaga.fonte_orcamento || '',
          detalhes_cronograma: vaga.detalhes_cronograma || '',
          status: vaga.status || vaga.status_vaga
      });
   selectVagas.appendChild(option);
  });

  selectVagas.disabled = false;
    
  // Se houver vaga na URL, seleciona automaticamente
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const vagaFromUrl = urlParams.get("vaga");

  if (vagaFromUrl) {
   selectVagas.value = vagaFromUrl;
   vagaIdAtual = vagaFromUrl;
   console.log('✅ Vaga pré-selecionada da URL:', vagaFromUrl);
      // Simula a troca para carregar os dados
      const selectedOption = selectVagas.querySelector(`option[value="${vagaFromUrl}"]`);
      if (selectedOption) {
          await carregarDadosVaga(vagaFromUrl, JSON.parse(selectedOption.dataset.data));
      }
  } else {
      // Garante que os campos de dados estão limpos e desabilitados se nenhuma vaga for selecionada inicialmente
      document.getElementById("form-cronograma-orcamento").reset();
      document.getElementById("form-cronograma-orcamento").querySelectorAll('input:not(#vaga-selecionada), textarea').forEach(el => {
          el.disabled = true;
      });
      document.getElementById("btn-salvar-cronograma").style.display = 'none';
      if (btnEditarCronograma) btnEditarCronograma.style.display = 'none';
    }
    
 } catch (error) {
  console.error("❌ Erro ao carregar vagas:", error);
  selectVagas.innerHTML = '<option value="" disabled selected>Erro ao carregar lista de vagas</option>';
  if (window.showToast) {
   window.showToast("Erro ao carregar lista de vagas.", "error");
  } else {
   alert("Erro ao carregar lista de vagas.");
  }
 }
}

/**
* Salva os dados de cronograma e orçamento no Firebase (somente primeira submissão).
*/
async function salvarCronogramaOrcamento(e) {
 e.preventDefault();

 const selectVagas = document.getElementById("vaga-selecionada");
 const btnSalvar = document.getElementById("btn-salvar-cronograma");

 const vagaId = selectVagas.value;
 if (!vagaId) {
  alert("Por favor, selecione uma vaga.");
  return;
 }
  
  const dataInicio = document.getElementById("data-inicio-recrutamento").value;
  const dataFechamento = document.getElementById("data-fechamento-recrutamento").value;

  if (!dataInicio || !dataFechamento) {
    alert("Por favor, preencha as datas de início e encerramento do recrutamento.");
    return;
  }

  btnSalvar.disabled = true;
  btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

  const dadosCronograma = {
    data_inicio_recrutamento: dataInicio,
    data_fechamento_recrutamento: dataFechamento,
    data_contratacao_prevista: document.getElementById("data-contratacao-prevista").value,
    orcamento_previsto: parseFloat(document.getElementById("orcamento-previsto").value || 0),
    fonte_orcamento: document.getElementById("fonte-orcamento").value,
    detalhes_cronograma: document.getElementById("detalhes-cronograma").value,
    status: "Cronograma Definido (Triagem Pendente)",
    ultima_atualizacao_recrutamento: serverTimestamp(),
  };

  try {
    const vagaRef = doc(db, "vagas", vagaId);
    await updateDoc(vagaRef, dadosCronograma);

    console.log('✅ Cronograma salvo com sucesso!');
    
    if (window.showToast) {
      window.showToast("Cronograma e Orçamento salvos com sucesso!", "success");
    } else {
      alert("Cronograma e Orçamento salvos com sucesso! Avançando para a Triagem.");
    }

    // ATENÇÃO: LINHA REMOVIDA PARA FICAR NA MESMA PÁGINA
    // setTimeout(() => {
    //   window.location.hash = `rh/recrutamento?vaga=${vagaId}&etapa=triagem`;
    // }, 1500);

    // Atualiza a interface da página atual para o modo "Visualização"
    const selectedOption = selectVagas.querySelector(`option[value="${vagaId}"]`);
    if (selectedOption) {
        const newData = JSON.parse(selectedOption.dataset.data);
        const updatedData = { ...newData, ...dadosCronograma, orcamento_previsto: dadosCronograma.orcamento_previsto };
        selectedOption.dataset.data = JSON.stringify(updatedData);
        carregarDadosVaga(vagaId, updatedData);
    }
    
  } catch (error) {
    console.error("❌ Erro ao salvar cronograma/orçamento:", error);
    
    if (window.showToast) {
      window.showToast("Erro ao salvar os dados: " + error.message, "error");
    } else {
      alert("Erro ao salvar os dados. Detalhes: " + error.message);
    }

    btnSalvar.disabled = false;
    btnSalvar.innerHTML = '<i class="fas fa-save me-2"></i> Salvar e Avançar para Triagem';
  }
}

/**
* Ponto de entrada do módulo.
*/
export async function init(user, userData) {
 console.log("📅 Iniciando Etapa: Cronograma e Orçamento...");

 await carregarVagasEmRecrutamento();

 const form = document.getElementById("form-cronograma-orcamento");
 if (form) {
  form.addEventListener("submit", salvarCronogramaOrcamento);
 } else {
  console.error("Formulário 'form-cronograma-orcamento' não encontrado!");
 }

  // INÍCIO: CONFIGURAÇÃO DO MODAL
  if (selectVagas) {
    // Adiciona o listener para carregar/exibir o botão de edição
    selectVagas.addEventListener("change", handleVagaChange);
  }

  // Listener para o formulário de edição do modal
  if (formEdicao) {
    formEdicao.addEventListener("submit", salvarAjustesCronograma);
  }
  
  // Listeners para fechar o modal (botão X e botão Cancelar)
  document.querySelectorAll("[data-modal-id='modal-edicao-cronograma']").forEach((btn) => {
      btn.addEventListener("click", fecharModalEdicao);
  });
  
  // Fechar o modal clicando no overlay
  if (modalEdicao) {
      modalEdicao.addEventListener('click', (e) => {
        if (e.target === modalEdicao) {
          fecharModalEdicao();
        }
      });
  }
  // FIM: CONFIGURAÇÃO DO MODAL
}