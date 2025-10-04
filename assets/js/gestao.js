/**
 * Sistema de Gestão de Locais e Celebrantes
 */

class GestaoSystem {
    constructor() {
        this.locais = [];
        this.celebrantes = [];
        this.deleteCallback = null;
        this.init();
    }
    
    init() {
        this.loadLocais();
        this.loadCelebrantes();
        this.setupForms();
        this.setupUppercaseInputs();
    }
    
    setupUppercaseInputs() {
        document.querySelectorAll('.uppercase-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                e.target.value = e.target.value.toUpperCase();
                e.target.setSelectionRange(start, end);
            });
        });
    }
    
    setupForms() {
        // Form de Local
        document.getElementById('localForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveLocal();
        });
        
        // Form de Celebrante
        document.getElementById('celebrantForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCelebrant();
        });
        
        // Máscara de telefone
        const telefone = document.getElementById('celebrantTelefone');
        if (telefone) {
            telefone.addEventListener('input', this.applyPhoneMask);
        }
    }
    
    applyPhoneMask(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.substring(0, 11);
        
        if (value.length === 0) {
            e.target.value = '';
        } else if (value.length <= 2) {
            e.target.value = `(${value}`;
        } else if (value.length <= 6) {
            e.target.value = `(${value.substring(0, 2)}) ${value.substring(2)}`;
        } else if (value.length <= 10) {
            e.target.value = `(${value.substring(0, 2)}) ${value.substring(2, 6)}-${value.substring(6)}`;
        } else {
            e.target.value = `(${value.substring(0, 2)}) ${value.substring(2, 7)}-${value.substring(7, 11)}`;
        }
    }
    
    // ========== LOCAIS ==========
    
    async loadLocais() {
        try {
            const response = await fetch('api/buscar-locais.php?include_inactive=1');
            const data = await response.json();
            
            if (data.success) {
                this.locais = data.locations;
                this.renderLocais();
            }
        } catch (error) {
            console.error('Erro ao carregar locais:', error);
            this.showToast('Erro ao carregar locais', 'error');
        }
    }
    
    renderLocais() {
        const tbody = document.getElementById('locaisTableBody');
        
        if (this.locais.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum local cadastrado</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.locais.map(local => `
            <tr>
                <td><strong>${local.nome_local}</strong></td>
                <td>${local.endereco || '-'}</td>
                <td>${local.capacidade || '-'}</td>
                <td>
                    <span class="status-badge ${local.ativo ? 'ativo' : 'inativo'}">
                        ${local.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="gestaoSystem.editLocal(${local.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon ${local.ativo ? '' : 'danger'}" 
                                onclick="gestaoSystem.toggleLocalStatus(${local.id}, ${local.ativo})" 
                                title="${local.ativo ? 'Desativar' : 'Ativar'}">
                            <i class="fas fa-${local.ativo ? 'toggle-on' : 'toggle-off'}"></i>
                        </button>
                        ${local.total_agendamentos === 0 ? `
                            <button class="btn-icon danger" 
                                    onclick="gestaoSystem.deleteLocal(${local.id}, '${local.nome_local}')" 
                                    title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    editLocal(id) {
        const local = this.locais.find(l => l.id === id);
        if (!local) return;
        
        document.getElementById('localModalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Local';
        document.getElementById('localId').value = local.id;
        document.getElementById('localNome').value = local.nome_local;
        document.getElementById('localEndereco').value = local.endereco || '';
        document.getElementById('localCapacidade').value = local.capacidade || '';
        
        document.getElementById('localModal').classList.add('active');
    }
    
    async saveLocal() {
        const id = document.getElementById('localId').value;
        const dados = {
            nome_local: document.getElementById('localNome').value,
            endereco: document.getElementById('localEndereco').value,
            capacidade: document.getElementById('localCapacidade').value
        };
        
        try {
            const url = id ? `api/buscar-locais.php?id=${id}` : 'api/buscar-locais.php';
            const method = id ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(id ? 'Local atualizado com sucesso!' : 'Local adicionado com sucesso!', 'success');
                closeLocalModal();
                this.loadLocais();
            } else {
                this.showToast(result.message || 'Erro ao salvar local', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showToast('Erro ao comunicar com o servidor', 'error');
        }
    }
    
    async toggleLocalStatus(id, currentStatus) {
        try {
            const response = await fetch(`api/buscar-locais.php?id=${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ativo: currentStatus ? 0 : 1 })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Status atualizado com sucesso!', 'success');
                this.loadLocais();
            } else {
                this.showToast(result.message || 'Erro ao atualizar status', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showToast('Erro ao comunicar com o servidor', 'error');
        }
    }
    
    deleteLocal(id, nome) {
        this.showConfirm(
            'Confirmar Exclusão',
            `Tem certeza que deseja excluir o local "${nome}"?`,
            async () => {
                try {
                    const response = await fetch(`api/buscar-locais.php?id=${id}`, {
                        method: 'DELETE'
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        this.showToast('Local excluído com sucesso!', 'success');
                        this.loadLocais();
                    } else {
                        this.showToast(result.message || 'Erro ao excluir local', 'error');
                    }
                } catch (error) {
                    console.error('Erro:', error);
                    this.showToast('Erro ao comunicar com o servidor', 'error');
                }
            }
        );
    }
    
    // ========== CELEBRANTES ==========
    
    async loadCelebrantes() {
        try {
            const response = await fetch('api/buscar-padres.php?include_inactive=1');
            const data = await response.json();
            
            if (data.success) {
                this.celebrantes = data.celebrants;
                this.renderCelebrantes();
            }
        } catch (error) {
            console.error('Erro ao carregar celebrantes:', error);
            this.showToast('Erro ao carregar celebrantes', 'error');
        }
    }
    
    renderCelebrantes() {
        const tbody = document.getElementById('celebrantesTableBody');
        
        if (this.celebrantes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum celebrante cadastrado</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.celebrantes.map(celebrant => `
            <tr>
                <td><strong>${celebrant.nome_completo}</strong></td>
                <td><span class="status-badge" style="background: #e3f2fd; color: #1976d2;">${celebrant.tipo}</span></td>
                <td>${celebrant.telefone_formatado || '-'}</td>
                <td>${celebrant.email || '-'}</td>
                <td>
                    <span class="status-badge ${celebrant.ativo ? 'ativo' : 'inativo'}">
                        ${celebrant.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon" onclick="gestaoSystem.editCelebrant(${celebrant.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon ${celebrant.ativo ? '' : 'danger'}" 
                                onclick="gestaoSystem.toggleCelebrantStatus(${celebrant.id}, ${celebrant.ativo})" 
                                title="${celebrant.ativo ? 'Desativar' : 'Ativar'}">
                            <i class="fas fa-${celebrant.ativo ? 'toggle-on' : 'toggle-off'}"></i>
                        </button>
                        ${celebrant.celebracoes_futuras === 0 ? `
                            <button class="btn-icon danger" 
                                    onclick="gestaoSystem.deleteCelebrant(${celebrant.id}, '${celebrant.nome_completo}')" 
                                    title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    editCelebrant(id) {
        const celebrant = this.celebrantes.find(c => c.id === id);
        if (!celebrant) return;
        
        document.getElementById('celebrantModalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Celebrante';
        document.getElementById('celebrantId').value = celebrant.id;
        document.getElementById('celebrantNome').value = celebrant.nome_completo;
        document.getElementById('celebrantTipo').value = celebrant.tipo;
        document.getElementById('celebrantTelefone').value = celebrant.telefone || '';
        document.getElementById('celebrantEmail').value = celebrant.email || '';
        
        document.getElementById('celebrantModal').classList.add('active');
    }
    
    async saveCelebrant() {
        const id = document.getElementById('celebrantId').value;
        const dados = {
            nome_completo: document.getElementById('celebrantNome').value,
            tipo: document.getElementById('celebrantTipo').value,
            telefone: document.getElementById('celebrantTelefone').value,
            email: document.getElementById('celebrantEmail').value
        };
        
        try {
            const url = id ? `api/buscar-padres.php?id=${id}` : 'api/buscar-padres.php';
            const method = id ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast(id ? 'Celebrante atualizado com sucesso!' : 'Celebrante adicionado com sucesso!', 'success');
                closeCelebrantModal();
                this.loadCelebrantes();
            } else {
                this.showToast(result.message || 'Erro ao salvar celebrante', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showToast('Erro ao comunicar com o servidor', 'error');
        }
    }
    
    async toggleCelebrantStatus(id, currentStatus) {
        try {
            const response = await fetch(`api/buscar-padres.php?id=${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ativo: currentStatus ? 0 : 1 })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Status atualizado com sucesso!', 'success');
                this.loadCelebrantes();
            } else {
                this.showToast(result.message || 'Erro ao atualizar status', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showToast('Erro ao comunicar com o servidor', 'error');
        }
    }
    
    deleteCelebrant(id, nome) {
        this.showConfirm(
            'Confirmar Exclusão',
            `Tem certeza que deseja excluir "${nome}"?`,
            async () => {
                try {
                    const response = await fetch(`api/buscar-padres.php?id=${id}`, {
                        method: 'DELETE'
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        this.showToast('Celebrante excluído com sucesso!', 'success');
                        this.loadCelebrantes();
                    } else {
                        this.showToast(result.message || 'Erro ao excluir celebrante', 'error');
                    }
                } catch (error) {
                    console.error('Erro:', error);
                    this.showToast('Erro ao comunicar com o servidor', 'error');
                }
            }
        );
    }
    
    // ========== UTILITÁRIOS ==========
    
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `show ${type}`;
        
        setTimeout(() => {
            toast.className = '';
        }, 3000);
    }
    
    showConfirm(title, message, callback) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        this.deleteCallback = callback;
        document.getElementById('confirmModal').classList.add('active');
    }
}

// Funções globais
function openAddLocalModal() {
    document.getElementById('localModalTitle').innerHTML = '<i class="fas fa-plus"></i> Novo Local';
    document.getElementById('localForm').reset();
    document.getElementById('localId').value = '';
    document.getElementById('localModal').classList.add('active');
}

function closeLocalModal() {
    document.getElementById('localModal').classList.remove('active');
}

function openAddCelebrantModal() {
    document.getElementById('celebrantModalTitle').innerHTML = '<i class="fas fa-plus"></i> Novo Celebrante';
    document.getElementById('celebrantForm').reset();
    document.getElementById('celebrantId').value = '';
    document.getElementById('celebrantModal').classList.add('active');
}

function closeCelebrantModal() {
    document.getElementById('celebrantModal').classList.remove('active');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
    gestaoSystem.deleteCallback = null;
}

function confirmDelete() {
    if (gestaoSystem.deleteCallback) {
        gestaoSystem.deleteCallback();
    }
    closeConfirmModal();
}

// Inicializa
let gestaoSystem;
document.addEventListener('DOMContentLoaded', () => {
    gestaoSystem = new GestaoSystem();
});
