// assets/js/lancamentos.js
(function() {
    if (!db) { return; }

    const fluxoCaixaRef = db.collection('fluxoCaixa');
    const saveBtn = document.getElementById('save-lancamento-btn');
    const formGrid = document.querySelector('.form-grid');
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const modal = document.getElementById('confirmation-modal');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    const btnCancelDelete = document.getElementById('btn-cancel-delete');
    let lancamentoIdParaExcluir = null;

    let allLancamentos = [];
    let currentFilter = { tipo: 'todos' };

    function formatCurrency(value) { return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    function formatDate(dateString) { if (!dateString) return 'Pendente'; return dateString.split('-').reverse().join('/'); }
    
    function setupFilters() {
        const mesSelector = document.getElementById('filtro-mes');
        const anoSelector = document.getElementById('filtro-ano');
        const d = new Date();
        const currentMonth = d.getMonth();
        const currentYear = d.getFullYear();
        currentFilter.mes = currentMonth;
        currentFilter.ano = currentYear;
        mesSelector.innerHTML = meses.map((m, i) => `<option value="${i}" ${i === currentMonth ? 'selected' : ''}>${m}</option>`).join('');
        let yearsHtml = '';
        for (let y = currentYear - 3; y <= currentYear + 1; y++) {
            yearsHtml += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
        }
        anoSelector.innerHTML = yearsHtml;
        mesSelector.addEventListener('change', (e) => { currentFilter.mes = parseInt(e.target.value); renderTable(); });
        anoSelector.addEventListener('change', (e) => { currentFilter.ano = parseInt(e.target.value); renderTable(); });
    }
    
    function renderTable() {
        const tbody = document.getElementById('lancamentos-table').querySelector('tbody');
        tbody.innerHTML = '';
        
        const filtered = allLancamentos.filter(l => {
            // Firestore timestamp pode ser null ou um objeto com seconds/nanoseconds
            const vencimento = l.dataVencimento ? new Date(l.dataVencimento) : null;
            if (!vencimento) return false;

            const matchPeriodo = vencimento.getUTCMonth() === currentFilter.mes && vencimento.getUTCFullYear() === currentFilter.ano;
            const matchTipo = currentFilter.tipo === 'todos' || l.tipo === currentFilter.tipo;
            return matchPeriodo && matchTipo;
        });
        
        filtered.sort((a,b) => new Date(a.dataVencimento) - new Date(b.dataVencimento));

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Nenhum lançamento encontrado para este período.</td></tr>';
            return;
        }
        filtered.forEach(l => {
            const tr = document.createElement('tr');
            const tipoClass = l.tipo === 'receita' ? 'text-receita' : 'text-despesa';
            tr.innerHTML = `
                <td>${formatDate(l.dataVencimento)}</td> <td>${formatDate(l.dataPagamento)}</td> <td>${l.descricao}</td>
                <td class="${tipoClass}">${l.tipo.charAt(0).toUpperCase() + l.tipo.slice(1)}</td>
                <td class="${tipoClass}">${formatCurrency(l.valor)}</td>
                <td><button class="delete-btn" data-id="${l.id}">&times;</button></td>
            `;
            tbody.appendChild(tr);
        });
    }
    
    document.getElementById('lancamentos-table').addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            lancamentoIdParaExcluir = e.target.dataset.id;
            modal.style.display = 'flex';
        }
    });

    btnCancelDelete.addEventListener('click', () => {
        modal.style.display = 'none';
        lancamentoIdParaExcluir = null;
    });

    btnConfirmDelete.addEventListener('click', () => {
        if (lancamentoIdParaExcluir) {
            fluxoCaixaRef.doc(lancamentoIdParaExcluir).delete()
                .then(() => window.showToast('Lançamento removido com sucesso.', 'success'))
                .catch(err => window.showToast('Erro ao remover lançamento.', 'error'))
                .finally(() => {
                    modal.style.display = 'none';
                    lancamentoIdParaExcluir = null;
                });
        }
    });

    document.getElementById('tipo-filter-buttons').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter.tipo = e.target.dataset.tipo;
            renderTable();
        }
    });

    saveBtn.addEventListener('click', () => {
        const novoLancamento = {
            descricao: document.getElementById('lancamento-desc').value,
            valor: parseFloat(document.getElementById('lancamento-valor').value),
            tipo: document.getElementById('lancamento-tipo').value,
            categoria: document.getElementById('lancamento-categoria').value || 'Geral',
            dataVencimento: document.getElementById('lancamento-vencimento').value,
            dataPagamento: document.getElementById('lancamento-pagamento').value || null,
            status: document.getElementById('lancamento-pagamento').value ? 'pago' : 'pendente',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (!novoLancamento.descricao || isNaN(novoLancamento.valor) || novoLancamento.valor <= 0 || !novoLancamento.dataVencimento) {
            window.showToast('Preencha Descrição, Valor e Data de Vencimento.', 'error'); return;
        }
        saveBtn.disabled = true; saveBtn.textContent = 'Salvando...';
        
        fluxoCaixaRef.add(novoLancamento)
            .then(() => {
                window.showToast('Lançamento salvo com sucesso!', 'success');
                formGrid.querySelectorAll('input, select').forEach(el => {
                    if(el.type !== 'select-one') el.value = '';
                });
                document.getElementById('lancamento-tipo').value = 'despesa';
            })
            .catch(err => { console.error(err); window.showToast('Erro ao salvar.', 'error'); })
            .finally(() => { saveBtn.disabled = false; saveBtn.textContent = 'Salvar Lançamento'; });
    });

    // Listener em tempo real do Firestore
    fluxoCaixaRef.onSnapshot(snapshot => {
        allLancamentos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTable();
    }, error => {
        console.error("Erro ao ouvir a coleção fluxoCaixa: ", error);
    });
    
    setupFilters();
})();
