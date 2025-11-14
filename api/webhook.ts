import { VercelRequest, VercelResponse } from '@vercel/node';
import { GitHubWebhookService } from '../src/services/github';
import { TaskOrchestrator } from '../src/services/orchestrator';
import { loadConfig, validateConfig } from '../src/utils/config';

let orchestrator: TaskOrchestrator;
let webhookService: GitHubWebhookService;

// Initialize services
function initializeServices() {
  if (!orchestrator) {
    const config = loadConfig();
    validateConfig(config);
    
    orchestrator = new TaskOrchestrator(config);
    
    webhookService = new GitHubWebhookService(
      config.github.webhookSecret,
      // On push event
      async (payload) => {
        await orchestrator.processGitHubEvent(payload);
      },
      // On pull request event
      async (payload) => {
        await orchestrator.processGitHubEvent(payload);
      }
    );
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Initialize services if needed
    initializeServices();

    // Handle the webhook using GitHub webhook service
    await webhookService.handleRequest(req as any, res as any);
    
    // If we get here, the webhook was processed successfully
    if (!res.headersSent) {
      res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
