const {
  onCall,
  HttpsError,
  onRequest,
} = require("firebase-functions/v2/https");
const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({
  origin: true,
  credentials: true,
});

// 🔐 DECLARAÇÃO DOS SECRETS
const googleAdminEmail = defineSecret("GOOGLE_ADMIN_EMAIL");
const googleWorkspaceServiceAccount = defineSecret(
  "GOOGLE_WORKSPACE_SERVICE_ACCOUNT"
);

// Inicialização dos serviços do Firebase Admin
initializeApp();
const db = getFirestore();
const adminAuth = getAuth();
const bucket = admin
  .storage()
  .bucket("eupsico-agendamentos-d2048.firebasestorage.app");

if (!admin.apps.length) {
  admin.initializeApp();
}
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
exports.getHorariosPublicos = onCall({ cors: true }, async () => {
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
        .where("dataAgendamento", "==", new Date(slot.date));

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
// FUNÇÃO: uploadCurriculo - SALVA NO FIREBASE STORAGE
// ====================================================================
exports.uploadCurriculo = onRequest(
  {
    cors: true,
    timeoutSeconds: 120,
    memory: "1GiB",
  },
  async (req, res) => {
    try {
      console.log("=== INÍCIO uploadCurriculo ===");
      console.log("Método HTTP:", req.method);

      if (req.method !== "POST") {
        console.warn("Método inválido:", req.method);
        return res.status(405).json({
          status: "error",
          message: "Método não permitido",
        });
      }

      const { fileData, mimeType, fileName, nomeCandidato, vagaTitulo } =
        req.body;

      console.log("Dados recebidos:", {
        hasFileData: !!fileData,
        fileDataLength: fileData ? fileData.length : 0,
        mimeType,
        fileName,
      });

      if (!fileData || !mimeType || !fileName) {
        console.error("Campos obrigatórios ausentes");
        return res.status(400).json({
          status: "error",
          message: "Campos obrigatórios ausentes",
        });
      }

      console.log("Convertendo base64 para Buffer...");
      const fileBuffer = Buffer.from(fileData, "base64");
      console.log("Buffer criado:", fileBuffer.length, "bytes");

      const timestamp = Date.now();
      const sanitizedNome = (nomeCandidato || "candidato")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .substring(0, 30);

      const sanitizedVaga = (vagaTitulo || "vaga")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .substring(0, 30);

      const fileExtension = fileName.split(".").pop().toLowerCase();
      const storagePath = `curriculos/${sanitizedVaga}/${timestamp}_${sanitizedNome}.${fileExtension}`;

      console.log("Caminho:", storagePath);

      const bucket = admin.storage().bucket();
      console.log("Bucket:", bucket.name);

      const file = bucket.file(storagePath);

      await file.save(fileBuffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            nomeCandidato: nomeCandidato || "N/A",
            vagaTitulo: vagaTitulo || "N/A",
            originalFileName: fileName,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      console.log("Arquivo salvo!");

      try {
        await file.makePublic();
        console.log("Arquivo tornado público");
      } catch (err) {
        console.warn("Erro ao tornar público (ignorando):", err.message);
      }

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      console.log("URL:", publicUrl);
      console.log("=== FIM - SUCESSO ===");

      return res.status(200).json({
        status: "success",
        message: "Currículo salvo!",
        fileUrl: publicUrl,
        storagePath: storagePath,
      });
    } catch (error) {
      console.error("ERRO:", error.message);
      console.error("Stack:", error.stack);
      console.log("=== FIM - ERRO ===");

      return res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
  }
);

// ====================================================================
// FUNÇÃO: salvarCandidatura - SALVA NO FIRESTORE
// ====================================================================
exports.salvarCandidatura = onCall(
  { cors: true, timeoutSeconds: 60 },
  async (request) => {
    try {
      const data = request.data;

      console.log("salvarCandidatura:", data.nome_completo);

      if (!data.vaga_id || !data.nome_completo || !data.link_curriculo_drive) {
        throw new HttpsError(
          "invalid-argument",
          "Campos obrigatórios ausentes"
        );
      }

      const novaCandidaturaData = {
        vaga_id: data.vaga_id,
        titulo_vaga_original: data.titulo_vaga_original || "",
        nome_completo: data.nome_completo,
        email_candidato: data.email_candidato || "",
        telefone_contato: data.telefone_contato || "",
        cep: data.cep || "",
        numero_endereco: data.numero_endereco || "",
        complemento_endereco: data.complemento_endereco || "",
        endereco_rua: data.endereco_rua || "",
        cidade: data.cidade || "",
        estado: data.estado || "",
        resumo_experiencia: data.resumo_experiencia || "",
        habilidades_competencias: data.habilidades_competencias || "",
        como_conheceu: data.como_conheceu || "",
        link_curriculo_drive: data.link_curriculo_drive,
        storage_path: data.storage_path || "",
        data_candidatura: FieldValue.serverTimestamp(),
        status_recrutamento: "Candidatura Recebida (Triagem Pendente)",
      };

      const docRef = await db
        .collection("candidaturas")
        .add(novaCandidaturaData);
      console.log("Candidatura salva:", docRef.id);

      return {
        success: true,
        message: "Candidatura registrada!",
        id: docRef.id,
      };
    } catch (error) {
      console.error("Erro salvarCandidatura:", error.message);
      throw new HttpsError("internal", error.message);
    }
  }
);

/**
 * URL: https://us-central1-eupsico-agendamentos-d2048.cloudfunctions.net/validarTokenTeste
 * Método: POST
 * Body: { token: "xxx" }
 *
 * Retorna dados do teste se o token for válido
 */
exports.validarTokenTeste = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      // ✅ Apenas POST permitido
      if (req.method !== "POST") {
        return res.status(405).json({
          erro: "Método não permitido. Use POST.",
        });
      }

      const { token } = req.body;

      // ✅ Valida se token foi informado
      if (!token || typeof token !== "string") {
        return res.status(400).json({
          erro: "Token inválido ou não informado",
        });
      }

      console.log(`🔹 Validando token: ${token.substring(0, 10)}...`);

      // ✅ Busca o token no Firestore
      const tokenSnap = await db
        .collection("tokens_acesso")
        .where("token", "==", token)
        .limit(1)
        .get();

      if (tokenSnap.empty) {
        console.log("❌ Token não encontrado");
        return res.status(404).json({
          erro: "Token inválido ou expirado",
        });
      }

      const tokenDoc = tokenSnap.docs[0];
      const dadosToken = tokenDoc.data();

      // ✅ Verifica se o token foi usado
      if (dadosToken.usado === true) {
        console.log("❌ Token já foi utilizado");
        return res.status(403).json({
          erro: "Este teste já foi respondido",
        });
      }

      // ✅ Verifica se o token expirou
      const agora = new Date();
      const dataExpiracao =
        dadosToken.expiraEm?.toDate?.() || dadosToken.expiraEm;

      if (dataExpiracao && agora > new Date(dataExpiracao)) {
        console.log("❌ Token expirado");
        return res.status(403).json({
          erro: "Token expirado. Solicite um novo link.",
          expiraEm: dataExpiracao?.toISOString(),
        });
      }

      // ✅ Busca o teste
      const testeSnap = await db
        .collection("estudos_de_caso")
        .doc(dadosToken.testeId)
        .get();

      if (!testeSnap.exists) {
        console.log("❌ Teste não encontrado");
        return res.status(404).json({
          erro: "Teste não encontrado",
        });
      }

      const dadosTeste = testeSnap.data();

      // ✅ Busca dados do candidato
      const candidatoSnap = await db
        .collection("candidaturas")
        .doc(dadosToken.candidatoId)
        .get();

      const dadosCandidato = candidatoSnap.exists ? candidatoSnap.data() : {};

      console.log("✅ Token validado com sucesso!");

      // ✅ Retorna dados completos
      return res.status(200).json({
        sucesso: true,
        tokenId: tokenDoc.id,
        candidato: {
          id: dadosToken.candidatoId,
          nome:
            dadosToken.nomeCandidato ||
            dadosCandidato.nome_completo ||
            "Candidato",
          email: dadosCandidato.email_candidato || "não informado",
        },
        teste: {
          id: dadosToken.testeId,
          titulo: dadosTeste.titulo || "Teste",
          descricao: dadosTeste.descricao || "",
          tipo: dadosTeste.tipo || "estudoDeCaso",
          conteudo: dadosTeste.conteudo || "",
          perguntas: dadosTeste.perguntas || [],
          tempoLimite: dadosTeste.tempo_limite_minutos || 45,
        },
        prazoDias: dadosToken.prazoDias || 7,
        expiraEm: dataExpiracao,
        diasRestantes: Math.ceil(
          (new Date(dataExpiracao) - agora) / (1000 * 60 * 60 * 24)
        ),
      });
    } catch (error) {
      console.error("❌ Erro ao validar token:", error);
      return res.status(500).json({
        erro: "Erro interno do servidor",
        detalhes: error.message,
      });
    }
  });
});

// ===================================================================
// CLOUD FUNCTION - exports.salvarRespostasTeste
// ATUALIZADA (v2.0) - Agora atualiza o status em 'testes_enviados'
// ===================================================================
exports.salvarRespostasTeste = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({
          erro: "Método não permitido. Use POST.",
        });
      }

      const { token, respostas, tempoGasto, navegador, ipAddress } = req.body;

      if (!token) {
        return res.status(400).json({
          erro: "Token não informado",
        });
      }

      console.log(
        `🔹 Salvando respostas do token: ${token.substring(0, 10)}...`
      );

      // ✅ 1. Busca o token
      const tokenSnap = await db
        .collection("tokens_acesso")
        .where("token", "==", token)
        .limit(1)
        .get();

      if (tokenSnap.empty) {
        return res.status(404).json({
          erro: "Token não encontrado",
        });
      }

      const tokenDoc = tokenSnap.docs[0];
      const dadosToken = tokenDoc.data();
      const tokenId = tokenDoc.id; // ID do documento do token

      // ✅ 2. Verifica se já foi respondido
      if (dadosToken.usado === true) {
        return res.status(403).json({
          erro: "Este teste já foi respondido",
        });
      }

      // ✅ 3. Verifica expiração
      const agora = new Date();
      const dataExpiracao =
        dadosToken.expiraEm?.toDate?.() || dadosToken.expiraEm;
      if (dataExpiracao && agora > new Date(dataExpiracao)) {
        return res.status(403).json({
          erro: "Token expirado",
        });
      }

      // ✅ 4. Atualiza o token como utilizado
      await db
        .collection("tokens_acesso")
        .doc(tokenId)
        .update({
          usado: true,
          respondidoEm: admin.firestore.FieldValue.serverTimestamp(),
          respostas: respostas || {},
          tempoRespostaSegundos: tempoGasto || 0,
          navegador: navegador || "desconhecido",
          ipAddress: ipAddress || "não registrado",
        });

      // ✅ 5. Busca dados do teste
      const testeSnap = await db
        .collection("estudos_de_caso")
        .doc(dadosToken.testeId)
        .get();

      const nomeTeste = testeSnap.exists ? testeSnap.data().titulo : "Teste";

      // ============================================
      // ✅ INÍCIO DA ATUALIZAÇÃO (REQ 1)
      // ============================================

      // 6. Busca a candidatura para atualizar o array 'testes_enviados'
      const candidaturaRef = db
        .collection("candidaturas")
        .doc(dadosToken.candidatoId);
      const candidaturaSnap = await candidaturaRef.get();

      let testesEnviadosAtualizado = [];

      // Define o link onde o RH poderá ver as respostas (ajuste se necessário)
      const linkRespostas = `/rh/painel/respostas?token=${tokenId}`;

      if (candidaturaSnap.exists) {
        const dadosCandidatura = candidaturaSnap.data();
        testesEnviadosAtualizado = dadosCandidatura.testes_enviados || [];

        // Encontra o teste enviado pelo tokenId e atualiza seu status
        const testeIndex = testesEnviadosAtualizado.findIndex(
          (t) => t.tokenId === tokenId
        );

        if (testeIndex !== -1) {
          console.log(
            `Atualizando status do teste [${testeIndex}] para 'respondido'`
          );
          testesEnviadosAtualizado[testeIndex].status = "respondido";
          testesEnviadosAtualizado[testeIndex].dataResposta = new Date();
          // Adiciona o link para o RH ver as respostas
          testesEnviadosAtualizado[testeIndex].link_respostas = linkRespostas;
        } else {
          console.warn(
            `Token ${tokenId} não encontrado no array 'testes_enviados' da candidatura ${dadosToken.candidatoId}`
          );
        }
      }

      // 7. Salva as respostas na coleção 'testes_respondidos' (como na imagem)
      // E atualiza a candidatura com o array modificado

      // Primeiro, salva as respostas na coleção principal (como na imagem)
      await db
        .collection("testes_respondidos")
        .doc(tokenId)
        .set({
          testeId: dadosToken.testeId,
          candidatoId: dadosToken.candidatoId,
          tokenId: tokenId,
          nomeTeste: nomeTeste,
          dataResposta: new Date(),
          tempoGasto: tempoGasto || 0,
          respostas: respostas || {},
          respostasCount: Object.keys(respostas || {}).length,
          titulo_vaga_original: candidaturaSnap.exists
            ? candidaturaSnap.data().titulo_vaga_original
            : "",
        });

      // Segundo, atualiza o documento da candidatura
      await candidaturaRef.update({
        testes_enviados: testesEnviadosAtualizado, // Sobrescreve o array com o status atualizado
        historico: admin.firestore.FieldValue.arrayUnion({
          data: new Date(),
          acao: `Teste respondido: ${nomeTeste}. Tempo gasto: ${tempoGasto}s`,
          usuario: "candidato_via_token",
        }),
      });
      // ============================================
      // ✅ FIM DA ATUALIZAÇÃO
      // ============================================

      console.log("✅ Respostas salvas e status atualizado com sucesso!");

      return res.status(200).json({
        sucesso: true,
        mensagem: "Respostas registradas com sucesso!",
        tokenId: tokenId,
        dataResposta: agora.toISOString(),
        tempoGasto: tempoGasto,
      });
    } catch (error) {
      console.error("❌ Erro ao salvar respostas:", error);
      return res.status(500).json({
        erro: "Erro ao salvar respostas",
        detalhes: error.message,
      });
    }
  });
});

// ============================================
// CLOUD FUNCTION: Gerar Token Teste
// ============================================

/**
 * URL: https://us-central1-eupsico-agendamentos-d2048.cloudfunctions.net/gerarTokenTeste
 * Método: POST
 * Body: { candidatoId, testeId, prazoDias }
 */
exports.gerarTokenTeste = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({
          erro: "Método não permitido. Use POST.",
        });
      }

      const { candidatoId, testeId, prazoDias = 7 } = req.body;

      if (!candidatoId || !testeId) {
        return res.status(400).json({
          erro: "candidatoId e testeId são obrigatórios",
        });
      }

      console.log(`🔹 Gerando token para candidato: ${candidatoId}`);

      // ✅ Gera token aleatório
      const token = generateRandomToken();

      // ✅ Calcula data de expiração
      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + prazoDias);

      // ✅ Busca dados do candidato
      const candSnap = await db
        .collection("candidaturas")
        .doc(candidatoId)
        .get();

      const dadosCandidato = candSnap.exists ? candSnap.data() : {};

      // ✅ Cria documento do token
      const novoToken = await db.collection("tokens_acesso").add({
        token: token,
        testeId: testeId,
        candidatoId: candidatoId,
        nomeCandidato: dadosCandidato.nome_completo || "Candidato",
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        expiraEm: dataExpiracao,
        prazoDias: prazoDias,
        usado: false,
        respondidoEm: null,
        respostas: {},
      });

      console.log("✅ Token gerado com sucesso!");

      // ✅ Retorna URL com token (usando a URL correta)
      const urlTeste = `https://intranet.eupsico.org.br/intranet-1/public/avaliacao-publica.html?token=${token}`;

      return res.status(200).json({
        sucesso: true,
        token: token,
        tokenId: novoToken.id,
        urlTeste: urlTeste,
        expiraEm: dataExpiracao.toISOString(),
        prazoDias: prazoDias,
        mensagem: "Token gerado com sucesso! Compartilhe o link acima.",
      });
    } catch (error) {
      console.error("❌ Erro ao gerar token:", error);
      return res.status(500).json({
        erro: "Erro ao gerar token",
        detalhes: error.message,
      });
    }
  });
});

// ============================================
// CLOUD FUNCTION: Listar Tokens (para debug)
// ============================================

/**
 * URL: https://us-central1-eupsico-agendamentos-d2048.cloudfunctions.net/listarTokens
 * Método: GET
 */
exports.listarTokens = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const { status, candidatoId } = req.query;

      let q = db.collection("tokens_acesso");

      if (status === "usado") {
        q = q.where("usado", "==", true);
      } else if (status === "pendente") {
        q = q.where("usado", "==", false);
      }

      if (candidatoId) {
        q = q.where("candidatoId", "==", candidatoId);
      }

      const snapshot = await q.limit(50).get();

      const tokens = [];
      snapshot.forEach((doc) => {
        tokens.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      return res.status(200).json({
        sucesso: true,
        total: tokens.length,
        tokens: tokens,
      });
    } catch (error) {
      console.error("❌ Erro ao listar tokens:", error);
      return res.status(500).json({
        erro: "Erro ao listar tokens",
        detalhes: error.message,
      });
    }
  });
});

// ============================================
// HELPER: Gerar Token Aleatório
// ============================================

function generateRandomToken() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  ).substring(0, 50);
}
// ====================================================================
// ✅ NOVA CONFIGURAÇÃO: Nodemailer para Gmail
// ====================================================================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "info@eupsico.org.br", // ⚠️ SUBSTITUIR pelo seu e-mail
    pass: "gfts qypt vwsl uvlg", // ⚠️ SUBSTITUIR pela senha de app do Gmail
  },
});

// ====================================================================
// ✅ NOVA FUNÇÃO: enviarEmail (Reutilizável) - V2
// ====================================================================
exports.enviarEmail = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const { destinatario, assunto, html, remetente } = request.data;

  if (!destinatario || !assunto || !html) {
    throw new HttpsError(
      "invalid-argument",
      "Parâmetros obrigatórios: destinatario, assunto, html"
    );
  }

  try {
    const mailOptions = {
      from: remetente || "EuPsico <atendimento@eupsico.org.br>",
      to: destinatario,
      subject: assunto,
      html: html,
    };

    await transporter.sendMail(mailOptions);

    logger.log(`✅ E-mail enviado para ${destinatario}`);
    return { success: true, message: "E-mail enviado com sucesso!" };
  } catch (error) {
    logger.error("❌ Erro ao enviar e-mail:", error);
    throw new HttpsError("internal", "Erro ao enviar e-mail.");
  }
});

// ====================================================================
// ✅ NOVA FUNÇÃO: enviarEmailGestorAgendamento (Automática) - V2
// ====================================================================
exports.enviarEmailGestorAgendamento = onDocumentUpdated(
  "agendamentos_voluntarios/{agendamentoId}",
  async (event) => {
    const novosDados = event.data.after.data();
    const dadosAntigos = event.data.before.data();

    if (!novosDados || !dadosAntigos) {
      logger.warn("Dados ausentes no evento de atualização");
      return;
    }

    const novosInscritos = [];

    novosDados.slots.forEach((slot, index) => {
      const vagasNovas = slot.vagas || [];
      const vagasAntigas = dadosAntigos.slots[index]?.vagas || [];

      if (vagasNovas.length > vagasAntigas.length) {
        const novaVaga = vagasNovas[vagasNovas.length - 1];
        novosInscritos.push({ slot, vaga: novaVaga });
      }
    });

    for (const inscrito of novosInscritos) {
      try {
        const gestorDoc = await db
          .collection("usuarios")
          .doc(inscrito.slot.gestorId)
          .get();

        if (!gestorDoc.exists) {
          logger.warn(`Gestor ${inscrito.slot.gestorId} não encontrado`);
          continue;
        }

        const gestorEmail = gestorDoc.data().email;
        const gestorNome = gestorDoc.data().nome;

        if (!gestorEmail) {
          logger.warn(`Gestor ${gestorNome} não tem e-mail cadastrado`);
          continue;
        }

        const linkCalendar = gerarLinkGoogleCalendar(
          `Reunião com ${inscrito.vaga.profissionalNome}`,
          "Reunião individual com voluntário - EuPsico",
          inscrito.slot.data,
          inscrito.slot.horaInicio,
          inscrito.slot.horaFim
        );

        const mailOptions = {
          from: "EuPsico Gestão <atendimento@eupsico.org.br>",
          to: gestorEmail,
          subject: `📅 Novo Agendamento - ${inscrito.vaga.profissionalNome}`,
          html: gerarEmailAgendamento(gestorNome, inscrito, linkCalendar),
        };

        await transporter.sendMail(mailOptions);
        logger.log(`✅ E-mail enviado para ${gestorEmail}`);
      } catch (error) {
        logger.error("❌ Erro ao enviar e-mail:", error);
      }
    }

    return null;
  }
);

// ====================================================================
// Funções auxiliares para e-mail
// ====================================================================
function gerarEmailAgendamento(gestorNome, inscrito, linkCalendar) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #003d7a; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 20px; }
        .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #003d7a; border-radius: 4px; }
        .button { display: inline-block; background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🎉 Novo Agendamento Confirmado!</h2>
        </div>
        <div class="content">
          <p>Olá, <strong>${gestorNome}</strong>!</p>
          <p>Um voluntário acaba de agendar uma reunião individual com você.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0; color: #003d7a;">📋 Detalhes da Reunião</h3>
            <p><strong>Voluntário:</strong> ${
              inscrito.vaga.profissionalNome
            }</p>
            <p><strong>Data:</strong> ${formatarDataCompleta(
              inscrito.slot.data
            )}</p>
            <p><strong>Horário:</strong> ${inscrito.slot.horaInicio} - ${
    inscrito.slot.horaFim
  }</p>
          </div>
          
          <div style="text-align: center; margin: 20px 0;">
            <a href="${linkCalendar}" class="button" target="_blank">
              📅 Adicionar ao Google Calendar
            </a>
          </div>
          
          <p style="background: #fff3cd; padding: 12px; border-radius: 4px; border-left: 4px solid #ffc107;">
            <strong>📝 Lembrete:</strong> O link do encontro online deve ser enviado por WhatsApp para o voluntário no dia agendado.
          </p>
        </div>
        <div class="footer">
          <p>Este é um e-mail automático da EuPsico.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function gerarLinkGoogleCalendar(titulo, descricao, data, horaInicio, horaFim) {
  const [ano, mes, dia] = data.split("-");
  const [horaIni, minIni] = horaInicio.split(":");
  const [horaFimStr, minFim] = horaFim.split(":");

  const dataInicio = `${ano}${mes}${dia}T${horaIni}${minIni}00`;
  const dataFimFormatada = `${ano}${mes}${dia}T${horaFimStr}${minFim}00`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: titulo,
    dates: `${dataInicio}/${dataFimFormatada}`,
    details: descricao,
    location: "Online",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function formatarDataCompleta(dataISO) {
  if (!dataISO) return "Data inválida";
  const [ano, mes, dia] = dataISO.split("-");
  const data = new Date(ano, parseInt(mes) - 1, dia);
  const diasSemana = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];
  return `${diasSemana[data.getDay()]}, ${dia}/${mes}/${ano}`;
}
// ====================================================================
// FUNÇÃO: criarEventoGoogleCalendar
// ====================================================================
exports.criarEventoGoogleCalendar = onCall({ cors: true }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Você precisa estar autenticado.");
  }

  const data = request.data;
  const {
    profissionalId,
    pacienteNome,
    data: dataAtendimento,
    horario,
    modalidade,
  } = data;

  try {
    const profissionalDoc = await db
      .collection("usuarios")
      .doc(profissionalId)
      .get();
    if (!profissionalDoc.exists) {
      throw new HttpsError("not-found", "Profissional não encontrado.");
    }

    const profissionalData = profissionalDoc.data();
    const calendarId = profissionalData.calendarId;

    if (!calendarId) {
      throw new HttpsError(
        "failed-precondition",
        "O profissional não possui um Google Calendar configurado."
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      functions.config().google.client_id,
      functions.config().google.client_secret,
      functions.config().google.redirect_uri
    );

    oauth2Client.setCredentials({
      refresh_token: profissionalData.refreshToken,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const [horaInicio, horaFim] = horario.split(" - ");
    const startDateTime = `${dataAtendimento}T${horaInicio}:00`;
    const endDateTime = `${dataAtendimento}T${horaFim}:00`;

    const evento = {
      summary: `Atendimento - ${pacienteNome}`,
      description: `Modalidade: ${modalidade}`,
      start: {
        dateTime: startDateTime,
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: endDateTime,
        timeZone: "America/Sao_Paulo",
      },
    };

    const response = await calendar.events.insert({
      calendarId: calendarId,
      resource: evento,
    });

    return {
      success: true,
      message: "Evento criado no Google Calendar com sucesso!",
      eventoId: response.data.id,
    };
  } catch (error) {
    logger.error("Erro ao criar evento no Google Calendar:", error);
    throw new HttpsError(
      "internal",
      "Erro ao criar evento no Google Calendar."
    );
  }
});

// ====================================================================
// FUNÇÃO: marcarPresenca (Trigger de atualização)
// ====================================================================
exports.marcarPresenca = onDocumentUpdated(
  "horarios/{horarioId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (before.presente === after.presente) {
      return null;
    }

    if (after.presente === true) {
      logger.log(`Presença marcada para o horário ${event.params.horarioId}`);
    }

    return null;
  }
);

// ====================================================================
// FUNÇÃO: importarPacientesBatch
// ====================================================================
// ============== FUNÇÃO CORRIGIDA: historicoEtapas sem FieldValue ==============

// Mapeamento status
const PIPEFY_TO_FIREBASE_STATUS = {
  "encaminhar para plantão": "encaminhar_para_plantao",
  "encaminhar para pb": "encaminhar_para_pb",
  "em atendimento pb": "em_atendimento_pb",
  "em atendimento plantão": "em_atendimento_plantao",
  "aguardando info dos horários": "aguardando_info_horarios",
  "aguardando info dos horários": "cadastrar_horario_psicomanager",
  parcerias: "pacientes_parcerias",
  desistência: "desistencia",
  "triagem agendada": "triagemagendada",
  alta: "alta",
  grupos: "grupos",
};

function mapearStatus(statusPipefy, fila) {
  if (!statusPipefy) return fila || "inscricaodocumentos";

  const normalized = String(statusPipefy).toLowerCase().trim();
  const mapped = PIPEFY_TO_FIREBASE_STATUS[normalized];

  if (mapped) return mapped;

  for (const [key, value] of Object.entries(PIPEFY_TO_FIREBASE_STATUS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }

  return fila || "inscricaodocumentos";
}

function validaCPF(cpf) {
  cpf = String(cpf).replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 1; i <= 9; i++) {
    soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  let resto = (soma * 10) % 11;
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

function procesarDataTriagem(dataInput) {
  try {
    if (!dataInput) return { dataTriagem: null, horaTriagem: null };

    // Se for Date object do XLSX
    if (dataInput instanceof Date) {
      const data = dataInput;
      const dataFormatada = `${data.getFullYear()}-${String(
        data.getMonth() + 1
      ).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
      const horaStr = `${String(data.getHours()).padStart(2, "0")}:${String(
        data.getMinutes()
      ).padStart(2, "0")}:${String(data.getSeconds()).padStart(2, "0")}`;
      return { dataTriagem: dataFormatada, horaTriagem: horaStr };
    }

    // Se for string
    const dataStr = String(dataInput).trim();
    const match = dataStr.match(
      /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/
    );
    if (match) {
      const [_, dia, mes, ano, horas, minutos, segundos] = match;
      return {
        dataTriagem: `${ano}-${mes}-${dia}`,
        horaTriagem: `${horas}:${minutos}:${segundos}`,
      };
    }

    return { dataTriagem: null, horaTriagem: null };
  } catch (err) {
    logger.warn(`Erro ao processar data: ${err.message}`);
    return { dataTriagem: null, horaTriagem: null };
  }
}

exports.importarPacientesBatch = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Autenticação necessária");
  }

  const adminUid = request.auth.uid;

  try {
    logger.info(`[IMPORTAÇÃO] Iniciada por ${adminUid}`);

    // Verificar permissões
    const adminUserDoc = await db.collection("usuarios").doc(adminUid).get();
    if (!adminUserDoc.exists) {
      throw new HttpsError("permission-denied", "Usuário não encontrado");
    }

    if (!adminUserDoc.data().funcoes?.includes("admin")) {
      throw new HttpsError("permission-denied", "Sem permissão de admin");
    }

    const { pacientes, fila } = request.data;

    if (!Array.isArray(pacientes) || pacientes.length === 0) {
      throw new HttpsError("invalid-argument", "Lista de pacientes vazia");
    }

    logger.info(
      `[IMPORTAÇÃO] Processando ${pacientes.length} pacientes. Fila: ${fila}`
    );

    const resultados = {
      total: pacientes.length,
      sucesso: 0,
      erros: 0,
      duplicatas: 0,
      mensagensErro: [],
      pacientesCriados: [],
    };

    const pacientesValidos = [];

    // Processar cada paciente
    for (const [index, paciente] of pacientes.entries()) {
      try {
        const cpfLimpo = String(paciente.cpf || "").replace(/\D/g, "");
        const nomeCompleto = String(paciente.nomeCompleto || "").trim();

        // Validações
        if (!nomeCompleto || nomeCompleto.length < 3) {
          resultados.erros++;
          resultados.mensagensErro.push(`Linha ${index + 2}: Nome muito curto`);
          continue;
        }

        if (!validaCPF(cpfLimpo)) {
          resultados.erros++;
          resultados.mensagensErro.push(`Linha ${index + 2}: CPF inválido`);
          continue;
        }

        // Verificar duplicatas
        const querySnapshot = await db
          .collection("trilhaPaciente")
          .where("cpf", "==", cpfLimpo)
          .limit(1)
          .get();

        if (!querySnapshot.empty) {
          resultados.duplicatas++;
          resultados.mensagensErro.push(
            `Linha ${index + 2}: CPF ${cpfLimpo} já existe`
          );
          continue;
        }

        // Processar data
        const { dataTriagem, horaTriagem } = procesarDataTriagem(
          paciente.dataTriagem
        );

        // Mapear status
        const statusFirebase = mapearStatus(paciente.status, fila);

        // ⭐ HORÁRIOS disponíveis
        const disponibilidade = {
          manha_semana:
            paciente.horarioManhaSemana === "true" ||
            paciente.horarioManhaSemana === true,
          tarde_semana:
            paciente.horarioTardeSemana === "true" ||
            paciente.horarioTardeSemana === true,
          noite_semana:
            paciente.horarioNoiteSemana === "true" ||
            paciente.horarioNoiteSemana === true,
          manha_sabado:
            paciente.horarioManhaSabado === "true" ||
            paciente.horarioManhaSabado === true,
        };

        // ⭐ CORRIGIDO: historicoEtapas usa new Date() em vez de FieldValue.serverTimestamp()
        const historicoEtapas = [
          {
            etapa: statusFirebase,
            data: new Date(), // ✅ USO DE new Date() EM VEZ DE FieldValue.serverTimestamp()
            usuario: adminUid,
          },
        ];

        // Montar card completo
        const cardData = {
          nomeCompleto,
          cpf: cpfLimpo,
          status: statusFirebase,
          etapaAtual: statusFirebase,

          // Dados pessoais
          dataNascimento: paciente.dataNascimento || null,
          genero: String(paciente.genero || "").trim(),
          estadoCivil: String(paciente.estadoCivil || "").trim(),
          escolaridade: String(paciente.escolaridade || "").trim(),
          rg: String(paciente.rg || "").trim(),

          // Contato
          telefoneCelular: String(paciente.telefoneCelular || "").trim(),
          telefoneFixo: String(paciente.telefoneFixo || "").trim(),
          email:
            String(paciente.email || "")
              .trim()
              .toLowerCase() || "não informado",

          // Endereço
          cep: String(paciente.cep || "").trim(),
          cidade: String(paciente.cidade || "").trim(),
          rua: String(paciente.rua || "").trim(),
          numeroCasa: String(paciente.numeroCasa || "").trim(),
          bairro: String(paciente.bairro || "").trim(),
          complemento: String(paciente.complemento || "").trim(),

          // Moradia
          tipoMoradia: String(paciente.tipoMoradia || "").trim(),
          pessoasMoradia: parseInt(paciente.pessoasMoradia) || 0,
          casaPropria: String(paciente.casaPropria || "").trim(),
          valorAluguel: parseFloat(paciente.valorAluguel) || 0,
          rendaMensal: parseFloat(paciente.rendaMensal) || 0,
          rendaFamiliar: parseFloat(paciente.rendaFamiliar) || 0,

          // Responsável (se menor)
          responsavelNome: String(paciente.responsavelNome || "").trim(),
          responsavelCpf: String(paciente.responsavelCpf || "").replace(
            /\D/g,
            ""
          ),
          responsavelParentesco: String(
            paciente.responsavelParentesco || ""
          ).trim(),
          responsavelContato: String(paciente.responsavelContato || "").trim(),

          // Triagem
          dataTriagem,
          horaTriagem,
          tipoTriagem: String(paciente.tipoTriagem || "").trim(),
          valorContribuicao: parseFloat(paciente.valorContribuicao) || 0,

          // Disponibilidade
          disponibilidadeHorarios: disponibilidade,
          opcoesHorarioTexto: String(paciente.opcoesHorarioTexto || "").trim(),

          // Preferências
          prefereSemModalidade: String(
            paciente.prefereSemModalidade || ""
          ).trim(),
          prefereSerAtendidoPor: String(
            paciente.prefereSerAtendidoPor || ""
          ).trim(),

          // Queixa e história
          queixaPaciente: String(paciente.queixaPaciente || "").trim(),
          motivoBusca: String(paciente.motivoBusca || "").trim(),
          tratamentoAnterior: String(paciente.tratamentoAnterior || "").trim(),

          // Plantão
          profissionalPlantao: String(
            paciente.profissionalPlantao || ""
          ).trim(),
          dataPrimeiraSessaoPlantao: paciente.dataPrimeiraSessaoPlantao || null,
          atendimentoSeraPlantao: String(
            paciente.atendimentoSeraPlantao || ""
          ).trim(),
          encaminhamentoPlantao: String(
            paciente.encaminhamentoPlantao || ""
          ).trim(),
          dataEncerramentoPlantao: paciente.dataEncerramentoPlantao || null,
          quantidadeSessoesPlantao:
            parseInt(paciente.quantidadeSessoesPlantao) || 0,

          // PB
          profissionalPB: String(paciente.profissionalPB || "").trim(),
          dataEncaminhamentoPB: paciente.dataEncaminhamentoPB || null,
          dataPrimeiraSessaoPB: paciente.dataPrimeiraSessaoPB || null,
          atendimentoSeraPB: String(paciente.atendimentoSeraPB || "").trim(),

          // Equipe
          assistenteSocial:
            paciente.assistenteSocial ||
            adminUserDoc.data().nome ||
            "Não informado",

          // ⭐ TIMESTAMPS CORRETOS (fora de arrays)
          timestamp: FieldValue.serverTimestamp(),
          lastUpdate: FieldValue.serverTimestamp(),
          lastUpdatedBy: `Importação em Lote por ${adminUid}`,

          // Status
          importadoEmLote: true,
          statusAtivo: true,

          // ⭐ historicoEtapas com new Date()
          historicoEtapas: historicoEtapas,
        };

        pacientesValidos.push({ cardData, cpf: cpfLimpo, nome: nomeCompleto });
      } catch (err) {
        logger.error(`Erro linha ${index + 2}: ${err.message}`);
        resultados.erros++;
        resultados.mensagensErro.push(`Linha ${index + 2}: ${err.message}`);
      }
    }

    // Inserir em batches
    const batchSize = 500;
    for (let i = 0; i < pacientesValidos.length; i += batchSize) {
      const chunk = pacientesValidos.slice(i, i + batchSize);
      const batch = db.batch();

      for (const { cardData } of chunk) {
        const novoCardRef = db.collection("trilhaPaciente").doc();
        batch.set(novoCardRef, cardData);
        resultados.pacientesCriados.push({
          id: novoCardRef.id,
          nome: cardData.nomeCompleto,
          status: cardData.status,
        });
      }

      await batch.commit();
      resultados.sucesso += chunk.length;
    }

    logger.info(
      `[IMPORTAÇÃO] Concluída: ${resultados.sucesso} sucessos, ${resultados.erros} erros, ${resultados.duplicatas} duplicatas`
    );

    return {
      ...resultados,
      mensagem: `✅ ${resultados.sucesso} pacientes importados com sucesso!`,
    };
  } catch (error) {
    logger.error(`[IMPORTAÇÃO] Erro fatal: ${error.message}`, error);
    throw new HttpsError("internal", `Erro: ${error.message}`);
  }
});

// Função auxiliar para gerar senha temporária
function gerarSenhaTemporaria() {
  const anoAtual = new Date().getFullYear();
  const numeroAleatorio = Math.floor(Math.random() * 1000);
  return `Eupsico${anoAtual}${numeroAleatorio}`;
}

// 📧 CLOUD FUNCTION PARA CRIAR E-MAIL NO GOOGLE WORKSPACE
// VERSÃO 2.0 - Usando Google Apps Script como proxy
exports.criarEmailGoogleWorkspace = onCall(
  {
    cors: true,
  },
  async (request) => {
    const { primeiroNome, sobrenome, email } = request.data;

    console.log("🔹 Recebendo requisição para criar e-mail:", email);

    // Validações básicas
    if (!primeiroNome || !sobrenome || !email) {
      throw new HttpsError(
        "invalid-argument",
        "Campos obrigatórios: primeiroNome, sobrenome, email"
      );
    }

    if (!email.match(/[a-z0-9.-]+@eupsico.org.br/i)) {
      throw new HttpsError(
        "invalid-argument",
        "E-mail deve estar no domínio @eupsico.org.br"
      );
    }

    try {
      // 🔗 URL do Google Apps Script (SUBSTITUA PELA SUA URL)
      const APPS_SCRIPT_URL =
        "https://script.google.com/macros/s/AKfycbz8DGNVG6P0x-Gv5VOEvP5kiyO6Rr2qqWQeA8Xvc6o0Fk9JiuzG6psxb42pSpgrF3d9DA/exec";

      const senhaTemporaria = gerarSenhaTemporaria();

      console.log("🔄 Chamando Google Apps Script para criar usuário...");

      // Fazer requisição para o Apps Script
      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          primeiroNome: primeiroNome,
          sobrenome: sobrenome,
          email: email,
          senha: senhaTemporaria,
        }),
      });

      const resultado = await response.json();

      console.log("✅ Resposta do Apps Script:", resultado);

      // Verificar se foi bem-sucedido
      if (resultado && resultado.sucesso === true) {
        console.log("✅ Usuário criado com sucesso:", resultado.usuarioId);

        return {
          sucesso: true,
          mensagem: `E-mail ${email} criado com sucesso`,
          usuarioId: resultado.usuarioId,
          email: resultado.email,
          primeiroNome: primeiroNome,
          sobrenome: sobrenome,
          senhaTemporaria: resultado.senhaTemporaria || senhaTemporaria,
        };
      } else {
        // Tratar erros específicos
        if (resultado.erro === "already_exists") {
          throw new HttpsError(
            "already-exists",
            `O e-mail ${email} já existe no Google Workspace`
          );
        }

        throw new HttpsError(
          "internal",
          resultado.mensagem || "Erro desconhecido ao criar usuário"
        );
      }
    } catch (error) {
      console.error("❌ Erro ao criar e-mail:", error);

      // Se for um HttpsError que já lançamos, repassa
      if (error instanceof HttpsError) {
        throw error;
      }

      // Tratamento de erros de rede ou outros
      if (error.message && error.message.includes("already exists")) {
        throw new HttpsError("already-exists", `O e-mail ${email} já existe`);
      }

      throw new HttpsError(
        "internal",
        `Erro ao comunicar com Google Apps Script: ${error.message}`
      );
    }
  }
);
// 🔑 CLOUD FUNCTION PARA RESETAR SENHA NO GOOGLE WORKSPACE
exports.resetarSenhaGoogleWorkspace = onCall(
  { cors: true },
  async (request) => {
    const { email, novaSenha } = request.data;

    console.log("🔹 Recebendo requisição para resetar senha:", email);

    // Validações
    if (!email) {
      throw new HttpsError("invalid-argument", "Campo obrigatório: email");
    }

    if (!email.match(/[a-z0-9.-]+@eupsico.org.br/i)) {
      throw new HttpsError(
        "invalid-argument",
        "E-mail deve estar no domínio @eupsico.org.br"
      );
    }

    try {
      const APPS_SCRIPT_URL =
        process.env.APPS_SCRIPT_URL ||
        "https://script.google.com/macros/s/AKfycbxjfXLEGUkPus6ijRV00SV7hO0LSsqND5Sh8_y1Rv9qaXcpiNVytSS5rm5h2yidkQWKDg/exec";

      const senhaTemporaria = novaSenha || gerarSenhaTemporaria();

      console.log("🔄 Chamando Google Apps Script para resetar senha...");

      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          acao: "resetar",
          email: email,
          novaSenha: senhaTemporaria,
        }),
      });

      const resultado = await response.json();

      console.log("✅ Resposta do Apps Script:", resultado);

      if (resultado && resultado.sucesso === true) {
        console.log("✅ Senha resetada com sucesso");

        return {
          sucesso: true,
          mensagem: `Senha resetada com sucesso para ${email}`,
          email: email,
          novaSenha: resultado.novaSenha,
        };
      } else {
        if (resultado.erro === "user_not_found") {
          throw new HttpsError(
            "not-found",
            `O e-mail ${email} não foi encontrado no Google Workspace`
          );
        }

        throw new HttpsError(
          "internal",
          resultado.mensagem || "Erro desconhecido ao resetar senha"
        );
      }
    } catch (error) {
      console.error("❌ Erro ao resetar senha:", error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        `Erro ao comunicar com Google Apps Script: ${error.message}`
      );
    }
  }
);
