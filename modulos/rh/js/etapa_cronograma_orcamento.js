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
} from "../../../assets/js/firebase-init.js";

let vagaIdAtual = null;

/**
 * Carrega as vagas ativas para o processo de recrutamento no dropdown.
 */
async function carregarVagasEmRecrutamento() {
  const selectVagas = document.getElementById("vaga-selecionada");
  
  if (!selectVagas) {
    console.error("Elemento 'vaga-selecionada' não encontrado!");
    return;
  }

  selectVagas.innerHTML = '<option value="">Carregando vagas...</option>';
  selectVagas.disabled = true;

  try {
    const q = query(
      collection(db, "vagas"),
      where("status", "in", [
        "em-divulgacao",
        "Em Divulgação",
        "Cronograma Pendente",
        "Cronograma Definido (Triagem Pendente)",
      ])
    );

    const snapshot = await getDocs(q);

    selectVagas.innerHTML = '<option value="" disabled selected>Selecione a Vaga</option>';

    if (snapshot.empty) {
      selectVagas.innerHTML = '<option value="" disabled selected>Nenhuma vaga em processo de recrutamento</option>';
      return;
    }

    snapshot.forEach((docSnap) => {
      const vaga = docSnap.data();
      const option = document.createElement("option");
      option.value = docSnap.id;
      option.textContent = `${vaga.nome || vaga.titulo_vaga} - ${vaga.departamento || 'Sem departamento'} (${vaga.status || vaga.status_vaga})`;
      selectVagas.appendChild(option);
    });

    selectVagas.disabled = false;

    // Se houver vaga na URL, seleciona automaticamente
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const vagaFromUrl = urlParams.get("vaga");

    if (vagaFromUrl) {
      selectVagas.value = vagaFromUrl;
      vagaIdAtual = vagaFromUrl;
      // TODO: Carregar dados existentes da vaga
    }
  } catch (error) {
    console.error("Erro ao carregar vagas:", error);
    selectVagas.innerHTML = '<option value="" disabled selected>Erro ao carregar lista de vagas</option>';
    alert("Erro ao carregar lista de vagas. Verifique a conexão.");
  }
}

/**
 * Salva os dados de cronograma e orçamento no Firebase.
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

    alert("Cronograma e Orçamento salvos com sucesso! Avançando para a Triagem.");

    // Redireciona para o recrutamento com a aba de triagem
    window.location.hash = `rh/recrutamento?vaga=${vagaId}&etapa=triagem`;
  } catch (error) {
    console.error("Erro ao salvar cronograma/orçamento:", error);
    alert("Erro ao salvar os dados. Detalhes: " + error.message);

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
  }
}
