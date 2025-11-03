// modulos/rh/js/etapa_triagem.js

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
  const candidaturaId = urlParams.get("candidatura"); // Espera-se que o ID da candidatura seja passado na URL
  const vagaId = urlParams.get("vaga"); // Opcional, para contexto

  const form = document.getElementById("form-avaliacao-triagem");
  const radioAptoSim = document.getElementById("apto-sim");
  const radioAptoNao = document.getElementById("apto-nao");
  const motivoRejeicaoContainer = document.getElementById(
    "motivo-rejeicao-container"
  );
  const alertaStatus = document.getElementById("alerta-status-triagem");
  const btnSalvar = document.getElementById("btn-finalizar-triagem");

  if (!candidaturaId) {
    mostrarAlerta(
      "ID da Candidatura não fornecido na URL. Não é possível prosseguir.",
      "danger"
    );
    // Redireciona para o painel de recrutamento principal, se souber o ID da vaga
    document.getElementById("btn-voltar-recrutamento").onclick = () =>
      (window.location.href = `recrutamento.html${
        vagaId ? "?vaga=" + vagaId : ""
      }`);
    return;
  }

  // 2. Funções de UI
  function mostrarAlerta(mensagem, tipo = "info") {
    alertaStatus.innerHTML = `<div class="alert alert-${tipo}" role="alert">${mensagem}</div>`;
  }

  /**
   * Popula a coluna da ficha de candidatura com os dados do Firebase.
   * @param {Object} dados - O objeto de dados da candidatura.
   */
  function popularDadosCandidato(dados) {
    document.getElementById("nome-candidato-triagem").textContent =
      dados.nome_completo || "Candidato(a) Desconhecido(a)";
    document.getElementById("dado-email").textContent =
      dados.email || "Não informado";
    document.getElementById("dado-telefone").textContent =
      dados.telefone_contato || "Não informado";

    // Assumindo que a nova lógica de formulário salva cidade e estado após a consulta de CEP
    document.getElementById("dado-cidade-estado").textContent = `${
      dados.cidade || "Não informada"
    } / ${dados.estado || "UF"}`;
    document.getElementById("dado-como-conheceu").textContent =
      dados.como_conheceu || "Não informado";

    // Novos campos
    document.getElementById("dado-resumo-experiencia").textContent =
      dados.resumo_experiencia || "Não preenchido no formulário.";
    document.getElementById("dado-habilidades").textContent =
      dados.habilidades_competencias || "Não preenchidas no formulário.";

    const linkCurriculo = document.getElementById("link-curriculo");
    if (dados.link_curriculo_drive) {
      linkCurriculo.href = dados.link_curriculo_drive;
      linkCurriculo.disabled = false;
    } else {
      linkCurriculo.textContent = "Currículo não anexado.";
      linkCurriculo.classList.remove("btn-outline-primary-eu");
      linkCurriculo.classList.add("btn-outline-danger");
      linkCurriculo.disabled = true;
    }

    // Preencher avaliação anterior, se houver
    if (dados.triagem_rh) {
      document.getElementById("prerequisitos-atendidos").value =
        dados.triagem_rh.prerequisitos_atendidos || "";
      document.getElementById("comentarios-gerais").value =
        dados.triagem_rh.comentarios_gerais || "";

      if (dados.triagem_rh.apto_entrevista === "Sim") {
        radioAptoSim.checked = true;
        mostrarAlerta(
          `Candidato previamente **Aprovado** na triagem em ${formatarTimestamp(
            dados.triagem_rh.data_avaliacao
          )}.`,
          "success"
        );
      } else if (dados.triagem_rh.apto_entrevista === "Não") {
        radioAptoNao.checked = true;
        document.getElementById("motivo-rejeicao").value =
          dados.triagem_rh.motivo_rejeicao || "";
        toggleMotivoRejeicao();
        mostrarAlerta(
          `Candidato previamente **Reprovado** na triagem em ${formatarTimestamp(
            dados.triagem_rh.data_avaliacao
          )}.`,
          "danger"
        );
      }
    } else {
      mostrarAlerta("Candidatura pendente de avaliação de triagem.", "warning");
    }
  }

  function popularNomeVaga(dadosVaga) {
    const nomeVagaSpan = document.getElementById("nome-vaga-triagem");
    nomeVagaSpan.textContent = dadosVaga.titulo_vaga || "Vaga Desconhecida";
  }

  function formatarTimestamp(timestamp) {
    if (!timestamp) return "Data/Hora não disponível";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return (
      date.toLocaleDateString("pt-BR") +
      " às " +
      date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    );
  }

  // 3. Lógica de Carregamento de Dados
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

      // Carregar dados da vaga para contexto
      if (dadosCandidatura.vaga_id) {
        const docVaga = await db
          .collection("vagas")
          .doc(dadosCandidatura.vaga_id)
          .get();
        if (docVaga.exists) {
          popularNomeVaga(docVaga.data());
        }
      } else {
        popularNomeVaga({ titulo_vaga: "Vaga Não Associada" });
      }

      popularDadosCandidato(dadosCandidatura);

      // Adiciona evento ao botão de voltar, usando o ID da vaga se possível
      const btnVoltar = document.getElementById("btn-voltar-recrutamento");
      const vagaParam = dadosCandidatura.vaga_id || vagaId;
      btnVoltar.onclick = () => {
        window.location.href = `recrutamento.html${
          vagaParam ? "?vaga=" + vagaParam : ""
        }`;
      };
    } catch (error) {
      console.error("Erro ao carregar dados da candidatura:", error);
      mostrarAlerta(`Erro ao carregar dados: ${error.message}`, "danger");
    }
  }

  // 4. Lógica de UI - Mostrar/Ocultar Motivo de Rejeição
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

  // 5. Lógica de Submissão do Formulário
  async function submeterAvaliacao(e) {
    e.preventDefault();

    // Determinar a decisão
    const aptoEntrevista = document.querySelector(
      'input[name="apto-entrevista"]:checked'
    )?.value;
    if (!aptoEntrevista) {
      alert("Por favor, selecione se o candidato está apto para a entrevista.");
      return;
    }

    const decisao = aptoEntrevista === "Sim";

    if (
      !decisao &&
      document.getElementById("motivo-rejeicao").required &&
      !document.getElementById("motivo-rejeicao").value.trim()
    ) {
      alert("Por favor, preencha o motivo detalhado da reprovação.");
      return;
    }

    btnSalvar.disabled = true;
    btnSalvar.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i> Processando...';

    // Determinar o novo status no banco de dados
    const novoStatusCandidato = decisao
      ? "Triagem Aprovada (Entrevista Pendente)"
      : "Triagem Reprovada (Encerrada)";

    const dadosAvaliacao = {
      prerequisitos_atendidos: document.getElementById(
        "prerequisitos-atendidos"
      ).value,
      comentarios_gerais: document.getElementById("comentarios-gerais").value,
      apto_entrevista: aptoEntrevista,
      motivo_rejeicao: decisao
        ? ""
        : document.getElementById("motivo-rejeicao").value.trim(),
      data_avaliacao: firebase.firestore.FieldValue.serverTimestamp(),
      // Assumindo que o usuário atual está autenticado via Firebase Auth
      avaliador_uid: firebase.auth().currentUser
        ? firebase.auth().currentUser.uid
        : "rh_system_user",
    };

    try {
      const candidaturaRef = db.collection("candidaturas").doc(candidaturaId);

      // Atualizar o documento da candidatura
      await candidaturaRef.update({
        status_recrutamento: novoStatusCandidato,
        triagem_rh: dadosAvaliacao,
      });

      const mensagemSucesso = decisao
        ? "Candidato Aprovado na Triagem! Prossiga para agendamento de Entrevista."
        : "Candidato Reprovado na Triagem. Processo de recrutamento encerrado para esta candidatura.";

      alert(mensagemSucesso);

      // Redirecionar para o painel principal de recrutamento, para que o RH possa ver a próxima etapa/próximos candidatos.
      window.location.href = `recrutamento.html${
        vagaId ? "?vaga=" + vagaId : ""
      }`;
    } catch (error) {
      console.error("Erro ao salvar avaliação de triagem:", error);
      mostrarAlerta(`Erro ao registrar a decisão: ${error.message}`, "danger");

      btnSalvar.disabled = false;
      btnSalvar.innerHTML =
        '<i class="fas fa-check-circle me-2"></i> Registrar Decisão';
    }
  }

  // 6. Inicialização
  carregarDados();
  form.addEventListener("submit", submeterAvaliacao);
});
