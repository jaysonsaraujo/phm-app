/**
 * Gerenciador de Envio de Formulários
 */

class FormHandler {
    constructor() {
        this.init();
    }
    
    init() {
        this.setupBookingForm();
        this.setupLocationForm();
        this.setupCelebrantForm();
    }
    
    setupBookingForm() {
        const form = document.getElementById('bookingForm');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Valida formulário
            if (!window.formValidator || !window.formValidator.validateForm(form)) {
                return;
            }
            
            // Coleta dados
            const dados = {
                id: document.getElementById('bookingId').value,
                nome_noiva: document.getElementById('brideName').value,
                whatsapp_noiva: document.getElementById('brideWhatsapp').value,
                nome_noivo: document.getElementById('groomName').value,
                whatsapp_noivo: document.getElementById('groomWhatsapp').value,
                data_casamento: document.getElementById('weddingDate').value,
                horario_casamento: document.getElementById('weddingTime').value,
                local_id: document.getElementById('ceremonyLocation').value,
                padre_diacono_id: document.getElementById('celebrant').value,
                transferencia_tipo: document.getElementById('transferType').value,
                com_efeito_civil: document.getElementById('civilEffect').value,
                data_entrevista: document.getElementById('interviewDate').value,
                observacoes: document.getElementById('observations').value,
                mensagem_sistema: document.getElementById('systemMessage').value
            };
            
            try {
                const response = await fetch('api/salvar-agendamento.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(dados)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    this.showSuccess('Agendamento salvo com sucesso!');
                    closeModal();
                    
                    // Atualiza calendário
                    if (window.weddingCalendar) {
                        window.weddingCalendar.refresh();
                    }
                    
                    // Limpa formulário
                    form.reset();
                } else {
                    this.showError(result.message || 'Erro ao salvar agendamento');
                }
                
            } catch (error) {
                console.error('Erro:', error);
                this.showError('Erro ao comunicar com o servidor');
            }
        });
    }
    
    setupLocationForm() {
        const form = document.getElementById('newLocationForm');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const dados = {
                nome_local: document.getElementById('newLocationName').value,
                endereco: document.getElementById('newLocationAddress').value,
                capacidade: document.getElementById('newLocationCapacity').value
            };
            
            try {
                const response = await fetch('api/buscar-locais.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(dados)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    this.showSuccess('Local adicionado com sucesso!');
                    closeLocationModal();
                    
                    // Recarrega locais no select
                    if (window.weddingCalendar) {
                        window.weddingCalendar.loadLocations();
                    }
                    
                    form.reset();
                } else {
                    this.showError(result.message || 'Erro ao adicionar local');
                }
                
            } catch (error) {
                console.error('Erro:', error);
                this.showError('Erro ao comunicar com o servidor');
            }
        });
    }
    
    setupCelebrantForm() {
        const form = document.getElementById('newCelebrantForm');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const dados = {
                nome_completo: document.getElementById('newCelebrantName').value,
                tipo: document.getElementById('newCelebrantType').value,
                telefone: document.getElementById('newCelebrantPhone').value,
                email: document.getElementById('newCelebrantEmail').value
            };
            
            try {
                const response = await fetch('api/buscar-padres.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(dados)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    this.showSuccess('Celebrante adicionado com sucesso!');
                    closeCelebrantModal();
                    
                    // Recarrega celebrantes no select
                    if (window.weddingCalendar) {
                        window.weddingCalendar.loadCelebrants();
                    }
                    
                    form.reset();
                } else {
                    this.showError(result.message || 'Erro ao adicionar celebrante');
                }
                
            } catch (error) {
                console.error('Erro:', error);
                this.showError('Erro ao comunicar com o servidor');
            }
        });
    }
    
    showSuccess(message) {
        if (window.formValidator) {
            window.formValidator.showAlert('success', 'Sucesso', message);
        }
    }
    
    showError(message) {
        if (window.formValidator) {
            window.formValidator.showAlert('error', 'Erro', message);
        }
    }
}

// Inicializa quando o DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    window.formHandler = new FormHandler();
});
