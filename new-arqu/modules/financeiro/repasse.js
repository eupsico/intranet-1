(function() {
    if (!db) { return; }

    const loadingDiv = document.getElementById('repasse-loading');
    const mainContentDiv = document.getElementById('repasse-main-content');
    const comprovantesTableBody = document.getElementById('comprovantes-table').querySelector('tbody');
    
    let DB = { profissionais: [], comprovantes: [], cobranca: {} };
    let currentlyDisplayedData = [];
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    function formatCurrency(value) { return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    function formatDate(dateStr) { return dateStr ? dateStr.split('-').reverse().join('/') : '---'; }
    function sanitizeKey(key) { if (!key) return ''; return key.replace(/\.|\$|\[|\]|#|\//g, '_'); }
    
    function showMessage(message, type = 'info') {
        const messageEl = document.getElementById('status-message');
        if (!messageEl) return;
        messageEl.textContent = message;
        messageEl.className = type;
        messageEl.style.display = 'block';
        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 5000);
    }

    function showConfirmation(message, onConfirm) {
        const modal = document.getElementById('custom-confirm-repasse');
        const messageEl = document.getElementById('confirm-repasse-message');
        const btnYes = document.getElementById('confirm-repasse-yes');
        const btnNo = document.getElementById('confirm-repasse-no');
        
        if (!modal || !messageEl || !btnYes || !btnNo) return;
        
        messageEl.textContent = message;
        modal.style.display = 'flex';

        btnYes.onclick = () => {
            modal.style.display = 'none';
            onConfirm();
        };
        btnNo.onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    async function fetchData() {
        try {
            const [usuariosSnap, configSnap, comprovantesSnap] = await Promise.all([
                db.collection('usuarios').get(),
                db.collection('financeiro').doc('configuracoes').get(),
                db.collection('comprovantes').get()
            ]);

            DB.profissionais = usuariosSnap.docs.map(doc => doc.data());
            DB.comprovantes = comprovantesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const configData = configSnap.exists ? configSnap.data() : {};
            DB.cobranca = configData.cobranca || {};

            loadingDiv.style.display = 'none';
            mainContentDiv.style.display = 'block';
            
            setupFilters();
            updateView();
        } catch (error) {
            loadingDiv.innerHTML = '<p style="color:red;">Erro ao carregar dados.</p>';
            console.error(error);
        }
    }

    function setupFilters() {
        const profSelector = document.getElementById('filtro-profissional');
        const mesSelector = document.getElementById('filtro-mes');
        const anoSelector = document.getElementById('filtro-ano');
        
        // --- LINHA CORRIGIDA AQUI ---
        // Adicionamos 'p.recebeDireto === true' ao filtro
        const ativos = DB.profissionais.filter(p => p.nome && !p.primeiraFase && !p.inativo && p.recebeDireto === true).sort((a, b) => a.nome.localeCompare(b.nome));
        
        profSelector.innerHTML = ['<option value="todos">Todos os Profissionais</option>', ...ativos.map(p => `<option value="${p.nome}">${p.nome}</option>`)].join('');
        mesSelector.innerHTML = ['<option value="todos">Todos os Meses</option>', ...meses.map((m, i) => `<option value="${m.toLowerCase()}">${m}</option>`)].join('');
        
        const currentYear = new Date().getFullYear();
        let yearsHtml = '';
        for (let y = currentYear - 3; y <= currentYear + 1; y++) { yearsHtml += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`; }
        anoSelector.innerHTML = yearsHtml;

        profSelector.addEventListener('change', updateView);
        mesSelector.addEventListener('change', updateView);
        anoSelector.addEventListener('change', updateView);
        document.getElementById('export-pdf-btn').addEventListener('click', () => generateReport('pdf'));
        document.getElementById('export-csv-btn').addEventListener('click', () => generateReport('csv'));
    }

    function updateView() {
        const selectedProf = document.getElementById('filtro-profissional').value;
        const selectedMes = document.getElementById('filtro-mes').value;
        const selectedAno = document.getElementById('filtro-ano').value;
        const summaryContainer = document.getElementById('summary-container');
        
        let filteredData = DB.comprovantes;
        if (selectedProf !== 'todos') {
            filteredData = filteredData.filter(c => c.profissional === selectedProf);
        }
        if (selectedMes !== 'todos') {
            filteredData = filteredData.filter(c => c.mesReferencia && c.mesReferencia.toLowerCase() === selectedMes);
        }
        if (selectedAno) {
            filteredData = filteredData.filter(c => c.anoReferencia == selectedAno);
        }

        currentlyDisplayedData = filteredData;
        renderTable(filteredData);

        if (selectedProf !== 'todos') {
            summaryContainer.style.display = 'block';
            calculateSummary(selectedProf, filteredData);
        } else {
            summaryContainer.style.display = 'none';
        }
    }
    
    function calculateSummary(professionalName, comprovantesFiltrados) {
        const selectedMes = document.getElementById('filtro-mes').value;
        const selectedAno = document.getElementById('filtro-ano').value;
        const totalRecebido = comprovantesFiltrados.reduce((sum, c) => sum + (c.valor || 0), 0);
        const profKey = sanitizeKey(professionalName);
        let totalDevido = 0;

        if (selectedMes !== 'todos') {
            totalDevido = (DB.cobranca[selectedAno]?.[profKey]?.[selectedMes]) || 0;
        } else {
            if (DB.cobranca[selectedAno] && DB.cobranca[selectedAno][profKey]) {
                for (const mes in DB.cobranca[selectedAno][profKey]) {
                    totalDevido += DB.cobranca[selectedAno][profKey][mes] || 0;
                }
            }
        }
        
        const saldo = totalRecebido - totalDevido;
        
        document.getElementById('total-recebido').textContent = formatCurrency(totalRecebido);
        document.getElementById('total-devido').textContent = formatCurrency(totalDevido);
        document.getElementById('saldo-profissional').textContent = formatCurrency(saldo);
        document.getElementById('titulo-devido').textContent = `Total Devido (${selectedMes === 'todos' ? 'Ano' : 'Mês'})`;
        document.getElementById('titulo-saldo').textContent = `Saldo (Repasse)`;
    }

    function renderTable(comprovantes) {
        comprovantes.sort((a,b) => {
            const dateA = a.dataPagamento ? new Date(a.dataPagamento) : new Date(a.timestamp?.toDate());
            const dateB = b.dataPagamento ? new Date(b.dataPagamento) : new Date(b.timestamp?.toDate());
            return dateB - dateA;
        });

        if (comprovantes.length === 0) {
            comprovantesTableBody.innerHTML = '<tr><td colspan="6">Nenhum comprovante para os filtros selecionados.</td></tr>';
        } else {
            comprovantesTableBody.innerHTML = comprovantes.map(c => `
                <tr>
                    <td>${c.profissional || 'N/A'}</td>
                    <td>${formatDate(c.dataPagamento)}</td>
                    <td>${(c.mesReferencia ? c.mesReferencia.charAt(0).toUpperCase() + c.mesReferencia.slice(1) : 'N/A')}/${c.anoReferencia || ''}</td>
                    <td>${formatCurrency(c.valor || 0)}</td>
                    <td><a href="${c.comprovanteUrl}" target="_blank" rel="noopener noreferrer">Ver Link</a></td>
                    <td><button class="btn-delete" data-id="${c.id}">Excluir</button></td>
                </tr>
            `).join('');
        }
    }

    function deleteComprovante(comprovanteId) {
        if (!comprovanteId) return;
        showConfirmation("Tem certeza que deseja excluir este comprovante? Esta ação não pode ser desfeita.", () => {
            db.collection('comprovantes').doc(comprovanteId).delete()
                .then(() => {
                    window.showToast("Comprovante excluído com sucesso!", "success");
                    DB.comprovantes = DB.comprovantes.filter(c => c.id !== comprovanteId);
                    updateView();
                })
                .catch((error) => {
                    window.showToast("Ocorreu um erro ao tentar excluir.", "error");
                    console.error("Erro ao excluir comprovante: ", error);
                });
        });
    }
    
    function generateReport(format) {
        if (currentlyDisplayedData.length === 0) { 
            showMessage('Não há dados para exportar.', 'info'); 
            return; 
        }
        const prof = document.getElementById('filtro-profissional').value;
        const mes = document.getElementById('filtro-mes').value;
        const ano = document.getElementById('filtro-ano').value;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        if (prof !== 'todos') {
            const totalRecebido = parseFloat(document.getElementById('total-recebido').textContent.replace(/[^\d,-]/g, '').replace(',', '.'));
            const totalDevido = parseFloat(document.getElementById('total-devido').textContent.replace(/[^\d,-]/g, '').replace(',', '.'));
            const saldo = parseFloat(document.getElementById('saldo-profissional').textContent.replace(/[^\d,-]/g, '').replace(',', '.'));

            if (format === 'pdf') {
                doc.setFontSize(18); doc.text(`Resumo Financeiro - ${prof}`, 14, 22);
                doc.setFontSize(11); doc.text(`Período: ${mes}/${ano}`, 14, 28);
                doc.autoTable({
                    head: [['Item', 'Valor']],
                    body: [
                        ['Total Recebido (Comprovantes)', formatCurrency(totalRecebido)],
                        ['Total Devido (Mês/Ano)', formatCurrency(totalDevido)],
                        ['Saldo (Repasse)', formatCurrency(saldo)]
                    ],
                    startY: 35
                });
                doc.save(`resumo_${prof}_${mes}.pdf`);
            } else if (format === 'csv') {
                let csvContent = "Item;Valor\n";
                csvContent += `"Total Recebido (Comprovantes)";"${totalRecebido.toFixed(2).replace('.',',')}"\n`;
                csvContent += `"Total Devido (Mês/Histórico)";"${totalDevido.toFixed(2).replace('.',',')}"\n`;
                csvContent += `"Saldo (Crédito/Débito)";"${saldo.toFixed(2).replace('.',',')}"\n`;
                const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `resumo_${prof}_${mes}.csv`;
                link.click();
            }
        } else {
            if (format === 'pdf') {
                doc.setFontSize(18); doc.text(`Relatório Geral de Comprovantes`, 14, 22);
                doc.setFontSize(11); doc.text(`Período: ${mes}/${ano}`, 14, 28);
                doc.autoTable({
                    head: [['Profissional', 'Data Pag.', 'Mês Ref.', 'Valor Pago']],
                    body: currentlyDisplayedData.map(c => [c.profissional, formatDate(c.dataPagamento), `${c.mesReferencia}/${c.anoReferencia}`, formatCurrency(c.valor || 0)]),
                    startY: 35
                });
                doc.save(`relatorio_geral_${mes}_${ano}.pdf`);
            } else if (format === 'csv') {
                let csvContent = "Profissional;Data Pagamento;Mes Referencia;Valor Pago;Link Comprovante\n";
                currentlyDisplayedData.forEach(c => { csvContent += `"${c.profissional}";"${formatDate(c.dataPagamento)}";"${c.mesReferencia}/${c.anoReferencia}";"${(c.valor || 0).toFixed(2).replace('.',',')}";"${c.comprovanteUrl}"\n`; });
                const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `relatorio_comprovantes_${mes}_${ano}.csv`;
                link.click();
            }
        }
    }
    
    comprovantesTableBody.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('btn-delete')) {
            const comprovanteId = e.target.dataset.id;
            deleteComprovante(comprovanteId);
        }
    });

    fetchData();
})();
