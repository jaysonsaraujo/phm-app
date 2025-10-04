<?php
/**
 * API para Adicionar Novo Local
 * Sistema de Agendamento de Casamentos
 */

// Headers CORS e JSON
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Trata requisições OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Importa configuração do banco de dados
require_once '../config/database.php';

class AdicionarLocal {
    private $db;
    
    public function __construct() {
        $this->db = getDB();
    }
    
    public function adicionar($dados) {
        try {
            // Inicia transação
            $this->db->beginTransaction();
            
            // Valida dados obrigatórios
            if (empty($dados['nome_local'])) {
                throw new Exception('Nome do local é obrigatório');
            }
            
            // Formata o nome em maiúsculas
            $nomeLocal = strtoupper(trim($dados['nome_local']));
            
            // Verifica se já existe um local com este nome
            $sql = "SELECT COUNT(*) as total FROM locais_cerimonias 
                    WHERE UPPER(nome_local) = :nome_local";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':nome_local' => $nomeLocal]);
            $resultado = $stmt->fetch();
            
            if ($resultado['total'] > 0) {
                throw new Exception('Já existe um local com este nome');
            }
            
            // Prepara dados para inserção
            $endereco = !empty($dados['endereco']) ? strtoupper(trim($dados['endereco'])) : null;
            $capacidade = !empty($dados['capacidade']) ? intval($dados['capacidade']) : null;
            
            // Insere o novo local
            $sql = "INSERT INTO locais_cerimonias (
                        nome_local,
                        endereco,
                        capacidade,
                        ativo,
                        created_at,
                        updated_at
                    ) VALUES (
                        :nome_local,
                        :endereco,
                        :capacidade,
                        1,
                        NOW(),
                        NOW()
                    )";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':nome_local' => $nomeLocal,
                ':endereco' => $endereco,
                ':capacidade' => $capacidade
            ]);
            
            $localId = $this->db->lastInsertId();
            
            // Registra no log
            $this->registrarLog('NOVO_LOCAL', 
                "Local '{$nomeLocal}' adicionado ao sistema", 
                $localId);
            
            // Confirma transação
            $this->db->commit();
            
            // Busca o local inserido para retornar
            $sql = "SELECT * FROM locais_cerimonias WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':id' => $localId]);
            $local = $stmt->fetch(PDO::FETCH_ASSOC);
            
            return [
                'success' => true,
                'message' => 'Local adicionado com sucesso',
                'locationId' => $localId,
                'location' => $local
            ];
            
        } catch (Exception $e) {
            // Desfaz transação em caso de erro
            $this->db->rollBack();
            
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }
    
    private function registrarLog($acao, $descricao, $localId = null) {
        try {
            $sql = "INSERT INTO log_atividades (
                        acao,
                        descricao,
                        ip_address,
                        user_agent,
                        created_at
                    ) VALUES (
                        :acao,
                        :descricao,
                        :ip_address,
                        :user_agent,
                        NOW()
                    )";
            
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':acao' => $acao,
                ':descricao' => $descricao . " (ID: {$localId})",
                ':ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
                ':user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
            ]);
        } catch (Exception $e) {
            // Log é opcional, não interrompe o processo
            error_log("Erro ao registrar log: " . $e->getMessage());
        }
    }
}

// Processa a requisição
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Obtém dados JSON do corpo da requisição
    $json = file_get_contents('php://input');
    $dados = json_decode($json, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo json_encode([
            'success' => false,
            'message' => 'Dados inválidos recebidos. Erro: ' . json_last_error_msg()
        ]);
        exit;
    }
    
    // Adiciona o local
    $adicionarLocal = new AdicionarLocal();
    $resultado = $adicionarLocal->adicionar($dados);
    
    // Retorna resposta
    echo json_encode($resultado, JSON_UNESCAPED_UNICODE);
    
} else {
    // Método não permitido
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Método não permitido. Use POST'
    ]);
}
?>
