// --- IMPORTAÇÕES E CONFIGURAÇÃO INICIAL ---
const { onCall, HttpsError, onRequest } = require("firebase-functions/v2/https");
const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { google } = require("googleapis");

// Inicialização dos serviços do Firebase Admin
initializeApp();
const db = getFirestore();
const adminAuth = getAuth();

// ====================================================================
// FUNÇÃO AUXILIAR: gerarUsernameUnico
// ====================================================================
async function gerarUsernameUnico(nomeCompleto) {
  const partesNome = nomeCompleto
    .trim()
    .split(/\s+/)
    .filter((p) => p);
  if (partesNome.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "O nome completo não pode estar vazio."
    );
  }

  const primeiroNome = partesNome[0];
  const ultimoNome =
    partesNome.length > 1 ? partesNome[partesNome.length - 1] : "";
  const nomesMeio = partesNome.slice(1, -1);

  const checkUsernameExists = async (username) => {
    const query = db
      .collection("usuarios")
      .where("username", "==", username)
      .limit(1);
    const snapshot = await query.get();
    return !snapshot.empty;
  };

  // Tentativa 1: "Primeiro Último"
  const usernameBase = `${primeiroNome} ${ultimoNome}`.trim();
  if (!(await checkUsernameExists(usernameBase))) return usernameBase;

  // Tentativa 2: "Primeiro InicialMeio. Último"
  if (nomesMeio.length > 0) {
    const inicialMeio = nomesMeio[0].charAt(0).toUpperCase();
    const usernameComInicial =
      `${primeiroNome} ${inicialMeio}. ${ultimoNome}`.trim();
    if (!(await checkUsernameExists(usernameComInicial))) {
      return usernameComInicial;
    }
  }

  // Tentativa 3: "Primeiro PrimeiroNomeMeio Último"
  if (nomesMeio.length > 0) {
    const primeiroNomeMeio = nomesMeio[0];
    const usernameComNomeMeio =
      `${primeiroNome} ${primeiroNomeMeio} ${ultimoNome}`.trim();
    if (!(await checkUsernameExists(usernameComNomeMeio))) {
      return usernameComNomeMeio;
    }
  }

  // Tentativa 4: Adicionar um número sequencial
  let contador = 2;
  while (true) {
    const usernameNumerado = `${usernameBase} ${contador}`;
    if (!(await checkUsernameExists(usernameNumerado))) return usernameNumerado;
    contador++;
    if (contador > 100) {
      throw new HttpsError(
        "internal",
        "Não foi possível gerar um username único."
      );
    }
  }
}

// ====================================================================
// FUNÇÃO: criarNovoProfissional
// ====================================================================
exports.criarNovoProfissional = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Você precisa estar autenticado.");
  }

  const adminUid = request.auth.uid;
  try {
    const adminUserDoc = await db.collection("usuarios").doc(adminUid).get();
    if (
      !adminUserDoc.exists ||
      !(adminUserDoc.data().funcoes || []).some((f) =>
        ["admin", "financeiro"].includes(f)
      )
    ) {
      throw new HttpsError(
        "permission-denied",
        "Você não tem permissão para criar usuários."
      );
    }

    const data = request.data;
    const usernameUnico = await gerarUsernameUnico(data.nome);
    const senhaPadrao = "eupsico@2025";

    const userRecord = await adminAuth.createUser({
      email: data.email,
      password: senhaPadrao,
      displayName: data.nome,
      disabled: false,
    });

    const uid = userRecord.uid;
    const dadosParaSalvar = {
      nome: data.nome,
      username: usernameUnico,
      email: data.email,
      contato: data.contato,
      profissao: data.profissao,
      funcoes: data.funcoes,
      inativo: data.inativo,
      recebeDireto: data.recebeDireto,
      primeiraFase: data.primeiraFase,
      fazAtendimento: data.fazAtendimento,
    };

    await db.collection("usuarios").doc(uid).set(dadosParaSalvar);

    return {
      status: "success",
      message: `Usuário ${data.nome} criado com sucesso!`,
    };
  } catch (error) {
    logger.error("Erro detalhado ao criar profissional:", error);
    if (error instanceof HttpsError) throw error;
    if (error.code === "auth/email-already-exists") {
      throw new HttpsError(
        "already-exists",
        "O e-mail fornecido já está em uso."
      );
    }
    throw new HttpsError(
      "internal",
      "Ocorreu um erro inesperado ao criar o profissional."
    );
  }
});

// ====================================================================
// FUNÇÃO: verificarCpfExistente
// ====================================================================
exports.verificarCpfExistente = onCall({ cors: true }, async (request) => {
  const cpf = request.data.cpf;
  if (!cpf) {
    throw new HttpsError("invalid-argument", "CPF/ID não fornecido.");
  }

  try {
    const trilhaRef = db.collection("trilhaPaciente");
    const snapshot = await trilhaRef.where("cpf", "==", cpf).limit(1).get();

    if (snapshot.empty) {
      return { exists: false };
    } else {
      const doc = snapshot.docs[0];
      const paciente = doc.data();
      return {
        exists: true,
        docId: doc.id,
        dados: {
          nomeCompleto: paciente.nomeCompleto || "Nome não encontrado",
          telefoneCelular: paciente.telefoneCelular || "",
          rua: paciente.rua || "",
          numeroCasa: paciente.numeroCasa || "",
          bairro: paciente.bairro || "",
          cidade: paciente.cidade || "",
          cep: paciente.cep || "",
        },
      };
    }
  } catch (error) {
    logger.error("Erro ao verificar CPF na trilha:", error);
    throw new HttpsError(
      "internal",
      "Erro interno do servidor ao verificar CPF/ID."
    );
  }
});

// ====================================================================
// FUNÇÃO: criarCardTrilhaPaciente (Trigger Firestore)
// ====================================================================
exports.criarCardTrilhaPaciente = onDocumentCreated(
  "inscricoes/{inscricaoId}",
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.warn("Nenhum dado associado ao evento de criação de inscrição.");
      return;
    }

    const inscricaoData = snap.data();

    const cardData = {
      inscricaoId: event.params.inscricaoId,
      timestamp: FieldValue.serverTimestamp(),
      lastUpdate: FieldValue.serverTimestamp(),
      lastUpdatedBy: "Sistema (Criação de Inscrição)",
      status: "inscricao_documentos",
      nomeCompleto: inscricaoData.nomeCompleto || "Não informado",
      cpf: inscricaoData.cpf || "Não informado",
      dataNascimento: inscricaoData.dataNascimento || null,
      telefoneCelular: inscricaoData.telefoneCelular || "",
      email: inscricaoData.email || "",
      rua: inscricaoData.rua || "",
      numeroCasa: inscricaoData.numeroCasa || "",
      bairro: inscricaoData.bairro || "",
      cidade: inscricaoData.cidade || "",
      cep: inscricaoData.cep || "",
      complemento: inscricaoData.complemento || "",
      responsavel: inscricaoData.responsavel || {},
      rendaMensal: inscricaoData.rendaMensal || "",
      rendaFamiliar: inscricaoData.rendaFamiliar || "",
      casaPropria: inscricaoData.casaPropria || "",
      pessoasMoradia: inscricaoData.pessoasMoradia || 0,
      motivoBusca: inscricaoData.motivoBusca || "",
      disponibilidadeGeral: inscricaoData.disponibilidadeGeral || [],
      disponibilidadeEspecifica: inscricaoData.disponibilidadeEspecifica || [],
      comoConheceu: inscricaoData.comoConheceu || "",
    };

    try {
      await db.collection("trilhaPaciente").add(cardData);
      logger.log(`Card criado com sucesso na Trilha para CPF: ${cardData.cpf}`);
    } catch (error) {
      logger.error("Erro ao criar card na Trilha:", error);
    }
  }
);

// ====================================================================
// FUNÇÃO: getTodasDisponibilidadesAssistentes
// ====================================================================
exports.getTodasDisponibilidadesAssistentes = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError(
        "unauthenticated",
        "Você precisa estar autenticado."
      );
    }
    const adminUid = request.auth.uid;

    try {
      const adminUserDoc = await db.collection("usuarios").doc(adminUid).get();
      if (
        !adminUserDoc.exists ||
        !(adminUserDoc.data().funcoes || []).includes("admin")
      ) {
        throw new HttpsError(
          "permission-denied",
          "Você não tem permissão para acessar estes dados."
        );
      }

      const dispoSnapshot = await db
        .collection("disponibilidadeAssistentes")
        .get();
      if (dispoSnapshot.empty) {
        return [];
      }

      const assistentesComDispoIds = dispoSnapshot.docs.map((doc) => doc.id);
      if (assistentesComDispoIds.length === 0) return [];

      const userPromises = assistentesComDispoIds.map((id) =>
        db.collection("usuarios").doc(id).get()
      );
      const userDocs = await Promise.all(userPromises);

      const assistentesMap = new Map();
      userDocs.forEach((doc) => {
        if (doc.exists) {
          const userData = doc.data();
          if (
            userData.funcoes?.includes("servico_social") &&
            userData.inativo === false
          ) {
            assistentesMap.set(doc.id, userData);
          }
        }
      });

      const todasDisponibilidades = [];
      dispoSnapshot.forEach((doc) => {
        if (assistentesMap.has(doc.id)) {
          const assistenteInfo = assistentesMap.get(doc.id);
          todasDisponibilidades.push({
            id: doc.id,
            nome: assistenteInfo.nome,
            disponibilidade: doc.data().disponibilidade,
          });
        }
      });

      return todasDisponibilidades;
    } catch (error) {
      logger.error("Erro em getTodasDisponibilidadesAssistentes:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError(
        "internal",
        "Não foi possível buscar as disponibilidades."
      );
    }
  }
);

// ====================================================================
// FUNÇÃO: definirTipoAgenda
// ====================================================================
exports.definirTipoAgenda = onCall({ cors: true }, async (request) => {
  logger.info("🔧 Iniciando definirTipoAgenda...");
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Você precisa estar autenticado.");
  }
  const adminUid = request.auth.uid;

  try {
    const { assistenteId, mes, modalidade, dias } = request.data;
    if (
      !assistenteId ||
      !mes ||
      !modalidade ||
      !Array.isArray(dias) ||
      dias.length === 0
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Dados insuficientes para configurar a agenda."
      );
    }

    const adminDoc = await db.collection("usuarios").doc(adminUid).get();
    if (!adminDoc.exists || !adminDoc.data()?.funcoes?.includes("admin")) {
      throw new HttpsError(
        "permission-denied",
        "Apenas administradores podem executar esta ação."
      );
    }

    const dispoSnap = await db
      .collection("disponibilidadeAssistentes")
      .doc(assistenteId)
      .get();
    const assistenteSnap = await db
      .collection("usuarios")
      .doc(assistenteId)
      .get();
    if (!dispoSnap.exists || !assistenteSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Assistente ou disponibilidade não encontrada."
      );
    }

    const dispoData = dispoSnap.data();
    const assistenteNome = assistenteSnap.data()?.nome || "Assistente";
    const bloco = dispoData.disponibilidade?.[mes]?.[modalidade];

    if (!bloco || !Array.isArray(bloco.dias) || !bloco.inicio || !bloco.fim) {
      throw new HttpsError(
        "not-found",
        `Nenhuma disponibilidade encontrada para ${mes}/${modalidade}.`
      );
    }

    const { dias: diasDisponiveis, inicio, fim } = bloco;
    const batch = db.batch();

    dias.forEach(({ dia, tipo }, index) => {
      if (!dia || !tipo) {
        throw new HttpsError(
          "invalid-argument",
          `Item inválido em dias[${index}]`
        );
      }
      if (!diasDisponiveis.includes(dia)) {
        throw new HttpsError(
          "invalid-argument",
          `Dia ${dia} não está na disponibilidade cadastrada.`
        );
      }

      const docId = `${dia}_${assistenteId}`;
      const docRef = db.collection("agendaConfigurada").doc(docId);

      batch.set(
        docRef,
        {
          assistenteId,
          assistenteNome,
          data: dia,
          tipo,
          modalidade,
          inicio,
          fim,
          configuradoPor: adminUid,
          configuradoEm: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    await batch.commit();
    logger.info("✅ Batch de agenda commitado com sucesso.");

    await db.collection("logsSistema").add({
      timestamp: FieldValue.serverTimestamp(),
      usuario: adminUid,
      acao: "Configuração de agenda",
      status: "success",
      detalhes: { assistenteId, mes, modalidade, dias },
    });

    return {
      status: "success",
      message: `${dias.length} dia(s) configurado(s) com sucesso para ${assistenteNome}!`,
    };
  } catch (error) {
    logger.error("🔥 ERRO definirTipoAgenda:", error);
    await db.collection("logsSistema").add({
      timestamp: FieldValue.serverTimestamp(),
      usuario: request.auth?.uid || "desconhecido",
      acao: "Configuração de agenda",
      status: "error",
      detalhes: { ...request.data, mensagem: error.message },
    });

    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      "internal",
      "Ocorreu um erro interno ao salvar a configuração."
    );
  }
});
// ====================================================================
// FUNÇÃO: getHorariosPublicos
// ====================================================================
exports.getHorariosPublicos = onCall({ cors: true }, async (request) => {
  try {
    logger.info("Iniciando getHorariosPublicos...");
    const agora = new Date();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataInicio = hoje.toISOString().split("T")[0];

    const configGeralDoc = await db
      .collection("configuracoesSistema")
      .doc("geral")
      .get();

    let minimoHorasAntecedencia = 24;
    let quantidadeDiasBusca = 7;

    if (configGeralDoc.exists) {
      const configData = configGeralDoc.data();
      minimoHorasAntecedencia =
        Number(configData.agendamentos?.minimoHorasAntecedencia) || 24;
      quantidadeDiasBusca =
        Number(configData.agendamentos?.quantidadeDiasBusca) || 7;
    } else {
      logger.warn(
        "Documento 'configuracoesSistema/geral' não encontrado. Usando valores padrão (24h/7d)."
      );
    }

    const dataFim = new Date(hoje);
    dataFim.setDate(hoje.getDate() + quantidadeDiasBusca);
    const dataFimISO = dataFim.toISOString().split("T")[0];
    logger.info(
      `Buscando agendas de ${dataInicio} a ${dataFimISO} com ${minimoHorasAntecedencia}h de antecedência.`
    );

    const agendamentosSnapshot = await db
      .collection("trilhaPaciente")
      .where("status", "==", "triagem_agendada")
      .where("dataTriagem", ">=", dataInicio)
      .get();

    const horariosOcupados = new Set();
    agendamentosSnapshot.forEach((doc) => {
      const agendamento = doc.data();
      if (
        agendamento.assistenteSocialId &&
        agendamento.dataTriagem &&
        agendamento.horaTriagem
      ) {
        const chave = `${agendamento.assistenteSocialId}-${agendamento.dataTriagem}-${agendamento.horaTriagem}`;
        horariosOcupados.add(chave);
      }
    });
    logger.info(`Encontrados ${horariosOcupados.size} horários já ocupados.`);

    const configSnapshot = await db
      .collection("agendaConfigurada")
      .where("tipo", "==", "triagem")
      .where("data", ">=", dataInicio)
      .where("data", "<=", dataFimISO)
      .get();

    if (configSnapshot.empty) {
      logger.warn("Nenhuma configuração de agenda encontrada para o período.");
      return { horarios: [] };
    }

    const diasConfigurados = configSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const slotsPotenciais = [];
    diasConfigurados.forEach((diaConfig) => {
      if (
        !diaConfig.inicio ||
        !diaConfig.fim ||
        typeof diaConfig.inicio !== "string" ||
        typeof diaConfig.fim !== "string"
      ) {
        logger.warn(
          `Documento ${diaConfig.id} ignorado por ter dados de início/fim inválidos ou ausentes.`
        );
        return;
      }

      const [hInicio, mInicio] = diaConfig.inicio.split(":").map(Number);
      const [hFim, mFim] = diaConfig.fim.split(":").map(Number);

      if (isNaN(hInicio) || isNaN(mInicio) || isNaN(hFim) || isNaN(mFim)) {
        logger.warn(
          `Documento ${diaConfig.id} ignorado por ter formato de hora inválido.`
        );
        return;
      }

      const inicioEmMinutos = hInicio * 60 + mInicio;
      const fimEmMinutos = hFim * 60 + mFim;

      for (
        let minutos = inicioEmMinutos;
        minutos < fimEmMinutos;
        minutos += 30
      ) {
        const hAtual = Math.floor(minutos / 60);
        const mAtual = minutos % 60;
        const horaSlot = `${String(hAtual).padStart(2, "0")}:${String(
          mAtual
        ).padStart(2, "0")}`;
        const dataHoraSlot = new Date(`${diaConfig.data}T${horaSlot}:00`);

        const diffMs = dataHoraSlot.getTime() - agora.getTime();
        const diffHoras = diffMs / (1000 * 60 * 60);

        if (diffHoras >= minimoHorasAntecedencia) {
          const chaveSlot = `${diaConfig.assistenteId}-${diaConfig.data}-${horaSlot}`;
          if (!horariosOcupados.has(chaveSlot)) {
            slotsPotenciais.push({
              id: `${diaConfig.data}_${horaSlot}_${diaConfig.assistenteId}`,
              data: diaConfig.data,
              hora: horaSlot,
              modalidade: diaConfig.modalidade,
              assistenteNome: diaConfig.assistenteNome,
              assistenteId: diaConfig.assistenteId,
            });
          }
        }
      }
    });

    logger.info(
      `Função concluída. ${slotsPotenciais.length} horários disponíveis encontrados.`
    );
    return { horarios: slotsPotenciais };
  } catch (error) {
    logger.error("❌ Erro crítico ao buscar horários públicos:", error);
    throw new HttpsError("internal", "Erro ao buscar horários públicos.", {
      originalError: error.message,
    });
  }
});

// ====================================================================
// FUNÇÃO: agendarTriagemPublico
// ====================================================================
exports.agendarTriagemPublico = onCall({ cors: true }, async (request) => {
  const {
    cpf,
    assistenteSocialId,
    assistenteSocialNome,
    data: dataAgendamento,
    hora,
    nomeCompleto,
    telefone,
  } = request.data;

  if (
    !cpf ||
    !assistenteSocialId ||
    !assistenteSocialNome ||
    !dataAgendamento ||
    !hora ||
    !nomeCompleto ||
    !telefone
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Todos os campos obrigatórios devem ser preenchidos."
    );
  }

  try {
    const trilhaRef = db.collection("trilhaPaciente");
    const q = trilhaRef
      .where("cpf", "==", cpf)
      .where("status", "==", "inscricao_documentos")
      .limit(1);
    const snapshot = await q.get();

    if (snapshot.empty) {
      throw new HttpsError(
        "not-found",
        "CPF não localizado na fila de inscrição. Por favor, entre em contato com a EuPsico para verificar seu cadastro antes de agendar."
      );
    }

    const pacienteDoc = snapshot.docs[0];
    const dadosDaTriagem = {
      status: "triagem_agendada",
      assistenteSocialNome,
      assistenteSocialId,
      dataTriagem: dataAgendamento,
      horaTriagem: hora,
      tipoTriagem: "Online",
      lastUpdate: FieldValue.serverTimestamp(),
      lastUpdatedBy: "Agendamento Público",
    };

    await pacienteDoc.ref.update(dadosDaTriagem);

    return {
      success: true,
      message:
        "Agendamento realizado e card do paciente atualizado com sucesso!",
      pacienteId: pacienteDoc.id,
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Erro interno ao tentar agendar triagem:", error);
    throw new HttpsError(
      "internal",
      "Ocorreu um erro inesperado ao processar o agendamento. Tente novamente mais tarde."
    );
  }
});

// ====================================================================
// FUNÇÃO AUXILIAR: validaCPF
// ====================================================================
function validaCPF(cpf) {
  cpf = String(cpf).replace(/[^\d]/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let soma = 0;
  let resto;
  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(9, 10))) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.substring(10, 11))) return false;
  return true;
}

// ====================================================================
// FUNÇÃO: assinarContrato
// ====================================================================
exports.assinarContrato = onCall({ cors: true }, async (request) => {
  const {
    pacienteId,
    atendimentoId,
    nomeSignatario,
    cpfSignatario,
    versaoContrato,
    ip,
  } = request.data;

  if (!pacienteId || !atendimentoId || !nomeSignatario || !cpfSignatario) {
    throw new HttpsError("invalid-argument", "Dados obrigatórios ausentes.");
  }

  if (!validaCPF(cpfSignatario)) {
    throw new HttpsError("invalid-argument", "CPF inválido.");
  }

  const cpfLimpo = String(cpfSignatario).replace(/[^\d]/g, "");
  const pacienteRef = db.collection("trilhaPaciente").doc(pacienteId);

  try {
    const docSnap = await pacienteRef.get();
    if (!docSnap.exists) {
      throw new HttpsError("not-found", "Paciente não encontrado.");
    }

    const dadosDoPaciente = docSnap.data();
    const atendimentos = dadosDoPaciente.atendimentosPB || [];
    const indiceDoAtendimento = atendimentos.findIndex(
      (at) => at.atendimentoId === atendimentoId
    );

    if (indiceDoAtendimento === -1) {
      throw new HttpsError(
        "not-found",
        "O atendimento específico para este contrato não foi encontrado."
      );
    }

    atendimentos[indiceDoAtendimento].contratoAssinado = {
      assinadoEm: new Date(),
      nomeSignatario,
      cpfSignatario: cpfLimpo,
      versaoContrato: versaoContrato || "1.0",
      ip: ip || "não identificado",
    };

    await pacienteRef.update({
      atendimentosPB: atendimentos,
      status: "em_atendimento_pb",
      lastUpdate: FieldValue.serverTimestamp(),
    });

    return { success: true, message: "Contrato assinado com sucesso." };
  } catch (error) {
    logger.error("Erro ao salvar assinatura:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      "internal",
      "Erro ao salvar assinatura no banco de dados."
    );
  }
});

// ====================================================================
// FUNÇÃO: registrarDesfechoPb
// ====================================================================
exports.registrarDesfechoPb = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "A função só pode ser chamada por um usuário autenticado."
    );
  }

  const { pacienteId, atendimentoId, desfecho, motivo, encaminhamento } =
    request.data;
  const profissionalId = request.auth.uid;

  if (!pacienteId || !atendimentoId || !desfecho) {
    throw new HttpsError(
      "invalid-argument",
      "Faltam dados essenciais (pacienteId, atendimentoId, desfecho)."
    );
  }

  const pacienteRef = db.collection("trilhaPaciente").doc(pacienteId);

  try {
    await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(pacienteRef);
      if (!docSnap.exists) {
        throw new HttpsError("not-found", "Paciente não encontrado.");
      }

      const dadosDoPaciente = docSnap.data();
      const atendimentos = dadosDoPaciente.atendimentosPB || [];
      const indiceDoAtendimento = atendimentos.findIndex(
        (at) =>
          at.atendimentoId === atendimentoId &&
          at.profissionalId === profissionalId
      );

      if (indiceDoAtendimento === -1) {
        const indiceAdmin = atendimentos.findIndex(
          (at) => at.atendimentoId === atendimentoId
        );
        if (indiceAdmin === -1) {
          throw new HttpsError(
            "permission-denied",
            "Atendimento não encontrado ou você não tem permissão para modificá-lo."
          );
        }

        atendimentos[indiceAdmin].statusAtendimento = "encerrado";
        atendimentos[indiceAdmin].desfecho = {
          tipo: desfecho,
          motivo: motivo || "",
          encaminhamento: encaminhamento || null,
          responsavelId: profissionalId,
          responsavelNome: atendimentos[indiceAdmin].profissionalNome,
          data: FieldValue.serverTimestamp(),
        };
      } else {
        atendimentos[indiceDoAtendimento].statusAtendimento = "encerrado";
        atendimentos[indiceDoAtendimento].desfecho = {
          tipo: desfecho,
          motivo: motivo || "",
          encaminhamento: encaminhamento || null,
          responsavelId: profissionalId,
          responsavelNome: atendimentos[indiceDoAtendimento].profissionalNome,
          data: FieldValue.serverTimestamp(),
        };
      }

      transaction.update(pacienteRef, {
        atendimentosPB: atendimentos,
        lastUpdate: FieldValue.serverTimestamp(),
      });
    });

    return { success: true, message: "Desfecho registrado com sucesso." };
  } catch (error) {
    logger.error("Erro ao registrar desfecho no Firestore:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      "internal",
      "Não foi possível salvar o desfecho do paciente."
    );
  }
});
// ====================================================================
// FUNÇÃO: getSupervisorSlots
// ====================================================================
exports.getSupervisorSlots = onCall({ cors: true }, async (request) => {
  const supervisorUid = request.data.supervisorUid;
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Você precisa estar autenticado para ver os horários."
    );
  }
  if (!supervisorUid) {
    throw new HttpsError(
      "invalid-argument",
      "O UID do supervisor é obrigatório."
    );
  }

  try {
    const configDoc = await db
      .collection("configuracoesSistema")
      .doc("minimoAgendaSupervisao")
      .get();

    let minimoHoras = 24;
    let quantidadeDiasSupervisao = 15;

    if (configDoc.exists) {
      const configData = configDoc.data();
      minimoHoras = parseInt(configData.minimoHoras, 10) || 24;
      quantidadeDiasSupervisao =
        parseInt(configData.quantidadeDiasSupervisao, 10) || 15;
    }

    const supervisorDoc = await db
      .collection("usuarios")
      .doc(supervisorUid)
      .get();
    if (!supervisorDoc.exists) {
      throw new HttpsError("not-found", "Supervisor não encontrado.");
    }

    const supervisorData = supervisorDoc.data();
    const diasHorarios = supervisorData.diasHorarios || [];

    const potentialSlots = [];
    const diasDaSemana = [
      "domingo",
      "segunda-feira",
      "terça-feira",
      "quarta-feira",
      "quinta-feira",
      "sexta-feira",
      "sábado",
    ];
    const hoje = new Date();
    const agora = new Date();

    for (let i = 0; i < quantidadeDiasSupervisao; i++) {
      const diaAtual = new Date();
      diaAtual.setDate(hoje.getDate() + i);
      diaAtual.setHours(0, 0, 0, 0);

      const nomeDiaSemana = diasDaSemana[diaAtual.getDay()];

      diasHorarios.forEach((horario) => {
        if (horario.dia && horario.dia.toLowerCase() === nomeDiaSemana) {
          const [h, m] = horario.inicio.split(":");
          const slotDate = new Date(diaAtual);
          slotDate.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);

          const diffMs = slotDate.getTime() - agora.getTime();
          const diffHoras = diffMs / (1000 * 60 * 60);

          if (diffHoras >= minimoHoras) {
            potentialSlots.push({
              date: slotDate.toISOString(),
              horario: horario,
            });
          }
        }
      });
    }

    const agendamentosRef = db.collection("agendamentos");
    const slotChecks = potentialSlots.map(async (slot) => {
      const q = agendamentosRef
        .where("supervisorUid", "==", supervisorUid)
        .where(
          "dataAgendamento",
          "==",
          new Date(slot.date)
        );

      const querySnapshot = await q.get();
      return {
        ...slot,
        booked: querySnapshot.size,
        capacity: calculateCapacity(slot.horario.inicio, slot.horario.fim),
      };
    });

    const finalSlots = await Promise.all(slotChecks);

    return { slots: finalSlots };
  } catch (error) {
    logger.error("Erro em getSupervisorSlots:", error);
    throw new HttpsError(
      "internal",
      "Ocorreu um erro ao buscar os horários de supervisão."
    );
  }
});

// ====================================================================
// FUNÇÃO AUXILIAR: calculateCapacity
// ====================================================================
function calculateCapacity(inicio, fim) {
  try {
    const [startH, startM] = inicio.split(":").map(Number);
    const [endH, endM] = fim.split(":").map(Number);

    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    const diffMin = endTotal - startTotal;
    if (diffMin <= 0 || !Number.isFinite(diffMin)) return 0;

    return Math.floor(diffMin / 30);
  } catch {
    return 0;
  }
}

// ====================================================================
// FUNÇÃO: gerenciarStatusGeralDoPaciente (Trigger Firestore)
// ====================================================================
exports.gerenciarStatusGeralDoPaciente = onDocumentUpdated(
  "trilhaPaciente/{pacienteId}",
  async (event) => {
    const dadosAntes = event.data.before.data();
    const dadosDepois = event.data.after.data();
    const pacienteId = event.params.pacienteId;

    if (
      JSON.stringify(dadosDepois.atendimentosPB) ===
      JSON.stringify(dadosAntes.atendimentosPB)
    ) {
      return;
    }

    const atendimentos = dadosDepois.atendimentosPB;
    if (!atendimentos || atendimentos.length === 0) {
      return;
    }

    const todosEncerrados = atendimentos.every(
      (at) => at.statusAtendimento === "encerrado"
    );
    const statusAtuaisDePB = [
      "em_atendimento_pb",
      "aguardando_info_horarios",
      "cadastrar_horario_psicomanager",
    ];

    if (todosEncerrados && statusAtuaisDePB.includes(dadosDepois.status)) {
      logger.info(
        `(ID: ${pacienteId}) Todos os atendimentos de PB foram encerrados. Atualizando status para 'alta'.`
      );
      try {
        await event.data.after.ref.update({
          status: "alta",
          lastUpdate: FieldValue.serverTimestamp(),
          lastUpdatedBy: "Sistema (Gerenciador de Status)",
        });
      } catch (error) {
        logger.error(
          `Erro ao atualizar status do paciente ${pacienteId}:`,
          error
        );
      }
    }
  }
);

// ====================================================================
// FUNÇÃO: getTodosUsuarios
// ====================================================================
exports.getTodosUsuarios = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Você precisa estar autenticado.");
  }
  const adminUid = request.auth.uid;
  try {
    const adminUserDoc = await db.collection("usuarios").doc(adminUid).get();
    if (
      !adminUserDoc.exists ||
      !(adminUserDoc.data().funcoes || []).includes("admin")
    ) {
      throw new HttpsError(
        "permission-denied",
        "Você não tem permissão para listar usuários."
      );
    }

    const listUsersResult = await adminAuth.listUsers(1000);
    const allUsersData = [];

    for (const userRecord of listUsersResult.users) {
      const userDoc = await db.collection("usuarios").doc(userRecord.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        allUsersData.push({
          uid: userRecord.uid,
          email: userRecord.email,
          nome: userData.nome || "Nome não cadastrado",
          role: (userData.funcoes || []).join(", ") || "Sem função",
        });
      } else {
        allUsersData.push({
          uid: userRecord.uid,
          email: userRecord.email,
          nome: userRecord.displayName || "Nome não encontrado",
          role: "Registro no Firestore ausente",
        });
      }
    }

    return allUsersData;
  } catch (error) {
    logger.error("Erro ao listar usuários:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Não foi possível listar os usuários.");
  }
});

// ====================================================================
// FUNÇÃO: importarPacientesBatch
// ====================================================================
exports.importarPacientesBatch = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Você precisa estar autenticado.");
  }
  const adminUid = request.auth.uid;
  try {
    const adminUserDoc = await db.collection("usuarios").doc(adminUid).get();
    if (
      !adminUserDoc.exists ||
      !adminUserDoc.data().funcoes?.includes("admin")
    ) {
      throw new HttpsError(
        "permission-denied",
        "Você não tem permissão para executar esta importação."
      );
    }

    const { pacientes, fila } = request.data;
    if (!Array.isArray(pacientes) || pacientes.length === 0 || !fila) {
      throw new HttpsError(
        "invalid-argument",
        "Dados inválidos. É necessário uma lista de pacientes e uma fila de destino."
      );
    }

    logger.info(
      `Iniciando importação de ${pacientes.length} pacientes para a fila ${fila} por ${adminUid}.`
    );

    const resultados = {
      sucesso: 0,
      erros: 0,
      total: pacientes.length,
      mensagensErro: [],
    };

    const verificacoesCpf = pacientes.map((paciente, index) => {
      const cpf = paciente.cpf ? String(paciente.cpf).replace(/\D/g, "") : null;
      if (!cpf) {
        resultados.erros++;
        resultados.mensagensErro.push(
          `Linha ${index + 2}: CPF ausente ou inválido.`
        );
        return Promise.resolve(null);
      }
      return db
        .collection("trilhaPaciente")
        .where("cpf", "==", cpf)
        .limit(1)
        .get()
        .then((snapshot) => ({ snapshot, paciente, cpf, index }));
    });

    const resultadosVerificacao = await Promise.all(verificacoesCpf);

    const batch = db.batch();
    const agora = FieldValue.serverTimestamp();

    for (const result of resultadosVerificacao) {
      if (result === null) continue;
      const { snapshot, paciente, cpf, index } = result;

      if (!paciente.nomeCompleto) {
        resultados.erros++;
        resultados.mensagensErro.push(
          `Linha ${index + 2}: O campo 'nomeCompleto' é obrigatório.`
        );
        continue;
      }
      if (!snapshot.empty) {
        resultados.erros++;
        resultados.mensagensErro.push(
          `Linha ${index + 2}: CPF ${cpf} já cadastrado no sistema.`
        );
        continue;
      }

      const novoCardRef = db.collection("trilhaPaciente").doc();
      const statusInicial = paciente.status || "inscricao_documentos";

      const dadosAdicionais = {};

      try {
        if (paciente.atendimentosPB_JSON) {
          const atendimentos = JSON.parse(paciente.atendimentosPB_JSON);
          atendimentos.forEach((at) => {
            at.atendimentoId = `imp_${novoCardRef.id}_${Math.random()
              .toString(36)
              .substr(2, 9)}`;
            at.dataInicio = agora;
          });
          dadosAdicionais.atendimentosPB = atendimentos;
        }
        if (paciente.plantaoInfo_JSON) {
          dadosAdicionais.plantaoInfo = JSON.parse(paciente.plantaoInfo_JSON);
        }
      } catch (e) {
        resultados.erros++;
        resultados.mensagensErro.push(
          `Linha ${
            index + 2
          }: Erro de formatação no JSON. Verifique as aspas e a estrutura. (${
            e.message
          })`
        );
        continue;
      }

      if (paciente.profissionaisPB_ids) {
        dadosAdicionais.profissionaisPB_ids = (
          paciente.profissionaisPB_ids || ""
        )
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
      }

      const cardData = {
        nomeCompleto: paciente.nomeCompleto,
        cpf: cpf,
        status: statusInicial,
        filaDeOrigem: fila,
        dataNascimento: paciente.dataNascimento || null,
        telefoneCelular: paciente.telefoneCelular || "",
        email: paciente.email || "",
        motivoBusca: paciente.motivoBusca || "",
        timestamp: agora,
        lastUpdate: agora,
        lastUpdatedBy: `Importação em Lote por ${adminUid}`,
        importadoEmLote: true,
        ...dadosAdicionais,
      };

      batch.set(novoCardRef, cardData);
      resultados.sucesso++;
    }

    if (resultados.sucesso > 0) {
      await batch.commit();
    }

    logger.info(
      `Importação concluída: ${resultados.sucesso} sucessos, ${resultados.erros} erros.`
    );
    return resultados;
  } catch (error) {
    logger.error("Erro geral na função importarPacientesBatch:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError(
      "internal",
      "Ocorreu um erro inesperado no servidor.",
      error.message
    );
  }
});


// ====================================================================
// FUNÇÃO: uploadCurriculo (CHAMA GOOGLE APPS SCRIPT)
// ====================================================================
// ====================================================================
// FUNÇÃO: uploadCurriculo (CHAMA GOOGLE APPS SCRIPT)
// ====================================================================
exports.uploadCurriculo = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).send('OK');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  try {
    const { fileData, mimeType, fileName, nomeCandidato, vagaTitulo } = req.body;

    if (!fileData || !mimeType || !fileName) {
      res.status(400).json({ 
        status: 'error', 
        message: 'Campos obrigatórios ausentes' 
      });
      return;
    }

    // URL DO SEU GOOGLE APPS SCRIPT (O MESMO QUE FUNCIONA NO FRONTEND)
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyV_DMfhuLYjmagAI-tGJfjYE4gtih8nXWcA17qW3SWODXQB1OJJPMYuCNIAKg9waBU/exec"; // ← COLOQUE SUA URL AQUI

    const payload = {
      fileData: fileData,
      mimeType: mimeType,
      fileName: fileName,
      nomeCandidato: nomeCandidato,
      vagaTitulo: vagaTitulo,
    };

    const gasResponse = await fetch(GAS_URL, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!gasResponse.ok) {
      throw new Error(`GAS retornou ${gasResponse.status}`);
    }

    const gasJson = await gasResponse.json();

    if (gasJson.status === 'success') {
      res.json({
        status: 'success',
        message: 'Arquivo salvo em Google Drive com sucesso!',
        fileUrl: gasJson.fileUrl
      });
    } else {
      throw new Error(gasJson.message || 'Erro no GAS');
    }

  } catch (error) {
    logger.error('❌ Erro na uploadCurriculo:', error);
    res.status(500).json({
      status: 'error',
      message: `Erro: ${error.message}`
    });
  }
});



// ====================================================================
// FUNÇÃO: salvarCandidatura
// ====================================================================
exports.salvarCandidatura = onCall({ cors: true }, async (data, context) => {
  try {
    if (!data.vaga_id || !data.nome_completo || !data.link_curriculo_drive) {
      throw new HttpsError(
        "invalid-argument",
        "Os campos vaga_id, nome_completo e link_curriculo_drive são obrigatórios."
      );
    }

    const novaCandidaturaData = {
      ...data,
      data_candidatura: FieldValue.serverTimestamp(),
      status_recrutamento: "Candidatura Recebida (Triagem Pendente)",
    };

    await db.collection("candidaturas").add(novaCandidaturaData);

    logger.info("Nova candidatura salva com sucesso.", {
      vagaId: data.vaga_id,
    });

    return { 
      success: true, 
      message: "Candidatura registrada com sucesso!" 
    };
  } catch (error) {
    logger.error("Erro ao processar candidatura:", error);
    throw new HttpsError(
      "internal",
      "Ocorreu um erro interno ao salvar sua candidatura.",
      error.message
    );
  }
});
