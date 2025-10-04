<?php
/**
 * API para Carregar Configurações do Sistema
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';

try {
    $db = getDB();
    
    $sql = "SELECT chave, valor, tipo FROM configuracoes";
    $stmt = $db->prepare($sql);
    $stmt->execute();
    
    $configuracoes = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $valor = $row['valor'];
        
        // Converte tipos
        if ($row['tipo'] === 'INTEGER') {
            $valor = (int)$valor;
        } elseif ($row['tipo'] === 'BOOLEAN') {
            $valor = (bool)$valor;
        } elseif ($row['tipo'] === 'JSON') {
            $valor = json_decode($valor, true);
        }
        
        $configuracoes[$row['chave']] = $valor;
    }
    
    echo json_encode([
        'success' => true,
        'config' => $configuracoes,
        'configurations' => $configuracoes
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao carregar configurações: ' . $e->getMessage()
    ]);
}
?>
