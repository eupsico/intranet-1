/**
 * Arquivo: modulos/rh/js/recrutamento.js
 * Versão: 3.6.0 (Refatorado para usar status_utils.js)
 * Data: 09/12/2025
 * Descrição: Controlador principal do módulo de Recrutamento e Seleção
 */

import {
  db,
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  getDoc,
  arrayUnion,
  onSnapshot,
  functions,
  httpsCallable,
} from "../../../assets/js/firebase-init.js";

// Importação dos módulos de abas (tabs)
import { renderizarCronograma } from "./tabs/tabCronograma.js";
import { renderizarTriagem } from "./tabs/tabTriagem.js";
import { renderizarEntrevistas } from "./tabs/tabEntrevistas.js";
import { renderizarEntrevistaGestor } from "./tabs/tabGestor.js";
import { renderizarFinalizados } from "./tabs/tabFinalizados.js";

// ✅ Importação do Utilitário de Status (Centralizado)
import {
  formatarStatusLegivel,
  getStatusBadgeClass,
} from "./utils/status_utils.js";

// ============================================
// CONSTANTES E COLEÇÕES DO FIRESTORE
// ============================================
const VAGAS_COLLECTION_NAME = "vagas";
const CANDIDATOS_COLLECTION_NAME = "candidaturas";

const vagasCollection = collection(db, VAGAS_COLLECTION_NAME);
const candidatosCollection = collection(db, CANDIDATOS_COLLECTION_NAME);

// ============================================
// ELEMENTOS DO DOM (CACHE)
// ============================================
const filtroVaga = document.getElementById("filtro-vaga");
const statusCandidaturaTabs = document.getElementById(
  "status-candidatura-tabs"
);
const conteudoRecrutamento = document.getElementById("conteudo-recrutamento");
const btnGerenciarConteudo = document.getElementById("btn-gestao-conteudo");

const modalCandidato = document.getElementById("modal-candidato");
const modalCandidatoBody = document.getElementById("candidato-modal-body");
const modalCandidatoFooter = document.getElementById("candidato-modal-footer");
// Cache do Template
const templateModalCandidato = document.getElementById(
  "template-modal-candidato"
);

// ============================================
// VARIÁVEIS DE ESTADO GLOBAL
// ============================================
let vagaSelecionadaId = null;
let currentUserData = {};
let dadosCandidatoAtual = null;

// ============================================
// FUNÇÕES DE UTILIDADE
// ============================================

/**
 * Formata um Timestamp do Firestore para data legível
 * @param {Object|Date} timestamp - Timestamp do Firestore ou objeto Date
 * @returns {string} Data formatada em pt-BR
 */
function formatarTimestamp(timestamp) {
  if (!timestamp) return "N/A";

  try {
    const date = timestamp.toDate
      ? timestamp.toDate()
      : typeof timestamp.seconds === "number"
      ? new Date(timestamp.seconds * 1000)
      : new Date(timestamp);

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (error) {
    console.error("Erro ao formatar timestamp:", error);
    return "Data inválida";
  }
}

/**
 * Retorna o estado global para uso em módulos filhos
 * @returns {Object} Estado global compartilhado
 */
export const getGlobalState = () => ({
  vagaSelecionadaId,
  currentUserData,
  candidatosCollection,
  vagasCollection,
  formatarTimestamp,
  formatarStatusLegivel, // ✅ Exportado do Utils
  getStatusBadgeClass, // ✅ Exportado do Utils
  conteudoRecrutamento,
  statusCandidaturaTabs,
  handleTabClick,
});

// ============================================
// CARREGAMENTO DE VAGAS
// ============================================

/**
 * Carrega lista de vagas ativas no filtro
 */
async function carregarVagasAtivas() {
  if (!filtroVaga) {
    console.warn("⚠️ Recrutamento: Elemento filtro-vaga não encontrado");
    return;
  }

  console.log("🔹 Recrutamento: Carregando vagas ativas...");

  try {
    // Query para vagas em processo de recrutamento
    const statusValidos = [
      "em-divulgacao",
      "Em Divulgação",
      "Cronograma Pendente",
      "Cronograma Definido (Triagem Pendente)",
      "Entrevista RH Pendente",
      "Testes Pendente",
      "Entrevista Gestor Pendente",
      "Contratado",
      "Encerrada",
    ];

    // Tenta primeiro com campo "status"
    let q = query(vagasCollection, where("status", "in", statusValidos));
    let snapshot = await getDocs(q);

    // Se não encontrar, tenta com campo "status_vaga"
    if (snapshot.empty) {
      q = query(vagasCollection, where("status_vaga", "in", statusValidos));
      snapshot = await getDocs(q);
    }

    // Monta as opções do select
    let htmlOptions = '<option value="">Selecione uma Vaga...</option>';

    if (snapshot.empty) {
      htmlOptions =
        '<option value="">Nenhuma vaga em processo de recrutamento.</option>';
      console.log("ℹ️ Recrutamento: Nenhuma vaga ativa encontrada");
    } else {
      snapshot.docs.forEach((docSnap) => {
        const vaga = docSnap.data();
        const titulo =
          vaga.titulo_vaga || vaga.nome || vaga.titulo || "Vaga sem título";
        const status = vaga.status_vaga || vaga.status || "Status desconhecido";

        htmlOptions += `<option value="${docSnap.id}">${titulo} - (${status})</option>`;
      });
      console.log(`✅ Recrutamento: ${snapshot.size} vagas carregadas`);
    }

    filtroVaga.innerHTML = htmlOptions;

    // Verifica se há vaga na URL (ex: ?vaga=xxx)
    const urlParams = new URLSearchParams(window.location.search);
    const vagaFromUrl = urlParams.get("vaga");

    if (vagaFromUrl && snapshot.docs.some((d) => d.id === vagaFromUrl)) {
      vagaSelecionadaId = vagaFromUrl;
      filtroVaga.value = vagaSelecionadaId;
      handleFiltroVagaChange();
    } else if (snapshot.size > 0 && filtroVaga.options.length > 1) {
      // Seleciona a primeira vaga automaticamente
      vagaSelecionadaId = snapshot.docs[0].id;
      filtroVaga.value = vagaSelecionadaId;
      handleFiltroVagaChange();
    }

    // Verifica se há etapa na URL (ex: ?etapa=triagem)
    const etapaFromUrl = urlParams.get("etapa");
    if (etapaFromUrl) {
      const targetTab = statusCandidaturaTabs.querySelector(
        `[data-status="${etapaFromUrl}"]`
      );
      if (targetTab) {
        handleTabClick({ currentTarget: targetTab });
      }
    }
  } catch (error) {
    console.error("❌ Recrutamento: Erro ao carregar vagas:", error);
    window.showToast?.("Erro ao carregar lista de vagas.", "error");

    filtroVaga.innerHTML =
      '<option value="">Erro ao carregar vagas. Tente novamente.</option>';
  }
}

// ============================================
// MODAL DE DETALHES DO CANDIDATO (REFATORADO)
// ============================================

/**
 * Abre modal com detalhes completos do candidato usando <template>
 * @param {string} candidatoId - ID do documento do candidato
 * @param {string} modo - Modo de visualização (detalhes, editar, etc.)
 * @param {Object} candidato - Dados do candidato (opcional)
 */
export async function abrirModalCandidato(candidatoId, modo, candidato) {
  if (!modalCandidato || !modalCandidatoBody || !templateModalCandidato) {
    console.error(
      "❌ Recrutamento: Modal, body ou template do candidato não encontrados"
    );
    return;
  }

  console.log(`🔹 Recrutamento: Abrindo modal para candidato ${candidatoId}`);
  modalCandidatoBody.innerHTML = '<div class="loading-spinner"></div>';
  modalCandidato.classList.add("is-visible");

  // Se os dados não foram passados, busca no Firestore
  if (!candidato) {
    try {
      const candSnap = await getDoc(doc(candidatosCollection, candidatoId));
      if (!candSnap.exists()) {
        modalCandidatoBody.innerHTML =
          '<p class="alert alert-error">Candidatura não encontrada.</p>';
        return;
      }
      candidato = candSnap.data();
    } catch (error) {
      console.error("❌ Erro ao carregar candidato:", error);
      modalCandidatoBody.innerHTML =
        '<p class="alert alert-error">Erro ao carregar os detalhes da candidatura.</p>';
      return;
    }
  }

  dadosCandidatoAtual = candidato;

  // Atualiza título do modal
  document.getElementById("candidato-nome-titulo").textContent = `Detalhes: ${
    candidato.nome_completo || candidato.nome_candidato || "Candidato(a)"
  }`;

  // 1. Clonar o template
  const clone = templateModalCandidato.content.cloneNode(true);

  // 2. Selecionar elementos pelo data-id (Helper function)
  const sel = (id) => clone.querySelector(`[data-id="${id}"]`);

  // 3. Preencher dados pessoais
  sel("nome-candidato").textContent =
    candidato.nome_completo || candidato.nome_candidato || "N/A";
  sel("email-candidato").textContent = candidato.email_candidato || "N/A";
  sel("telefone-contato").textContent = candidato.telefone_contato || "N/A";
  sel("localidade").textContent = `${candidato.cidade || "N/A"} / ${
    candidato.estado || "N/A"
  }`;
  sel("como-conheceu").textContent = candidato.como_conheceu || "N/A";

  // 4. Preencher dados profissionais
  sel("resumo-experiencia").textContent =
    candidato.resumo_experiencia || "Não informado";
  sel("habilidades").textContent =
    candidato.habilidades_competencias || "Não informadas";

  // 5. Preencher status (USANDO O NOVO FORMATADOR)
  sel("vaga-aplicada").textContent = candidato.titulo_vaga_original || "N/A";
  const statusBadge = sel("status-recrutamento");
  const statusTecnico = candidato.status_recrutamento || "N/A";

  // ✅ USA AS FUNÇÕES DO UTILS
  statusBadge.textContent = formatarStatusLegivel(statusTecnico);
  statusBadge.className = `status-badge ${getStatusBadgeClass(statusTecnico)}`;

  sel("data-candidatura").textContent = formatarTimestamp(
    candidato.data_candidatura
  );

  // 6. Preencher Triagem (se existir)
  if (candidato.triagem_rh) {
    sel("container-triagem").classList.remove("hidden");
    const resultadoTriagem = candidato.triagem_rh.apto_entrevista || "N/A";
    const badgeTriagem = sel("triagem-resultado");
    badgeTriagem.textContent = resultadoTriagem;
    badgeTriagem.className = `status-badge ${
      resultadoTriagem === "Sim" ? "status-concluída" : "status-rejeitada"
    }`;
    sel("triagem-data").textContent = formatarTimestamp(
      candidato.triagem_rh.data_avaliacao
    );
    sel("triagem-prerequisitos").textContent =
      candidato.triagem_rh.prerequisitos_atendidos || "N/A";

    if (candidato.triagem_rh.motivo_rejeicao) {
      sel("container-triagem-rejeicao").classList.remove("hidden");
      sel("triagem-motivo-rejeicao").textContent =
        candidato.triagem_rh.motivo_rejeicao;
    }
    if (candidato.triagem_rh.info_aprovacao) {
      sel("container-triagem-aprovacao").classList.remove("hidden");
      sel("triagem-info-aprovacao").textContent =
        candidato.triagem_rh.info_aprovacao;
    }
  } else {
    // Exibe placeholder se nenhuma outra avaliação existir
    if (!candidato.entrevista_rh && !candidato.rejeicao) {
      sel("container-sem-avaliacao").classList.remove("hidden");
    }
  }

  // 7. Preencher Entrevista RH (se existir)
  if (candidato.entrevista_rh) {
    sel("container-entrevista-rh").classList.remove("hidden");
    if (candidato.entrevista_rh.agendamento) {
      sel("container-entrevista-rh-agendamento").classList.remove("hidden");
      sel("entrevista-rh-agendamento").textContent = `${
        candidato.entrevista_rh.agendamento.data || "N/A"
      } às ${candidato.entrevista_rh.agendamento.hora || "N/A"}`;
    }
    if (candidato.entrevista_rh.resultado) {
      sel("container-entrevista-rh-resultado").classList.remove("hidden");
      const badgeEntrevista = sel("entrevista-rh-resultado");
      badgeEntrevista.textContent = candidato.entrevista_rh.resultado;
      badgeEntrevista.className = `status-badge ${
        candidato.entrevista_rh.resultado === "Aprovado"
          ? "status-concluída"
          : "status-rejeitada"
      }`;
    }
    if (candidato.entrevista_rh.notas) {
      sel("container-entrevista-rh-notas").classList.remove("hidden");
      sel("entrevista-rh-notas").innerHTML = `Motivação: <strong>${
        candidato.entrevista_rh.notas.motivacao || "N/A"
      }</strong> | 
        Aderência: <strong>${
          candidato.entrevista_rh.notas.aderencia || "N/A"
        }</strong> | 
        Comunicação: <strong>${
          candidato.entrevista_rh.notas.comunicacao || "N/A"
        }</strong>`;
    }
    if (candidato.entrevista_rh.pontos_fortes) {
      sel("container-entrevista-rh-fortes").classList.remove("hidden");
      sel("entrevista-rh-pontos-fortes").textContent =
        candidato.entrevista_rh.pontos_fortes;
    }
    if (candidato.entrevista_rh.pontos_atencao) {
      sel("container-entrevista-rh-atencao").classList.remove("hidden");
      sel("entrevista-rh-pontos-atencao").textContent =
        candidato.entrevista_rh.pontos_atencao;
    }
  }

  // 8. Preencher Rejeição (se existir)
  if (candidato.rejeicao?.etapa) {
    sel("container-rejeicao").classList.remove("hidden");
    sel("rejeicao-etapa").textContent = candidato.rejeicao.etapa;
    sel("rejeicao-data").textContent = formatarTimestamp(
      candidato.rejeicao.data
    );
    sel("rejeicao-justificativa").textContent =
      candidato.rejeicao.justificativa || "N/A";
  }

  // 9. Inserir o clone preenchido no DOM
  modalCandidatoBody.innerHTML = "";
  modalCandidatoBody.appendChild(clone);

  // 10. Atualiza o footer com botão de currículo e fechar
  const linkCurriculo =
    candidato.link_curriculo_drive || candidato.link_curriculo_drive || "#";
  modalCandidatoFooter.innerHTML = `
    <a href="${linkCurriculo}" target="_blank" 
       class="action-button info ms-auto" 
       ${linkCurriculo === "#" ? "disabled" : ""}>
      <i class="fas fa-file-pdf me-2"></i> Ver Currículo
    </a>
    <button type="button" class="action-button secondary fechar-modal-candidato">
      <i class="fas fa-times me-2"></i> Fechar
    </button>
  `;

  // Anexa listener ao botão de fechar (precisa ser re-anexado)
  const btnFechar = modalCandidatoFooter.querySelector(
    ".fechar-modal-candidato"
  );
  if (btnFechar) {
    btnFechar.addEventListener("click", () => {
      modalCandidato.classList.remove("is-visible");
    });
  }

  console.log("✅ Recrutamento: Modal de detalhes aberto com template");
}

// ====================================================
// FUNÇÕES RESTAURADAS (DASHBOARD, MONITOR, TOGGLES)
// ====================================================

/**
 * ✅ Alterna os campos de aprovação/reprovação no modal de triagem
 */
window.toggleMotivoAprovacaoRejeicao = function () {
  const radioAprovado = document.getElementById("modal-apto-sim");
  const radioReprovado = document.getElementById("modal-apto-nao");

  const containerAprovacao = document.getElementById(
    "modal-info-aprovacao-container"
  );
  const containerRejeicao = document.getElementById(
    "modal-motivo-rejeicao-container"
  );

  // Verificação de segurança
  if (!containerAprovacao || !containerRejeicao) {
    console.warn("toggleMotivoAprovacaoRejeicao: Containers não encontrados.");
    return;
  }

  if (radioAprovado && radioAprovado.checked) {
    containerAprovacao.classList.remove("hidden");
    containerRejeicao.classList.add("hidden");
  } else if (radioReprovado && radioReprovado.checked) {
    containerAprovacao.classList.add("hidden");
    containerRejeicao.classList.remove("hidden");
  } else {
    containerAprovacao.classList.add("hidden");
    containerRejeicao.classList.add("hidden");
  }
};

/**
 * Envia resumo das respostas do teste por email usando Cloud Function genérica (Aba Email)
 * Mantido aqui pois é chamado diretamente pelo HTML do modal, mas não está no módulo de avaliação
 */
window.enviarResumoEmailTeste = async function () {
  const emailDestino = document.getElementById("email-destino-resumo")?.value;
  const incluirGraficos = document.getElementById(
    "incluir-graficos-email"
  )?.checked;
  const btnEnviar = document.getElementById("btn-enviar-email-resumo");

  if (!emailDestino) {
    window.showToast?.("Por favor, informe um email de destino.", "error");
    return;
  }

  if (!btnEnviar) return;

  btnEnviar.disabled = true;
  btnEnviar.innerHTML =
    '<i class="fas fa-spinner fa-spin me-2"></i>Enviando...';

  try {
    const modalAvaliacaoTeste = document.getElementById(
      "modal-avaliacao-teste"
    );
    const candidatoId = modalAvaliacaoTeste?.dataset.candidaturaId;

    if (!candidatoId) {
      throw new Error("ID do candidato não encontrado");
    }

    const candidaturaRef = doc(candidatosCollection, candidatoId);
    const candidaturaSnap = await getDoc(candidaturaRef);

    if (!candidaturaSnap.exists()) {
      throw new Error("Candidatura não encontrada");
    }

    const dados = candidaturaSnap.data();
    const nomeCandidato =
      dados.nome_completo || dados.nome_candidato || "Candidato";
    const emailCandidato = dados.emailcandidato || "não informado";
    const vagaAplicada =
      dados.titulovagaoriginal || dados.titulo_vaga_original || "Não informada";

    // Busca de testesenviados ou da coleção 'testesrespondidos'
    let tokensAccesso = dados.testesenviados || [];

    if (tokensAccesso.length === 0) {
      console.log(
        "Email: Array vazio no candidato. Buscando em 'testesrespondidos'..."
      );
      try {
        const qRespostas = query(
          collection(db, "testesrespondidos"),
          where("candidatoId", "==", candidatoId)
        );
        const snapshotRespostas = await getDocs(qRespostas);

        if (!snapshotRespostas.empty) {
          tokensAccesso = snapshotRespostas.docs.map((doc) => {
            const data = doc.data();
            return {
              nomeTeste: data.nomeTeste,
              dataenvio: data.data_envio, // Normaliza nome do campo
              status: "respondido",
              tempoGasto: data.tempoGasto,
            };
          });
        }
      } catch (fetchError) {
        console.error("Erro ao buscar fallback para email:", fetchError);
      }
    }

    // ✅ MONTA O CORPO DO EMAIL EM HTML (ESTILOS INLINE SÃO NECESSÁRIOS AQUI)
    let htmlEmail = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0078d4 0%, #003d7a 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 20px; }
          .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #0078d4; border-radius: 4px; }
          .stat-box { display: inline-block; background: white; padding: 15px; margin: 10px; border-left: 4px solid #28a745; border-radius: 4px; width: 45%; }
          .stat-number { font-size: 28px; font-weight: bold; color: #0078d4; }
          .stat-label { font-size: 12px; color: #666; margin-top: 5px; }
          .table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          .table th { background: #0078d4; color: white; padding: 10px; text-align: left; }
          .table td { border-bottom: 1px solid #ddd; padding: 10px; }
          .table tr:hover { background: #f5f5f5; }
          .badge { display: inline-block; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          .badge-success { background: #d4edda; color: #155724; }
          .badge-warning { background: #fff3cd; color: #856404; }
          .badge-info { background: #d1ecf1; color: #0c5460; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; border-top: 1px solid #ddd; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>📊 Resumo de Testes - ${nomeCandidato}</h2>
          </div>
          <div class="content">
            <div class="info-box">
              <h3 style="margin-top: 0; color: #0078d4;">👤 Informações do Candidato</h3>
              <p><strong>Nome:</strong> ${nomeCandidato}</p>
              <p><strong>Email:</strong> ${emailCandidato}</p>
              <p><strong>Vaga Aplicada:</strong> ${vagaAplicada}</p>
              <p><strong>Data do Relatório:</strong> ${new Date().toLocaleDateString(
                "pt-BR",
                {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}</p>
            </div>
    `;

    // ✅ ADICIONA ESTATÍSTICAS SE MARCADO
    if (incluirGraficos) {
      const totalTestes = tokensAccesso.length;
      const testsRespondidos = tokensAccesso.filter(
        (t) => t.status === "respondido" || t.status === "avaliado"
      ).length;
      const testsPendentes = totalTestes - testsRespondidos;
      const taxaRespostaPct =
        totalTestes > 0
          ? Math.round((testsRespondidos / totalTestes) * 100)
          : 0;

      let tempoTotal = 0;
      let testComTempo = 0;
      tokensAccesso.forEach((t) => {
        if (t.tempoGasto) {
          tempoTotal += t.tempoGasto;
          testComTempo++;
        }
      });
      const tempoMedio =
        testComTempo > 0 ? Math.round(tempoTotal / testComTempo) : 0;

      htmlEmail += `
        <div class="info-box">
          <h3 style="margin-top: 0; color: #0078d4;">📈 Estatísticas Gerais</h3>
          <div style="text-align: center;">
            <div class="stat-box">
              <div class="stat-number">${totalTestes}</div>
              <div class="stat-label">Total de Testes</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">${testsRespondidos}</div>
              <div class="stat-label">Respondidos</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">${testsPendentes}</div>
              <div class="stat-label">Pendentes</div>
            </div>
            <div class="stat-box">
              <div class="stat-number">${taxaRespostaPct}%</div>
              <div class="stat-label">Taxa de Resposta</div>
            </div>
          </div>
        </div>
      `;

      // Barra de progresso
      htmlEmail += `
        <div class="info-box">
          <h4 style="margin-top: 0;">Progresso Geral</h4>
          <div style="width: 100%; height: 30px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
            <div style="width: ${taxaRespostaPct}%; height: 100%; background: linear-gradient(90deg, #28a745 0%, #20c997 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
              ${taxaRespostaPct}%
            </div>
          </div>
        </div>
      `;

      if (tempoMedio > 0) {
        htmlEmail += `
          <div class="info-box" style="border-left-color: #6f42c1;">
            <strong>⏱️ Tempo Médio de Resposta:</strong> ${Math.floor(
              tempoMedio / 60
            )}m ${tempoMedio % 60}s
          </div>
        `;
      }
    }

    // ✅ TABELA COM DETALHAMENTO DOS TESTES
    htmlEmail += `
      <div class="info-box">
        <h3 style="margin-top: 0; color: #0078d4;">📋 Detalhamento dos Testes</h3>
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Teste</th>
              <th>Data de Envio</th>
              <th>Status</th>
              <th>Tempo</th>
            </tr>
          </thead>
          <tbody>
    `;

    tokensAccesso.forEach((token, index) => {
      // Tratamento robusto para diferentes formatos de data
      let dataEnvio = "N/A";
      if (token.dataenvio?.toDate) {
        dataEnvio = token.dataenvio.toDate().toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      } else if (token.data_envio?.toDate) {
        dataEnvio = token.data_envio.toDate().toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }

      const status = token.status || "enviado";
      let statusBadge = '<span class="badge badge-warning">Pendente</span>';

      if (status === "respondido") {
        statusBadge = '<span class="badge badge-success">Respondido</span>';
      } else if (status === "avaliado") {
        statusBadge = '<span class="badge badge-info">Avaliado</span>';
      }

      const tempoExibir = token.tempoGasto
        ? `${Math.floor(token.tempoGasto / 60)}m ${token.tempoGasto % 60}s`
        : "N/A";

      htmlEmail += `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${token.nomeTeste || "Teste"}</strong></td>
          <td>${dataEnvio}</td>
          <td>${statusBadge}</td>
          <td>${tempoExibir}</td>
        </tr>
      `;
    });

    htmlEmail += `
          </tbody>
        </table>
      </div>
    `;

    // ✅ RODAPÉ
    htmlEmail += `
      <div class="footer">
        <p><strong>EuPsico - Sistema de Recrutamento e Seleção</strong></p>
        <p>Este é um e-mail automático. Não responda diretamente.</p>
      </div>
    </div>
    </body>
    </html>
    `;

    // ✅ CHAMA CLOUD FUNCTION GENÉRICA EXISTENTE
    const enviarEmail = httpsCallable(functions, "enviarEmail");

    const resultado = await enviarEmail({
      destinatario: emailDestino,
      assunto: `Resumo de Testes - ${nomeCandidato}`,
      html: htmlEmail,
      remetente: "EuPsico Recrutamento <atendimento@eupsico.org.br>",
    });

    if (resultado.data?.success) {
      window.showToast?.("Email enviado com sucesso!", "success");
      document.getElementById("email-destino-resumo").value = "";
    } else {
      throw new Error(resultado.data?.message || "Erro desconhecido ao enviar");
    }
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    window.showToast?.(`Erro ao enviar email: ${error.message}`, "error");
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.innerHTML =
      '<i class="fas fa-paper-plane me-2"></i>Enviar Resumo por Email';
  }
};

// ============================================
// REPROVAÇÃO DE CANDIDATOS
// ============================================

/**
 * Reprova uma candidatura em qualquer etapa do processo
 * @param {string} candidatoId - ID do candidato
 * @param {string} etapa - Etapa em que foi reprovado
 * @param {string} justificativaFicha - Justificativa (opcional)
 */
window.reprovarCandidatura = async function (
  candidatoId,
  etapa,
  justificativaFicha = null
) {
  console.log(
    `🔹 Recrutamento: Iniciando reprovação do candidato ${candidatoId}`
  );

  let justificativa =
    justificativaFicha ||
    prompt(
      `Confirme a reprovação do candidato nesta etapa (${etapa}). Informe a justificativa:`
    );

  if (!justificativa || justificativa.trim() === "") {
    window.showToast?.(
      "A justificativa de reprovação é obrigatória.",
      "warning"
    );
    return;
  }

  if (!confirm(`Confirmar reprovação na etapa ${etapa}?`)) {
    return;
  }

  try {
    const candidatoRef = doc(candidatosCollection, candidatoId);

    // ✅ CORREÇÃO: Usa "REPROVADO" como status padronizado
    await updateDoc(candidatoRef, {
      status_recrutamento: "REPROVADO",
      "rejeicao.etapa": etapa,
      "rejeicao.data": new Date(),
      "rejeicao.justificativa": justificativa,
      historico: arrayUnion({
        data: new Date(),
        acao: `Candidatura REJEITADA na etapa de ${etapa}. Motivo: ${justificativa}`,
        usuario: currentUserData.uid || "sistema",
      }),
    });

    window.showToast?.(`Candidatura rejeitada na etapa ${etapa}.`, "success");
    console.log("✅ Recrutamento: Candidato reprovado com sucesso");

    // Fecha o modal se estiver aberto
    if (modalCandidato) {
      modalCandidato.classList.remove("is-visible");
    }

    // Recarrega a listagem atual
    const activeStatus = statusCandidaturaTabs
      .querySelector(".tab-link.active")
      ?.getAttribute("data-status");

    if (activeStatus === "triagem") renderizarTriagem(getGlobalState());
    else if (activeStatus === "entrevistas")
      renderizarEntrevistas(getGlobalState());
    else if (activeStatus === "gestor")
      renderizarEntrevistaGestor(getGlobalState());
  } catch (error) {
    console.error("❌ Recrutamento: Erro ao reprovar candidato:", error);
    window.showToast?.("Erro ao reprovar candidato.", "error");
  }
};

// ============================================
// HANDLERS DE UI E NAVEGAÇÃO
// ============================================

/**
 * Handler para mudança na seleção de vaga
 */
function handleFiltroVagaChange() {
  vagaSelecionadaId = filtroVaga.value;
  console.log(
    `🔹 Recrutamento: Vaga selecionada: ${vagaSelecionadaId || "Nenhuma"}`
  );

  const activeTab = statusCandidaturaTabs.querySelector(".tab-link.active");

  if (vagaSelecionadaId) {
    if (activeTab) {
      handleTabClick({ currentTarget: activeTab });
    } else {
      // Se nenhuma aba está ativa, carrega o cronograma por padrão
      renderizarCronograma(getGlobalState());
    }
  } else {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Selecione uma vaga no filtro acima para iniciar a visualização do processo seletivo.</p>';
  }
}

/**
 * Handler para clique nas abas de status
 * @param {Event} e - Evento de clique
 */
function handleTabClick(e) {
  const status = e.currentTarget.getAttribute("data-status");
  console.log(`🔹 Recrutamento: Mudando para aba: ${status}`);

  // Remove classe ativa de todas as abas
  document
    .querySelectorAll("#status-candidatura-tabs .tab-link")
    .forEach((btn) => btn.classList.remove("active"));

  // Adiciona classe ativa na aba clicada
  e.currentTarget.classList.add("active");

  // Validações de vaga (exceto para gestão de conteúdo)
  if (!vagaSelecionadaId && status !== "gestao-conteudo") {
    conteudoRecrutamento.innerHTML =
      '<p class="alert alert-info">Por favor, selecione uma vaga para visualizar esta etapa.</p>';
    return;
  }

  const globalState = getGlobalState();

  // Roteamento para cada aba
  switch (status) {
    case "cronograma":
      renderizarCronograma(globalState);
      break;
    case "triagem":
      renderizarTriagem(globalState);
      break;
    case "entrevistas":
      renderizarEntrevistas(globalState);
      break;
    case "gestor":
      renderizarEntrevistaGestor(globalState);
      break;
    case "finalizados":
      renderizarFinalizados(globalState);
      break;
    case "gestao-conteudo":
      // Redirecionamento para módulo de gestão de estudos
      window.location.hash = "#rh/gestao_estudos_de_caso";
      break;
    default:
      conteudoRecrutamento.innerHTML =
        '<p class="alert alert-warning">Selecione uma etapa do processo.</p>';
  }
}

// ============================================
// INICIALIZAÇÃO DO MÓDULO
// ============================================

/**
 * Função principal de inicialização do módulo
 * @param {Object} user - Usuário autenticado
 * @param {Object} userData - Dados do usuário
 */
export async function initRecrutamento(user, userData) {
  console.log("🔹 Recrutamento: Iniciando módulo...");

  currentUserData = userData || {};

  // ✅ CORREÇÃO: Publica a função 'getGlobalState' no window
  // Isso quebra a dependência circular, permitindo que os submódulos
  // de modal a acessem sem precisar importar 'recrutamento.js'.
  window.getGlobalRecrutamentoState = getGlobalState;
  // =========================================================

  // 1. Carrega lista de vagas ativas
  await carregarVagasAtivas();

  // 2. Configura evento de filtro de vaga
  if (filtroVaga) {
    filtroVaga.addEventListener("change", handleFiltroVagaChange);
  } else {
    console.warn("⚠️ Recrutamento: Filtro de vaga não encontrado");
  }

  // 3. Configura eventos das abas de status
  if (statusCandidaturaTabs) {
    statusCandidaturaTabs.querySelectorAll(".tab-link").forEach((btn) => {
      btn.addEventListener("click", handleTabClick);
    });
  } else {
    console.warn("⚠️ Recrutamento: Container de abas não encontrado");
  }

  // 4. Configura listener para fechar modal de detalhes
  const closeBtnDetalhes = modalCandidato?.querySelector(
    ".close-modal-btn.fechar-modal-candidato"
  );
  if (closeBtnDetalhes) {
    closeBtnDetalhes.addEventListener("click", () => {
      modalCandidato.classList.remove("is-visible");
    });
  }

  console.log("✅ Recrutamento: Módulo inicializado com sucesso");
}

// Compatibilidade com o roteador (permite usar tanto initRecrutamento quanto init)
export { initRecrutamento as init };
