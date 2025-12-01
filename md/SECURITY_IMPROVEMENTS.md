# Security Improvements

## 🔴 CRITICAL (Implement Immediately)

### 1. API Key Hashing
**Current Issue**: API keys stored in plain text in database
**Risk**: If database is compromised, all API keys are exposed

**Solution**: Hash API keys using bcrypt (similar to passwords)

```typescript
// backend/src/utils/hashApiKey.ts
import bcrypt from 'bcryptjs';

export async function hashApiKey(apiKey: string): Promise<string> {
  return bcrypt.hash(apiKey, 10);
}

export async function compareApiKey(plainKey: string, hashedKey: string): Promise<boolean> {
  return bcrypt.compare(plainKey, hashedKey);
}
```

**Migration Required**: 
- Add `apiKeyHash` and `devApiKeyHash` columns
- Migrate existing keys
- Update authentication middleware

### 2. Remove Sensitive Data from Logs
**Current Issue**: Console.log statements expose API keys, passwords, OTPs
**Risk**: Logs can be accessed by unauthorized users

**Files to Fix**:
- `backend/src/controllers/authController.ts` (lines 61-66, 284-298)
- `backend/src/middleware/requestLogger.ts`
- All files with `console.log` containing sensitive data

**Solution**: Create sanitized logger

```typescript
// backend/src/utils/logger.ts
export function sanitizeLog(data: any): any {
  if (typeof data !== 'object') return data;
  
  const sensitive = ['apiKey', 'devApiKey', 'password', 'otp', 'code', 'token'];
  const sanitized = { ...data };
  
  for (const key of sensitive) {
    if (sanitized[key]) {
      sanitized[key] = '***REDACTED***';
    }
  }
  
  return sanitized;
}

export function safeLog(message: string, data?: any) {
  console.log(message, data ? sanitizeLog(data) : '');
}
```

### 3. API Key in Query Parameters
**Current Issue**: API keys can be passed in URL query params (line 71 in auth.ts)
**Risk**: Keys appear in server logs, browser history, referrer headers

**Solution**: Only accept API keys in headers

```typescript
// backend/src/middleware/auth.ts
export async function authenticateApiKey(req: AuthRequest, res: Response, next: NextFunction) {
  // REMOVE: req.query.key
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    throw new AppError(401, 'API key required in X-API-Key header');
  }
  // ... rest of code
}
```

### 4. Rate Limiting Per IP
**Current Issue**: Only user-based rate limiting
**Risk**: Single user can bypass limits with multiple accounts

**Solution**: Add IP-based rate limiting

```typescript
// backend/src/middleware/rateLimit.ts
import rateLimit from 'express-rate-limit';

export const ipRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP per window
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
  message: 'Too many requests from this IP, please try again later.',
});
```

## 🟡 HIGH PRIORITY

### 5. API Key Rotation
**Current Issue**: No mechanism to rotate compromised keys
**Risk**: If key is leaked, user must regenerate manually

**Solution**: Implement key rotation with grace period

```typescript
// Add to User model in schema.prisma
model User {
  // ... existing fields
  apiKeyRotatedAt DateTime?
  oldApiKey      String?  // Keep old key for 24 hours
  oldApiKeyExpiresAt DateTime?
}

// backend/src/controllers/authController.ts
export async function rotateApiKey(req: AuthRequest, res: Response) {
  // Generate new key
  // Keep old key active for 24 hours
  // Notify user via email/SMS
}
```

### 6. Request Signing for Sensitive Endpoints
**Current Issue**: API key alone authenticates requests
**Risk**: Replay attacks, MITM attacks

**Solution**: Add request signing (HMAC)

```typescript
// backend/src/middleware/requestSigning.ts
import crypto from 'crypto';

export function verifyRequestSignature(
  apiKey: string,
  timestamp: string,
  signature: string,
  body: string
): boolean {
  const secret = process.env.API_SECRET!;
  const payload = `${apiKey}:${timestamp}:${body}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### 7. Input Validation & Sanitization
**Current Issue**: Some endpoints may not validate all inputs
**Risk**: Injection attacks, XSS

**Solution**: Add comprehensive validation

```typescript
// backend/src/utils/validator.ts
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input);
}

export const smsTextSchema = z.string()
  .min(10)
  .max(1000)
  .refine((val) => !val.includes('<script>'), {
    message: 'Invalid characters detected'
  });
```

### 8. CORS Configuration
**Current Issue**: Allows all origins in development
**Risk**: CSRF attacks in production

**Solution**: Strict CORS in production

```typescript
// backend/src/server.ts
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL!] // Only allow specific domain
    : true, // Allow all in dev
  credentials: true,
  // ... rest
};
```

## 🟢 MEDIUM PRIORITY

### 9. SQL Injection Protection
**Current Status**: ✅ Using Prisma (parameterized queries)
**Note**: Already protected, but verify no raw queries

### 10. XSS Protection
**Current Status**: ✅ Using Helmet
**Enhancement**: Add Content Security Policy headers

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));
```

### 11. Session Management
**Current Issue**: JWT tokens don't have revocation mechanism
**Risk**: Compromised tokens valid until expiration

**Solution**: Add token blacklist

```typescript
// backend/src/utils/tokenBlacklist.ts
import { cache } from './cache';

export function blacklistToken(token: string, expiresIn: number) {
  const decoded = jwt.decode(token) as { exp: number };
  const ttl = (decoded.exp * 1000) - Date.now();
  cache.set(`blacklist:${token}`, true, ttl);
}

export function isTokenBlacklisted(token: string): boolean {
  return cache.get(`blacklist:${token}`) === true;
}
```

### 12. Audit Logging Enhancement
**Current Status**: ✅ Basic audit logging exists
**Enhancement**: Add more context, IP tracking, user agent

```typescript
// backend/src/middleware/auditLog.ts
await prisma.auditLog.create({
  data: {
    userId: req.user?.id,
    action: `${req.method} ${req.path}`,
    endpoint: req.path,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    metadata: {
      query: req.query,
      body: sanitizeLog(req.body), // Sanitized
    },
  },
});
```

## 📋 Implementation Priority

1. **Week 1**: API key hashing, remove sensitive logs, API key in headers only
2. **Week 2**: IP rate limiting, API key rotation
3. **Week 3**: Request signing, enhanced CORS
4. **Week 4**: Token blacklist, enhanced audit logging



