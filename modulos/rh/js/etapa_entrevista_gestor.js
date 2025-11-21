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

  // === INÍCIO CORREÇÃO 2: Referências do Modal de Agendamento (Reutilizado) ===
  // Estas referências apontam para elementos em 'recrutamento.html'
  const modalAgendamento = document.getElementById("modal-agendamento-rh");
  const formAgendamento = document.getElementById(
    "form-agendamento-entrevista-rh"
  );
  const btnRegistrarAgendamentoRH = document.getElementById(
    "btn-registrar-agendamento-rh"
  );
  const modalAgendamentoTitulo = modalAgendamento
    ? modalAgendamento.querySelector(".modal-title-text")
    : null;
  const dataAgendadaInput = document.getElementById("data-entrevista-agendada");
  const horaAgendadaInput = document.getElementById("hora-entrevista-agendada");
  // === FIM CORREÇÃO 2 ===

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
        dadosCandidatura.entrevista_rh?.resultado === "Aprovado"
          ? "Aprovado"
          : "Reprovado/N/A";
      document.getElementById("resumo-testes-gestor").textContent =
        dadosCandidatura.avaliacao_teste?.resultado === "Aprovado"
          ? "Aprovado"
          : "Reprovado/N/A";

      // === INÍCIO CORREÇÃO 2: Listener do novo botão "Agendar Reunião Gestor" ===
      const btnAgendarGestor = document.getElementById(
        "btn-agendar-reuniao-gestor"
      );
      if (btnAgendarGestor) {
        btnAgendarGestor.addEventListener("click", () => {
          abrirModalAgendamentoGestor(dadosCandidatura);
        });
      }
      // === FIM CORREÇÃO 2 ===

      // 4.2. Preencher avaliação do gestor se já existir
      if (dadosCandidatura.entrevista_gestor?.aprovado) {
        // Verifica se APROVADO existe
        const avaliacao = dadosCandidatura.entrevista_gestor;
        document.getElementById("nome-gestor").value =
          avaliacao.nome_gestor || "";

        document.getElementById("data-entrevista-gestor").value =
          avaliacao.agendamento?.data || avaliacao.data_entrevista || "";

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

        // Se a avaliação já foi registrada, esconde o formulário e exibe a comunicação
        ultimaDecisaoGestor = avaliacao.aprovado;
        formAvaliacaoGestor.style.display = "none";
        secaoComunicacao.style.display = "block"; // Garante que a comunicação apareça
      } else {
        // === INÍCIO CORREÇÃO 1: Garantir visibilidade do formulário ===
        mostrarAlerta(
          "Candidatura aguardando a Entrevista e Avaliação Final do Gestor.",
          "warning"
        );
        // Garante que o formulário de avaliação esteja visível se nenhuma avaliação foi feita
        formAvaliacaoGestor.style.display = "block";
        secaoComunicacao.style.display = "none";
        // === FIM CORREÇÃO 1 ===

        // Preenche dados já existentes mesmo sem avaliação (Ex: agendamento)
        if (dadosCandidatura.entrevista_gestor) {
          document.getElementById("data-entrevista-gestor").value =
            dadosCandidatura.entrevista_gestor.agendamento?.data ||
            dadosCandidatura.entrevista_gestor.data_entrevista ||
            "";
          document.getElementById("nome-gestor").value =
            dadosCandidatura.entrevista_gestor.nome_gestor || "";
        }
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
    const nomeCandidato = dadosCandidatura.nome_candidato || "Candidato(a)";
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
      data_entrevista: document.getElementById("data-entrevista-gestor").value, // Mantém a data principal
      perguntas_foco: document.getElementById("perguntas-gestor").value,
      comentarios_gestor: document.getElementById("comentarios-gestor").value,
      aprovado: aprovado,
      motivo_rejeicao: motivoRejeicao,
      data_registro: firebase.firestore.FieldValue.serverTimestamp(),
      avaliador_uid: firebase.auth().currentUser
        ? firebase.auth().currentUser.uid
        : "rh_system_user",
    };

    // 6.2. Atualização no Firebase
    const novoStatusCandidato = decisao
      ? "Entrevista Gestor Aprovada (Comunicação Final)"
      : "Rejeitado (Comunicação Pendente)";

    try {
      const candidaturaRef = db.collection("candidaturas").doc(candidaturaId);

      // Mescla a nova avaliação com dados existentes (como o agendamento)
      // Usando set com merge: true para garantir que o 'agendamento' não seja perdido
      await candidaturaRef.set(
        {
          status_recrutamento: novoStatusCandidato,
          entrevista_gestor: {
            ...(dadosCandidatura.entrevista_gestor || {}), // Mantém agendamento
            ...dadosAvaliacao, // Sobrescreve com novos dados
          },
        },
        { merge: true } // Mescla com o documento existente
      );

      // Se reprovado, adiciona a rejeição
      if (!decisao) {
        await candidaturaRef.update({
          rejeicao: {
            etapa: "Entrevista com Gestor",
            justificativa: `Reprovado pelo Gestor. Motivo: ${motivoRejeicao}`,
            data: dadosAvaliacao.data_registro,
          },
        });
      }

      // Atualiza dados locais para a transição
      dadosCandidatura.entrevista_gestor = {
        ...(dadosCandidatura.entrevista_gestor || {}),
        ...dadosAvaliacao,
      };

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
  // ... (Nenhuma mudança nesta seção) ...

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

  // === INÍCIO CORREÇÃO 2: Funções de Agendamento (Reutilizando o modal do RH) ===

  /**
   * Abre o modal de agendamento (reutilizado do RH) para a entrevista com GESTOR
   */
  function abrirModalAgendamentoGestor(dados) {
    if (
      !modalAgendamento ||
      !formAgendamento ||
      !modalAgendamentoTitulo ||
      !dataAgendadaInput ||
      !horaAgendadaInput
    ) {
      console.error(
        "ERRO: Elementos do modal de agendamento do RH não encontrados."
      );
      alert(
        "Erro ao abrir o modal de agendamento. Verifique se o 'recrutamento.html' está carregado."
      );
      return;
    }

    // Mudar o título para "Gestor"
    modalAgendamentoTitulo.textContent = "Agendamento da Entrevista com Gestor";
    btnRegistrarAgendamentoRH.textContent = "Agendar Entrevista com Gestor";

    // Preencher com dados existentes da *entrevista gestor*
    const agendamentoGestor = dados.entrevista_gestor?.agendamento;
    dataAgendadaInput.value = agendamentoGestor?.data || "";
    horaAgendadaInput.value = agendamentoGestor?.hora || "";

    // Preencher infos do candidato no modal (os IDs são do modal RH)
    const nomeEl = document.getElementById("agendamento-rh-nome-candidato");
    const statusEl = document.getElementById("agendamento-rh-status-atual");
    const resumoEl = document.getElementById("agendamento-rh-resumo-triagem");

    if (nomeEl) nomeEl.textContent = dados.nome_completo || "Candidato(a)";
    if (statusEl) statusEl.textContent = dados.status_recrutamento || "N/A";
    if (resumoEl)
      resumoEl.textContent = dados.triagem_rh?.prerequisitos_atendidos || "N/A";

    // Trocar o listener do form
    // Usamos .onclick para garantir que apenas um handler esteja ativo e
    // evitamos que o listener do 'tabEntrevistas.js' seja disparado.
    formAgendamento.onsubmit = submeterAgendamentoGestor;

    // Configurar botões de fechar (eles podem ter listeners de outros scripts)
    modalAgendamento
      .querySelectorAll(
        ".close-modal-btn, [data-modal-id='modal-agendamento-rh']"
      )
      .forEach((btn) => {
        btn.onclick = (e) => {
          e.preventDefault();
          modalAgendamento.classList.remove("is-visible");
          formAgendamento.onsubmit = null; // Limpa o handler ao fechar
        };
      });

    modalAgendamento.classList.add("is-visible");
  }

  /**
   * Submete o agendamento da entrevista com GESTOR
   */
  async function submeterAgendamentoGestor(e) {
    e.preventDefault();
    console.log("Submetendo agendamento do GESTOR");

    const dataEntrevista = dataAgendadaInput.value;
    const horaEntrevista = horaAgendadaInput.value;

    if (!dataEntrevista || !horaEntrevista) {
      alert("Preencha data e hora.");
      return;
    }

    btnRegistrarAgendamentoRH.disabled = true;
    btnRegistrarAgendamentoRH.textContent = "Salvando...";

    try {
      const candidaturaRef = db.collection("candidaturas").doc(candidaturaId);

      // Salva no campo correto: 'entrevista_gestor.agendamento'
      await candidaturaRef.set(
        {
          entrevista_gestor: {
            agendamento: {
              data: dataEntrevista,
              hora: horaEntrevista,
            },
            data_entrevista: dataEntrevista, // Atualiza o campo principal também
          },
          historico: firebase.firestore.FieldValue.arrayUnion({
            data: firebase.firestore.FieldValue.serverTimestamp(),
            acao: `Agendamento Entrevista GESTOR: ${dataEntrevista} às ${horaEntrevista}.`,
            usuario: firebase.auth().currentUser
              ? firebase.auth().currentUser.uid
              : "rh_system_user",
          }),
        },
        { merge: true } // Usamos merge:true para não apagar outros dados
      );

      // Atualizar o campo no formulário principal da página
      document.getElementById("data-entrevista-gestor").value = dataEntrevista;

      // Atualizar dados locais
      if (!dadosCandidatura.entrevista_gestor) {
        dadosCandidatura.entrevista_gestor = {};
      }
      dadosCandidatura.entrevista_gestor.agendamento = {
        data: dataEntrevista,
        hora: horaEntrevista,
      };
      dadosCandidatura.entrevista_gestor.data_entrevista = dataEntrevista;

      mostrarAlerta("Agendamento com gestor salvo com sucesso!", "success");
      modalAgendamento.classList.remove("is-visible");
    } catch (error) {
      console.error("Erro ao salvar agendamento do gestor:", error);
      mostrarAlerta(`Erro ao salvar: ${error.message}`, "danger");
    } finally {
      btnRegistrarAgendamentoRH.disabled = false;
      btnRegistrarAgendamentoRH.textContent = "Agendar Entrevista"; // Reseta o texto padrão
      formAgendamento.onsubmit = null; // Limpa o handler
    }
  }

  // === FIM CORREÇÃO 2 ===

  // 8. Inicialização
  carregarDados();
  formAvaliacaoGestor.addEventListener("submit", submeterAvaliacaoGestor);
});
