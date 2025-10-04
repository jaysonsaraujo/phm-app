/**
 * Funções para adicionar novos locais e celebrantes
 * Adicione estas funções ao arquivo main.js existente
 */

// Função para adicionar novo local (chamada ao clicar duplo no select)
async function addNewLocation() {
    const modal = document.getElementById('newLocationModal');
    if (modal) {
        modal.classList.add('active');
        
        // Limpa o formulário
        document.getElementById('newLocationForm').reset();
        
        // Configura o envio do formulário
        document.getElementById('newLocationForm').onsubmit = async function(e) {
            e.preventDefault();
            
            const locationData = {
                nome_local: document.getElementById('newLocationName').value.toUpperCase(),
                endereco: document.getElementById('newLocationAddress').value.toUpperCase(),
                capacidade: document.getElementById('newLocationCapacity').value
            };
            
            try {
                const response = await fetch('api/adicionar-local.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(locationData)
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Mostra mensagem de sucesso
                    if (window.formValidator) {
                        window.formValidator.showAlert('success', 'Sucesso', 'Local adicionado com sucesso!');
                    }
                    
                    // Recarrega a lista de locais
                    if (window.weddingCalendar) {
                        await window.weddingCalendar.loadLocations();
                    }
                    
                    // Seleciona o novo local
                    if (data.locationId) {
                        document.getElementById('ceremonyLocation').value = data.locationId;
                    }
                    
                    // Fecha o modal
                    closeLocationModal();
                } else {
                    if (window.formValidator) {
                        window.formValidator.showAlert('error', 'Erro', data.message || 'Erro ao adicionar local');
                    }
                }
            } catch (error) {
                console.error('Erro ao adicionar local:', error);
                if (window.formValidator) {
                    window.formValidator.showAlert('error', 'Erro', 'Erro de conexão ao adicionar local');
                }
            }
        };
    }
}

// Função para adicionar novo celebrante (chamada ao clicar duplo no select)
async function addNewCelebrant() {
    const modal = document.getElementById('newCelebrantModal');
    if (modal) {
        modal.classList.add('active');
        
        // Limpa o formulário
        document.getElementById('newCelebrantForm').reset();
        
        // Configura o envio do formulário
        document.getElementById('newCelebrantForm').onsubmit = async function(e) {
            e.preventDefault();
            
            const celebrantData = {
                nome_completo: document.getElementById('newCelebrantName').value.toUpperCase(),
                tipo: document.getElementById('newCelebrantType').value,
                telefone: document.getElementById('newCelebrantPhone').value,
                email: document.getElementById('newCelebrantEmail').value
            };
            
            try {
                const response = await fetch('api/adicionar-celebrante.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(celebrantData)
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Mostra mensagem de sucesso
                    if (window.formValidator) {
                        window.formValidator.showAlert('success', 'Sucesso', 'Celebrante adicionado com sucesso!');
                    }
                    
                    // Recarrega a lista de celebrantes
                    if (window.weddingCalendar) {
                        await window.weddingCalendar.loadCelebrants();
                    }
                    
                    // Seleciona o novo celebrante
                    if (data.celebrantId) {
                        document.getElementById('celebrant').value = data.celebrantId;
                    }
                    
                    // Fecha o modal
                    closeCelebrantModal();
                } else {
                    if (window.formValidator) {
                        window.formValidator.showAlert('error', 'Erro', data.message || 'Erro ao adicionar celebrante');
                    }
                }
            } catch (error) {
                console.error('Erro ao adicionar celebrante:', error);
                if (window.formValidator) {
                    window.formValidator.showAlert('error', 'Erro', 'Erro de conexão ao adicionar celebrante');
                }
            }
        };
    }
}

// Exporta as funções para uso global
window.addNewLocation = addNewLocation;
window.addNewCelebrant = addNewCelebrant;
