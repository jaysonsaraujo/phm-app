<?php
/**
 * API para Verificar Lembretes Pendentes
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
    
    $sql = "SELECT 
                l.id,
                l.tipo_lembrete as tipo,
                l.data_lembrete,
                l.mensagem,
                a.nome_noiva,
                a.nome_noivo,
                a.data_casamento
            FROM lembretes l
            INNER JOIN agendamentos a ON l.agendamento_id = a.id
            WHERE l.enviado = 0
            AND l.data_lembrete <= NOW()
            AND a.status = 'ATIVO'
            ORDER BY l.data_lembrete ASC
            LIMIT 10";
    
    $stmt = $db->prepare($sql);
    $stmt->execute();
    
    $lembretes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'reminders' => $lembretes,
        'count' => count($lembretes)
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao verificar lembretes: ' . $e->getMessage()
    ]);
}
?>
