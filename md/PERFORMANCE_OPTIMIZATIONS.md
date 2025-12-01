# Performance Optimizations

## 🔴 CRITICAL (High Impact)

### 1. Pattern Matching Optimization
**Current Issue**: Loops through all patterns in memory (O(n) for each SMS)
**Impact**: Slow for users with many patterns

**Current Code** (patternMatcher.ts):
```typescript
// Loops through ALL user patterns
const userPatterns = await prisma.pattern.findMany({ where: { userId } });
for (const pattern of userPatterns) {
  // Try each pattern
}
```

**Solution**: Use database queries with regex matching

```typescript
// backend/src/utils/patternMatcher.ts
export async function findMatchingPattern(
  smsText: string,
  userId?: string | null,
  countryCode?: string | null
): Promise<PatternMatch> {
  // Use PostgreSQL regex matching
  if (userId) {
    // Try to match SMS against patterns using database
    const matchedPattern = await prisma.$queryRaw`
      SELECT id, regex, "extractFields", bank, currency
      FROM "Pattern"
      WHERE "userId" = ${userId}
        AND ${smsText} ~* regex
      LIMIT 1
    `;
    
    if (matchedPattern) {
      // Extract using flexible extractor
      const extracted = flexibleExtract(smsText, matchedPattern);
      return { matched: true, pattern: matchedPattern, ... };
    }
  }
  // ... rest
}
```

**Alternative**: Cache pattern matches
```typescript
// Cache pattern matches for 5 minutes
const cacheKey = `pattern_match:${userId}:${hashSMS(smsText)}`;
const cached = cache.get(cacheKey);
if (cached) return cached;
```

### 2. Partial Transaction ID Matching
**Current Issue**: Loads 1000 transactions into memory, then searches
**Impact**: High memory usage, slow for large datasets

**Current Code** (txnController.ts line 200-219):
```typescript
const recentTransactions = await prisma.transaction.findMany({
  where: { userId: req.user.id, ... },
  take: 1000, // Loads 1000 records
});
const partialMatches = findTransactionsByPrefix(recentTransactions, txnId, 8);
```

**Solution**: Use database index on `txnIdPrefix`

```typescript
// Already indexed in schema, but use it!
export async function verifyTransaction(req: AuthRequest, res: Response) {
  // ... exact match code ...
  
  // Use database query with prefix matching
  const prefix = extractPrefix(txnId, 8);
  const partialMatch = await prisma.transaction.findFirst({
    where: {
      userId: req.user.id,
      txnIdPrefix: {
        startsWith: prefix,
      },
      receivedAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { receivedAt: 'desc' },
    include: { pattern: { select: { name: true, bank: true } } },
  });
  
  if (partialMatch) {
    const confidence = calculateConfidence(
      findCommonPrefix(txnId, partialMatch.txnId).length,
      txnId.length
    );
    
    if (confidence >= 0.75) {
      return res.json({ success: true, data: { ... } });
    }
  }
}
```

### 3. Database Connection Pooling
**Current Issue**: May not have optimal connection pool settings
**Impact**: Connection exhaustion under load

**Solution**: Configure Prisma connection pool

```typescript
// backend/src/utils/prisma.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

// Add connection pool configuration in DATABASE_URL
// postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10
```

**Or use connection pooler** (PgBouncer):
```
DATABASE_URL=postgresql://user:pass@pgbouncer:6432/db
```

### 4. AI Extraction Caching
**Current Issue**: Every pattern creation calls Gemini API
**Impact**: High costs, slow responses

**Solution**: Cache AI extraction results

```typescript
// backend/src/utils/llmExtractor.ts
export async function extractTxnIdWithLLM(smsText: string): Promise<LLMExtractionResult> {
  // Create cache key from SMS hash
  const smsHash = crypto.createHash('sha256').update(smsText).digest('hex');
  const cacheKey = `ai_extraction:${smsHash}`;
  
  // Check cache first
  const cached = cache.get<LLMExtractionResult>(cacheKey);
  if (cached) {
    console.log('[AI] Using cached extraction result');
    return cached;
  }
  
  // Call Gemini
  const result = await extractWithGemini(smsText);
  
  // Cache for 24 hours (SMS patterns don't change often)
  cache.set(cacheKey, result, 24 * 60 * 60 * 1000);
  
  return result;
}
```

## 🟡 HIGH PRIORITY

### 5. Redis Cache Implementation
**Current Issue**: In-memory cache (lost on restart, not shared across instances)
**Impact**: Cache misses, no shared cache in multi-instance deployments

**Solution**: Use Redis for distributed caching

```typescript
// backend/src/utils/redis.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export const redisCache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  },
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const ttlSeconds = ttl ? Math.floor(ttl / 1000) : 300; // Default 5 min
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  },
  
  async delete(key: string): Promise<void> {
    await redis.del(key);
  },
};
```

**Update cache.ts to use Redis in production**:
```typescript
const isProduction = process.env.NODE_ENV === 'production';
export const cache = isProduction ? redisCache : new SimpleCache();
```

### 6. Database Query Optimization
**Current Issue**: Some queries may not use indexes efficiently
**Impact**: Slow queries under load

**Optimizations**:

1. **Add composite indexes**:
```sql
-- For pattern matching
CREATE INDEX idx_pattern_user_bank_currency ON "Pattern"("userId", "bank", "currency");

-- For transaction lookups
CREATE INDEX idx_transaction_user_prefix_date ON "Transaction"("userId", "txnIdPrefix", "receivedAt" DESC);
```

2. **Use select statements** (already done, but verify):
```typescript
// ✅ Good - only select needed fields
select: { id: true, apiKey: true, plan: true }

// ❌ Bad - selects all fields
// (not in your code, but avoid)
```

3. **Batch queries**:
```typescript
// Instead of multiple queries
const [user, patterns, transactions] = await Promise.all([
  prisma.user.findUnique({ where: { id } }),
  prisma.pattern.findMany({ where: { userId: id } }),
  prisma.transaction.findMany({ where: { userId: id } }),
]);
```

### 7. Response Compression
**Current Issue**: No response compression
**Impact**: Large payloads, slow mobile connections

**Solution**: Add compression middleware

```typescript
// backend/src/server.ts
import compression from 'compression';

app.use(compression({
  level: 6, // Balance between speed and compression
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));
```

### 8. Pagination for Large Datasets
**Current Status**: ✅ Already implemented for transactions
**Enhancement**: Add cursor-based pagination for better performance

```typescript
// Instead of offset-based (slow for large offsets)
// Use cursor-based pagination
export async function getTransactionsCursor(
  userId: string,
  cursor?: string,
  limit: number = 20
) {
  return prisma.transaction.findMany({
    where: { userId },
    take: limit + 1, // Fetch one extra to check if more exists
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
  });
}
```

## 🟢 MEDIUM PRIORITY

### 9. Background Job Processing
**Current Issue**: Missing template detection runs in `setImmediate` (can fail silently)
**Impact**: Background tasks may not complete

**Solution**: Use job queue (Bull/BullMQ)

```typescript
// backend/src/jobs/patternAnalysis.ts
import Queue from 'bull';

const patternAnalysisQueue = new Queue('pattern-analysis', {
  redis: process.env.REDIS_URL,
});

export async function analyzePatternForMissingTemplate(patternId: string) {
  await patternAnalysisQueue.add('check-missing-template', {
    patternId,
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
}

// Worker
patternAnalysisQueue.process('check-missing-template', async (job) => {
  const { patternId } = job.data;
  // ... analysis logic
});
```

### 10. Database Indexes Review
**Current Status**: ✅ Good indexes exist
**Enhancement**: Add missing indexes

```sql
-- For usage stats lookups
CREATE INDEX idx_usage_stats_user_date ON "UsageStats"("userId", "lastResetDate");

-- For audit logs
CREATE INDEX idx_audit_log_user_date ON "AuditLog"("userId", "createdAt" DESC);

-- For SIM card lookups
CREATE INDEX idx_sim_card_user_active ON "SimCard"("userId", "isActive");
```

### 11. Request Batching
**Current Issue**: Mobile app may send multiple requests sequentially
**Impact**: Multiple round trips

**Solution**: Add batch endpoints

```typescript
// backend/src/routes/ingest.ts
router.post('/batch', authenticate, async (req, res) => {
  const { transactions } = req.body; // Array of transactions
  
  // Process in parallel (with limit)
  const results = await Promise.allSettled(
    transactions.slice(0, 100).map(txn => ingestTransaction({ ...req, body: txn }, res))
  );
  
  res.json({ success: true, results });
});
```

### 12. Monitoring & Metrics
**Current Issue**: No performance monitoring
**Impact**: Can't identify bottlenecks

**Solution**: Add APM (Application Performance Monitoring)

```typescript
// backend/src/middleware/metrics.ts
import { performance } from 'perf_hooks';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = performance.now();
  
  res.on('finish', () => {
    const duration = performance.now() - start;
    
    // Log slow queries
    if (duration > 1000) {
      console.warn(`[SLOW] ${req.method} ${req.path} took ${duration}ms`);
    }
    
    // Send to monitoring service (DataDog, New Relic, etc.)
    // metrics.timing('request.duration', duration, { route: req.path });
  });
  
  next();
}
```

## 📊 Performance Targets

- **API Response Time**: < 200ms (p95)
- **Database Queries**: < 50ms (p95)
- **Pattern Matching**: < 100ms
- **AI Extraction**: < 2s (with caching)
- **Throughput**: 1000+ requests/second

## 📋 Implementation Priority

1. **Week 1**: Pattern matching optimization, partial matching with DB
2. **Week 2**: AI caching, connection pooling
3. **Week 3**: Redis cache, response compression
4. **Week 4**: Background jobs, monitoring



