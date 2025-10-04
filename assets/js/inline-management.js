/**
 * Sistema de Gerenciamento Inline
 * Gerenciamento de locais e celebrantes diretamente no formulário
 */

class InlineManagement {
    constructor() {
        this.locations = [];
        this.celebrants = [];
        this.init();
    }
    
    init() {
        this.setupForms();
        this.loadInitialData();
    }
    
    setupForms() {
        // Form de novo local
        const locationForm = document.getElementById('newLocationForm');
        if (locationForm) {
            locationForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveLocation();
            });
        }
        
        // Form de novo celebrante
        const celebrantForm = document.getElementById('newCelebrantForm');
        if (celebrantForm) {
            celebrantForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveCelebrant();
            });
        }
    }
    
    async loadInitialData() {
        await this.loadLocations();
        await this.loadCelebrants();
    }
    
    /**
     * Carrega lista de locais
     */
    async loadLocations() {
        try {
            const response = await fetch('api/buscar-locais.php');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const text = await response.text();
            
            // Tenta fazer parse do JSON
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Resposta não é JSON válido:', text);
                throw new Error('Resposta inválida do servidor');
            }
            
            if (data.success) {
                this.locations = data.locations;
                this.updateLocationSelect();
            } else {
                console.error('Erro ao carregar locais:', data.message);
            }
        } catch (error) {
            console.error('Erro ao carregar locais:', error);
            this.showAlert('error', 'Erro', 'Não foi possível carregar os locais');
        }
    }
    
    /**
     * Carrega lista de celebrantes
     */
    async loadCelebrants() {
        try {
            const response = await fetch('api/buscar-padres.php');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const text = await response.text();
            
            // Tenta fazer parse do JSON
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error('Resposta não é JSON válido:', text);
                throw new Error('Resposta inválida do servidor');
            }
            
            if (data.success) {
                this.celebrants = data.celebrants;
                this.updateCelebrantSelect();
            } else {
                console.error('Erro ao carregar celebrantes:', data.message);
            }
        } catch (error) {
            console.error('Erro ao carregar celebrantes:', error);
            this.showAlert('error', 'Erro', 'Não foi possível carregar os celebrantes');
        }
    }
    
    /**
     * Atualiza o select de locais
     */
    updateLocationSelect() {
        const select = document.getElementById('ceremonyLocation');
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = '<option value="">Selecione o local...</option>';
        
        this.locations.forEach(location => {
            if (location.ativo) {
                const option = document.createElement('option');
                option.value = location.id;
                option.textContent = location.nome_local;
                
                if (location.capacidade) {
                    option.textContent += ` (Capacidade: ${location.capacidade})`;
                }
                
                select.appendChild(option);
            }
        });
        
        // Restaura valor selecionado se existir
        if (currentValue) {
            select.value = currentValue;
        }
    }
    
    /**
     * Atualiza o select de celebrantes
     */
    updateCelebrantSelect() {
        const select = document.getElementById('celebrant');
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = '<option value="">Selecione o celebrante...</option>';
        
        // Agrupa por tipo
        const padres = this.celebrants.filter(c => c.tipo === 'PADRE' && c.ativo);
        const diaconos = this.celebrants.filter(c => c.tipo === 'DIÁCONO' && c.ativo);
        
        if (padres.length > 0) {
            const optgroupPadres = document.createElement('optgroup');
            optgroupPadres.label = 'PADRES';
            
            padres.forEach(padre => {
                const option = document.createElement('option');
                option.value = padre.id;
                option.textContent = padre.nome_completo;
                optgroupPadres.appendChild(option);
            });
            
            select.appendChild(optgroupPadres);
        }
        
        if (diaconos.length > 0) {
            const optgroupDiaconos = document.createElement('optgroup');
            optgroupDiaconos.label = 'DIÁCONOS';
            
            diaconos.forEach(diacono => {
                const option = document.createElement('option');
                option.value = diacono.id;
                option.textContent = diacono.nome_completo;
                optgroupDiaconos.appendChild(option);
            });
            
            select.appendChild(optgroupDiaconos);
        }
        
        // Restaura valor selecionado se existir
        if (currentValue) {
            select.value = currentValue;
        }
    }
    
    /**
     * Salva novo local
     */
    async saveLocation() {
        const nameInput = document.getElementById('newLocationName');
        const addressInput = document.getElementById('newLocationAddress');
        const capacityInput = document.getElementById('newLocationCapacity');
        
        if (!nameInput.value.trim()) {
            this.showAlert('error', 'Erro', 'Nome do local é obrigatório');
            return;
        }
        
        const locationData = {
            nome_local: nameInput.value.trim().toUpperCase(),
            endereco: addressInput.value.trim().toUpperCase(),
            capacidade: capacityInput.value || null
        };
        
        try {
            const response = await fetch('api/adicionar-local.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(locationData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert('success', 'Sucesso', 'Local adicionado com sucesso!');
                
                // Limpa o formulário
                document.getElementById('newLocationForm').reset();
                
                // Recarrega a lista
                await this.loadLocations();
                
                // Seleciona o novo local
                if (data.locationId) {
                    const select = document.getElementById('ceremonyLocation');
                    if (select) {
                        select.value = data.locationId;
                    }
                }
                
                // Fecha o modal
                this.closeLocationModal();
            } else {
                this.showAlert('error', 'Erro', data.message || 'Erro ao adicionar local');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showAlert('error', 'Erro', 'Erro de conexão ao adicionar local');
        }
    }
    
    /**
     * Salva novo celebrante
     */
    async saveCelebrant() {
        const nameInput = document.getElementById('newCelebrantName');
        const typeInput = document.getElementById('newCelebrantType');
        const phoneInput = document.getElementById('newCelebrantPhone');
        const emailInput = document.getElementById('newCelebrantEmail');
        
        if (!nameInput.value.trim()) {
            this.showAlert('error', 'Erro', 'Nome do celebrante é obrigatório');
            return;
        }
        
        const celebrantData = {
            nome_completo: nameInput.value.trim().toUpperCase(),
            tipo: typeInput.value,
            telefone: phoneInput.value.trim(),
            email: emailInput.value.trim().toLowerCase()
        };
        
        try {
            const response = await fetch('api/adicionar-celebrante.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(celebrantData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert('success', 'Sucesso', 'Celebrante adicionado com sucesso!');
                
                // Limpa o formulário
                document.getElementById('newCelebrantForm').reset();
                
                // Recarrega a lista
                await this.loadCelebrants();
                
                // Seleciona o novo celebrante
                if (data.celebrantId) {
                    const select = document.getElementById('celebrant');
                    if (select) {
                        select.value = data.celebrantId;
                    }
                }
                
                // Fecha o modal
                this.closeCelebrantModal();
            } else {
                this.showAlert('error', 'Erro', data.message || 'Erro ao adicionar celebrante');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showAlert('error', 'Erro', 'Erro de conexão ao adicionar celebrante');
        }
    }
    
    /**
     * Abre modal para gerenciar locais
     */
    openManageLocations() {
        const modal = document.getElementById('manageLocationsModal');
        if (!modal) {
            this.createManageLocationsModal();
        }
        
        this.loadLocationsForManagement();
        document.getElementById('manageLocationsModal').classList.add('active');
    }
    
    /**
     * Abre modal para gerenciar celebrantes
     */
    openManageCelebrants() {
        const modal = document.getElementById('manageCelebrantsModal');
        if (!modal) {
            this.createManageCelebrantsModal();
        }
        
        this.loadCelebrantsForManagement();
        document.getElementById('manageCelebrantsModal').classList.add('active');
    }
    
    /**
     * Cria modal de gerenciamento de locais
     */
    createManageLocationsModal() {
        const modal = document.createElement('div');
        modal.id = 'manageLocationsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-map-marker-alt"></i> Gerenciar Locais</h2>
                    <button class="close-modal" onclick="inlineManager.closeManageLocationsModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="management-list" id="locationsList">
                        <!-- Lista será preenchida dinamicamente -->
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    /**
     * Cria modal de gerenciamento de celebrantes
     */
    createManageCelebrantsModal() {
        const modal = document.createElement('div');
        modal.id = 'manageCelebrantsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2><i class="fas fa-user-tie"></i> Gerenciar Celebrantes</h2>
                    <button class="close-modal" onclick="inlineManager.closeManageCelebrantsModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="management-list" id="celebrantsList">
                        <!-- Lista será preenchida dinamicamente -->
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    /**
     * Carrega locais para gerenciamento
     */
    async loadLocationsForManagement() {
        await this.loadLocations();
        
        const container = document.getElementById('locationsList');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.locations.forEach(location => {
            const item = document.createElement('div');
            item.className = 'management-item';
            item.innerHTML = `
                <div class="item-info">
                    <strong>${location.nome_local}</strong>
                    ${location.endereco ? `<br><small>${location.endereco}</small>` : ''}
                    ${location.capacidade ? `<br><small>Capacidade: ${location.capacidade}</small>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn-small ${location.ativo ? 'btn-danger' : 'btn-success'}" 
                            onclick="inlineManager.toggleLocation(${location.id}, ${location.ativo})">
                        ${location.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                </div>
            `;
            container.appendChild(item);
        });
    }
    
    /**
     * Carrega celebrantes para gerenciamento
     */
    async loadCelebrantsForManagement() {
        await this.loadCelebrants();
        
        const container = document.getElementById('celebrantsList');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.celebrants.forEach(celebrant => {
            const item = document.createElement('div');
            item.className = 'management-item';
            item.innerHTML = `
                <div class="item-info">
                    <strong>${celebrant.nome_completo}</strong>
                    <br><small>${celebrant.tipo}</small>
                    ${celebrant.telefone_formatado ? `<br><small>${celebrant.telefone_formatado}</small>` : ''}
                </div>
                <div class="item-actions">
                    <button class="btn-small ${celebrant.ativo ? 'btn-danger' : 'btn-success'}" 
                            onclick="inlineManager.toggleCelebrant(${celebrant.id}, ${celebrant.ativo})">
                        ${celebrant.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                </div>
            `;
            container.appendChild(item);
        });
    }
    
    /**
     * Alterna status de local
     */
    async toggleLocation(id, currentStatus) {
        try {
            const response = await fetch(`api/buscar-locais.php?id=${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ativo: currentStatus ? 0 : 1
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showAlert('success', 'Sucesso', 'Status atualizado com sucesso');
                await this.loadLocationsForManagement();
                await this.loadLocations();
            } else {
                this.showAlert('error', 
