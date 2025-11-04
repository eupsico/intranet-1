/**
 * Arquivo: modulos/rh/js/gestao_estudos_de_caso.js
 * Versão: 2.1.0 (Com edição funcionando - SEM DUPLICATAS)
 * Data: 04/11/2025
 * Descrição: Gerencia a criação, edição e listagem de modelos de avaliação
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

  newPerguntaDiv.innerHTML = `
    <label for="pergunta-${perguntaId}">Pergunta ${perguntaId}:</label>
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
  `;

  listaPerguntas.appendChild(newPerguntaDiv);

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
// SALVAR MODELO (CRIAÇÃO E EDIÇÃO) - ✅ UMA ÚNICA FUNÇÃO
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
  const modeloId = formNovoEstudo.dataset.modeloId; // ✅ ID se for edição

  // Validação
  if (!titulo || !tipo || !textoConteudo) {
    window.showToast?.("Por favor, preencha Título, Tipo e Conteúdo.", "error");
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Salvar Modelo de Conteúdo';
    return;
  }

  // Coleta as perguntas
  const perguntas = Array.from(
    listaPerguntas.querySelectorAll(".pergunta-texto")
  )
    .map((textarea) => textarea.value.trim())
    .filter((pergunta) => pergunta.length > 0);

  const dadosModelo = {
    titulo: titulo,
    tipo: tipo,
    conteudo_texto: textoConteudo,
    perguntas: perguntas,
    data_atualizacao: new Date(),
    criado_por_uid: currentUserData?.id || "rh_system_user",
    ativo: true,
  };

  try {
    if (modeloId) {
      // ✅ EDIÇÃO: Atualiza modelo existente
      const modeloRef = doc(estudosCollection, modeloId);
      await updateDoc(modeloRef, dadosModelo);

      window.showToast?.(`Modelo "${tipo}" atualizado com sucesso!`, "success");
      console.log("✅ Estudos: Modelo atualizado:", modeloId);
    } else {
      // ✅ CRIAÇÃO: Cria novo modelo
      dadosModelo.data_criacao = new Date();
      const docRef = await addDoc(estudosCollection, dadosModelo);

      window.showToast?.(`Modelo "${tipo}" salvo com sucesso!`, "success");
      console.log("✅ Estudos: Novo modelo salvo:", docRef.id);
    }

    // Limpa o formulário
    formNovoEstudo.reset();
    formNovoEstudo.dataset.modeloId = ""; // ✅ Limpa ID
    listaPerguntas.innerHTML = "";
    proximoIdPergunta = 1;
    adicionarCampoPergunta();

    // Restaura botão
    btn.innerHTML = '<i class="fas fa-save"></i> Salvar Modelo de Conteúdo';

    // Alterna para modelos salvos
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

    // Preenche os campos do formulário
    document.getElementById("conteudo-tipo").value = modelo.tipo;
    document.getElementById("conteudo-titulo").value = modelo.titulo;
    document.getElementById("conteudo-texto").value = modelo.conteudo_texto;

    // Limpa e preenche as perguntas
    listaPerguntas.innerHTML = "";
    proximoIdPergunta = 1;

    if (modelo.perguntas && modelo.perguntas.length > 0) {
      modelo.perguntas.forEach((pergunta, index) => {
        const perguntaId = index + 1;
        const newPerguntaDiv = document.createElement("div");
        newPerguntaDiv.classList.add("pergunta-item", "form-group");
        newPerguntaDiv.setAttribute("data-pergunta-id", perguntaId);

        newPerguntaDiv.innerHTML = `
          <label for="pergunta-${perguntaId}">Pergunta ${perguntaId}:</label>
          <div class="input-group">
            <textarea
              class="pergunta-texto form-control"
              data-id="${perguntaId}"
              rows="2"
              required
            >${pergunta}</textarea>
            <button 
              type="button" 
              class="btn btn-danger btn-sm btn-remover-pergunta ms-2" 
              title="Remover Pergunta"
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `;

        listaPerguntas.appendChild(newPerguntaDiv);

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

    // Armazena o ID para saber se é criação ou edição
    formNovoEstudo.dataset.modeloId = id;

    // Muda o texto do botão de submit
    const btnSubmit = formNovoEstudo.querySelector('button[type="submit"]');
    if (btnSubmit) {
      btnSubmit.innerHTML =
        '<i class="fas fa-refresh me-2"></i> Atualizar Modelo';
    }

    // Ativa a aba de criar novo
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

      htmlTabela += `
        <tr data-id="${docSnap.id}" data-tipo="${modelo.tipo}">
          <td>${modelo.titulo}</td>
          <td>${tipoFormatado}</td>
          <td>${numPerguntas}</td>
          <td>${dataFormatada}</td>
          <td class="text-center">
            <button 
              type="button" 
              class="btn btn-sm btn-info btn-editar-modelo me-2" 
              title="Editar"
              data-id="${docSnap.id}"
            >
              <i class="fas fa-edit"></i>
            </button>
            <button 
              type="button" 
              class="btn btn-sm btn-primary btn-gerar-link me-2" 
              title="Gerar Link Público"
              data-id="${docSnap.id}"
            >
              <i class="fas fa-link"></i>
            </button>
            <button 
              type="button" 
              class="btn btn-sm btn-danger btn-excluir-modelo" 
              title="Excluir"
              data-id="${docSnap.id}"
            >
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    });

    htmlTabela += `</tbody></table>`;
    listaModelosSalvos.innerHTML = htmlTabela;

    // LISTENERS
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
    const modeloRef = doc(estudosCollection, id);

    await updateDoc(modeloRef, {
      ativo: false,
      data_exclusao: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Modelo desativado (soft delete)",
        usuario: currentUserData?.id || "rh_system_user",
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
  console.log(`🔹 Estudos: Gerando link para modelo: ${id}`);

  const urlBase = window.location.origin.replace("intranet", "public");
  const link = `${urlBase}/avaliacao-publica.html?tipo=${tipo}&id=${id}`;

  linkPublicoInput.value = link;
  modalGerarLink.style.display = "flex";

  setTimeout(() => linkPublicoInput.select(), 100);
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

  // Configurar abas
  configurarAbas();

  // Adicionar listener do formulário
  if (formNovoEstudo) {
    formNovoEstudo.addEventListener("submit", salvarModelo);
  }

  // Adicionar listener para adicionar pergunta
  if (btnAdicionarPergunta) {
    btnAdicionarPergunta.addEventListener("click", adicionarCampoPergunta);
  }

  // Listeners do Modal de Link
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

  // Inicializar perguntas
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
