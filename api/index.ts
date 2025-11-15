import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutoTaskAI - Intelligent Task Management</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            text-align: center;
            max-width: 600px;
            padding: 2rem;
        }
        .logo {
            font-size: 4rem;
            margin-bottom: 1rem;
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            font-weight: 600;
        }
        .tagline {
            font-size: 1.2rem;
            opacity: 0.9;
            margin-bottom: 2rem;
        }
        .status {
            background: rgba(255, 255, 255, 0.1);
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            backdrop-filter: blur(10px);
        }
        .endpoints {
            background: rgba(255, 255, 255, 0.1);
            padding: 1.5rem;
            border-radius: 8px;
            backdrop-filter: blur(10px);
            text-align: left;
        }
        .endpoint {
            margin: 0.5rem 0;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9rem;
        }
        .endpoint-label {
            font-weight: bold;
            color: #ffd700;
        }
        a {
            color: #ffd700;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        .footer {
            margin-top: 2rem;
            opacity: 0.7;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🤖</div>
        <h1>AutoTaskAI</h1>
        <div class="tagline">
            Intelligent task management powered by AI
        </div>
        
        <div class="status">
            <strong>🟢 Service Running</strong><br>
            Your AutoTaskAI instance is deployed and ready to receive GitHub webhooks.
        </div>

        <div class="endpoints">
            <h3>📡 Available Endpoints</h3>
            <div class="endpoint">
                <span class="endpoint-label">Health Check:</span> 
                <a href="/api/health" target="_blank">GET /api/health</a>
            </div>
            <div class="endpoint">
                <span class="endpoint-label">Configuration Check:</span> 
                <a href="/api/config" target="_blank">GET /api/config</a>
            </div>
            <div class="endpoint">
                <span class="endpoint-label">Linear Test:</span> 
                <a href="/api/test-linear" target="_blank">GET /api/test-linear</a>
            </div>
            <div class="endpoint">
                <span class="endpoint-label">GitHub Webhook:</span> 
                POST /api/webhook
            </div>
        </div>

        <div class="footer">
            <p>
                📚 <a href="https://github.com/Simple96/AutoTaskAI" target="_blank">Documentation</a> • 
                🐛 <a href="https://github.com/Simple96/AutoTaskAI/issues" target="_blank">Report Issues</a> • 
                ⭐ <a href="https://github.com/Simple96/AutoTaskAI" target="_blank">GitHub</a>
            </p>
            <p>Made with ❤️ by the AutoTaskAI community</p>
        </div>
    </div>
</body>
</html>
  `;

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(html);
}
