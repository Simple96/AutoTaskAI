import { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../src/utils/logger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Test logging endpoint to see what shows up in Vercel logs
  const timestamp = new Date().toISOString();
  
  console.log('=== DEBUG LOG TEST START ===');
  console.log(`Simple console.log: ${timestamp}`);
  console.warn(`Simple console.warn: ${timestamp}`);  
  console.error(`Simple console.error: ${timestamp}`);
  
  logger.simpleInfo('Simple info test');
  logger.simpleWarn('Simple warn test');
  logger.simpleError('Simple error test');
  
  logger.info('Structured info test', {
    action: 'debug_test',
    timestamp,
    method: req.method
  });
  
  logger.warn('Structured warn test', {
    action: 'debug_test',
    timestamp,
    type: 'warning'
  });
  
  logger.error('Structured error test', {
    action: 'debug_test',
    timestamp,
    type: 'error'
  }, new Error('Test error message'));
  
  console.log('=== DEBUG LOG TEST END ===');

  return res.status(200).json({
    message: 'Debug logs sent - check Vercel function logs',
    timestamp,
    logFormats: [
      'Simple console methods',
      'Simple logger methods', 
      'Structured logger methods'
    ]
  });
}
