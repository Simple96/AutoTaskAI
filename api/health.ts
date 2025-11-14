import { VercelRequest, VercelResponse } from '@vercel/node';
import { TaskOrchestrator } from '../src/services/orchestrator';
import { loadConfig, validateConfig } from '../src/utils/config';
import { logger } from '../src/utils/logger';

let orchestrator: TaskOrchestrator;

function initializeOrchestrator() {
  if (!orchestrator) {
    const config = loadConfig();
    validateConfig(config);
    orchestrator = new TaskOrchestrator(config);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  logger.info('Health check requested', {
    service: 'HealthAPI',
    action: 'health_check_request',
    method: req.method
  });
  
  if (req.method !== 'GET') {
    logger.warn('Invalid method for health check', {
      service: 'HealthAPI',
      action: 'method_not_allowed',
      method: req.method
    });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    initializeOrchestrator();
    const health = await orchestrator.healthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    logger.info('Health check completed', {
      service: 'HealthAPI',
      action: 'health_check_completed',
      status: health.status,
      statusCode
    });
    
    return res.status(statusCode).json({
      ...health,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    logger.error('Health check failed', {
      service: 'HealthAPI',
      action: 'health_check_failed'
    }, error as Error);
    
    return res.status(503).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
