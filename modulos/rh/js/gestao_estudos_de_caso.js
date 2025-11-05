/**
 * Arquivo: modulos/rh/js/gestao_estudos_de_caso.js
 * Versão: 3.0.0 (Com Prazo de Validade + Tipo de Pergunta)
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

  // ✅ HTML ATUALIZADO COM TIPO DE PERGUNTA
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

    <!-- ✅ CAMPOS CONDICIONAIS PARA MÚLTIPLA ESCOLHA -->
    <div class="opcoes-multipla-escolha" style="display: none; margin-top: 10px; background: #f8f9fa; padding: 10px; border-radius: 5px;">
      <label>Opções (uma por linha):</label>
      <textarea 
        class="form-control opcoes-texto" 
        data-id="${perguntaId}"
        rows="3"
        placeholder="Opção 1&#10;Opção 2&#10;Opção 3&#10;Opção 4"
      ></textarea>
      
      <label class="mt-2">Resposta Correta (número da opção, ex: 1):</label>
      <input 
        type="number" 
        class="form-control resposta-correta"
        data-id="${perguntaId}"
        min="1"
        placeholder="1"
      />
    </div>
  `;

  listaPerguntas.appendChild(newPerguntaDiv);

  // ✅ LISTENER PARA MOSTRAR/OCULTAR OPÇÕES
  const selectTipo = newPerguntaDiv.querySelector(".tipo-pergunta");
  const opcoesDiv = newPerguntaDiv.querySelector(".opcoes-multipla-escolha");

  selectTipo.addEventListener("change", (e) => {
    if (e.target.value === "multipla-escolha") {
      opcoesDiv.style.display = "block";
    } else {
      opcoesDiv.style.display = "none";
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

  // ✅ NOVOS CAMPOS
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

  // ✅ COLETA AS PERGUNTAS COM TIPO
  const perguntas = [];
  listaPerguntas.querySelectorAll(".pergunta-item").forEach((item) => {
    const tipoPergunta = item.querySelector(".tipo-pergunta")?.value;
    const textoPergunta = item.querySelector(".pergunta-texto")?.value.trim();

    if (!textoPergunta || !tipoPergunta) {
      window.showToast?.("Todas as perguntas devem ter tipo definido", "error");
      throw new Error("Pergunta incompleta");
    }

    const perguntaObj = {
      enunciado: textoPergunta,
      tipo: tipoPergunta,
      opcoes: [],
    };

    // ✅ SE FOR MÚLTIPLA ESCOLHA, COLETA OPÇÕES
    if (tipoPergunta === "multipla-escolha") {
      const opcoesTexto = item.querySelector(".opcoes-texto")?.value;
      const respostaCorreta = item.querySelector(".resposta-correta")?.value;

      if (!opcoesTexto || !respostaCorreta) {
        window.showToast?.(
          "Múltipla escolha deve ter opções e resposta correta",
          "error"
        );
        throw new Error("Opções incompletas");
      }

      perguntaObj.opcoes = opcoesTexto
        .split("\n")
        .map((opt, idx) => ({
          id: idx + 1,
          texto: opt.trim(),
        }))
        .filter((opt) => opt.texto);

      perguntaObj.respostaCorreta = parseInt(respostaCorreta);
    }

    perguntas.push(perguntaObj);
  });

  const dadosModelo = {
    titulo: titulo,
    tipo: tipo,
    conteudo_texto: textoConteudo,
    perguntas: perguntas,
    // ✅ NOVOS CAMPOS
    prazo_validade_dias: prazoDias,
    data_atualizacao: new Date(),
    criado_por_uid: currentUserData?.id || "rh_system_user",
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

    // ✅ PREENCHE O PRAZO
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

        // ✅ HTML COM TIPO DE PERGUNTA PREENCHIDO
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
            <textarea
              class="pergunta-texto form-control"
              data-id="${perguntaId}"
              rows="2"
              required
            >${pergunta.enunciado}</textarea>
            <button 
              type="button" 
              class="btn btn-danger btn-sm btn-remover-pergunta ms-2" 
              title="Remover Pergunta"
            >
              <i class="fas fa-trash"></i>
            </button>
          </div>

          <!-- ✅ CAMPOS CONDICIONAIS -->
          <div class="opcoes-multipla-escolha" style="display: ${
            pergunta.tipo === "multipla-escolha" ? "block" : "none"
          }; margin-top: 10px; background: #f8f9fa; padding: 10px; border-radius: 5px;">
            <label>Opções (uma por linha):</label>
            <textarea 
              class="form-control opcoes-texto" 
              data-id="${perguntaId}"
              rows="3"
            >${pergunta.opcoes.map((opt) => opt.texto).join("\n")}</textarea>
            
            <label class="mt-2">Resposta Correta:</label>
            <input 
              type="number" 
              class="form-control resposta-correta"
              data-id="${perguntaId}"
              min="1"
              value="${pergunta.respostaCorreta || ""}"
            />
          </div>
        `;

        listaPerguntas.appendChild(newPerguntaDiv);

        // ✅ LISTENERS
        const selectTipo = newPerguntaDiv.querySelector(".tipo-pergunta");
        const opcoesDiv = newPerguntaDiv.querySelector(
          ".opcoes-multipla-escolha"
        );

        selectTipo.addEventListener("change", (e) => {
          opcoesDiv.style.display =
            e.target.value === "multipla-escolha" ? "block" : "none";
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
