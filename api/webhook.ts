import { VercelRequest, VercelResponse } from '@vercel/node';
import { GitHubWebhookService } from '../src/services/github';
import { TaskOrchestrator } from '../src/services/orchestrator';
import { loadConfig, validateConfig } from '../src/utils/config';
import { logger } from '../src/utils/logger';

let orchestrator: TaskOrchestrator;
let webhookService: GitHubWebhookService;

// Initialize services
function initializeServices() {
  if (!orchestrator) {
    logger.info('Initializing webhook services');
    
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
  const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // Add simple console logs that are definitely visible in Vercel
  console.log(`🚀 WEBHOOK START - ${requestId}`);
  console.log(`📨 Method: ${req.method}, Event: ${req.headers['x-github-event']}, HasSignature: ${!!req.headers['x-hub-signature-256']}`);
  
  logger.info('Webhook request received', {
    service: 'WebhookAPI',
    action: 'request_received',
    method: req.method,
    userAgent: req.headers['user-agent'],
    hasSignature: !!req.headers['x-hub-signature-256'],
    githubEvent: req.headers['x-github-event'],
    requestId
  });
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    console.log(`❌ WEBHOOK ERROR - Wrong method: ${req.method}`);
    logger.warn('Invalid method for webhook', {
      service: 'WebhookAPI',
      action: 'method_not_allowed',
      method: req.method,
      requestId
    });
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Check for required headers
  if (!req.headers['x-github-event']) {
    console.log(`❌ WEBHOOK ERROR - Missing GitHub event header`);
    logger.warn('Missing GitHub event header', {
      service: 'WebhookAPI',
      action: 'missing_header',
      requestId
    });
    res.status(400).json({ error: 'Missing X-GitHub-Event header' });
    return;
  }

  if (!req.headers['x-hub-signature-256']) {
    console.log(`❌ WEBHOOK ERROR - Missing GitHub signature header`);
    logger.warn('Missing GitHub signature header', {
      service: 'WebhookAPI',
      action: 'missing_signature',
      requestId
    });
    res.status(401).json({ error: 'Missing X-Hub-Signature-256 header' });
    return;
  }

  try {
    console.log(`🔧 WEBHOOK INIT - Starting service initialization`);
    
    // Initialize services if needed
    initializeServices();
    
    console.log(`✅ WEBHOOK SERVICES READY - Processing ${req.headers['x-github-event']} event`);

    logger.debug('Processing webhook request', {
      service: 'WebhookAPI',
      action: 'processing_webhook',
      githubEvent: req.headers['x-github-event'],
      requestId
    });

    // Handle the webhook using GitHub webhook service
    await webhookService.handleRequest(req as any, res as any);
    
    // If we get here, the webhook was processed successfully
    if (!res.headersSent) {
      console.log(`✅ WEBHOOK SUCCESS - ${req.headers['x-github-event']} processed successfully`);
      logger.info('Webhook processed successfully', {
        service: 'WebhookAPI',
        action: 'webhook_success',
        githubEvent: req.headers['x-github-event'],
        requestId
      });
      res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error(`🔴 WEBHOOK ERROR - ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(`🔴 Request ID: ${requestId}`);
    if (error instanceof Error && error.stack) {
      console.error(`🔴 Stack: ${error.stack}`);
    }
    
    logger.error('Webhook handler error', {
      service: 'WebhookAPI',
      action: 'webhook_error',
      githubEvent: req.headers['x-github-event'],
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      requestId
    }, error as Error);
    
    if (!res.headersSent) {
      // Check if it's a signature verification error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('signature') || errorMessage.includes('unauthorized')) {
        res.status(401).json({ 
          error: 'Webhook signature verification failed',
          message: 'Please check your GitHub webhook secret configuration'
        });
      } else {
        res.status(500).json({ 
          error: 'Internal server error',
          message: errorMessage
        });
      }
    }
  }
}
