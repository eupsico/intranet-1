// modulos/rh/js/etapa_entrevista_gestor.js

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

  // Referências do DOM
  const alertaStatus = document.getElementById("alerta-status-gestor");
  const formAvaliacaoGestor = document.getElementById("form-avaliacao-gestor");
  const radioAprovadoSim = document.getElementById("aprovado-sim");
  const radioAprovadoNao = document.getElementById("aprovado-nao");
  const motivoRejeicaoContainer = document.getElementById(
    "motivo-rejeicao-container"
  );
  const btnRegistrarGestor = document.getElementById("btn-registrar-gestor");

  // Referências da Comunicação Final
  const secaoComunicacao = document.getElementById("secao-comunicacao-final");
  const statusComunicacaoLabel = document.getElementById(
    "status-comunicacao-label"
  );
  const selectModeloMensagem = document.getElementById("modelo-mensagem");
  const textoMensagemFinal = document.getElementById("texto-mensagem-final");
  const btnEnviarWhatsAppFinal = document.getElementById(
    "btn-enviar-whatsapp-final"
  );

  let dadosCandidatura = null;
  let ultimaDecisaoGestor = null; // 'Sim' ou 'Não'
  let modelosMensagem = {}; // Armazena modelos do Firebase

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
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("pt-BR");
  }

  // 3. Carregamento de Modelos de Mensagem do Firebase
  async function carregarModelosMensagem() {
    try {
      const snapshot = await db.collection("mensagens_rh").get();
      modelosMensagem = {};
      selectModeloMensagem.innerHTML =
        '<option value="" disabled selected>Selecione o Modelo Padrão</option>';

      snapshot.forEach((doc) => {
        const msg = doc.data();
        modelosMensagem[doc.id] = msg;
        selectModeloMensagem.innerHTML += `<option value="${doc.id}" data-tipo="${msg.tipo_mensagem}">${msg.titulo}</option>`;
      });
    } catch (error) {
      console.error("Erro ao carregar modelos de mensagem:", error);
      mostrarAlerta(
        "Erro ao carregar modelos de comunicação. A comunicação manual pode ser afetada.",
        "warning"
      );
    }
  }

  // 4. Carregamento Inicial de Dados da Candidatura
  async function carregarDados() {
    await carregarModelosMensagem();

    try {
      const docCandidatura = await db
        .collection("candidaturas")
        .doc(candidaturaId)
        .get();
      if (!docCandidatura.exists) {
        mostrarAlerta("Candidatura não encontrada.", "danger");
        return;
      }
      dadosCandidatura = docCandidatura.data();

      document.getElementById("nome-candidato-gestor").textContent =
        dadosCandidatura.nome_completo || "Candidato(a)";

      // 4.1. Preencher Histórico
      document.getElementById("resumo-triagem-gestor").textContent =
        dadosCandidatura.triagem_rh?.apto_entrevista === "Sim"
          ? "Aprovado"
          : "Reprovado/N/A";
      document.getElementById("resumo-entrevista-rh-gestor").textContent =
        dadosCandidatura.entrevista_rh?.aprovado === "Sim"
          ? "Aprovado"
          : "Reprovado/N/A";
      document.getElementById("resumo-testes-gestor").textContent =
        dadosCandidatura.testes_estudos?.status_resultado === "aprovado"
          ? "Aprovado"
          : "Reprovado/N/A";

      const linkCurriculo = document.getElementById("link-curriculo-gestor");
      if (dadosCandidatura.link_curriculo_drive) {
        linkCurriculo.href = dadosCandidatura.link_curriculo_drive;
        linkCurriculo.disabled = false;
      }

      // 4.2. Preencher avaliação do gestor se já existir
      if (dadosCandidatura.entrevista_gestor) {
        const avaliacao = dadosCandidatura.entrevista_gestor;
        document.getElementById("nome-gestor").value =
          avaliacao.nome_gestor || "";
        document.getElementById("data-entrevista-gestor").value =
          avaliacao.data_entrevista || "";
        document.getElementById("perguntas-gestor").value =
          avaliacao.perguntas_foco || "";
        document.getElementById("comentarios-gestor").value =
          avaliacao.comentarios_gestor || "";

        if (avaliacao.aprovado === "Sim") {
          radioAprovadoSim.checked = true;
          mostrarAlerta(
            `Avaliação final registrada em ${formatarTimestamp(
              avaliacao.data_registro
            )}. Candidato APROVADO pelo Gestor. Prossiga para a comunicação final.`,
            "success"
          );
        } else if (avaliacao.aprovado === "Não") {
          radioAprovadoNao.checked = true;
          document.getElementById("motivo-rejeicao").value =
            avaliacao.motivo_rejeicao || "";
          toggleMotivoRejeicao();
          mostrarAlerta(
            `Avaliação final registrada em ${formatarTimestamp(
              avaliacao.data_registro
            )}. Candidato REPROVADO pelo Gestor. Prossiga para a comunicação final.`,
            "danger"
          );
        }

        // Se a avaliação já foi registrada, exibe a seção de comunicação
        ultimaDecisaoGestor = avaliacao.aprovado;
        formAvaliacaoGestor.style.display = "none";
        exibirSecaoComunicacao(ultimaDecisaoGestor);
      } else {
        mostrarAlerta(
          "Candidatura aguardando a Entrevista e Avaliação Final do Gestor.",
          "warning"
        );
      }
    } catch (error) {
      console.error("Erro ao carregar dados da candidatura:", error);
      mostrarAlerta(`Erro ao carregar dados: ${error.message}`, "danger");
    }
  }

  // 5. Lógica de UI - Mostrar/Ocultar Motivo de Rejeição
  function toggleMotivoRejeicao() {
    if (radioAprovadoNao.checked) {
      motivoRejeicaoContainer.style.display = "block";
      document.getElementById("motivo-rejeicao").required = true;
    } else {
      motivoRejeicaoContainer.style.display = "none";
      document.getElementById("motivo-rejeicao").required = false;
    }
  }

  function exibirSecaoComunicacao(decisao) {
    // Altera o label para mostrar a decisão
    statusComunicacaoLabel.textContent =
      decisao === "Sim" ? "APROVAÇÃO" : "REPROVAÇÃO";
    secaoComunicacao.style.display = "block";

    // Pré-seleciona o modelo de mensagem no dropdown
    const modeloPadraoId = Object.keys(modelosMensagem).find(
      (key) =>
        modelosMensagem[key].tipo_mensagem ===
        (decisao === "Sim" ? "aprovacao-final" : "rejeicao-final")
    );
    if (modeloPadraoId) {
      selectModeloMensagem.value = modeloPadraoId;
      textoMensagemFinal.value = modelosMensagem[modeloPadraoId].corpo_mensagem;
    } else {
      textoMensagemFinal.value =
        decisao === "Sim"
          ? "Parabéns! Fomos muito bem impressionados e gostaríamos de seguir com sua contratação."
          : "Agradecemos sua participação. Infelizmente, não avançaremos com sua candidatura neste momento.";
    }

    // Substitui placeholders (Assumindo nome do candidato e vaga)
    const nomeCandidato = dadosCandidatura.nome_completo || "Candidato(a)";
    const tituloVaga = dadosCandidatura.titulo_vaga_original || "Vaga";
    textoMensagemFinal.value = textoMensagemFinal.value
      .replace("[NOME_CANDIDATO]", nomeCandidato)
      .replace("[TITULO_VAGA]", tituloVaga);
  }

  // Adicionar listeners para os rádios
  radioAprovadoSim.addEventListener("change", toggleMotivoRejeicao);
  radioAprovadoNao.addEventListener("change", toggleMotivoRejeicao);

  // 6. Lógica de Submissão: Registro da Avaliação do Gestor
  async function submeterAvaliacaoGestor(e) {
    e.preventDefault();

    const aprovado = document.querySelector(
      'input[name="aprovado-gestor"]:checked'
    )?.value;
    if (!aprovado) {
      alert("Por favor, selecione o resultado da avaliação do gestor.");
      return;
    }

    const decisao = aprovado === "Sim";
    const motivoRejeicao = decisao
      ? ""
      : document.getElementById("motivo-rejeicao").value.trim();

    if (!decisao && !motivoRejeicao) {
      alert("Por favor, preencha o motivo detalhado da reprovação.");
      return;
    }

    btnRegistrarGestor.disabled = true;
    btnRegistrarGestor.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i> Registrando Decisão...';

    // 6.1. Construção dos dados
    const dadosAvaliacao = {
      nome_gestor: document.getElementById("nome-gestor").value.trim(),
      data_entrevista: document.getElementById("data-entrevista-gestor").value,
      perguntas_foco: document.getElementById("perguntas-gestor").value,
      comentarios_gestor: document.getElementById("comentarios-gestor").value,
      aprovado: aprovado,
      motivo_rejeicao: motivoRejeicao,
      data_registro: firebase.firestore.FieldValue.serverTimestamp(),
      avaliador_uid: firebase.auth().currentUser
        ? firebase.auth().currentUser.uid
        : "rh_system_user",
    };

    // 6.2. Atualização no Firebase (Mantém o status como 'Entrevista Gestor Aprovada' ou 'Rejeitado (Comunicação Pendente)' para indicar que a próxima ação é a comunicação)
    const novoStatusCandidato = decisao
      ? "Entrevista Gestor Aprovada (Comunicação Final)" // Aprovado: Próximo é Contratar
      : "Rejeitado (Comunicação Pendente)"; // Reprovado: Próximo é enviar mensagem

    try {
      const candidaturaRef = db.collection("candidaturas").doc(candidaturaId);

      const updateData = {
        status_recrutamento: novoStatusCandidato,
        entrevista_gestor: dadosAvaliacao,
      };

      // Se reprovado, adiciona a rejeição
      if (!decisao) {
        updateData.rejeicao = {
          etapa: "Entrevista com Gestor",
          justificativa: `Reprovado pelo Gestor. Motivo: ${motivoRejeicao}`,
          data: dadosAvaliacao.data_registro,
        };
      }

      await candidaturaRef.update(updateData);

      // Transição para a fase de comunicação
      ultimaDecisaoGestor = aprovado;
      formAvaliacaoGestor.style.display = "none";
      btnRegistrarGestor.disabled = false;
      exibirSecaoComunicacao(ultimaDecisaoGestor);

      mostrarAlerta(
        "Avaliação do Gestor registrada com sucesso! Prossiga para a comunicação final.",
        decisao ? "success" : "danger"
      );
    } catch (error) {
      console.error("Erro ao salvar avaliação do gestor:", error);
      mostrarAlerta(`Erro ao registrar a decisão: ${error.message}`, "danger");

      btnRegistrarGestor.disabled = false;
      btnRegistrarGestor.innerHTML =
        '<i class="fas fa-bullhorn me-2"></i> Registrar Decisão e Iniciar Comunicação Final';
    }
  }

  // 7. Lógica de Comunicação Final (WhatsApp)

  // Atualiza o textarea com o modelo selecionado
  selectModeloMensagem.addEventListener("change", () => {
    const modeloId = selectModeloMensagem.value;
    if (modeloId && modelosMensagem[modeloId]) {
      let texto = modelosMensagem[modeloId].corpo_mensagem;
      const nomeCandidato = dadosCandidatura.nome_completo || "Candidato(a)";
      const tituloVaga = dadosCandidatura.titulo_vaga_original || "Vaga";

      texto = texto
        .replace("[NOME_CANDIDATO]", nomeCandidato)
        .replace("[TITULO_VAGA]", tituloVaga);

      textoMensagemFinal.value = texto;
    }
  });

  // Gera o link do WhatsApp com o texto final
  btnEnviarWhatsAppFinal.addEventListener("click", async () => {
    const textoFinal = textoMensagemFinal.value.trim();
    const telefone = dadosCandidatura.telefone_contato || "00000000000"; // Telefone do candidato
    const decisao = ultimaDecisaoGestor;

    if (!textoFinal) {
      alert("O corpo da mensagem não pode estar vazio.");
      return;
    }

    btnEnviarWhatsAppFinal.disabled = true;
    btnEnviarWhatsAppFinal.innerHTML =
      '<i class="fas fa-spinner fa-spin me-2"></i> Gerando Link...';

    // 7.1. Atualiza o status da candidatura para "Finalizado" (Contratado ou Rejeitado)
    const novoStatusCandidato =
      decisao === "Sim" ? "Contratado" : "Rejeitado (Comunicação Final)";

    try {
      const candidaturaRef = db.collection("candidaturas").doc(candidaturaId);

      const updateData = {
        status_recrutamento: novoStatusCandidato,
        data_comunicacao_final: firebase.firestore.FieldValue.serverTimestamp(),
      };

      // Adiciona a mensagem enviada ao histórico
      updateData.historico = firebase.firestore.FieldValue.arrayUnion({
        data: updateData.data_comunicacao_final,
        acao: `Comunicação Final (WhatsApp) Enviada. Status: ${novoStatusCandidato}`,
        mensagem_final: textoFinal,
      });

      await candidaturaRef.update(updateData);

      // 7.2. Gera e abre o link do WhatsApp
      const whatsappUrl = `https://wa.me/${telefone.replace(
        /\D/g,
        ""
      )}?text=${encodeURIComponent(textoFinal)}`;
      window.open(whatsappUrl, "_blank");

      mostrarAlerta(
        `Sucesso! Status finalizado para "${novoStatusCandidato}". Link do WhatsApp aberto.`,
        "success"
      );

      // Redireciona para o painel de finalizados após 3 segundos
      setTimeout(() => {
        window.location.href = `recrutamento.html?vaga=${vagaId}&etapa=finalizados`;
      }, 3000);
    } catch (error) {
      console.error("Erro ao finalizar comunicação e status:", error);
      mostrarAlerta(`Erro na etapa de finalização: ${error.message}`, "danger");

      btnEnviarWhatsAppFinal.disabled = false;
      btnEnviarWhatsAppFinal.innerHTML =
        '<i class="fab fa-whatsapp me-2"></i> Gerar Link WhatsApp e Finalizar';
    }
  });

  // 8. Inicialização
  carregarDados();
  formAvaliacaoGestor.addEventListener("submit", submeterAvaliacaoGestor);
});
