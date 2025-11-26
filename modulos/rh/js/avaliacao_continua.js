// Arquivo: modulos/rh/js/avaliacao_continua.js
// Versão: 1.0.0
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
} from "../../../assets/js/firebase-init.js";

let currentUserData = null;
let listaProfissionais = []; // Cache

export async function init(user, userData) {
  console.log("🔹 Avaliação Contínua: Iniciando...");
  currentUserData = userData;

  configurarAbas();
  await carregarListaProfissionais(); // Carrega lista base para os selects e monitoramento

  // Carrega aba inicial
  carregarMonitoramento();

  // Configurar busca na aba 360
  const inputBusca = document.getElementById("busca-profissional-360");
  if (inputBusca) {
    inputBusca.addEventListener("input", (e) =>
      filtrarListaProfissionais360(e.target.value)
    );
  }

  // Configurar submit form 360
  const form360 = document.getElementById("form-avaliacao-360");
  if (form360) {
    form360.addEventListener("submit", handleSalvarAvaliacao360);
  }

  // Configurar gerador NPS
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
}

// ============================================
// GESTÃO DE ABAS
// ============================================
function configurarAbas() {
  const tabs = document.querySelectorAll("#tabs-avaliacao .tab-link");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Remove active
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => (c.style.display = "none"));

      // Add active
      tab.classList.add("active");
      const targetId = `tab-${tab.dataset.tab}`;
      document.getElementById(targetId).style.display = "block";

      // Carregar dados específicos da aba se necessário
      if (tab.dataset.tab === "monitoramento") carregarMonitoramento();
      if (tab.dataset.tab === "avaliacao-rh") renderizarListaProfissionais360();
      if (tab.dataset.tab === "pesquisa-paciente") popularSelectNPS();
    });
  });
}

// ============================================
// CARREGAMENTO DE DADOS BÁSICOS
// ============================================
async function carregarListaProfissionais() {
  try {
    // Busca usuários com flag 'fazAtendimento' ou função 'atendimento'
    const q = query(
      collection(db, "usuarios"),
      where("fazAtendimento", "==", true)
    );

    const snapshot = await getDocs(q);
    listaProfissionais = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Filtra apenas ativos
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
// ABA 1: MONITORAMENTO DE CONFORMIDADE (TRILHA)
// ============================================
async function carregarMonitoramento() {
  const tbody = document.getElementById("tbody-monitoramento");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="7" class="text-center"><div class="loading-spinner"></div> Analisando trilhas... (Isso pode levar alguns segundos)</td></tr>';

  // Define período de análise (últimos 30 dias)
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);

  let html = "";

  // Para cada profissional, vamos buscar seus pacientes ativos e verificar sessões
  // NOTA: Isso é uma operação pesada. Em produção com muitos dados, idealmente seria uma Cloud Function agendada que gera um relatório diário.
  // Aqui faremos no front-end mas com cuidado.

  for (const prof of listaProfissionais) {
    try {
      // Busca pacientes vinculados ao profissional (Plantão ou PB)
      // Devido a limitações de queries compostas "OR" no Firestore v9 client-side simples, faremos duas queries ou uma busca mais ampla se possível.
      // Vamos buscar pacientes onde este profissional está no array 'profissionaisPB_ids' OU é o 'plantaoInfo.profissionalId'

      // Estratégia otimizada: Buscar pacientes ativos na trilha e filtrar em memória (se a base não for gigante)
      // Ou fazer queries específicas. Vamos tentar queries específicas.

      const qPB = query(
        collection(db, "trilhaPaciente"),
        where("profissionaisPB_ids", "array-contains", prof.id),
        where("status", "in", ["em_atendimento_pb", "aguardando_info_horarios"])
      );

      // Query Plantão
      const qPlantao = query(
        collection(db, "trilhaPaciente"),
        where("plantaoInfo.profissionalId", "==", prof.id),
        where("status", "==", "em_atendimento_plantao")
      );

      const [snapPB, snapPlantao] = await Promise.all([
        getDocs(qPB),
        getDocs(qPlantao),
      ]);

      // Unir resultados sem duplicatas
      const pacientesIds = new Set();
      snapPB.forEach((d) => pacientesIds.add(d.id));
      snapPlantao.forEach((d) => pacientesIds.add(d.id));

      const totalPacientes = pacientesIds.size;

      if (totalPacientes === 0) {
        // Se não tem pacientes, pula (ou mostra zerado)
        continue;
      }

      let totalSessoes = 0;
      let sessoesSemStatus = 0;
      let sessoesSemEvolucao = 0;

      // Verificar sessões de cada paciente (Subcoleção)
      // Limitamos a verificação para não estourar leitura
      const promessasSessoes = Array.from(pacientesIds).map(async (pid) => {
        const sessoesRef = collection(db, "trilhaPaciente", pid, "sessoes");
        // Pega sessões recentes
        const qSessao = query(sessoesRef, where("dataHora", ">=", dataLimite));
        const snapSessao = await getDocs(qSessao);

        snapSessao.forEach((sDoc) => {
          const sData = sDoc.data();
          totalSessoes++;

          if (sData.status === "pendente") {
            sessoesSemStatus++;
          }

          // Verifica evolução (assumindo que se o status não é pendente, deveria ter evolução)
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

      // Calcular conformidade
      let statusConformidade = '<span class="badge bg-success">OK</span>';
      let classeLinha = "";

      if (sessoesSemStatus > 0) {
        statusConformidade =
          '<span class="badge bg-danger">Presença Pendente</span>';
        classeLinha = 'style="background-color: #fff5f5"'; // Leve vermelho
      } else if (sessoesSemEvolucao > 0) {
        statusConformidade =
          '<span class="badge bg-warning text-dark">Evolução Pendente</span>';
      }

      if (totalSessoes === 0 && totalPacientes > 0) {
        // Pode ser um alerta se tem paciente mas não tem sessão agendada/registrada no mês
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
            <button class="action-button small secondary btn-detalhe-monitor" onclick="alert('Redirecionar para detalhes do profissional ${
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

  // Reset form
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
    // Salvar na coleção de avaliações (nova coleção sugerida)
    await addDoc(collection(db, "avaliacoes_internas"), avaliacao);

    window.showToast("Avaliação registrada com sucesso!", "success");

    // Reset UI
    document.getElementById("form-avaliacao-360").reset();
    document.getElementById("form-container-360").style.display = "none";
    document.getElementById("placeholder-360").style.display = "block";

    // Se marcou enviar email, chamar Cloud Function de email (lógica implícita aqui)
    if (avaliacao.enviarEmail) {
      // Exemplo de chamada futura: enviarEmailFeedback(avaliacao);
      console.log("Solicitação de envio de email registrada.");
    }
  } catch (error) {
    console.error("Erro ao salvar avaliação:", error);
    window.showToast("Erro ao salvar avaliação.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Salvar Avaliação";
  }
}

// ============================================
// ABA 4: PESQUISA PACIENTE (NPS)
// ============================================
function popularSelectNPS() {
  const select = document.getElementById("select-prof-nps");
  if (!select || select.options.length > 1) return; // Já populado

  select.innerHTML = '<option value="">Selecione...</option>';
  listaProfissionais.forEach((prof) => {
    const opt = document.createElement("option");
    opt.value = prof.nome; // Usamos o nome para a mensagem
    opt.textContent = prof.nome;
    select.appendChild(opt);
  });
}

function gerarMensagemNPS() {
  const nomeProf = document.getElementById("select-prof-nps").value;
  const nomePac =
    document.getElementById("nome-paciente-nps").value || "Paciente";
  const linkForm = document.getElementById("link-nps").value;

  if (!nomeProf) {
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
