/**
 * Arquivo: modulos/rh/js/gestao_documentos.js
 * Versão: 2.2.0 (Padronização com getCurrentUserName - Nome em vez de ID)
 * Data: 05/11/2025
 * Descrição: Gerencia a criação de modelos de documentos (contratos, termos) com o texto completo.
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

// Nova coleção no Firestore
const COLECAO_DOCUMENTOS = "rh_documentos_modelos";
const documentosCollection = collection(db, COLECAO_DOCUMENTOS);

// ============================================
// REFERÊNCIAS DO DOM
// ============================================

const tabLinks = document.querySelectorAll(".tab-link");
const tabContents = document.querySelectorAll(".tab-content");
// IDs atualizados
const formNovoDocumento = document.getElementById("form-novo-documento");
const listaDocumentosSalvos = document.getElementById(
  "lista-documentos-salvos"
);
// Textarea principal (mantida)
const documentoTextoInput = document.getElementById("documento-texto");

// ============================================
// VARIÁVEIS DE ESTADO
// ============================================

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
        // Função de carregamento atualizada
        carregarDocumentosSalvos();
      }
    });
  });
}

// ============================================
// SALVAR MODELO (CRIAÇÃO E EDIÇÃO)
// ============================================
async function salvarModeloDocumento(e) {
  e.preventDefault();

  console.log("🔹 Documentos: Salvando modelo");

  const btn = formNovoDocumento.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Salvando...'; // Campos atualizados

  const titulo = document.getElementById("documento-titulo").value.trim();
  const tipo = document.getElementById("documento-tipo").value; // Campo de texto principal
  const textoConteudo = document.getElementById("documento-texto").value.trim();

  const modeloId = formNovoDocumento.dataset.modeloId; // Validação

  if (!titulo || !tipo || !textoConteudo) {
    window.showToast?.(
      "Por favor, preencha Título, Tipo e o Conteúdo do documento.",
      "error"
    );
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Salvar Modelo de Documento';
    return;
  }

  // ✅ CORREÇÃO: Usa getCurrentUserName() para pegar o nome real, assim como no tabTriagem.js
  const usuarioNome = await getCurrentUserName();

  // Objeto de dados atualizado
  const dadosModelo = {
    titulo: titulo,
    tipo: tipo,
    texto_conteudo: textoConteudo, // Campo principal com o texto do contrato
    data_atualizacao: new Date(),
    criado_por: usuarioNome, // ✅ Salva o NOME (conforme solicitado), removendo fallbacks
    ativo: true,
  };

  try {
    if (modeloId) {
      const modeloRef = doc(documentosCollection, modeloId);
      await updateDoc(modeloRef, dadosModelo);

      window.showToast?.(
        `Documento "${titulo}" atualizado com sucesso!`,
        "success"
      );
      console.log("✅ Documentos: Modelo atualizado:", modeloId);
    } else {
      dadosModelo.data_criacao = new Date();
      const docRef = await addDoc(documentosCollection, dadosModelo);

      window.showToast?.(`Documento "${titulo}" salvo com sucesso!`, "success");
      console.log("✅ Documentos: Novo modelo salvo:", docRef.id);
    }

    formNovoDocumento.reset();
    formNovoDocumento.dataset.modeloId = "";

    btn.innerHTML = '<i class="fas fa-save"></i> Salvar Modelo de Documento';

    document.querySelector('[data-tab="modelos-salvos"]').click();
  } catch (error) {
    console.error("❌ Documentos: Erro ao salvar modelo:", error);
    window.showToast?.(`Erro ao salvar o modelo: ${error.message}`, "error");
  } finally {
    btn.disabled = false;
  }
}

// ============================================
// EDIÇÃO DE MODELO
// ============================================
async function abrirEdicaoDocumento(id) {
  console.log(`🔹 Documentos: Abrindo modal de edição para: ${id}`);

  try {
    const modeloRef = doc(documentosCollection, id);
    const modeloSnap = await getDoc(modeloRef);

    if (!modeloSnap.exists()) {
      window.showToast?.("Modelo não encontrado.", "error");
      return;
    }

    const modelo = modeloSnap.data(); // Preenchimento atualizado

    document.getElementById("documento-tipo").value = modelo.tipo;
    document.getElementById("documento-titulo").value = modelo.titulo; // Carrega o texto principal do documento
    document.getElementById("documento-texto").value =
      modelo.texto_conteudo || ""; // Lógica de preenchimento de perguntas removida

    formNovoDocumento.dataset.modeloId = id;

    const btnSubmit = formNovoDocumento.querySelector('button[type="submit"]');
    if (btnSubmit) {
      btnSubmit.innerHTML =
        '<i class="fas fa-refresh me-2"></i> Atualizar Documento';
    }

    document.querySelector('[data-tab="criar-novo"]').click();

    window.showToast?.("Modelo carregado para edição.", "info");
    console.log("✅ Documentos: Modelo aberto para edição");
  } catch (error) {
    console.error("❌ Documentos: Erro ao carregar modelo:", error);
    window.showToast?.(`Erro ao carregar modelo: ${error.message}`, "error");
  }
}

// ============================================
// CARREGAMENTO DE MODELOS
// ============================================

async function carregarDocumentosSalvos() {
  listaDocumentosSalvos.innerHTML =
    '<p><i class="fas fa-spinner fa-spin me-2"></i> Buscando modelos...</p>';

  try {
    const q = query(
      documentosCollection,
      where("ativo", "==", true),
      orderBy("data_criacao", "desc")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      listaDocumentosSalvos.innerHTML =
        '<p class="alert alert-info">Nenhum modelo de documento salvo ainda.</p>';
      console.log("ℹ️ Documentos: Nenhum modelo encontrado");
      return;
    } // Tabela simplificada

    let htmlTabela = `
   <table class="table table-striped table-hover">
    <thead>
     <tr>
      <th>Título</th>
      <th>Tipo</th>
      <th>Criação</th>
      <th class="text-center">Ações</th>
     </tr>
    </thead>
    <tbody>
  `;

    snapshot.forEach((docSnap) => {
      const modelo = docSnap.data();
      const dataFormatada = formatarTimestamp(modelo.data_criacao);
      const tipoFormatado = (modelo.tipo || "outro")
        .replace(/-/g, " ")
        .toUpperCase(); // Linha da tabela simplificada

      htmlTabela += `
    <tr data-id="${docSnap.id}" data-tipo="${modelo.tipo}">
     <td>${modelo.titulo}</td>
     <td>${tipoFormatado}</td>
     <td>${dataFormatada}</td>
     <td class="text-center">
      <div class="btn-group" role="group" aria-label="Ações">
       <button 
        type="button" 
        class="btn btn-sm btn-info btn-editar-documento" 
     D    title="Editar Modelo"
        data-id="${docSnap.id}"
       >
        <i class="fas fa-edit me-1"></i> Editar
       </button>
              <button 
        type="button" 
        class="btn btn-sm btn-danger btn-excluir-documento" 
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
    listaDocumentosSalvos.innerHTML = htmlTabela; // Listeners atualizados

    document.querySelectorAll(".btn-editar-documento").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        abrirEdicaoDocumento(id);
      });
    });

    document.querySelectorAll(".btn-excluir-documento").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.currentTarget.getAttribute("data-id");
        excluirDocumento(id);
      });
    });

    console.log(`✅ Documentos: ${snapshot.size} modelo(s) carregado(s)`);
  } catch (error) {
    console.error("❌ Documentos: Erro ao carregar modelos:", error);
    listaDocumentosSalvos.innerHTML =
      '<p class="alert alert-danger">Erro ao carregar os modelos. Tente recarregar a página.</p>';
  }
}

// ============================================
// EXCLUSÃO DE MODELO
// ============================================

async function excluirDocumento(id) {
  if (!confirm("Tem certeza que deseja excluir (desativar) este modelo?")) {
    return;
  }

  console.log(`🔹 Documentos: Excluindo modelo: ${id}`);

  try {
    // ✅ CORREÇÃO: Pega o nome do usuário assincronamente para o histórico
    const usuarioNome = await getCurrentUserName();

    const modeloRef = doc(documentosCollection, id);

    await updateDoc(modeloRef, {
      ativo: false,
      data_exclusao: new Date(),
      historico: arrayUnion({
        data: new Date(),
        acao: "Modelo desativado (soft delete)",
        usuario: usuarioNome, // ✅ Usa o nome correto, sem fallbacks
      }),
    });

    window.showToast?.(
      "Modelo excluído com sucesso (marcado como inativo)!",
      "success"
    );
    console.log("✅ Documentos: Modelo excluído");

    carregarDocumentosSalvos();
  } catch (error) {
    console.error("❌ Documentos: Erro ao excluir modelo:", error);
    window.showToast?.(`Erro ao excluir o modelo: ${error.message}`, "error");
  }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

export async function initGestaoDocumentos(user, userData) {
  console.log("🔹 Gestão de Documentos: Iniciando módulo (v2.2)");

  currentUserData = userData || {};

  configurarAbas();

  if (formNovoDocumento) {
    formNovoDocumento.addEventListener("submit", salvarModeloDocumento);
  }

  console.log(
    "✅ Gestão de Documentos: Módulo inicializado com sucesso (v2.2)"
  );
}

export { initGestaoDocumentos as init };
