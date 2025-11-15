import { Request, Response, NextFunction } from 'express';

/**
 * Enhanced request/response logging middleware
 * Logs requests and responses with AI-friendly formatting
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log request
  const requestLog = {
    timestamp,
    type: 'REQUEST',
    method: req.method,
    path: req.path,
    url: req.originalUrl || req.url,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    headers: {
      'content-type': req.headers['content-type'],
      'authorization': req.headers.authorization ? 'Bearer ***' : undefined,
      'x-api-key': req.headers['x-api-key'] ? '***' : undefined,
      'user-agent': req.headers['user-agent'],
    },
    body: req.body && Object.keys(req.body).length > 0 
      ? sanitizeBody(req.body) 
      : undefined,
    ip: req.ip || req.socket.remoteAddress,
  };

  console.log('📥 REQUEST:', JSON.stringify(requestLog, null, 2));

  // Capture response
  const originalSend = res.send;
  res.send = function (body: any) {
    const duration = Date.now() - startTime;
    
    // Parse response body if it's JSON
    let responseBody;
    try {
      responseBody = typeof body === 'string' ? JSON.parse(body) : body;
    } catch {
      responseBody = body;
    }

    const responseLog = {
      timestamp: new Date().toISOString(),
      type: 'RESPONSE',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      body: sanitizeResponse(responseBody),
      success: res.statusCode >= 200 && res.statusCode < 300,
    };

    console.log('📤 RESPONSE:', JSON.stringify(responseLog, null, 2));

    // Call original send
    return originalSend.call(this, body);
  };

  next();
}

/**
 * Sanitize request body - remove sensitive data
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'otp', 'code'];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }

  // Limit body size for logging
  const bodyStr = JSON.stringify(sanitized);
  if (bodyStr.length > 2000) {
    return { ...sanitized, _truncated: true, _originalLength: bodyStr.length };
  }

  return sanitized;
}

/**
 * Sanitize response body - remove sensitive data and limit size
 */
function sanitizeResponse(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'otp'];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }

  // Limit response size for logging
  const bodyStr = JSON.stringify(sanitized);
  if (bodyStr.length > 3000) {
    return { 
      ...sanitized, 
      _truncated: true, 
      _originalLength: bodyStr.length,
      _preview: JSON.stringify(sanitized).substring(0, 1000) + '...'
    };
  }

  return sanitized;
}





