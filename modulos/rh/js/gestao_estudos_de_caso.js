/**
 * Arquivo: modulos/rh/js/gestao_estudos_de_caso.js
 * Versão: 3.1.0 (Correção de Auth - Nome do Usuário Real)
 * Data: 05/11/2025
 * Descrição: Gerencia a criação, edição e listagem de modelos de avaliação com prazo e tipos de pergunta
 */

import {
  db,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  getDoc,
  arrayUnion,
} from "../../../assets/js/firebase-init.js";

// ✅ Importação da função auxiliar correta para pegar o NOME do usuário
import { getCurrentUserName } from "./tabs/entrevistas/helpers.js";

// ============================================
// CONSTANTES
// ============================================

const COLECAO_ESTUDOS = "estudos_de_caso";
const estudosCollection = collection(db, COLECAO_ESTUDOS);

// ============================================
// REFERÊNCIAS DO DOM
// ============================================

const tabLinks = document.querySelectorAll(".tab-link");
const tabContents = document.querySelectorAll(".tab-content");
const formNovoEstudo = document.getElementById("form-novo-estudo");
const listaPerguntas = document.getElementById("lista-perguntas");
const btnAdicionarPergunta = document.getElementById("btn-adicionar-pergunta");
const listaModelosSalvos = document.getElementById("lista-modelos-salvos");
const modalGerarLink = document.getElementById("modal-gerar-link");
const linkPublicoInput = document.getElementById("link-publico");
const btnCopiarLink = document.getElementById("btn-copiar-link");
const btnFecharModalLink = document.querySelector(".fechar-modal-link");

// ============================================
// VARIÁVEIS DE ESTADO
// ============================================

let proximoIdPergunta = 1;
let currentUserData = {};

// ============================================
// FUNÇÕES DE UTILIDADE
// ============================================

function formatarTimestamp(timestamp) {
  if (!timestamp) return "N/A";

  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("pt-BR");
  } catch (error) {
    console.error("Erro ao formatar timestamp:", error);
    return "Data inválida";
  }
}

// ============================================
// LÓGICA DE ABAS
// ============================================

function configurarAbas() {
  tabLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const targetTab = link.getAttribute("data-tab");

      tabLinks.forEach((l) => l.classList.remove("active"));
      tabContents.forEach((c) => (c.style.display = "none"));

      link.classList.add("active");
      document.getElementById(`tab-${targetTab}`).style.display = "block";

      if (targetTab === "modelos-salvos") {
        carregarModelosSalvos();
      }
    });
  });
}

// ============================================
// GERENCIAMENTO DE PERGUNTAS
// ============================================

function adicionarCampoPergunta() {
  const perguntaId = proximoIdPergunta++;
  const newPerguntaDiv = document.createElement("div");
  newPerguntaDiv.classList.add("pergunta-item", "form-group");
  newPerguntaDiv.setAttribute("data-pergunta-id", perguntaId);

  // ✅ HTML ATUALIZADO: Resposta Correta para TODOS os tipos
  newPerguntaDiv.innerHTML = `
    <label for="pergunta-${perguntaId}">Pergunta ${perguntaId}:</label>
    
    <div class="row mb-2">
      <div class="col-md-3">
        <select class="form-control tipo-pergunta" data-id="${perguntaId}" required>
          <option value="">Selecione o tipo...</option>
          <option value="dissertativa">Dissertativa</option>
          <option value="multipla-escolha">Múltipla Escolha</option>
          <option value="verdadeiro-falso">Verdadeiro/Falso</option>
          <option value="preenchimento">Preenchimento</option>
        </select>
      </div>
    </div>

    <div class="input-group">
      <textarea
        class="pergunta-texto form-control"
        data-id="${perguntaId}"
        rows="2"
        placeholder="Ex: Qual seria sua primeira ação neste cenário?"
        required
      ></textarea>
      <button 
        type="button" 
        class="btn btn-danger btn-sm btn-remover-pergunta ms-2" 
        title="Remover Pergunta"
      >
        <i class="fas fa-trash"></i>
      </button>
    </div>

    <div class="campos-multipla-escolha" style="display: none; margin-top: 10px; background: #e8f4f8; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea;">
      <label><strong>Opções (uma por linha):</strong></label>
      <textarea 
        class="form-control opcoes-texto" 
        data-id="${perguntaId}"
        rows="4"
        placeholder="Opção 1&#10;Opção 2&#10;Opção 3&#10;Opção 4"
      ></textarea>
      
      <label class="mt-2"><strong>Resposta Correta (número da opção, ex: 1):</strong></label>
      <input 
        type="number" 
        class="form-control resposta-correta"
        data-id="${perguntaId}"
        min="1"
        placeholder="1"
      />
    </div>

    <div class="campos-verdadeiro-falso" style="display: none; margin-top: 10px; background: #e8f4f8; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745;">
      <label><strong>Resposta Correta:</strong></label>
      <select class="form-control resposta-correta-vf" data-id="${perguntaId}">
        <option value="">Selecione...</option>
        <option value="Verdadeiro">Verdadeiro</option>
        <option value="Falso">Falso</option>
      </select>
    </div>

    <div class="campos-preenchimento" style="display: none; margin-top: 10px; background: #e8f4f8; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
      <label><strong>Resposta Padrão/Esperada:</strong></label>
      <input 
        type="text" 
        class="form-control resposta-padrao"
        data-id="${perguntaId}"
        placeholder="Ex: Multitarefa"
      />
      <small class="form-text text-muted">
        Digite a resposta esperada (não diferencia maiúsculas/minúsculas).
      </small>
    </div>

    <div class="campos-dissertativa" style="display: none; margin-top: 10px; background: #e8f4f8; padding: 15px; border-radius: 5px; border-left: 4px solid #6c757d;">
      <label><strong>Resposta Padrão/Modelo (opcional):</strong></label>
      <textarea 
        class="form-control resposta-padrao-dissertativa"
        data-id="${perguntaId}"
        rows="3"
        placeholder="Digite uma resposta modelo/padrão para referência (opcional)"
      ></textarea>
      <small class="form-text text-muted">
        Esta resposta serve como referência. Questões dissertativas não são corrigidas automaticamente.
      </small>
    </div>
  `;

  listaPerguntas.appendChild(newPerguntaDiv);

  // ✅ LISTENER PARA MOSTRAR/OCULTAR CAMPOS CONDICIONAIS
  const selectTipo = newPerguntaDiv.querySelector(".tipo-pergunta");
  const camposMultipla = newPerguntaDiv.querySelector(
    ".campos-multipla-escolha"
  );
  const camposVF = newPerguntaDiv.querySelector(".campos-verdadeiro-falso");
  const camposPreenchimento = newPerguntaDiv.querySelector(
    ".campos-preenchimento"
  );
  const camposDissertativa = newPerguntaDiv.querySelector(
    ".campos-dissertativa"
  );

  selectTipo.addEventListener("change", (e) => {
    // Esconde todos
    camposMultipla.style.display = "none";
    camposVF.style.display = "none";
    camposPreenchimento.style.display = "none";
    camposDissertativa.style.display = "none";

    // Mostra o relevante
    switch (e.target.value) {
      case "multipla-escolha":
        camposMultipla.style.display = "block";
        break;
      case "verdadeiro-falso":
        camposVF.style.display = "block";
        break;
      case "preenchimento":
        camposPreenchimento.style.display = "block";
        break;
      case "dissertativa":
        camposDissertativa.style.display = "block";
        break;
    }
  });

  // ✅ LISTENER PARA REMOVER PERGUNTA
  newPerguntaDiv
    .querySelector(".btn-remover-pergunta")
    .addEventListener("click", function () {
      newPerguntaDiv.remove();
      reordenarPerguntas();
    });
}

function reordenarPerguntas() {
  const itens = listaPerguntas.querySelectorAll(".pergunta-item");
  itens.forEach((item, index) => {
    const numero = index + 1;
    item.querySelector("label").textContent = `Pergunta ${numero}:`;
    item.querySelector("textarea").setAttribute("data-id", numero);
    item.querySelector("textarea").id = `pergunta-${numero}`;
  });
  proximoIdPergunta = itens.length + 1;
}

// ============================================
// SALVAR MODELO (CRIAÇÃO E EDIÇÃO)
// ============================================
async function salvarModelo(e) {
  e.preventDefault();

  console.log("🔹 Estudos: Salvando modelo");

  const btn = formNovoEstudo.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...';

  const titulo = document.getElementById("conteudo-titulo").value.trim();
  const tipo = document.getElementById("conteudo-tipo").value;
  const textoConteudo = document.getElementById("conteudo-texto").value.trim();
  const prazoDias = parseInt(
    document.getElementById("prazo-validade-link")?.value || "7"
  );

  const modeloId = formNovoEstudo.dataset.modeloId;

  // Validação
  if (!titulo || !tipo || !textoConteudo) {
    window.showToast?.("Por favor, preencha Título, Tipo e Conteúdo.", "error");
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Salvar Modelo de Conteúdo';
    return;
  }

  // ✅ COLETA AS PERGUNTAS COM RESPOSTA CORRETA
  const perguntas = [];

  try {
    listaPerguntas.querySelectorAll(".pergunta-item").forEach((item) => {
      const tipoPergunta = item.querySelector(".tipo-pergunta")?.value;
      const textoPergunta = item.querySelector(".pergunta-texto")?.value.trim();

      if (!textoPergunta || !tipoPergunta) {
        throw new Error("Todas as perguntas devem ter tipo e texto definidos");
      }

      const perguntaObj = {
        enunciado: textoPergunta,
        tipo: tipoPergunta,
        opcoes: [],
        respostaCorreta: null,
      };

      // ✅ COLETA RESPOSTA CORRETA CONFORME O TIPO
      switch (tipoPergunta) {
        case "multipla-escolha":
          const opcoesTexto = item.querySelector(".opcoes-texto")?.value;
          const numRespostaCorreta =
            item.querySelector(".resposta-correta")?.value;

          if (!opcoesTexto || !numRespostaCorreta) {
            throw new Error(
              "Múltipla escolha deve ter opções e número da resposta correta"
            );
          }

          perguntaObj.opcoes = opcoesTexto
            .split("\n")
            .map((opt, idx) => ({
              id: idx + 1,
              texto: opt.trim(),
            }))
            .filter((opt) => opt.texto);

          const numeroResposta = parseInt(numRespostaCorreta);

          // Valida se o número está dentro do range de opções
          if (
            numeroResposta < 1 ||
            numeroResposta > perguntaObj.opcoes.length
          ) {
            throw new Error(
              `Resposta correta deve estar entre 1 e ${perguntaObj.opcoes.length}`
            );
          }

          // Guarda o número da opção correta
          perguntaObj.respostaCorreta = numeroResposta;
          break;

        case "verdadeiro-falso":
          const respostaVF = item.querySelector(".resposta-correta-vf")?.value;

          if (!respostaVF) {
            throw new Error(
              "Verdadeiro/Falso deve ter resposta correta definida"
            );
          }

          perguntaObj.respostaCorreta = respostaVF;
          perguntaObj.opcoes = [
            { id: 1, texto: "Verdadeiro" },
            { id: 2, texto: "Falso" },
          ];
          break;

        case "preenchimento":
          const respostaPadrao = item
            .querySelector(".resposta-padrao")
            ?.value?.trim();

          if (!respostaPadrao) {
            throw new Error(
              "Preenchimento deve ter uma resposta padrão definida"
            );
          }

          perguntaObj.respostaCorreta = respostaPadrao;
          break;

        case "dissertativa":
          // Dissertativa é opcional (não há correção automática)
          const respostaDissertativa = item
            .querySelector(".resposta-padrao-dissertativa")
            ?.value?.trim();

          if (respostaDissertativa) {
            perguntaObj.respostaCorreta = respostaDissertativa;
          }
          break;

        default:
          throw new Error(`Tipo de pergunta desconhecido: ${tipoPergunta}`);
      }

      perguntas.push(perguntaObj);
    });
  } catch (error) {
    window.showToast?.(error.message, "error");
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Salvar Modelo de Conteúdo';
    return;
  }

  // ✅ CORREÇÃO: Usa getCurrentUserName() para pegar o nome real
  const usuarioNome = await getCurrentUserName();

  const dadosModelo = {
    titulo: titulo,
    tipo: tipo,
    conteudo_texto: textoConteudo,
    perguntas: perguntas,
    prazo_validade_dias: prazoDias,
    data_atualizacao: new Date(),
    criado_por: usuarioNome, // ✅ Salva o NOME (conforme solicitado), removendo fallbacks
    ativo: true,
  };

  try {
    if (modeloId) {
      const modeloRef = doc(estudosCollection, modeloId);
      await updateDoc(modeloRef, dadosModelo);

      window.showToast?.(`Modelo "${tipo}" atualizado com sucesso!`, "success");
      console.log("✅ Estudos: Modelo atualizado:", modeloId);
    } else {
      dadosModelo.data_criacao = new Date();
      const docRef = await addDoc(estudosCollection, dadosModelo);

      window.showToast?.(`Modelo "${tipo}" salvo com sucesso!`, "success");
      console.log("✅ Estudos: Novo modelo salvo:", docRef.id);
    }

    formNovoEstudo.reset();
    formNovoEstudo.dataset.modeloId = "";
    listaPerguntas.innerHTML = "";
    proximoIdPergunta = 1;
    adicionarCampoPergunta();

    btn.innerHTML = '<i class="fas fa-save"></i> Salvar Modelo de Conteúdo';

    document.querySelector('[data-tab="modelos-salvos"]').click();
  } catch (error) {
    console.error("❌ Estudos: Erro ao salvar modelo:", error);
    window.showToast?.(`Erro ao salvar o modelo: ${error.message}`, "error");
  } finally {
    btn.disabled = false;
  }
}

// ============================================
// EDIÇÃO DE MODELO
// ============================================
async function abrirModalEdicaoModelo(id) {
  console.log(`🔹 Estudos: Abrindo modal de edição para: ${id}`);

  try {
    const modeloRef = doc(estudosCollection, id);
    const modeloSnap = await getDoc(modeloRef);

    if (!modeloSnap.exists()) {
      window.showToast?.("Modelo não encontrado.", "error");
      return;
    }

    const modelo = modeloSnap.data();

    document.getElementById("conteudo-tipo").value = modelo.tipo;
    document.getElementById("conteudo-titulo").value = modelo.titulo;
    document.getElementById("conteudo-texto").value = modelo.conteudo_texto;
    document.getElementById("prazo-validade-link").value =
      modelo.prazo_validade_dias || "7";

    listaPerguntas.innerHTML = "";
    proximoIdPergunta = 1;

    if (modelo.perguntas && modelo.perguntas.length > 0) {
      modelo.perguntas.forEach((pergunta, index) => {
        const perguntaId = index + 1;
        const newPerguntaDiv = document.createElement("div");
        newPerguntaDiv.classList.add("pergunta-item", "form-group");
        newPerguntaDiv.setAttribute("data-pergunta-id", perguntaId);

        // ✅ Determina visibilidade dos campos
        const showMultipla = pergunta.tipo === "multipla-escolha";
        const showVF = pergunta.tipo === "verdadeiro-falso";
        const showPreenchimento = pergunta.tipo === "preenchimento";
        const showDissertativa = pergunta.tipo === "dissertativa";

        // ✅ Prepara valores
        const opcoesTextoValue =
          showMultipla && pergunta.opcoes
            ? pergunta.opcoes.map((opt) => opt.texto).join("\n")
            : "";

        const respostaCorretaMultipla = showMultipla
          ? pergunta.respostaCorreta || ""
          : "";
        const respostaCorretaVF = showVF ? pergunta.respostaCorreta || "" : "";
        const respostaPadraoPreench = showPreenchimento
          ? pergunta.respostaCorreta || ""
          : "";
        const respostaDissert = showDissertativa
          ? pergunta.respostaCorreta || ""
          : "";

        newPerguntaDiv.innerHTML = `
          <label for="pergunta-${perguntaId}">Pergunta ${perguntaId}:</label>
          
          <div class="row mb-2">
            <div class="col-md-3">
              <select class="form-control tipo-pergunta" data-id="${perguntaId}" required>
                <option value="">Selecione o tipo...</option>
                <option value="dissertativa" ${
                  pergunta.tipo === "dissertativa" ? "selected" : ""
                }>Dissertativa</option>
                <option value="multipla-escolha" ${
                  pergunta.tipo === "multipla-escolha" ? "selected" : ""
                }>Múltipla Escolha</option>
                <option value="verdadeiro-falso" ${
                  pergunta.tipo === "verdadeiro-falso" ? "selected" : ""
                }>Verdadeiro/Falso</option>
                <option value="preenchimento" ${
                  pergunta.tipo === "preenchimento" ? "selected" : ""
                }>Preenchimento</option>
              </select>
            </div>
          </div>

          <div class="input-group">
            <textarea class="pergunta-texto form-control" data-id="${perguntaId}" rows="2" required>${
          pergunta.enunciado
        }</textarea>
            <button type="button" class="btn btn-danger btn-sm btn-remover-pergunta ms-2" title="Remover Pergunta">
              <i class="fas fa-trash"></i>
            </button>
          </div>

          <div class="campos-multipla-escolha" style="display: ${
            showMultipla ? "block" : "none"
          }; margin-top: 10px; background: #e8f4f8; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea;">
            <label><strong>Opções (uma por linha):</strong></label>
            <textarea class="form-control opcoes-texto" data-id="${perguntaId}" rows="4">${opcoesTextoValue}</textarea>
            <label class="mt-2"><strong>Resposta Correta (número da opção):</strong></label>
            <input type="number" class="form-control resposta-correta" data-id="${perguntaId}" min="1" value="${respostaCorretaMultipla}" />
          </div>

          <div class="campos-verdadeiro-falso" style="display: ${
            showVF ? "block" : "none"
          }; margin-top: 10px; background: #e8f4f8; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745;">
            <label><strong>Resposta Correta:</strong></label>
            <select class="form-control resposta-correta-vf" data-id="${perguntaId}">
              <option value="">Selecione...</option>
              <option value="Verdadeiro" ${
                respostaCorretaVF === "Verdadeiro" ? "selected" : ""
              }>Verdadeiro</option>
              <option value="Falso" ${
                respostaCorretaVF === "Falso" ? "selected" : ""
              }>Falso</option>
            </select>
          </div>

          <div class="campos-preenchimento" style="display: ${
            showPreenchimento ? "block" : "none"
          }; margin-top: 10px; background: #e8f4f8; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
            <label><strong>Resposta Padrão/Esperada:</strong></label>
            <input type="text" class="form-control resposta-padrao" data-id="${perguntaId}" value="${respostaPadraoPreench}" />
          </div>

          <div class="campos-dissertativa" style="display: ${
            showDissertativa ? "block" : "none"
          }; margin-top: 10px; background: #e8f4f8; padding: 15px; border-radius: 5px; border-left: 4px solid #6c757d;">
            <label><strong>Resposta Padrão/Modelo (opcional):</strong></label>
            <textarea class="form-control resposta-padrao-dissertativa" data-id="${perguntaId}" rows="3">${respostaDissert}</textarea>
          </div>
        `;

        listaPerguntas.appendChild(newPerguntaDiv);

        // ✅ LISTENERS
        const selectTipo = newPerguntaDiv.querySelector(".tipo-pergunta");
        const camposMultipla = newPerguntaDiv.querySelector(
          ".campos-multipla-escolha"
        );
        const camposVF = newPerguntaDiv.querySelector(
          ".campos-verdadeiro-falso"
        );
        const camposPreenchimento = newPerguntaDiv.querySelector(
          ".campos-preenchimento"
        );
        const camposDissertativa = newPerguntaDiv.querySelector(
          ".campos-dissertativa"
        );

        selectTipo.addEventListener("change", (e) => {
          camposMultipla.style.display = "none";
          camposVF.style.display = "none";
          camposPreenchimento.style.display = "none";
          camposDissertativa.style.display = "none";

          switch (e.target.value) {
            case "multipla-escolha":
              camposMultipla.style.display = "block";
              break;
            case "verdadeiro-falso":
              camposVF.style.display = "block";
              break;
            case "preenchimento":
              camposPreenchimento.style.display = "block";
              break;
            case "dissertativa":
              camposDissertativa.style.display = "block";
              break;
          }
        });

        newPerguntaDiv
          .querySelector(".btn-remover-pergunta")
          .addEventListener("click", function () {
            newPerguntaDiv.remove();
            reordenarPerguntas();
          });
      });
      proximoIdPergunta = modelo.perguntas.length + 1;
    } else {
      adicionarCampoPergunta();
      listaPerguntas.querySelector(".btn-remover-pergunta")?.remove();
      proximoIdPergunta = 2;
    }

    formNovoEstudo.dataset.modeloId = id;

    const btnSubmit = formNovoEstudo.querySelector('button[type="submit"]');
    if (btnSubmit) {
      btnSubmit.innerHTML =
        '<i class="fas fa-refresh me-2"></i> Atualizar Modelo';
    }

    document.querySelector('[data-tab="criar-novo"]').click();

    window.showToast?.("Modelo carregado para edição.", "info");
    console.log("✅ Estudos: Modelo aberto para edição");
  } catch (error) {
    console.error("❌ Estudos: Erro ao carregar modelo:", error);
    window.showToast?.(`Erro ao carregar modelo: ${error.message}`, "error");
  }
}

// ============================================
// CARREGAMENTO DE MODELOS
// ============================================

async function carregarModelosSalvos() {
  listaModelosSalvos.innerHTML =
    '<p><i class="fas fa-spinner fa-spin me-2"></i> Buscando modelos...</p>';

  try {
    const q = query(
      estudosCollection,
      where("ativo", "==", true),
      orderBy("data_criacao", "desc")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      listaModelosSalvos.innerHTML =
        '<p class="alert alert-info">Nenhum modelo de avaliação salvo ainda.</p>';
      console.log("ℹ️ Estudos: Nenhum modelo encontrado");
      return;
    }

    let htmlTabela = `
      <table class="table table-striped table-hover">
        <thead>
          <tr>
            <th>Título</th>
            <th>Tipo</th>
            <th>Perguntas</th>
            <th>Prazo (dias)</th>
            <th>Criação</th>
            <th class="text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
    `;

    snapshot.forEach((docSnap) => {
      const modelo = docSnap.data();
      const dataFormatada = formatarTimestamp(modelo.data_criacao);
      const numPerguntas = modelo.perguntas ? modelo.perguntas.length : 0;
      const tipoFormatado = modelo.tipo.replace(/-/g, " ").toUpperCase();
      // ✅ EXIBE O PRAZO
      const prazoDias = modelo.prazo_validade_dias || "7";

      htmlTabela += `
        <tr data-id="${docSnap.id}" data-tipo="${modelo.tipo}">
          <td>${modelo.titulo}</td>
          <td>${tipoFormatado}</td>
          <td>${numPerguntas}</td>
          <td><span class="badge bg-warning">${prazoDias}</span></td>
          <td>${dataFormatada}</td>
          <td class="text-center">
            <div class="btn-group" role="group" aria-label="Ações">
              <button 
                type="button" 
                class="btn btn-sm btn-info btn-editar-modelo" 
                title="Editar Modelo"
                data-id="${docSnap.id}"
              >
                <i class="fas fa-edit me-1"></i> Editar
              </button>
              <button 
                type="button" 
                class="btn btn-sm btn-primary btn-gerar-link" 
                title="Gerar Link Público"
                data-id="${docSnap.id}"
              >
                <i class="fas fa-link me-1"></i> Link
              </button>
              <button 
                type="button" 
                class="btn btn-sm btn-danger btn-excluir-modelo" 
                title="Excluir Modelo"
                data-id="${docSnap.id}"
              >
                <i class="fas fa-trash me-1"></i> Excluir
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    htmlTabela += `</tbody></table>`;
    listaModelosSalvos.innerHTML = htmlTabela;

    document.querySelectorAll(".btn-editar-modelo").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        abrirModalEdicaoModelo(id);
      });
    });

    document.querySelectorAll(".btn-gerar-link").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        const tipo = e.currentTarget.closest("tr").getAttribute("data-tipo");
        abrirModalGerarLink(id, tipo);
      });
    });

    document.querySelectorAll(".btn-excluir-modelo").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        excluirModelo(id);
      });
    });

    console.log(`✅ Estudos: ${snapshot.size} modelo(s) carregado(s)`);
  } catch (error) {
    console.error("❌ Estudos: Erro ao carregar modelos:", error);
    listaModelosSalvos.innerHTML =
      '<p class="alert alert-danger">Erro ao carregar os modelos. Tente recarregar a página.</p>';
  }
}

// ============================================
// EXCLUSÃO DE MODELO
// ============================================

async function excluirModelo(id) {
  if (!confirm("Tem certeza que deseja excluir (desativar) este modelo?")) {
    return;
  }

  console.log(`🔹 Estudos: Excluindo modelo: ${id}`);

  try {
    // ✅ CORREÇÃO: Pega o nome do usuário assincronamente para o histórico
    const usuarioNome = await getCurrentUserName();

    const modeloRef = doc(estudosCollection, id);

    await updateDoc(modeloRef, {
      ativo: false,
      data_exclusao: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Modelo desativado (soft delete)",
        usuario: usuarioNome, // ✅ Usa o nome correto obtido do helper
      }),
    });

    window.showToast?.(
      "Modelo excluído com sucesso (marcado como inativo)!",
      "success"
    );
    console.log("✅ Estudos: Modelo excluído");

    carregarModelosSalvos();
  } catch (error) {
    console.error("❌ Estudos: Erro ao excluir modelo:", error);
    window.showToast?.(`Erro ao excluir o modelo: ${error.message}`, "error");
  }
}

// ============================================
// GERAÇÃO DE LINK PÚBLICO
// ============================================

function abrirModalGerarLink(id, tipo) {
  console.log(`🔹 Estudos: Gerando link para modelo: ${id}, tipo: ${tipo}`);

  try {
    let urlBase = window.location.origin;

    if (urlBase.includes("intranet.eupsico.org.br")) {
      urlBase = "https://eupsico.org.br";
    }

    console.log(`✅ URL Base: ${urlBase}`);

    const link = `${urlBase}/avaliacao-publica.html?tipo=${tipo}&id=${id}`;

    console.log(`✅ Link gerado: ${link}`);

    if (linkPublicoInput) {
      linkPublicoInput.value = link;
      console.log("✅ Campo de link preenchido");
    } else {
      console.error("❌ Campo linkPublicoInput não encontrado");
    }

    window.showToast?.(`Link gerado: ${link}`, "info");

    if (modalGerarLink) {
      modalGerarLink.style.display = "flex";
      console.log("✅ Modal de link aberto");
    } else {
      console.error("❌ Modal modalGerarLink não encontrado");
    }

    setTimeout(() => {
      if (linkPublicoInput) {
        linkPublicoInput.select();
        console.log("✅ Link selecionado para cópia");
      }
    }, 100);
  } catch (error) {
    console.error("❌ Estudos: Erro ao gerar link:", error);
    window.showToast?.(`Erro ao gerar link: ${error.message}`, "error");
  }
}

function fecharModalGerarLink() {
  modalGerarLink.style.display = "none";
}

// ============================================
// INICIALIZAÇÃO
// ============================================

export async function initGestaoEstudos(user, userData) {
  console.log("🔹 Estudos de Caso: Iniciando módulo");

  currentUserData = userData || {};

  configurarAbas();

  if (formNovoEstudo) {
    formNovoEstudo.addEventListener("submit", salvarModelo);
  }

  if (btnAdicionarPergunta) {
    btnAdicionarPergunta.addEventListener("click", adicionarCampoPergunta);
  }

  if (btnFecharModalLink) {
    btnFecharModalLink.addEventListener("click", fecharModalGerarLink);
  }

  if (btnCopiarLink) {
    btnCopiarLink.addEventListener("click", () => {
      linkPublicoInput.select();
      document.execCommand("copy");
      btnCopiarLink.textContent = "Copiado!";
      setTimeout(
        () =>
          (btnCopiarLink.innerHTML = '<i class="fas fa-copy"></i> Copiar Link'),
        2000
      );
    });
  }

  if (listaPerguntas) {
    if (listaPerguntas.children.length === 0) {
      proximoIdPergunta = 1;
      adicionarCampoPergunta();
      listaPerguntas.querySelector(".btn-remover-pergunta")?.remove();
      proximoIdPergunta = 2;
      console.log("✅ Primeira pergunta adicionada");
    }
  }

  console.log("✅ Estudos de Caso: Módulo inicializado com sucesso");
}

export { initGestaoEstudos as init };
