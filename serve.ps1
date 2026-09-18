$port = 8080
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Server running on http://localhost:$port/ ..."

# Load .env
$envPath = Join-Path $PSScriptRoot ".env"
$apiKey = ""
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match "^\s*GROQ_API_KEY\s*=\s*(.+)$") {
            $apiKey = $matches[1].Trim().Trim('"').Trim("'")
        }
    }
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".svg"  = "image/svg+xml"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")

    if ($request.HttpMethod -eq "OPTIONS") {
        $response.StatusCode = 204
        $response.OutputStream.Close()
        continue
    }

    $path = $request.Url.LocalPath

    # Handle /api/chat
    if ($path -eq "/api/chat" -and $request.HttpMethod -eq "POST") {
        $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
        $body = $reader.ReadToEnd()
        $reader.Close()

        try {
            $groqReq = [System.Net.HttpWebRequest]::Create("https://api.groq.com/openai/v1/chat/completions")
            $groqReq.Method = "POST"
            $groqReq.Headers.Add("Authorization", "Bearer $apiKey")
            $groqReq.ContentType = "application/json"

            $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
            $stream = $groqReq.GetRequestStream()
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Close()

            $groqRes = $groqReq.GetResponse()
            $resReader = New-Object System.IO.StreamReader($groqRes.GetResponseStream(), [System.Text.Encoding]::UTF8)
            $resContent = $resReader.ReadToEnd()
            $resReader.Close()

            $response.ContentType = "application/json; charset=utf-8"
            $outBytes = [System.Text.Encoding]::UTF8.GetBytes($resContent)
            $response.ContentLength64 = $outBytes.Length
            $response.OutputStream.Write($outBytes, 0, $outBytes.Length)
        } catch {
            $response.StatusCode = 500
            $errJson = '{"error":{"message":"' + $_.Exception.Message.Replace('"', '\"') + '"}}'
            $outBytes = [System.Text.Encoding]::UTF8.GetBytes($errJson)
            $response.ContentType = "application/json; charset=utf-8"
            $response.OutputStream.Write($outBytes, 0, $outBytes.Length)
        }

        $response.OutputStream.Close()
        continue
    }

    if ($path -eq "/") { $path = "/index.html" }
    $filePath = Join-Path $PSScriptRoot ($path.TrimStart("/").Replace("/", "\"))

    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
        $response.ContentType = $contentType
        
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
        $response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $response.OutputStream.Close()
}
