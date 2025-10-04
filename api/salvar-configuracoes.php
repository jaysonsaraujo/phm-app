<?php
/**
 * API para Salvar Configurações do Sistema
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';

try {
    $db = getDB();
    
    $json = file_get_contents('php://input');
    $dados = json_decode($json, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception('Dados inválidos');
    }
    
    $db->beginTransaction();
    
    foreach ($dados as $chave => $valor) {
        if ($chave === 'auto_save') continue;
        
        // Determina o tipo
        $tipo = 'STRING';
        if (is_int($valor)) {
            $tipo = 'INTEGER';
        } elseif (is_bool($valor) || in_array($valor, [0, 1])) {
            $tipo = 'BOOLEAN';
            $valor = $valor ? 1 : 0;
        } elseif (is_array($valor)) {
            $tipo = 'JSON';
            $valor = json_encode($valor);
        }
        
        $sql = "INSERT INTO configuracoes (chave, valor, tipo) 
                VALUES (:chave, :valor, :tipo) 
                ON DUPLICATE KEY UPDATE valor = :valor2, tipo = :tipo2";
        
        $stmt = $db->prepare($sql);
        $stmt->execute([
            ':chave' => $chave,
            ':valor' => $valor,
            ':tipo' => $tipo,
            ':valor2' => $valor,
            ':tipo2' => $tipo
        ]);
    }
    
    $db->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Configurações salvas com sucesso'
    ]);
    
} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao salvar configurações: ' . $e->getMessage()
    ]);
}
?>
