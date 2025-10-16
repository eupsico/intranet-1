// assets/js/valores_sessao.js (Atualizado para Firebase v9)
(function () {
  // Importa as funções necessárias do SDK global do Firebase
  // Certifique-se de que o SDK do Firebase v9 está sendo importado no seu HTML
  const { doc, getDoc, updateDoc } = firebase.firestore;

  if (!db) {
    console.error("Instância do Firestore (db) não encontrada.");
    return;
  }

  // Referência para o documento único de configurações financeiras
  const docRef = doc(db, "financeiro", "configuracoes");

  // Elementos da página
  const inputOnline = document.getElementById("valor-online");
  const inputPresencial = document.getElementById("valor-presencial");
  const inputTaxa = document.getElementById("taxa-acordo");
  const saveBtn = document.getElementById("salvar-valores-btn");

  // Função para carregar os dados do Firestore e preencher o formulário
  async function carregarValores() {
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Acessa o mapa 'valores' dentro do documento
        if (data.valores) {
          inputOnline.value = data.valores.online || 0;
          inputPresencial.value = data.valores.presencial || 0;
          inputTaxa.value = data.valores.taxaAcordo || 0;
        }
      } else {
        console.log("Documento de configurações não encontrado!");
      }
    } catch (error) {
      console.error("Erro ao buscar valores: ", error);
      window.showToast("Erro ao buscar valores.", "error");
    }
  }

  // Adiciona o evento de clique no botão de salvar
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;

      const novoValorOnline = parseFloat(inputOnline.value) || 0;
      const novoValorPresencial = parseFloat(inputPresencial.value) || 0;
      const novaTaxaAcordo = parseFloat(inputTaxa.value) || 0;

      try {
        // Usa a notação de ponto para atualizar campos dentro de um mapa
        await updateDoc(docRef, {
          "valores.online": novoValorOnline,
          "valores.presencial": novoValorPresencial,
          "valores.taxaAcordo": novaTaxaAcordo,
        });
        window.showToast("Valores salvos com sucesso!", "success");
      } catch (error) {
        console.error("Erro ao salvar valores: ", error);
        window.showToast("Erro ao salvar valores.", "error");
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  // Carrega os valores assim que o script é executado
  carregarValores();
})();
