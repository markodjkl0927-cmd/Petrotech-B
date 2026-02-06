import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

// Stripe webhook needs raw body for signature verification
// This must be before express.json() middleware
app.use(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    // Store raw body for webhook verification
    (req as any).rawBody = req.body;
    next();
  }
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (MVP). In production, prefer S3/Cloudinary.
const uploadsDir = path.join(process.cwd(), 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Petrotech API is running' });
});

// API Routes
import apiRoutes from './routes';
app.use('/api', apiRoutes);

app.get('/api', (req, res) => {
  res.json({ 
    message: 'Petrotech API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      users: '/api/users',
      products: '/api/products',
      orders: '/api/orders',
      addresses: '/api/addresses',
      admin: '/api/admin',
      driver: '/api/driver (earnings, payouts, connect)',
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📝 API Documentation: http://localhost:${PORT}/api`);
});

