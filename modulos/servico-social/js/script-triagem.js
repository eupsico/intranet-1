// Arquivo: /modulos/servico-social/js/script-triagem.js
// Versão: 1.0 (Integrado com as Configurações do Sistema)

import { db, doc, getDoc } from "../../../assets/js/firebase-init.js";

/**
 * Carrega os prazos configuráveis do Firestore e atualiza o texto na página.
 */
async function carregarPrazosConfiguraveis() {
  console.log("Carregando prazos configuráveis do script de triagem...");

  // IDs dos elementos no HTML que serão atualizados
  const elementosParaAtualizar = {
    prazoContatoTriagem: [
      document.getElementById("prazo-contato-triagem"),
      document.getElementById("prazo-contato-triagem-resumo"),
    ],
    prazoInicioTerapia: [
      document.getElementById("prazo-inicio-terapia"),
      document.getElementById("prazo-inicio-terapia-resumo"),
    ],
  };

  try {
    const configRef = doc(db, "configuracoesSistema", "geral");
    const docSnap = await getDoc(configRef);

    if (docSnap.exists()) {
      const configs = docSnap.data();
      const prazos = configs.prazos;

      if (prazos && prazos.contatoTriagem) {
        elementosParaAtualizar.prazoContatoTriagem.forEach((el) => {
          if (el) el.textContent = prazos.contatoTriagem;
        });
      }

      if (prazos && prazos.inicioTerapia) {
        elementosParaAtualizar.prazoInicioTerapia.forEach((el) => {
          if (el) el.textContent = prazos.inicioTerapia;
        });
      }
    } else {
      console.warn("Documento de configurações do sistema não encontrado.");
    }
  } catch (error) {
    console.error("Erro ao buscar prazos da trilha do paciente:", error);
  }
}

// Executa a função assim que o script é carregado
carregarPrazosConfiguraveis();
