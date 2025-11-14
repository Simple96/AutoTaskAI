// Main entry point for local development
import { loadConfig, validateConfig } from './utils/config';
import { TaskOrchestrator } from './services/orchestrator';
import { GitHubWebhookService } from './services/github';

async function startServer() {
  console.log('🚀 Starting AutoTaskAI...');
  
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
    
    console.log('✅ AutoTaskAI initialized successfully!');
    console.log('📡 For production use, deploy to Vercel and configure GitHub webhooks');
    console.log('🔧 For local testing, use ngrok to expose webhook endpoint');
    
  } catch (error) {
    console.error('❌ Failed to start AutoTaskAI:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  startServer();
}

export { TaskOrchestrator, GitHubWebhookService, loadConfig };
