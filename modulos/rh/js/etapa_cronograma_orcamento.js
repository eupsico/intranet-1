// modulos/rh/js/etapa_cronograma_orcamento.js

document.addEventListener("DOMContentLoaded", () => {
  // Verifica se o Firebase foi inicializado
  if (typeof firebase === "undefined" || !firebase.firestore) {
    console.error(
      "ERRO: O SDK do Firebase não está carregado ou configurado corretamente."
    );
    alert(
      "Erro de inicialização: O sistema de banco de dados não está disponível."
    );
    return;
  }

  const db = firebase.firestore();
  const form = document.getElementById("form-cronograma-orcamento");
  const selectVagas = document.getElementById("vaga-selecionada");
  const btnSalvar = document.getElementById("btn-salvar-cronograma");

  /**
   * Carrega as vagas ativas para o processo de recrutamento no dropdown.
   */
  async function carregarVagasEmRecrutamento() {
    selectVagas.innerHTML = '<option value="">Carregando vagas...</option>';
    selectVagas.disabled = true;

    try {
      // Buscando vagas que estão 'Em Divulgação' e que precisam de cronograma.
      // O filtro pode ser ajustado conforme a evolução do fluxo de status.
      const snapshot = await db
        .collection("vagas")
        .where("status_vaga", "in", [
          "Em Divulgação",
          "Cronograma Pendente",
          "Cronograma Definido (Triagem Pendente)",
        ])
        .get();

      selectVagas.innerHTML =
        '<option value="" disabled selected>Selecione a Vaga</option>';

      if (snapshot.empty) {
        selectVagas.innerHTML =
          '<option value="" disabled selected>Nenhuma vaga em processo de recrutamento</option>';
        return;
      }

      snapshot.forEach((doc) => {
        const vaga = doc.data();
        const option = document.createElement("option");
        option.value = doc.id;
        option.textContent = `${vaga.titulo_vaga} - ${vaga.departamento} (${vaga.status_vaga})`;
        selectVagas.appendChild(option);
      });

      selectVagas.disabled = false;
    } catch (error) {
      console.error("Erro ao carregar vagas:", error);
      selectVagas.innerHTML =
        '<option value="" disabled selected>Erro ao carregar lista de vagas</option>';
      alert(
        "Erro ao carregar lista de vagas. Verifique a conexão com o Firebase."
      );
    }
  }

  /**
   * Salva os dados de cronograma e orçamento no Firebase.
   */
  async function salvarCronogramaOrcamento(e) {
    e.preventDefault();

    const vagaId = selectVagas.value;
    if (!vagaId) {
      alert("Por favor, selecione uma vaga.");
      return;
    }

    const dataInicio = document.getElementById(
      "data-inicio-recrutamento"
    ).value;
    const dataFechamento = document.getElementById(
      "data-fechamento-recrutamento"
    ).value;

    if (!dataInicio || !dataFechamento) {
      alert(
        "Por favor, preencha as datas de início e encerramento do recrutamento."
      );
      return;
    }

    btnSalvar.disabled = true;
    btnSalvar.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

    const dadosCronograma = {
      data_inicio_recrutamento: dataInicio,
      data_fechamento_recrutamento: dataFechamento,
      data_contratacao_prevista: document.getElementById(
        "data-contratacao-prevista"
      ).value,
      orcamento_previsto: parseFloat(
        document.getElementById("orcamento-previsto").value || 0
      ), // Salvar como número
      fonte_orcamento: document.getElementById("fonte-orcamento").value,
      detalhes_cronograma: document.getElementById("detalhes-cronograma").value,

      // Atualização de status: Pronto para a próxima etapa (Triagem)
      status_vaga: "Cronograma Definido (Triagem Pendente)",
      ultima_atualizacao_recrutamento:
        firebase.firestore.FieldValue.serverTimestamp(),
    };

    try {
      const vagaRef = db.collection("vagas").doc(vagaId);

      await vagaRef.update(dadosCronograma);

      alert(
        "Cronograma e Orçamento salvos com sucesso! Avançando para a Triagem."
      );

      // Redirecionar para o painel de Recrutamento ou para a próxima etapa (Triagem)
      // Assumindo que o roteamento suporta a passagem de parâmetros.
      window.location.href = `recrutamento.html?vaga=${vagaId}&etapa=triagem`;
    } catch (error) {
      console.error("Erro ao salvar cronograma/orçamento:", error);
      alert(
        "Erro ao salvar os dados. Por favor, tente novamente. Detalhes: " +
          error.message
      );

      btnSalvar.disabled = false;
      btnSalvar.innerHTML =
        '<i class="fas fa-save me-2"></i> Salvar e Avançar para Triagem';
    }
  }

  // Inicialização
  carregarVagasEmRecrutamento();
  form.addEventListener("submit", salvarCronogramaOrcamento);

  // TODO: Adicionar lógica para popular os campos se a vaga já tiver dados de cronograma
  // selectVagas.addEventListener('change', (e) => carregarDadosCronograma(e.target.value));
});
