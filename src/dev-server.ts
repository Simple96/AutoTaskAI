// Simple development server for testing
import http from 'http';
import { loadConfig, validateConfig } from './utils/config';
import { TaskOrchestrator } from './services/orchestrator';
import { GitHubWebhookService } from './services/github';

const PORT = process.env.PORT || 3000;

async function startDevServer() {
  console.log('🚀 Starting AutoTaskAI Development Server...');
  
  try {
    // Load configuration
    const config = loadConfig();
    validateConfig(config);
    
    // Initialize orchestrator
    const orchestrator = new TaskOrchestrator(config);
    
    // Test health check
    const health = await orchestrator.healthCheck();
    console.log('🏥 Health check:', health);
    
    if (health.status !== 'healthy') {
      console.warn('⚠️  Some services are not healthy. Check your configuration.');
    }
    
    // Initialize webhook service
    const webhookService = new GitHubWebhookService(
      config.github.webhookSecret,
      // On push event
      async (payload) => {
        console.log('📥 Received push event');
        await orchestrator.processGitHubEvent(payload);
      },
      // On pull request event
      async (payload) => {
        console.log('📥 Received pull request event');
        await orchestrator.processGitHubEvent(payload);
      }
    );
    
    // Create HTTP server
    const server = http.createServer(async (req, res) => {
      // CORS headers for development
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-GitHub-Event, X-Hub-Signature-256');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      if (req.url === '/api/webhook' && req.method === 'POST') {
        console.log('📨 Processing webhook...');
        try {
          await webhookService.handleRequest(req, res);
        } catch (error) {
          console.error('❌ Webhook error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      } else if (req.url === '/api/health') {
        console.log('🏥 Health check requested');
        try {
          const health = await orchestrator.healthCheck();
          const statusCode = health.status === 'healthy' ? 200 : 503;
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ...health,
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }));
        }
      } else if (req.url === '/' || req.url === '/status') {
        // Simple status page
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>AutoTaskAI - Development Server</title></head>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
              <h1>🤖 AutoTaskAI Development Server</h1>
              <p><strong>Status:</strong> Running</p>
              <p><strong>Port:</strong> ${PORT}</p>
              <h2>Available Endpoints:</h2>
              <ul>
                <li><a href="/api/health">GET /api/health</a> - Health check</li>
                <li>POST /api/webhook - GitHub webhook endpoint</li>
              </ul>
              <h2>Setup Instructions:</h2>
              <ol>
                <li>Install ngrok: <code>npm install -g ngrok</code></li>
                <li>Expose server: <code>ngrok http ${PORT}</code></li>
                <li>Use the ngrok URL as your GitHub webhook URL</li>
              </ol>
            </body>
          </html>
        `);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });
    
    // Start server
    server.listen(PORT, () => {
      console.log(`✅ AutoTaskAI server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/api/webhook`);
      console.log('');
      console.log('🛠️  For GitHub webhook testing:');
      console.log('   1. Install ngrok: npm install -g ngrok');
      console.log(`   2. Run: ngrok http ${PORT}`);
      console.log('   3. Use the ngrok URL in GitHub webhook settings');
      console.log('');
      console.log('🛑 Press Ctrl+C to stop');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down AutoTaskAI server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down AutoTaskAI server...');
  process.exit(0);
});

if (require.main === module) {
  startDevServer();
}
