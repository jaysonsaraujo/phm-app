/**
 * Gerenciamento Inline de Locais e Celebrantes
 */

class InlineManagement {
    constructor() {
        this.locations = [];
        this.celebrants = [];
        this.init();
    }
    
    init() {
        this.setupForms();
    }
    
    setupForms() {
        // Form de Local
        const locationForm = document.getElementById('locationForm');
        if (locationForm) {
            locationForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveLocation();
            });
        }
        
        // Form de Celebrante
        const celebrantForm = document.getElementById('celebrantForm');
        if (celebrantForm) {
            celebrantForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveCelebrant();
            });
        }
        
        // Máscara de telefone
        const phone = document.getElementById('celebrantPhone');
        if (phone) {
            phone.addEventListener('input', this.applyPhoneMask);
        }
        
        // Uppercase inputs
        document.querySelectorAll('.uppercase-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                e.target.value = e.target.value.toUpperCase();
                e.target.setSelectionRange(start, end);
            });
        });
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
    
    async loadLocations() {
        try {
            const response = await fetch('api/buscar-locais.php?include_inactive=1');
            const data = await response.json();
            
            if (data.success) {
                this.locations = data.locations;
                this.renderLocations();
            }
        } catch (error) {
            console.error('Erro ao carregar locais:', error);
            this.showToast('Erro ao carregar locais', 'error');
        }
    }
    
    renderLocations() {
        const tbody = document.getElementById('locationsTableBody');
        
        if (this.locations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum local cadastrado</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.locations.map(loc => `
            <tr>
                <td><strong>${loc.nome_local}</strong></td>
                <td>${loc.endereco || '-'}</td>
                <td>${loc.capacidade || '-'}</td>
                <td>
                    <span class="status-badge ${loc.ativo ? 'ativo' : 'inativo'}">
                        ${loc.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td>
                    <button class="action-btn" onclick="inlineManagement.editLocation(${loc.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="action-btn ${loc.ativo ? '' : 'danger'}" 
                            onclick="inlineManagement.toggleLocationStatus(${loc.id}, ${loc.ativo})">
                        <i class="fas fa-toggle-${loc.ativo ? 'on' : 'off'}"></i> 
                        ${loc.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    ${loc.total_agendamentos === 0 ? `
                        <button class="action-btn danger" 
                                onclick="inlineManagement.deleteLocation(${loc.id}, '${loc.nome_local.replace(/'/g, "\\'")}')">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }
    
    editLocation(id) {
        const location = this.locations.find(l => l.id === id);
        if (!location) return;
        
        document.getElementById('locationFormTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Local';
        document.getElementById('locationId').value = location.id;
        document.getElementById('locationName').value = location.nome_local;
        document.getElementById('locationAddress').value = location.endereco || '';
        document.getElementById('locationCapacity').value = location.capacidade || '';
        
        document.getElementById('locationFormModal').classList.add('active');
    }
    
    async saveLocation() {
        const id = document.getElementById('locationId').value;
        const dados = {
            nome_local: document.getElementById('locationName').value,
            endereco: document.getElementById('locationAddress').value,
            capacidade: document.getElementById('locationCapacity').value
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
                this.showToast(id ? 'Local atualizado!' : 'Local adicionado!', 'success');
                closeLocationForm();
                this.loadLocations();
                
                // Recarrega o select no formulário principal
                if (window.weddingCalendar) {
                    window.weddingCalendar.loadLocations();
                }
            } else {
                this.showToast(result.message || 'Erro ao salvar', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showToast('Erro ao comunicar com servidor', 'error');
        }
    }
    
    async toggleLocationStatus(id, currentStatus) {
        try {
            const response = await fetch(`api/buscar-locais.php?id=${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ativo: currentStatus ? 0 : 1 })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Status atualizado!', 'success');
                this.loadLocations();
                if (window.weddingCalendar) {
                    window.weddingCalendar.loadLocations();
                }
            } else {
                this.showToast(result.message || 'Erro ao atualizar', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showToast('Erro ao comunicar com servidor', 'error');
        }
    }
    
    async deleteLocation(id, nome) {
        if (!confirm(`Tem certeza que deseja excluir "${nome}"?`)) return;
        
        try {
            const response = await fetch(`api/buscar-locais.php?id=${id}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Local excluído!', 'success');
                this.loadLocations();
                if (window.weddingCalendar) {
                    window.weddingCalendar.loadLocations();
                }
            } else {
                this.showToast(result.message || 'Erro ao excluir', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showToast('Erro ao comunicar com servidor', 'error');
        }
    }
    
    // ========== CELEBRANTES ==========
    
    async loadCelebrants() {
        try {
            const response = await fetch('api/buscar-padres.php?include_inactive=1');
            const data = await response.json();
            
            if (data.success) {
                this.celebrants = data.celebrants;
                this.renderCelebrants();
            }
        } catch (error) {
            console.error('Erro ao carregar celebrantes:', error);
            this.showToast('Erro ao carregar celebrantes', 'error');
        }
    }
    
    renderCelebrants() {
        const tbody = document.getElementById('celebrantsTableBody');
        
        if (this.celebrants.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhum celebrante cadastrado</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.celebrants.map(cel => `
            <tr>
                <td><strong>${cel.nome_completo}</strong></td>
                <td><span class="status-badge tipo">${cel.tipo}</span></td>
                <td>${cel.telefone_formatado || '-'}</td>
                <td>${cel.email || '-'}</td>
                <td>
                    <span class="status-badge ${cel.ativo ? 'ativo' : 'inativo'}">
                        ${cel.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td>
                    <button class="action-btn" onclick="inlineManagement.editCelebrant(${cel.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="action-btn ${cel.ativo ? '' : 'danger'}" 
                            onclick="inlineManagement.toggleCelebrantStatus(${cel.id}, ${cel.ativo})">
                        <i class="fas fa-toggle-${cel.ativo ? 'on' : 'off'}"></i> 
                        ${cel.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    ${cel.celebracoes_futuras === 0 ? `
                        <button class="action-btn danger" 
                                onclick="inlineManagement.deleteCelebrant(${cel.id}, '${cel.nome_completo.replace(/'/g, "\\'")}')">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    }
    
    editCelebrant(id) {
        const celebrant = this.celebrants.find(c => c.id === id);
        if (!celebrant) return;
        
        document.getElementById('celebrantFormTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Celebrante';
        document.getElementById('celebrantId').value = celebrant.id;
        document.getElementById('celebrantName').value = celebrant.nome_completo;
        document.getElementById('celebrantType').value = celebrant.tipo;
        document.getElementById('celebrantPhone').value = celebrant.telefone || '';
        document.getElementById('celebrantEmail').value = celebrant.email || '';
        
        document.getElementById('celebrantFormModal').classList.add('active');
    }
    
    async saveCelebrant() {
        const id = document.getElementById('celebrantId').value;
        const dados = {
            nome_completo: document.getElementById('celebrantName').value,
            tipo: document.getElementById('celebrantType').value,
            telefone: document.getElementById('celebrantPhone').value,
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
                this.showToast(id ? 'Celebrante atualizado!' : 'Celebrante adicionado!', 'success');
                closeCelebrantForm();
                this.loadCelebrants();
                
                if (window.weddingCalendar) {
                    window.weddingCalendar.loadCelebrants();
                }
            } else {
                this.showToast(result.message || 'Erro ao salvar', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showToast('Erro ao comunicar com servidor', 'error');
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
                this.showToast('Status atualizado!', 'success');
                this.loadCelebrants();
                if (window.weddingCalendar) {
                    window.weddingCalendar.loadCelebrants();
                }
            } else {
                this.showToast(result.message || 'Erro ao atualizar', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showToast('Erro ao comunicar com servidor', 'error');
        }
    }
    
    async deleteCelebrant(id, nome) {
        if (!confirm(`Tem certeza que deseja excluir "${nome}"?`)) return;
        
        try {
            const response = await fetch(`api/buscar-padres.php?id=${id}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showToast('Celebrante excluído!', 'success');
                this.loadCelebrants();
                if (window.weddingCalendar) {
                    window.weddingCalendar.loadCelebrants();
                }
            } else {
                this.showToast(result.message || 'Erro ao excluir', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showToast('Erro ao comunicar com servidor', 'error');
        }
    }
    
    // ========== UTILITÁRIOS ==========
    
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }
}

// Funções globais
function openManageLocations() {
    document.getElementById('manageLocationsModal').classList.add('active');
    inlineManagement.loadLocations();
}

function closeManageLocations() {
    document.getElementById('manageLocationsModal').classList.remove('active');
}

function openManageCelebrants() {
    document.getElementById('manageCelebrantsModal').classList.add('active');
    inlineManagement.loadCelebrants();
}

function closeManageCelebrants() {
    document.getElementById('manageCelebrantsModal').classList.remove('active');
}

function openAddLocation() {
    document.getElementById('locationFormTitle').innerHTML = '<i class="fas fa-plus"></i> Novo Local';
    document.getElementById('locationForm').reset();
    document.getElementById('locationId').value = '';
    document.getElementById('locationFormModal').classList.add('active');
}

function closeLocationForm() {
    document.getElementById('locationFormModal').classList.remove('active');
}

function openAddCelebrant() {
    document.getElementById('celebrantFormTitle').innerHTML = '<i class="fas fa-plus"></i> Novo Celebrante';
    document.getElementById('celebrantForm').reset();
    document.getElementById('celebrantId').value = '';
    document.getElementById('celebrantFormModal').classList.add('active');
}

function closeCelebrantForm() {
    document.getElementById('celebrantFormModal').classList.remove('active');
}

// Inicializa
let inlineManagement;
document.addEventListener('DOMContentLoaded', () => {
    inlineManagement = new InlineManagement();
});
