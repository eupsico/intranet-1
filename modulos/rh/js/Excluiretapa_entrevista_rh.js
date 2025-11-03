// modulos/rh/js/etapa_entrevista_rh.js

document.addEventListener("DOMContentLoaded", () => {
  // 1. Inicialização e Referências
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
  const urlParams = new URLSearchParams(window.location.search);
  const candidaturaId = urlParams.get("candidatura");
  const vagaId = urlParams.get("vaga");

  const form = document.getElementById("form-avaliacao-entrevista");
  const radioAptoSim = document.getElementById("entrevista-sim");
  const radioAptoNao = document.getElementById("entrevista-nao");
  const motivoRejeicaoContainer = document.getElementById(
    "motivo-rejeicao-container"
  );
  const alertaStatus = document.getElementById("alerta-status-entrevista");
  const btnRegistrar = document.getElementById("btn-registrar-entrevista");

  // Navegação de retorno
  document.getElementById("btn-voltar-recrutamento").onclick = () => {
    window.location.href = `recrutamento.html${
      vagaId ? "?vaga=" + vagaId + "&etapa=entrevistas" : ""
    }`;
  };

  if (!candidaturaId) {
    mostrarAlerta(
      "ID da Candidatura não fornecido na URL. Não é possível prosseguir.",
      "danger"
    );
    return;
  }

  // 2. Funções de UI
  function mostrarAlerta(mensagem, tipo = "info") {
    alertaStatus.innerHTML = `<div class="alert alert-${tipo}" role="alert">${mensagem}</div>`;
  }

  function formatarTimestamp(timestamp) {
    if (!timestamp) return "Data/Hora não disponível";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("pt-BR");
  }

  /**
   * Carrega os dados básicos da candidatura e da vaga.
   */
  async function carregarDados() {
    try {
      const docCandidatura = await db
        .collection("candidaturas")
        .doc(candidaturaId)
        .get();
      if (!docCandidatura.exists) {
        mostrarAlerta("Candidatura não encontrada.", "danger");
        return;
      }
      const dadosCandidatura = docCandidatura.data();

      // 2.1. Carregar Nome da Vaga (para título)
      if (dadosCandidatura.vaga_id) {
        const docVaga = await db
          .collection("vagas")
          .doc(dadosCandidatura.vaga_id)
          .get();
        if (docVaga.exists) {
          document.getElementById("nome-vaga-entrevista").textContent =
            docVaga.data().titulo_vaga || "Vaga Desconhecida";
        }
      }

      document.getElementById("nome-candidato-entrevista").textContent =
        dadosCandidatura.nome_completo || "Candidato(a)";
      document.getElementById("dado-status-atual").textContent =
        dadosCandidatura.status_recrutamento || "N/A";
      document.getElementById("dado-resumo-triagem").textContent =
        dadosCandidatura.triagem_rh?.apto_entrevista === "Sim"
          ? `Aprovado na Triagem em ${formatarTimestamp(
              dadosCandidatura.triagem_rh.data_avaliacao
            )}`
          : "Pendente de Triagem (Erro de Fluxo)";

      const linkCurriculo = document.getElementById(
        "link-curriculo-entrevista"
      );
      if (dadosCandidatura.link_curriculo_drive) {
        linkCurriculo.href = dadosCandidatura.link_curriculo_drive;
        linkCurriculo.disabled = false;
      } else {
        linkCurriculo.textContent = "Currículo não anexado.";
        linkCurriculo.classList.remove("btn-outline-info");
        linkCurriculo.classList.add("btn-outline-danger");
        linkCurriculo.disabled = true;
      }

      // 2.2. Preencher avaliação anterior, se houver
      if (dadosCandidatura.entrevista_rh) {
        const avaliacao = dadosCandidatura.entrevista_rh;
        document.getElementById("nota-motivacao").value =
          avaliacao.nota_motivacao || "";
        document.getElementById("nota-cultura").value =
          avaliacao.nota_cultura || "";
        document.getElementById("nota-comportamento").value =
          avaliacao.nota_comportamento || "";
        document.getElementById("pontos-fortes").value =
          avaliacao.pontos_fortes || "";
        document.getElementById("pontos-melhoria").value =
          avaliacao.pontos_melhoria || "";

        if (avaliacao.aprovado === "Sim") {
          radioAptoSim.checked = true;
          mostrarAlerta(
            `Avaliação registrada em ${formatarTimestamp(
              avaliacao.data_avaliacao
            )}. Candidato APROVADO para Testes.`,
            "success"
          );
        } else if (avaliacao.aprovado === "Não") {
          radioAptoNao.checked = true;
          document.getElementById("motivo-rejeicao").value =
            avaliacao.motivo_rejeicao || "";
          toggleMotivoRejeicao();
          mostrarAlerta(
            `Avaliação registrada em ${formatarTimestamp(
              avaliacao.data_avaliacao
            )}. Candidato REPROVADO.`,
            "danger"
          );
        }
      } else {
        mostrarAlerta(
          "Candidatura pendente de avaliação de Entrevista RH.",
          "warning"
        );
      }
    } catch (error) {
      console.error("Erro ao carregar dados da candidatura:", error);
      mostrarAlerta(`Erro ao carregar dados: ${error.message}`, "danger");
    }
  }

  // 3. Lógica de UI - Mostrar/Ocultar Motivo de Rejeição
  function toggleMotivoRejeicao() {
    if (radioAptoNao.checked) {
      motivoRejeicaoContainer.style.display = "block";
      document.getElementById("motivo-rejeicao").required = true;
    } else {
      motivoRejeicaoContainer.style.display = "none";
      document.getElementById("motivo-rejeicao").required = false;
    }
  }

  // Adicionar listeners para os rádios
  radioAptoSim.addEventListener("change", toggleMotivoRejeicao);
  radioAptoNao.addEventListener("change", toggleMotivoRejeicao);

  // 4. Lógica de Submissão do Formulário
  async function submeterAvaliacao(e) {
    e.preventDefault();

    const aprovado = document.querySelector(
      'input[name="apto-entrevista"]:checked'
    )?.value;
    if (!aprovado) {
      alert("Por favor, selecione o resultado da entrevista.");
      return;
    }

    const decisao = aprovado === "Sim";

    if (
      !decisao &&
      document.getElementById("motivo-rejeicao").required &&
      !document.getElementById("motivo-rejeicao").value.trim()
    ) {
      alert("Por favor, preencha o motivo detalhado da reprovação.");
      return;
    }

    btnRegistrar.disabled = true;
    btnRegistrar.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i> Registrando...';

    // 4.1. Construção dos dados de avaliação
    const dadosAvaliacao = {
      nota_motivacao:
        parseInt(document.getElementById("nota-motivacao").value) || 0,
      nota_cultura:
        parseInt(document.getElementById("nota-cultura").value) || 0,
      nota_comportamento:
        parseInt(document.getElementById("nota-comportamento").value) || 0,
      pontos_fortes: document.getElementById("pontos-fortes").value,
      pontos_melhoria: document.getElementById("pontos-melhoria").value,
      aprovado: aprovado,
      motivo_rejeicao: decisao
        ? ""
        : document.getElementById("motivo-rejeicao").value.trim(),
      data_avaliacao: firebase.firestore.FieldValue.serverTimestamp(),
      avaliador_uid: firebase.auth().currentUser
        ? firebase.auth().currentUser.uid
        : "rh_system_user",
    };

    // 4.2. Determinar o novo status no banco de dados
    const novoStatusCandidato = decisao
      ? "Entrevista RH Aprovada (Testes Pendente)" // Próxima etapa: Testes
      : "Rejeitado (Comunicação Pendente)"; // Rejeitado: Envia para comunicação final

    // 4.3. Atualização no Firebase
    try {
      const candidaturaRef = db.collection("candidaturas").doc(candidaturaId);

      await candidaturaRef.update({
        status_recrutamento: novoStatusCandidato,
        entrevista_rh: dadosAvaliacao, // Novo campo no documento
        // Se reprovado, adiciona a rejeição (para a aba de finalizados)
        ...(decisao
          ? {}
          : {
              rejeicao: {
                etapa: "Entrevista RH",
                justificativa: dadosAvaliacao.motivo_rejeicao,
                data: dadosAvaliacao.data_avaliacao,
              },
            }),
      });

      const mensagemSucesso = decisao
        ? "Candidato Aprovado na Entrevista RH! Avançando para a etapa de Testes/Estudos de Caso."
        : "Candidato Reprovado na Entrevista RH. Enviado para comunicação final.";

      alert(mensagemSucesso);

      // Redirecionar para o painel principal de recrutamento, na próxima aba relevante.
      const proximaEtapa = decisao ? "entrevistas" : "finalizados";
      window.location.href = `recrutamento.html?vaga=${vagaId}&etapa=${proximaEtapa}`;
    } catch (error) {
      console.error("Erro ao salvar avaliação de entrevista RH:", error);
      mostrarAlerta(`Erro ao registrar a decisão: ${error.message}`, "danger");

      btnRegistrar.disabled = false;
      btnRegistrar.innerHTML =
        '<i class="fas fa-share-square me-2"></i> Registrar e Enviar para Próxima Fase';
    }
  }

  // 5. Inicialização
  carregarDados();
  form.addEventListener("submit", submeterAvaliacao);
});
