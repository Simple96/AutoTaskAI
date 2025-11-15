import { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../src/utils/logger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  logger.info('Configuration check requested', {
    service: 'ConfigAPI',
    action: 'config_check_request'
  });

  try {
    // Check environment variables (without exposing sensitive values)
    const config = {
      github: {
        webhookSecret: !!process.env.GITHUB_WEBHOOK_SECRET,
        token: !!process.env.GITHUB_TOKEN,
        webhookSecretLength: process.env.GITHUB_WEBHOOK_SECRET?.length || 0
      },
      linear: {
        apiKey: !!process.env.LINEAR_API_KEY,
        teamId: !!process.env.LINEAR_TEAM_ID,
        defaultAssigneeId: !!process.env.LINEAR_DEFAULT_ASSIGNEE_ID,
        defaultPriority: process.env.LINEAR_DEFAULT_PRIORITY || '3',
        apiKeyPrefix: process.env.LINEAR_API_KEY ? process.env.LINEAR_API_KEY.substring(0, 8) + '...' : null
      },
      ai: {
        provider: process.env.AI_PROVIDER || 'openrouter',
        apiKey: !!(process.env.AI_API_KEY || process.env.OPENAI_API_KEY),
        model: process.env.AI_MODEL || process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
        baseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
        apiKeyPrefix: (process.env.AI_API_KEY || process.env.OPENAI_API_KEY) ? 
          (process.env.AI_API_KEY || process.env.OPENAI_API_KEY)!.substring(0, 8) + '...' : null
      },
      app: {
        nodeEnv: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info'
      }
    };

    // Calculate configuration score
    const requiredVars = [
      config.github.webhookSecret,
      config.linear.apiKey,
      config.ai.apiKey
    ];
    
    const configuredCount = requiredVars.filter(Boolean).length;
    const totalRequired = requiredVars.length;
    const configurationScore = Math.round((configuredCount / totalRequired) * 100);

    // Determine status
    let status = 'misconfigured';
    if (configurationScore === 100) {
      status = 'fully_configured';
    } else if (configurationScore >= 67) {
      status = 'partially_configured';
    }

    // Provide recommendations
    const recommendations = [];
    if (!config.github.webhookSecret) {
      recommendations.push('Set GITHUB_WEBHOOK_SECRET for webhook security');
    } else if (config.github.webhookSecretLength < 20) {
      recommendations.push('Use a longer GITHUB_WEBHOOK_SECRET (20+ characters recommended)');
    }
    
    if (!config.linear.apiKey) {
      recommendations.push('Set LINEAR_API_KEY to create tasks in Linear');
    }
    
    if (!config.linear.teamId) {
      recommendations.push('Set LINEAR_TEAM_ID to specify which Linear team to use');
    }
    
    if (!config.ai.apiKey) {
      recommendations.push('Set AI_API_KEY to enable AI-powered task analysis');
    }

    if (config.ai.provider === 'openrouter' && !config.ai.baseUrl) {
      recommendations.push('Set AI_BASE_URL=https://openrouter.ai/api/v1 for OpenRouter');
    }

    const response = {
      status,
      configurationScore,
      timestamp: new Date().toISOString(),
      configuration: config,
      recommendations,
      summary: {
        configured: configuredCount,
        required: totalRequired,
        optional: 3 // GITHUB_TOKEN, LINEAR_DEFAULT_ASSIGNEE_ID, LINEAR_DEFAULT_PRIORITY
      }
    };

    logger.info('Configuration check completed', {
      service: 'ConfigAPI',
      action: 'config_check_completed',
      status,
      configurationScore
    });

    const statusCode = status === 'fully_configured' ? 200 : 
                      status === 'partially_configured' ? 206 : 
                      400;

    return res.status(statusCode).json(response);

  } catch (error) {
    logger.error('Configuration check failed', {
      service: 'ConfigAPI',
      action: 'config_check_failed'
    }, error as Error);

    return res.status(500).json({
      status: 'error',
      error: 'Failed to check configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}
