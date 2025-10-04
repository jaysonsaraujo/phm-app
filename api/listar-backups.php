<?php
/**
 * API para Listar Backups Disponíveis
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $backupDir = '../backups';
    
    if (!is_dir($backupDir)) {
        echo json_encode([
            'success' => true,
            'backups' => []
        ]);
        exit;
    }
    
    $files = scandir($backupDir);
    $backups = [];
    
    foreach ($files as $file) {
        if ($file === '.' || $file === '..' || !preg_match('/\.sql$/', $file)) {
            continue;
        }
        
        $filepath = $backupDir . '/' . $file;
        
        $backups[] = [
            'filename' => $file,
            'date' => date('Y-m-d H:i:s', filemtime($filepath)),
            'size' => filesize($filepath),
            'type' => strpos($file, 'auto') !== false ? 'auto' : 'manual'
        ];
    }
    
    // Ordena por data (mais recentes primeiro)
    usort($backups, function($a, $b) {
        return strtotime($b['date']) - strtotime($a['date']);
    });
    
    echo json_encode([
        'success' => true,
        'backups' => $backups
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao listar backups: ' . $e->getMessage()
    ]);
}
?>
