import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { errorHandler, AppError } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Import routes
import authRoutes from './routes/auth';
import patternRoutes from './routes/patterns';
import ingestRoutes from './routes/ingest';
import verifyRoutes from './routes/verify';
import premiumRoutes from './routes/premium';
import dashboardRoutes from './routes/dashboard';
import configRoutes from './routes/config';
import adminRoutes from './routes/admin';
import countriesRoutes from './routes/countries';
import templateRoutes from './routes/templates';
import testRoutes from './routes/test';
import packageRoutes from './routes/packages';
import userPackageRoutes from './routes/user-packages';
import systemConfigRoutes from './routes/system-config';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - allow specific origins with credentials
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from frontend dashboard, test page, or no origin (mobile apps, Postman, etc.)
    const allowedOrigins = [
      'http://localhost:5173', // Frontend dashboard
      'http://localhost:3006', // Test page
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3006',
    ];
    
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for development - change in production
    }
  },
  credentials: true, // Allow cookies/credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'Accept', 'Origin', 'X-Requested-With', 'ngrok-skip-browser-warning'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// Security middleware - relaxed for local development
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disable CSP for local dev
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enhanced request/response logging with AI-friendly format
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'CheckPay API is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/patterns', patternRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/config', configRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/countries', countriesRoutes);
app.use('/api/test', testRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/user-packages', userPackageRoutes);
app.use('/api/system-config', systemConfigRoutes);

// 404 handler
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(404, `Route ${req.method} ${req.path} not found`));
});

// Error handler (must be last)
app.use(errorHandler);

// Start server - listen on all interfaces (0.0.0.0) to allow network access
const port = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 CheckPay API server running on port ${port}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${port}/health`);
  console.log(`🌐 Network access: http://0.0.0.0:${port}/health`);
});

export default app;

