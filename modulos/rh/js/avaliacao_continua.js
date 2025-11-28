// Arquivo: modulos/rh/js/avaliacao_continua.js
// Versão: 2.0.0 (Com Whatsapp de Cobrança, Stats e Form 360 Completo)
// Descrição: Gerencia o monitoramento de conformidade, avaliação 360 e feedback.

import {
  db,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  limit,
  orderBy,
} from "../../../assets/js/firebase-init.js";

let currentUserData = null;
let listaProfissionais = []; // Cache

export async function init(user, userData) {
  console.log("🔹 Avaliação Contínua: Iniciando...");
  currentUserData = userData;

  configurarAbas();
  await carregarListaProfissionais();

  // Carrega aba inicial
  carregarMonitoramento();

  // Configurações de eventos
  setupEventListeners();
}

function setupEventListeners() {
  const inputBusca = document.getElementById("busca-profissional-360");
  // Seletor da aba 360 mudou para dropdown, listener adicionado em renderizar
  const selectProf360 = document.getElementById("select-profissional-360");
  if (selectProf360) {
    selectProf360.addEventListener("change", (e) => {
      const profId = e.target.value;
      if (profId) {
        selecionarProfissional360(profId);
      } else {
        document.getElementById("form-container-360").style.display = "none";
        document.getElementById("stats-container-360").style.display = "none";
        document.getElementById("placeholder-360").style.display = "block";
      }
    });
  }

  const form360 = document.getElementById("form-avaliacao-360");
  if (form360) {
    form360.addEventListener("submit", handleSalvarAvaliacao360);
  }

  const btnNps = document.getElementById("btn-gerar-msg-nps");
  if (btnNps) {
    btnNps.addEventListener("click", gerarMensagemNPS);
  }

  const btnCopiar = document.getElementById("btn-copiar-nps");
  if (btnCopiar) {
    btnCopiar.addEventListener("click", () => {
      const txt = document.getElementById("preview-msg-nps");
      txt.select();
      document.execCommand("copy");
      window.showToast("Texto copiado!", "success");
    });
  }

  // Botão para copiar o link do formulário de feedback do voluntário
  const btnCopiarLinkFeedback = document.getElementById(
    "btn-copiar-link-feedback"
  );
  if (btnCopiarLinkFeedback) {
    btnCopiarLinkFeedback.addEventListener("click", () => {
      const urlBase =
        window.location.origin.includes("localhost") ||
        window.location.origin.includes("127.0.0.1")
          ? window.location.origin
          : "https://intranet.eupsico.org.br";

      const url = `${urlBase}/public/feedback_voluntario.html`;

      navigator.clipboard.writeText(url).then(() => {
        window.showToast("Link copiado: " + url, "success");
      });
    });
  }
}

function configurarAbas() {
  const tabs = document.querySelectorAll("#tabs-avaliacao .tab-link");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => (c.style.display = "none"));

      tab.classList.add("active");
      const targetId = `tab-${tab.dataset.tab}`;
      document.getElementById(targetId).style.display = "block";

      if (tab.dataset.tab === "monitoramento") carregarMonitoramento();
      if (tab.dataset.tab === "avaliacao-rh") popularSelectProfissionais360();
      if (tab.dataset.tab === "feedback-profissional")
        carregarFeedbacksVoluntarios();
      if (tab.dataset.tab === "pesquisa-paciente") popularSelectNPS();
    });
  });
}

async function carregarListaProfissionais() {
  try {
    const q = query(
      collection(db, "usuarios"),
      where("fazAtendimento", "==", true)
    );

    const snapshot = await getDocs(q);
    listaProfissionais = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (!data.inativo) {
        listaProfissionais.push({
          id: doc.id,
          nome: data.nome,
          email: data.email,
          foto: data.fotoUrl || "../../../assets/img/avatar-padrao.png",
          telefone: data.contato || data.telefone || "",
        });
      }
    });

    listaProfissionais.sort((a, b) => a.nome.localeCompare(b.nome));
  } catch (error) {
    console.error("Erro ao carregar profissionais:", error);
    window.showToast("Erro ao carregar lista de voluntários.", "error");
  }
}

// ============================================
// ABA 1: MONITORAMENTO (ATUALIZADO)
// ============================================
async function carregarMonitoramento() {
  const tbody = document.getElementById("tbody-monitoramento");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="7" class="text-center"><div class="loading-spinner"></div> Analisando trilhas...</td></tr>';

  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);

  let html = "";

  for (const prof of listaProfissionais) {
    try {
      const qPB = query(
        collection(db, "trilhaPaciente"),
        where("profissionaisPB_ids", "array-contains", prof.id),
        where("status", "in", [
          "em_atendimento_pb",
          "aguardando_info_horarios",
          "pacientes_parcerias",
        ])
      );

      const qPlantao = query(
        collection(db, "trilhaPaciente"),
        where("plantaoInfo.profissionalId", "==", prof.id),
        where("status", "==", "em_atendimento_plantao")
      );

      const [snapPB, snapPlantao] = await Promise.all([
        getDocs(qPB),
        getDocs(qPlantao),
      ]);

      const pacientesIds = new Set();
      const pacientesInfo = []; // Array para guardar infos para o WhatsApp

      snapPB.forEach((d) => {
        pacientesIds.add(d.id);
        pacientesInfo.push({
          id: d.id,
          nome: d.data().nomeCompleto,
          tipo: "PB",
        });
      });
      snapPlantao.forEach((d) => {
        pacientesIds.add(d.id);
        pacientesInfo.push({
          id: d.id,
          nome: d.data().nomeCompleto,
          tipo: "Plantão",
        });
      });

      const totalPacientes = pacientesIds.size;

      if (totalPacientes === 0) continue;

      let totalSessoes = 0;
      let sessoesSemStatus = 0;
      let sessoesSemEvolucao = 0;

      // Guarda detalhes das pendências para mensagem
      const pendenciasPresenca = []; // { paciente: "Nome", data: "10/10" }
      const pendenciasEvolucao = [];

      const promessasSessoes = Array.from(pacientesIds).map(async (pid) => {
        const pacienteNome =
          pacientesInfo.find((p) => p.id === pid)?.nome || "Paciente";
        const sessoesRef = collection(db, "trilhaPaciente", pid, "sessoes");
        const qSessao = query(sessoesRef, where("dataHora", ">=", dataLimite));
        const snapSessao = await getDocs(qSessao);

        snapSessao.forEach((sDoc) => {
          const sData = sDoc.data();
          totalSessoes++;
          const dataSessao = sData.dataHora
            ? new Date(sData.dataHora.seconds * 1000).toLocaleDateString(
                "pt-BR"
              )
            : "Data N/A";

          if (sData.status === "pendente") {
            sessoesSemStatus++;
            pendenciasPresenca.push({
              paciente: pacienteNome,
              data: dataSessao,
            });
          }

          if (sData.status !== "pendente") {
            if (
              !sData.anotacoes ||
              !sData.anotacoes.fichaEvolucao ||
              sData.anotacoes.fichaEvolucao.trim() === ""
            ) {
              sessoesSemEvolucao++;
              pendenciasEvolucao.push({
                paciente: pacienteNome,
                data: dataSessao,
              });
            }
          }
        });
      });

      await Promise.all(promessasSessoes);

      let statusConformidade = "OK";
      let badgeHtml = '<span class="badge bg-success">OK</span>';
      let classeLinha = "";

      if (sessoesSemStatus > 0) {
        statusConformidade = "Presença Pendente";
        badgeHtml = '<span class="badge bg-danger">Presença Pendente</span>';
        classeLinha = 'style="background-color: #fff5f5"';
      } else if (sessoesSemEvolucao > 0) {
        statusConformidade = "Evolução Pendente";
        badgeHtml =
          '<span class="badge bg-warning text-dark">Evolução Pendente</span>';
      }

      if (totalSessoes === 0 && totalPacientes > 0) {
        statusConformidade = "Sem Atividade Recente";
        badgeHtml =
          '<span class="badge bg-secondary">Sem Atividade Recente</span>';
      }

      // Encode data for button
      const dadosPendencia = encodeURIComponent(
        JSON.stringify({
          nomeProf: prof.nome,
          telefone: prof.telefone,
          status: statusConformidade,
          presencas: pendenciasPresenca,
          evolucoes: pendenciasEvolucao,
        })
      );

      html += `
        <tr ${classeLinha}>
          <td>
            <div class="d-flex align-items-center">
              <img src="${
                prof.foto
              }" class="rounded-circle me-2" width="32" height="32" style="object-fit: cover">
              <strong>${prof.nome}</strong>
            </div>
          </td>
          <td class="text-center">${totalPacientes}</td>
          <td class="text-center">${totalSessoes}</td>
          <td class="text-center text-${
            sessoesSemStatus > 0 ? "danger fw-bold" : "success"
          }">${totalSessoes - sessoesSemStatus}/${totalSessoes}</td>
          <td class="text-center text-${
            sessoesSemEvolucao > 0 ? "warning fw-bold" : "success"
          }">${totalSessoes - sessoesSemStatus - sessoesSemEvolucao}/${
        totalSessoes - sessoesSemStatus
      }</td>
          <td class="text-center">${badgeHtml}</td>
          <td class="text-end">
            <button class="action-button small whatsapp btn-cobranca-monitor" onclick="enviarWhatsAppCobranca('${dadosPendencia}')">
              <i class="fab fa-whatsapp"></i> Cobrar
            </button>
          </td>
        </tr>
      `;
    } catch (err) {
      console.error(`Erro ao processar prof ${prof.nome}`, err);
    }
  }

  if (html === "") {
    tbody.innerHTML =
      '<tr><td colspan="7" class="text-center text-muted">Nenhum dado de atendimento encontrado no período.</td></tr>';
  } else {
    tbody.innerHTML = html;
  }
}

// Função Global para o botão de cobrança
window.enviarWhatsAppCobranca = function (dadosJson) {
  const dados = JSON.parse(decodeURIComponent(dadosJson));

  if (!dados.telefone) {
    alert("Profissional sem telefone cadastrado.");
    return;
  }

  const primeiroNome = dados.nomeProf.split(" ")[0];
  let msg = `Olá ${primeiroNome}, tudo bem? 👋\n\nPassando para falar sobre os registros na Intranet (Status: *${dados.status}*).\n\n`;

  if (dados.presencas.length > 0) {
    msg += `🚨 *Falta registrar Presença/Falta:*\n`;
    dados.presencas.forEach((p) => {
      msg += `- ${p.paciente} (${p.data})\n`;
    });
    msg += `\n`;
  }

  if (dados.evolucoes.length > 0) {
    msg += `📝 *Falta preencher Evolução:*\n`;
    dados.evolucoes.forEach((e) => {
      msg += `- ${e.paciente} (${e.data})\n`;
    });
    msg += `\n`;
  }

  msg += `Por favor, regularize assim que possível para mantermos o prontuário em dia. Obrigado! 💙`;

  const link = `https://api.whatsapp.com/send?phone=55${dados.telefone.replace(
    /\D/g,
    ""
  )}&text=${encodeURIComponent(msg)}`;
  window.open(link, "_blank");
};

// ============================================
// ABA 2: AVALIAÇÃO 360 (NOVA LÓGICA)
// ============================================

function popularSelectProfissionais360() {
  const select = document.getElementById("select-profissional-360");
  if (!select) return;

  select.innerHTML = '<option value="">Selecione um profissional...</option>';
  listaProfissionais.forEach((prof) => {
    const opt = document.createElement("option");
    opt.value = prof.id;
    opt.textContent = prof.nome;
    select.appendChild(opt);
  });
}

async function selecionarProfissional360(profId) {
  const prof = listaProfissionais.find((p) => p.id === profId);
  if (!prof) return;

  document.getElementById("form-container-360").style.display = "block";
  document.getElementById("stats-container-360").style.display = "block";
  document.getElementById("placeholder-360").style.display = "none";

  document.getElementById("uid-profissional-360").value = prof.id;
  document.getElementById("nome-profissional-360-input").value = prof.nome;
  document.getElementById("form-avaliacao-360").reset();

  // Carregar Estatísticas
  await carregarEstatisticasProfissional(profId);
}

async function carregarEstatisticasProfissional(profId) {
  // Zera valores visuais
  document.getElementById("stat-sessoes-total").textContent = "...";
  document.getElementById("stat-presencas-pendentes").textContent = "...";
  document.getElementById("stat-evolucoes-pendentes").textContent = "...";
  document.getElementById("stat-conformidade").textContent = "...";

  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);

  try {
    const qPB = query(
      collection(db, "trilhaPaciente"),
      where("profissionaisPB_ids", "array-contains", profId),
      where("status", "in", [
        "em_atendimento_pb",
        "aguardando_info_horarios",
        "pacientes_parcerias",
      ])
    );

    const qPlantao = query(
      collection(db, "trilhaPaciente"),
      where("plantaoInfo.profissionalId", "==", profId),
      where("status", "==", "em_atendimento_plantao")
    );

    const [snapPB, snapPlantao] = await Promise.all([
      getDocs(qPB),
      getDocs(qPlantao),
    ]);

    const pacientesIds = new Set();
    snapPB.forEach((d) => pacientesIds.add(d.id));
    snapPlantao.forEach((d) => pacientesIds.add(d.id));

    let totalSessoes = 0;
    let pendPresenca = 0;
    let pendEvolucao = 0;

    const promessas = Array.from(pacientesIds).map(async (pid) => {
      const sessoesRef = collection(db, "trilhaPaciente", pid, "sessoes");
      const qSessao = query(sessoesRef, where("dataHora", ">=", dataLimite));
      const snapSessao = await getDocs(qSessao);
      snapSessao.forEach((doc) => {
        const data = doc.data();
        totalSessoes++;
        if (data.status === "pendente") pendPresenca++;
        else if (!data.anotacoes?.fichaEvolucao) pendEvolucao++;
      });
    });

    await Promise.all(promessas);

    document.getElementById("stat-sessoes-total").textContent = totalSessoes;
    document.getElementById("stat-presencas-pendentes").textContent =
      pendPresenca;
    document.getElementById("stat-evolucoes-pendentes").textContent =
      pendEvolucao;

    let conformidade = 100;
    if (totalSessoes > 0) {
      conformidade = Math.round(
        ((totalSessoes - pendPresenca - pendEvolucao) / totalSessoes) * 100
      );
    }
    const elConf = document.getElementById("stat-conformidade");
    elConf.textContent = conformidade + "%";

    if (conformidade < 70) elConf.className = "fw-bold text-danger";
    else if (conformidade < 90) elConf.className = "fw-bold text-warning";
    else elConf.className = "fw-bold text-success";
  } catch (error) {
    console.error("Erro stats 360:", error);
  }
}

async function handleSalvarAvaliacao360(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Salvando...";

  // Coleta os dados dos novos campos agrupados
  const formData = new FormData(e.target);

  const avaliacao = {
    avaliadoId: document.getElementById("uid-profissional-360").value,
    avaliadoNome: document.getElementById("nome-profissional-360-input").value,
    avaliadorId: currentUserData.uid,
    avaliadorNome: currentUserData.nome,
    dataAvaliacao: serverTimestamp(),
    tipo: "avaliacao_rh_interna",
    notas: {
      comunicacao_eficacia: formData.get("comunicacao_eficacia"),
      comunicacao_escuta: formData.get("comunicacao_escuta"),
      equipe_colaboracao: formData.get("equipe_colaboracao"),
      equipe_ambiente: formData.get("equipe_ambiente"),
      lideranca_inspiracao: formData.get("lideranca_inspiracao"),
      lideranca_feedback: formData.get("lideranca_feedback"),
      etica_integridade: formData.get("etica_integridade"),
      etica_prazos: formData.get("etica_prazos"),
      resultados_metas: formData.get("resultados_metas"),
      resultados_iniciativa: formData.get("resultados_iniciativa"),
      proatividade_antecipacao: formData.get("proatividade_antecipacao"),
      proatividade_responsabilidade: formData.get(
        "proatividade_responsabilidade"
      ),
      inovacao_ideias: formData.get("inovacao_ideias"),
      inovacao_projetos: formData.get("inovacao_projetos"),
      inovacao_viabilidade: formData.get("inovacao_viabilidade"),
      participacao_reunioes: formData.get("participacao_reunioes"),
      participacao_envolvimento: formData.get("participacao_envolvimento"),
      participacao_contribuicao: formData.get("participacao_contribuicao"),
    },
    feedbackTexto: document.getElementById("texto-feedback").value,
    enviarEmail: document.getElementById("enviar-email-feedback").checked,
  };

  try {
    await addDoc(collection(db, "avaliacoes_internas"), avaliacao);
    window.showToast("Avaliação registrada com sucesso!", "success");
    document.getElementById("form-avaliacao-360").reset();

    // Reseta visualização
    document.getElementById("select-profissional-360").value = "";
    document.getElementById("form-container-360").style.display = "none";
    document.getElementById("stats-container-360").style.display = "none";
    document.getElementById("placeholder-360").style.display = "block";
  } catch (error) {
    console.error("Erro ao salvar avaliação:", error);
    window.showToast("Erro ao salvar avaliação.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Salvar Avaliação";
  }
}

// ============================================
// ABA 3: FEEDBACK DO VOLUNTÁRIO
// ============================================
async function carregarFeedbacksVoluntarios() {
  const tbody = document.getElementById("tbody-feedbacks");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="6" class="text-center">Carregando feedbacks...</td></tr>';

  try {
    const q = query(
      collection(db, "feedbacks_voluntarios"),
      orderBy("dataEnvio", "desc"),
      limit(50)
    );

    const snapshot = await getDocs(q);

    let promotores = 0;
    let neutros = 0;
    let detratores = 0;
    let total = 0;
    let html = "";

    snapshot.forEach((doc) => {
      const data = doc.data();
      total++;

      const nota = parseInt(data.nps);
      if (nota >= 9) promotores++;
      else if (nota >= 7) neutros++;
      else detratores++;

      const dataEnvio = data.dataEnvio
        ? new Date(data.dataEnvio.seconds * 1000).toLocaleDateString("pt-BR")
        : "N/A";

      let corNota = "bg-secondary";
      if (nota >= 9) corNota = "bg-success";
      else if (nota <= 6) corNota = "bg-danger";
      else corNota = "bg-warning text-dark";

      html += `
        <tr>
          <td>${dataEnvio}</td>
          <td>${data.nomeVoluntario || "Anônimo"}</td>
          <td><span class="badge ${corNota}">${nota}</span></td>
          <td>${data.avaliacaoSuporte}</td>
          <td>${data.avaliacaoProcessos}</td>
          <td title="${data.sugestoes || ""}">${
        data.sugestoes
          ? data.sugestoes.substring(0, 50) +
            (data.sugestoes.length > 50 ? "..." : "")
          : "-"
      }</td>
        </tr>
      `;
    });

    if (total > 0) {
      const nps = Math.round(((promotores - detratores) / total) * 100);
      document.getElementById("metric-nps").textContent = nps;

      const elNps = document.getElementById("metric-nps");
      if (nps >= 75) elNps.className = "display-4 fw-bold text-success";
      else if (nps >= 50) elNps.className = "display-4 fw-bold text-warning";
      else elNps.className = "display-4 fw-bold text-danger";

      document.getElementById("metric-promotores").textContent = promotores;
      document.getElementById("metric-neutros").textContent = neutros;
      document.getElementById("metric-detratores").textContent = detratores;

      tbody.innerHTML = html;
    } else {
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted">Nenhum feedback recebido ainda.</td></tr>';
      document.getElementById("metric-nps").textContent = "N/A";
    }
  } catch (error) {
    console.error("Erro ao carregar feedbacks:", error);
    tbody.innerHTML = `<tr><td colspan="6" class="text-danger">Erro ao carregar dados: ${error.message}</td></tr>`;
  }
}

// ============================================
// ABA 4: PESQUISA PACIENTE (NPS) - ATUALIZADO
// ============================================
function popularSelectNPS() {
  const select = document.getElementById("nps-select-profissional");
  const statusSelect = document.getElementById("nps-select-status");
  const btnBuscar = document.getElementById("nps-btn-buscar");

  if (!select) return;

  // Evita repopular se já tiver dados
  if (select.options.length > 1) return;

  select.innerHTML = '<option value="">Selecione um profissional...</option>';

  listaProfissionais.forEach((prof) => {
    const opt = document.createElement("option");
    opt.value = prof.id;
    opt.textContent = prof.nome;
    opt.dataset.nome = prof.nome;
    select.appendChild(opt);
  });

  select.addEventListener("change", () => {
    const disabled = select.value === "";
    statusSelect.disabled = disabled;
    btnBuscar.disabled = disabled;
    document.getElementById("tbody-nps-pacientes").innerHTML =
      '<tr><td colspan="5" class="text-center py-4 text-muted">Clique em "Listar Pacientes" para atualizar.</td></tr>';
    document.getElementById("contador-pacientes-nps").textContent = "0";
  });

  btnBuscar.addEventListener("click", listarPacientesParaNPS);
}

async function listarPacientesParaNPS() {
  const profId = document.getElementById("nps-select-profissional").value;
  const profNome = document.getElementById("nps-select-profissional").options[
    document.getElementById("nps-select-profissional").selectedIndex
  ].dataset.nome;
  const statusTipo = document.getElementById("nps-select-status").value;
  const tbody = document.getElementById("tbody-nps-pacientes");
  const contadorEl = document.getElementById("contador-pacientes-nps");

  if (!profId) return;

  tbody.innerHTML =
    '<tr><td colspan="5" class="text-center py-4"><div class="loading-spinner"></div> Buscando pacientes...</td></tr>';
  contadorEl.textContent = "...";

  try {
    let statusFiltro = [];
    if (statusTipo === "ativo") {
      statusFiltro = [
        "em_atendimento_pb",
        "em_atendimento_plantao",
        "aguardando_info_horarios",
        "pacientes_parcerias", // ✅ Incluído parcerias também aqui
      ];
    } else {
      statusFiltro = [
        "alta",
        "desistencia",
        "encaminhado_grupo",
        "encaminhado_parceiro",
        "encaminhado_outro",
      ];
    }

    const qPlantao = query(
      collection(db, "trilhaPaciente"),
      where("plantaoInfo.profissionalId", "==", profId),
      where("status", "in", statusFiltro)
    );

    const qPB = query(
      collection(db, "trilhaPaciente"),
      where("profissionaisPB_ids", "array-contains", profId),
      where("status", "in", statusFiltro)
    );

    const [snapPlantao, snapPB] = await Promise.all([
      getDocs(qPlantao),
      getDocs(qPB),
    ]);

    const pacientesMap = new Map();

    const processarDoc = (doc) => {
      const data = doc.data();
      // ✅ CORREÇÃO: Garantir que telefoneCelular seja String para evitar erro no .replace()
      const telefone = data.telefoneCelular ? String(data.telefoneCelular) : "";

      // Mock de data de último envio (pode ser implementado com campo real no futuro)
      const ultimoEnvio = data.dataUltimoEnvioNPS
        ? new Date(data.dataUltimoEnvioNPS.seconds * 1000).toLocaleDateString(
            "pt-BR"
          )
        : "-";

      pacientesMap.set(doc.id, {
        id: doc.id,
        nome: data.nomeCompleto,
        telefoneCelular: telefone,
        status: data.status,
        ultimoEnvio: ultimoEnvio,
      });
    };

    snapPlantao.forEach(processarDoc);
    snapPB.forEach(processarDoc);

    const listaPacientes = Array.from(pacientesMap.values());

    // ✅ Atualiza o contador
    contadorEl.textContent = listaPacientes.length;

    if (listaPacientes.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="text-center py-4 text-muted">Nenhum paciente encontrado com este status para este profissional.</td></tr>';
      return;
    }

    let html = "";
    const baseUrl =
      window.location.origin.includes("localhost") ||
      window.location.origin.includes("127.0.0.1")
        ? window.location.origin
        : "https://intranet.eupsico.org.br";

    const pagina =
      statusTipo === "ativo"
        ? "pesquisa_paciente_ativo.html"
        : "pesquisa_paciente_inativo.html";

    listaPacientes.forEach((p) => {
      const linkPesquisa = `${baseUrl}/public/${pagina}?prof=${encodeURIComponent(
        profNome
      )}&pac=${p.id}`;

      const primeiroNome = p.nome.split(" ")[0];
      let msg = "";

      if (statusTipo === "ativo") {
        msg = `Olá ${primeiroNome}, tudo bem? 👋 Aqui é da EuPsico.\n\nGostaríamos de saber como está sendo seu atendimento. É rapidinho!\n\n🔗 ${linkPesquisa}`;
      } else {
        msg = `Olá ${primeiroNome}, tudo bem? 👋\n\nVimos que seu atendimento foi encerrado. Poderia nos contar como foi sua experiência?\n\n🔗 ${linkPesquisa}`;
      }

      // ✅ CORREÇÃO: Usando variável já convertida para String
      const linkZap = p.telefoneCelular
        ? `https://wa.me/55${p.telefoneCelular.replace(
            /\D/g,
            ""
          )}?text=${encodeURIComponent(msg)}`
        : null;

      const btnWhatsapp = linkZap
        ? `<a href="${linkZap}" target="_blank" class="action-button success small"><i class="fab fa-whatsapp"></i> Enviar</a>`
        : `<button disabled class="action-button secondary small" title="Sem telefone">Sem Tel</button>`;

      let badgeClass = "bg-secondary";
      if (p.status.includes("atendimento")) badgeClass = "bg-success";
      if (p.status === "alta") badgeClass = "bg-primary";
      if (p.status === "desistencia") badgeClass = "bg-danger";
      if (p.status === "pacientes_parcerias") badgeClass = "bg-info text-dark";

      html += `
        <tr>
          <td>${p.nome}</td>
          <td>${p.telefoneCelular || "-"}</td>
          <td><span class="badge ${badgeClass}">${p.status}</span></td>
          <td>${p.ultimoEnvio}</td> <td class="text-end">${btnWhatsapp}</td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  } catch (error) {
    console.error("Erro ao listar pacientes:", error);
    tbody.innerHTML = `<tr><td colspan="4" class="text-danger text-center">Erro ao buscar dados: ${error.message}</td></tr>`;
  }
}

function gerarMensagemNPS() {
  const nomeProf = document.getElementById("nps-select-profissional").options[
    document.getElementById("nps-select-profissional").selectedIndex
  ].text;
  const nomePac =
    document.getElementById("nome-paciente-nps").value || "Paciente";
  const linkForm = document.getElementById("link-nps").value;

  if (!document.getElementById("nps-select-profissional").value) {
    alert("Selecione um profissional.");
    return;
  }

  const msg = `Olá, ${nomePac}! 👋
  
Aqui é da equipe *EuPsico*. Esperamos que você esteja bem.

Gostaríamos muito de ouvir sua opinião sobre o atendimento realizado com o(a) profissional *${nomeProf}* e sobre nossa ONG.

Sua avaliação é rápida, anônima e nos ajuda a melhorar cada vez mais!

🔗 *Responda aqui:* ${linkForm}

Agradecemos sua participação! 💙`;

  const txtArea = document.getElementById("preview-msg-nps");
  txtArea.value = msg;

  document.getElementById("btn-copiar-nps").style.display = "block";
}
