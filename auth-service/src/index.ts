import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { auth } from 'express-oauth2-jwt-bearer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.AUTH_PORT || 3002;

// Middleware básico
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Auth0 JWT validation middleware
const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
  tokenSigningAlg: 'RS256'
});

// Public routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Auth Service',
    timestamp: new Date().toISOString()
  });
});

// Protected route - validate JWT
app.get('/auth/validate', checkJwt, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: {
      id: req.auth?.payload.sub,
      email: req.auth?.payload.email,
      name: req.auth?.payload.name,
      roles: req.auth?.payload['https://restaurant-api.com/roles'] || []
    },
    timestamp: new Date().toISOString()
  });
});

// Get user info from token
app.get('/auth/me', checkJwt, (req, res) => {
  const payload = req.auth?.payload;
  
  res.json({
    success: true,
    data: {
      id: payload?.sub,
      email: payload?.email,
      name: payload?.name,
      picture: payload?.picture,
      roles: payload?.['https://restaurant-api.com/roles'] || ['customer'],
      emailVerified: payload?.email_verified || false
    },
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Auth service error:', err);
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing token'
      },
      timestamp: new Date().toISOString()
    });
  }
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    },
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🔐 Auth Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 Auth0 Domain: ${process.env.AUTH0_DOMAIN}`);
});

export default app;