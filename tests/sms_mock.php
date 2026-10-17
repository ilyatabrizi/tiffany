<?php
/* A stand-in for api.sms.ir, for the test suites only (never deployed):
     SMS_MOCK_LOG=/tmp/sms.log php -S 127.0.0.1:8139 tests/sms_mock.php
   Every request is appended to the log as one JSON line. The key must be
   «test-key»; mobile 09990000000 always fails, to test the error path. */
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$raw = (string) file_get_contents('php://input');
$body = json_decode($raw, true);
file_put_contents((string) getenv('SMS_MOCK_LOG'), json_encode([
    'method' => $_SERVER['REQUEST_METHOD'] ?? '', 'path' => $path,
    'key' => $_SERVER['HTTP_X_API_KEY'] ?? '', 'body' => $body,
], JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
header('Content-Type: application/json');
$say = static function (int $status, string $message, $data = null): void {
    echo json_encode(['status' => $status, 'message' => $message, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
};
if (($_SERVER['HTTP_X_API_KEY'] ?? '') !== 'test-key') {
    $say(0, 'کلید نامعتبر');
}
if ($path === '/v1/credit') {
    $say(1, 'موفق', 42);
}
if ($path === '/v1/send/verify') {
    if (($body['mobile'] ?? '') === '09990000000') {
        $say(0, 'ارسال ناموفق');
    }
    $say(1, 'موفق', ['messageId' => random_int(1, 999999), 'cost' => 2]);
}
$say(0, 'unknown');
