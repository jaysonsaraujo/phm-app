<?php
/**
 * API para Buscar e Gerenciar Locais de Cerimônia
 * Sistema de Agendamento de Casamentos
 */

// Headers CORS e JSON
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Trata requisições OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Importa configuração do banco de dados
require_once '../config/database.php';

class LocalManager {
    private $db;
    
    public function __construct() {
        $this->db = getDB();
    }
    
    /**
     * Lista todos os locais ativos
     */
    public function listarLocais($incluirInativos = false) {
        try {
            $sql = "SELECT 
                        l.id,
                        l.nome_local,
                        l.endereco,
                        l.capacidade,
                        l.ativo,
                        l.created_at,
                        l.updated_at,
                        COUNT(DISTINCT a.id) as total_agendamentos,
                        COUNT(DISTINCT CASE 
                            WHEN a.data_casamento >= CURDATE() 
                            THEN a.id 
                        END) as agendamentos_futuros
                    FROM locais_cerimonias l
                    LEFT JOIN agendamentos a ON l.id = a.local_id AND a.status = 'ATIVO'";
            
            if (!$incluirInativos) {
                $sql .= " WHERE l.ativo = 1";
            }
            
            $sql .= " GROUP BY l.id
                     ORDER BY l.nome_local ASC";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute();
            
            $locais = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Processa os locais
            foreach ($locais as &$local) {
                $local['nome_local'] = strtoupper($local['nome_local']);
                if ($local['endereco']) {
                    $local['endereco'] = strtoupper($local['endereco']);
                }
                
                // Busca próximos agendamentos do local
                $local['proximos_agendamentos'] = $this->buscarProximosAgendamentosLocal($local['id'], 5);
                
                // Verifica disponibilidade para hoje
                $local['disponivel_hoje'] = $this->verificarDisponibilidadeHoje($local['id']);
            }
            
            return [
                'success' => true,
                'locations' => $locais,
                'total' => count($locais)
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Erro ao buscar locais: ' . $e->getMessage(),
                'locations' => []
            ];
        }
    }
    
    /**
     * Busca um local específico
     */
    public function buscarLocal($id) {
        try {
            $sql = "SELECT * FROM locais_cerimonias WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $id]);
            
            $local = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$local) {
                return [
                    'success' => false,
                    'message' => 'Local não encontrado'
                ];
            }
            
            // Formata dados
            $local['nome_local'] = strtoupper($local['nome_local']);
            if ($local['endereco']) {
                $local['endereco'] = strtoupper($local['endereco']);
            }
            
            // Busca estatísticas do local
            $local['estatisticas'] = $this->buscarEstatisticasLocal($id);
            
            // Busca agendamentos do local
            $local['agendamentos'] = $this->buscarAgendamentosLocal($id);
            
            return [
                'success' => true,
                'location' => $local
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Erro ao buscar local: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Adiciona novo local
     */
    public function adicionarLocal($dados) {
        try {
            // Valida dados
            if (empty($dados['nome_local'])) {
                throw new Exception('Nome do local é obrigatório');
            }
            
            // Verifica duplicidade
            $sql = "SELECT COUNT(*) FROM locais_cerimonias 
                    WHERE UPPER(nome_local) = UPPER(:nome)";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':nome' => $dados['nome_local']]);
            
            if ($stmt->fetchColumn() > 0) {
                throw new Exception('Já existe um local com este nome');
            }
            
            // Insere o novo local
            $sql = "INSERT INTO locais_cerimonias (
                        nome_local,
                        endereco,
                        capacidade,
                        ativo
                    ) VALUES (
                        :nome_local,
                        :endereco,
                        :capacidade,
                        1
                    )";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':nome_local' => strtoupper(trim($dados['nome_local'])),
                ':endereco' => !empty($dados['endereco']) ? strtoupper(trim($dados['endereco'])) : null,
                ':capacidade' => !empty($dados['capacidade']) ? intval($dados['capacidade']) : null
            ]);
            
            $localId = $this->db->lastInsertId();
            
            // Registra no log
            $this->registrarLog('NOVO_LOCAL', 
                "Local '{$dados['nome_local']}' adicionado ao sistema", 
                $localId);
            
            return [
                'success' => true,
                'message' => 'Local adicionado com sucesso',
                'locationId' => $localId
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Atualiza um local
     */
    public function atualizarLocal($id, $dados) {
        try {
            // Verifica se o local existe
            $sql = "SELECT * FROM locais_cerimonias WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $id]);
            
            if (!$stmt->fetch()) {
                throw new Exception('Local não encontrado');
            }
            
            // Verifica duplicidade do nome se foi alterado
            if (!empty($dados['nome_local'])) {
                $sql = "SELECT COUNT(*) FROM locais_cerimonias 
                        WHERE UPPER(nome_local) = UPPER(:nome) 
                        AND id != :id";
                $stmt = $this->db->prepare($sql);
                $stmt->execute([
                    ':nome' => $dados['nome_local'],
                    ':id' => $id
                ]);
                
                if ($stmt->fetchColumn() > 0) {
                    throw new Exception('Já existe outro local com este nome');
                }
            }
            
            // Monta a query de atualização
            $campos = [];
            $valores = [':id' => $id];
            
            if (isset($dados['nome_local'])) {
                $campos[] = "nome_local = :nome_local";
                $valores[':nome_local'] = strtoupper(trim($dados['nome_local']));
            }
            
            if (isset($dados['endereco'])) {
                $campos[] = "endereco = :endereco";
                $valores[':endereco'] = !empty($dados['endereco']) ? strtoupper(trim($dados['endereco'])) : null;
            }
            
            if (isset($dados['capacidade'])) {
                $campos[] = "capacidade = :capacidade";
                $valores[':capacidade'] = !empty($dados['capacidade']) ? intval($dados['capacidade']) : null;
            }
            
            if (isset($dados['ativo'])) {
                $campos[] = "ativo = :ativo";
                $valores[':ativo'] = $dados['ativo'] ? 1 : 0;
            }
            
            if (empty($campos)) {
                throw new Exception('Nenhum campo para atualizar');
            }
            
            $sql = "UPDATE locais_cerimonias SET " . implode(', ', $campos) . " WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute($valores);
            
            // Registra no log
            $this->registrarLog('ATUALIZAR_LOCAL', 
                "Local ID {$id} atualizado", 
                $id);
            
            return [
                'success' => true,
                'message' => 'Local atualizado com sucesso'
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Remove um local (soft delete)
     */
    public function removerLocal($id) {
        try {
            // Verifica se o local existe
            $sql = "SELECT nome_local FROM locais_cerimonias WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $id]);
            $local = $stmt->fetch();
            
            if (!$local) {
                throw new Exception('Local não encontrado');
            }
            
            // Verifica se há agendamentos futuros
            $sql = "SELECT COUNT(*) FROM agendamentos 
                    WHERE local_id = :id 
                    AND data_casamento >= CURDATE() 
                    AND status = 'ATIVO'";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $id]);
            
            if ($stmt->fetchColumn() > 0) {
                throw new Exception('Não é possível remover o local pois existem agendamentos futuros');
            }
            
            // Desativa o local ao invés de deletar
            $sql = "UPDATE locais_cerimonias SET ativo = 0 WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $id]);
            
            // Registra no log
            $this->registrarLog('REMOVER_LOCAL', 
                "Local '{$local['nome_local']}' desativado", 
                $id);
            
            return [
                'success' => true,
                'message' => 'Local removido com sucesso'
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    /**
     * Busca disponibilidade de um local em uma data
     */
    public function buscarDisponibilidade($localId, $data) {
        try {
            // Configurações do sistema
            $horarioInicio = $this->getConfiguracao('horario_inicio_agendamento', '08:00');
            $horarioFim = $this->getConfiguracao('horario_fim_agendamento', '20:00');
            $duracaoCerimonia = $this->getConfiguracao('duracao_cerimonia_minutos', 60);
            $intervaloMinimo = $this->getConfiguracao('intervalo_entre_cerimonias', 30);
            
            // Busca agendamentos do dia
            $sql = "SELECT 
                        horario_casamento,
                        nome_noiva,
                        nome_noivo
                    FROM agendamentos
                    WHERE local_id = :local_id
                    AND data_casamento = :data
                    AND status = 'ATIVO'
                    ORDER BY horario_casamento ASC";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':local_id' => $localId,
                ':data' => $data
            ]);
            
            $agendamentos = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Calcula horários disponíveis
            $horariosDisponiveis = [];
            $horaAtual = new DateTime($data . ' ' . $horarioInicio);
            $horaLimite = new DateTime($data . ' ' . $horarioFim);
            
            while ($horaAtual < $horaLimite) {
                $horarioStr = $horaAtual->format('H:i');
                $disponivel = true;
                
                // Verifica conflitos com agendamentos existentes
                foreach ($agendamentos as $agendamento) {
                    $horaAgendamento = new DateTime($data . ' ' . $agendamento['horario_casamento']);
                    $horaFimAgendamento = clone $horaAgendamento;
                    $horaFimAgendamento->add(new DateInterval("PT{$duracaoCerimonia}M"));
                    
                    $horaFimAtual = clone $horaAtual;
                    $horaFimAtual->add(new DateInterval("PT{$duracaoCerimonia}M"));
                    
                    // Verifica sobreposição
                    if (!(($horaFimAtual <= $horaAgendamento) || 
                          ($horaAtual >= $horaFimAgendamento))) {
                        $disponivel = false;
                        break;
                    }
                    
                    // Verifica intervalo mínimo
                    $diffMinutos = abs(($horaAtual->getTimestamp() - $horaAgendamento->getTimestamp()) / 60);
                    if ($diffMinutos < ($duracaoCerimonia + $intervaloMinimo)) {
                        $disponivel = false;
                        break;
                    }
                }
                
                if ($disponivel) {
                    $horariosDisponiveis[] = $horarioStr;
                }
                
                // Avança 30 minutos
                $horaAtual->add(new DateInterval('PT30M'));
            }
            
            return [
                'success' => true,
                'date' => $data,
                'location_id' => $localId,
                'scheduled' => $agendamentos,
                'available_times' => $horariosDisponiveis,
                'total_available' => count($horariosDisponiveis)
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Erro ao buscar disponibilidade: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Busca próximos agendamentos de um local
     */
    private function buscarProximosAgendamentosLocal($localId, $limite = 5) {
        $sql = "SELECT 
                    a.data_casamento,
                    a.horario_casamento,
                    a.nome_noiva,
                    a.nome_noivo
                FROM agendamentos a
                WHERE a.local_id = :local_id
                AND a.data_casamento >= CURDATE()
                AND a.status = 'ATIVO'
                ORDER BY a.data_casamento ASC, a.horario_casamento ASC
                LIMIT :limite";
        
        $stmt = $this->db->prepare($sql);
        $stmt->bindValue(':local_id', $localId, PDO::PARAM_INT);
        $stmt->bindValue(':limite', $limite, PDO::PARAM_INT);
        $stmt->execute();
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Verifica disponibilidade do local para hoje
     */
    private function verificarDisponibilidadeHoje($localId) {
        $hoje = date('Y-m-d');
        $agora = date('H:i');
        
        $sql = "SELECT COUNT(*) FROM agendamentos
                WHERE local_id = :local_id
                AND data_casamento = :hoje
                AND horario_casamento > :agora
                AND status = 'ATIVO'";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':local_id' => $localId,
            ':hoje' => $hoje,
            ':agora' => $agora
        ]);
        
        $agendamentosHoje = $stmt->fetchColumn();
        
        // Considera disponível se tiver menos de 3 agendamentos para hoje
        return $agendamentosHoje < 3;
    }
    
    /**
     * Busca estatísticas de um local
     */
    private function buscarEstatisticasLocal($localId) {
        $stats = [];
        
        // Total de agendamentos
        $sql = "SELECT COUNT(*) FROM agendamentos 
                WHERE local_id = :id AND status = 'ATIVO'";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $localId]);
        $stats['total_agendamentos'] = $stmt->fetchColumn();
        
        // Agendamentos este ano
        $sql = "SELECT COUNT(*) FROM agendamentos 
                WHERE local_id = :id 
                AND YEAR(data_casamento) = YEAR(CURDATE())
                AND status = 'ATIVO'";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $localId]);
        $stats['agendamentos_ano_atual'] = $stmt->fetchColumn();
        
        // Próximo agendamento
        $sql = "SELECT 
                    data_casamento,
                    horario_casamento,
                    nome_noiva,
                    nome_noivo
                FROM agendamentos
                WHERE local_id = :id
                AND data_casamento >= CURDATE()
                AND status = 'ATIVO'
                ORDER BY data_casamento ASC, horario_casamento ASC
                LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $localId]);
        $stats['proximo_agendamento'] = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Dia da semana mais popular
        $sql = "SELECT 
                    DAYNAME(data_casamento) as dia_semana,
                    COUNT(*) as total
                FROM agendamentos
                WHERE local_id = :id
                AND status = 'ATIVO'
                GROUP BY DAYOFWEEK(data_casamento)
                ORDER BY total DESC
                LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $localId]);
        $diaMaisPopular = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($diaMaisPopular) {
            $diasPT = [
                'Sunday' => 'Domingo',
                'Monday' => 'Segunda-feira',
                'Tuesday' => 'Terça-feira',
                'Wednesday' => 'Quarta-feira',
                'Thursday' => 'Quinta-feira',
                'Friday' => 'Sexta-feira',
                'Saturday' => 'Sábado'
            ];
            $stats['dia_mais_popular'] = $diasPT[$diaMaisPopular['dia_semana']] ?? $diaMaisPopular['dia_semana'];
        }
        
        return $stats;
    }
    
    /**
     * Busca agendamentos de um local
     */
    private function buscarAgendamentosLocal($localId) {
        $sql = "SELECT 
                    a.id,
                    a.data_casamento,
                    a.horario_casamento,
                    a.nome_noiva,
                    a.nome_noivo,
                    pd.nome_completo as celebrante
                FROM agendamentos a
                INNER JOIN padres_diaconos pd ON a.padre_diacono_id = pd.id
                WHERE a.local_id = :local_id
                AND a.status = 'ATIVO'
                ORDER BY a.data_casamento DESC, a.horario_casamento DESC
                LIMIT 20";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':local_id' => $localId]);
        
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Registra atividade no log
     */
    private function registrarLog($acao, $descricao, $localId = null) {
        $sql = "INSERT INTO log_atividades (
                    acao,
                    descricao,
                    ip_address,
                    user_agent
                ) VALUES (
                    :acao,
                    :descricao,
                    :ip_address,
                    :user_agent
                )";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':acao' => $acao,
            ':descricao' => $descricao . " (Local ID: {$localId})",
            ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            ':user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);
    }
    
    /**
     * Obtém configuração do sistema
     */
    private function getConfiguracao($chave, $padrao = null) {
        $sql = "SELECT valor FROM configuracoes WHERE chave = :chave";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':chave' => $chave]);
        
        $resultado = $stmt->fetch();
        return $resultado ? $resultado['valor'] : $padrao;
    }
}

// Processa a requisição
$manager = new LocalManager();

switch ($_SERVER['REQUEST_METHOD']) {
    case 'GET':
        // Buscar locais
        if (isset($_GET['id'])) {
            // Buscar local específico
            $resultado = $manager->buscarLocal($_GET['id']);
        } elseif (isset($_GET['availability'])) {
            // Buscar disponibilidade
            $localId = $_GET['location_id'] ?? null;
            $data = $_GET['date'] ?? null;
            
            if (!$localId || !$data) {
                $resultado = ['success' => false, 'message' => 'Parâmetros incompletos'];
            } else {
                $resultado = $manager->buscarDisponibilidade($localId, $data);
            }
        } else {
            // Listar todos os locais
            $incluirInativos = isset($_GET['include_inactive']) && $_GET['include_inactive'] == '1';
            $resultado = $manager->listarLocais($incluirInativos);
        }
        break;
        
    case 'POST':
        // Adicionar novo local
        $json = file_get_contents('php://input');
        $dados = json_decode($json, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            $resultado = ['success' => false, 'message' => 'Dados inválidos'];
        } else {
            $resultado = $manager->adicionarLocal($dados);
        }
        break;
        
    case 'PUT':
        // Atualizar local
        $id = $_GET['id'] ?? null;
        if (!$id) {
            $resultado = ['success' => false, 'message' => 'ID não fornecido'];
        } else {
            $json = file_get_contents('php://input');
            $dados = json_decode($json, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                $resultado = ['success' => false, 'message' => 'Dados inválidos'];
            } else {
                $resultado = $manager->atualizarLocal($id, $dados);
            }
        }
        break;
        
    case 'DELETE':
        // Remover local
        $id = $_GET['id'] ?? null;
        if (!$id) {
            $resultado = ['success' => false, 'message' => 'ID não fornecido'];
        } else {
            $resultado = $manager->removerLocal($id);
        }
        break;
        
    default:
        http_response_code(405);
        $resultado = ['success' => false, 'message' => 'Método não permitido'];
}

// Retorna resposta JSON
echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
?>
