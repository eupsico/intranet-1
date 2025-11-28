// Arquivo: modulos/rh/js/avaliacao_continua.js
// Versão: 1.4.0 (Atualização: Layout Pesquisa Paciente e Query Parcerias)
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
  if (inputBusca) {
    inputBusca.addEventListener("input", (e) =>
      filtrarListaProfissionais360(e.target.value)
    );
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
      if (tab.dataset.tab === "avaliacao-rh") renderizarListaProfissionais360();
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
// ABA 1: MONITORAMENTO
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
        ]) // ✅ Incluído parcerias
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
      snapPB.forEach((d) => pacientesIds.add(d.id));
      snapPlantao.forEach((d) => pacientesIds.add(d.id));

      const totalPacientes = pacientesIds.size;

      if (totalPacientes === 0) continue;

      let totalSessoes = 0;
      let sessoesSemStatus = 0;
      let sessoesSemEvolucao = 0;

      const promessasSessoes = Array.from(pacientesIds).map(async (pid) => {
        const sessoesRef = collection(db, "trilhaPaciente", pid, "sessoes");
        const qSessao = query(sessoesRef, where("dataHora", ">=", dataLimite));
        const snapSessao = await getDocs(qSessao);

        snapSessao.forEach((sDoc) => {
          const sData = sDoc.data();
          totalSessoes++;

          if (sData.status === "pendente") sessoesSemStatus++;

          if (sData.status !== "pendente") {
            if (
              !sData.anotacoes ||
              !sData.anotacoes.fichaEvolucao ||
              sData.anotacoes.fichaEvolucao.trim() === ""
            ) {
              sessoesSemEvolucao++;
            }
          }
        });
      });

      await Promise.all(promessasSessoes);

      let statusConformidade = '<span class="badge bg-success">OK</span>';
      let classeLinha = "";

      if (sessoesSemStatus > 0) {
        statusConformidade =
          '<span class="badge bg-danger">Presença Pendente</span>';
        classeLinha = 'style="background-color: #fff5f5"';
      } else if (sessoesSemEvolucao > 0) {
        statusConformidade =
          '<span class="badge bg-warning text-dark">Evolução Pendente</span>';
      }

      if (totalSessoes === 0 && totalPacientes > 0) {
        statusConformidade =
          '<span class="badge bg-secondary">Sem Atividade Recente</span>';
      }

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
          <td class="text-center">${statusConformidade}</td>
          <td>
            <button class="action-button small secondary btn-detalhe-monitor" onclick="alert('Acessar detalhes do profissional ID: ${
              prof.id
            }')">
              <i class="fas fa-search"></i>
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

// ============================================
// ABA 2: AVALIAÇÃO 360
// ============================================
function renderizarListaProfissionais360() {
  const lista = document.getElementById("lista-profissionais-360");
  if (!lista) return;
  lista.innerHTML = "";
  listaProfissionais.forEach((prof) => {
    const li = document.createElement("li");
    li.className =
      "list-group-item list-group-item-action d-flex align-items-center";
    li.style.cursor = "pointer";
    li.innerHTML = `
      <img src="${prof.foto}" class="rounded-circle me-2" width="32" height="32" style="object-fit: cover">
      <span>${prof.nome}</span>
    `;
    li.onclick = () => selecionarProfissional360(prof);
    lista.appendChild(li);
  });
}

function filtrarListaProfissionais360(termo) {
  const termoLower = termo.toLowerCase();
  const itens = document.querySelectorAll("#lista-profissionais-360 li");
  itens.forEach((li) => {
    const texto = li.textContent.toLowerCase();
    li.style.display = texto.includes(termoLower) ? "flex" : "none";
  });
}

function selecionarProfissional360(prof) {
  document.getElementById("form-container-360").style.display = "block";
  document.getElementById("placeholder-360").style.display = "none";
  document.getElementById("nome-profissional-360").textContent = prof.nome;
  document.getElementById("uid-profissional-360").value = prof.id;
  document.getElementById("form-avaliacao-360").reset();
}

async function handleSalvarAvaliacao360(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = "Salvando...";

  const avaliacao = {
    avaliadoId: document.getElementById("uid-profissional-360").value,
    avaliadoNome: document.getElementById("nome-profissional-360").textContent,
    avaliadorId: currentUserData.uid,
    avaliadorNome: currentUserData.nome,
    dataAvaliacao: serverTimestamp(),
    tipo: "avaliacao_rh_interna",
    notas: {
      assiduidade: document.getElementById("nota-assiduidade").value,
      processos: document.getElementById("nota-processos").value,
      relacionamento: document.getElementById("nota-relacionamento").value,
    },
    feedbackTexto: document.getElementById("texto-feedback").value,
    enviarEmail: document.getElementById("enviar-email-feedback").checked,
  };

  try {
    await addDoc(collection(db, "avaliacoes_internas"), avaliacao);
    window.showToast("Avaliação registrada com sucesso!", "success");
    document.getElementById("form-avaliacao-360").reset();
    document.getElementById("form-container-360").style.display = "none";
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
// ABA 4: PESQUISA PACIENTE (NPS)
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
      '<tr><td colspan="4" class="text-center py-4 text-muted">Clique em "Listar Pacientes" para atualizar.</td></tr>';
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
    '<tr><td colspan="4" class="text-center py-4"><div class="loading-spinner"></div> Buscando pacientes...</td></tr>';
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

      pacientesMap.set(doc.id, {
        id: doc.id,
        nome: data.nomeCompleto,
        telefoneCelular: telefone,
        status: data.status,
      });
    };

    snapPlantao.forEach(processarDoc);
    snapPB.forEach(processarDoc);

    const listaPacientes = Array.from(pacientesMap.values());

    // ✅ Atualiza o contador
    contadorEl.textContent = listaPacientes.length;

    if (listaPacientes.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="4" class="text-center py-4 text-muted">Nenhum paciente encontrado com este status para este profissional.</td></tr>';
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
          <td class="text-end">${btnWhatsapp}</td>
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
