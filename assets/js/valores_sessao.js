// assets/js/valores_sessao.js
(function() {
    if (!db) {
        console.error("Instância do Firestore (db) não encontrada.");
        return;
    }

    // Referência para o documento único de configurações financeiras
    const docRef = db.collection('financeiro').doc('configuracoes');

    // Elementos da página
    const inputOnline = document.getElementById('valor-online');
    const inputPresencial = document.getElementById('valor-presencial');
    const inputTaxa = document.getElementById('taxa-acordo');
    const saveBtn = document.getElementById('salvar-valores-btn');

    // Função para carregar os dados do Firestore e preencher o formulário
    async function carregarValores() {
        try {
            const doc = await docRef.get();
            if (doc.exists) {
                const data = doc.data();
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
            window.showToast('Erro ao buscar valores.', 'error');
        }
    }

    // Adiciona o evento de clique no botão de salvar
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            
            const novoValorOnline = parseFloat(inputOnline.value) || 0;
            const novoValorPresencial = parseFloat(inputPresencial.value) || 0;
            const novaTaxaAcordo = parseFloat(inputTaxa.value) || 0;
            
            try {
                // Usa a notação de ponto para atualizar campos dentro de um mapa
                await docRef.update({
                    'valores.online': novoValorOnline,
                    'valores.presencial': novoValorPresencial,
                    'valores.taxaAcordo': novaTaxaAcordo
                });
                window.showToast('Valores salvos com sucesso!', 'success');
            } catch (error) {
                console.error("Erro ao salvar valores: ", error);
                window.showToast('Erro ao salvar valores.', 'error');
            } finally {
                saveBtn.disabled = false;
            }
        });
    }

    // Carrega os valores assim que o script é executado
    carregarValores();
})();
