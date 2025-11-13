import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { EmailService } from '../services/email.service';
import { AgentOrchestrator } from '../services/agent-orchestrator.service';
import { DatabaseService } from '../services/database.service';
import { GmailProvider } from '../providers/gmail.provider';
import { CategorizerAgent } from '../agents/categorizer.agent';
import { PrioritizerAgent } from '../agents/prioritizer.agent';
import { SummarizerAgent } from '../agents/summarizer.agent';
import { Email } from '../models/email.model';
import { JWTService } from '../auth/jwt.service';
import { PasswordService } from '../auth/password.service';
import { APIKeyService } from '../auth/api-key.service';
import { RBACService } from '../auth/rbac.service';
import { AuthMiddleware, AuthenticatedRequest } from './middleware/auth.middleware';
import { createAuthRoutes } from './routes/auth.routes';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

export class EmailServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private io: SocketIOServer;
  private emailService!: EmailService;
  private orchestrator!: AgentOrchestrator;
  private database: DatabaseService;
  private jwtService: JWTService;
  private passwordService: PasswordService;
  private apiKeyService: APIKeyService;
  private rbacService: RBACService;
  private authMiddleware!: AuthMiddleware;
  private logger: winston.Logger;

  constructor(private port: number = 3000) {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: { service: 'email-server' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });

    this.database = new DatabaseService(process.env.DB_PATH || './emails.db');
    this.jwtService = new JWTService();
    this.passwordService = new PasswordService();
    this.apiKeyService = new APIKeyService();
    this.rbacService = new RBACService();

    this.setupServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private async setupServices(): Promise<void> {
    await this.database.connect();

    this.authMiddleware = new AuthMiddleware(
      this.database,
      this.jwtService,
      this.apiKeyService,
      this.rbacService
    );

    const emailProvider = new GmailProvider({
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || '',
    });

    this.emailService = new EmailService(emailProvider, this.database);
    this.orchestrator = new AgentOrchestrator(this.database, process.env.REDIS_URL);

    const categorizerConfig = {
      id: uuidv4(),
      name: 'Categorizer',
      type: 'categorizer' as const,
      status: 'idle' as const,
      enabled: true,
      priority: 80,
      config: {},
      capabilities: ['categorize'],
    };
    const categorizerAgent = new CategorizerAgent(categorizerConfig);

    const prioritizerConfig = {
      id: uuidv4(),
      name: 'Prioritizer',
      type: 'prioritizer' as const,
      status: 'idle' as const,
      enabled: true,
      priority: 70,
      config: {},
      capabilities: ['prioritize'],
    };
    const prioritizerAgent = new PrioritizerAgent(prioritizerConfig);

    const summarizerConfig = {
      id: uuidv4(),
      name: 'Summarizer',
      type: 'summarizer' as const,
      status: 'idle' as const,
      enabled: true,
      priority: 60,
      config: {},
      capabilities: ['summarize'],
    };
    const summarizerAgent = new SummarizerAgent(summarizerConfig);

    await categorizerAgent.initialize(categorizerConfig);
    await prioritizerAgent.initialize(prioritizerConfig);
    await summarizerAgent.initialize(summarizerConfig);

    this.orchestrator.registerAgent(categorizerAgent);
    this.orchestrator.registerAgent(prioritizerAgent);
    this.orchestrator.registerAgent(summarizerAgent);

    this.logger.info('Services initialized');
  }

  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`);
      next();
    });

    // Global error handler
    this.app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      this.logger.error('Unhandled error', err);
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });
  }

  private setupRoutes(): void {
    // Public routes
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'healthy', timestamp: new Date() });
    });

    // Auth routes
    this.app.use('/api/auth', createAuthRoutes(
      this.database,
      this.jwtService,
      this.passwordService,
      this.apiKeyService,
      this.authMiddleware,
      this.logger
    ));

    // Protected routes - require authentication
    this.app.post('/api/emails/send',
      this.authMiddleware.requireAuth,
      this.authMiddleware.requirePermission('emails', 'send'),
      async (_req: AuthenticatedRequest, res) => {
      try {
        const email = await this.emailService.send(_req.body);
        const processResult = await this.orchestrator.processEmail(email);
        res.json(processResult.finalEmail);
      } catch (error) {
        this.logger.error('Failed to send email', error);
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Failed to send email' 
        });
      }
    });

    this.app.get('/api/emails/receive', async (req, res) => {
      try {
        const emails = await this.emailService.receive();
        const processedEmails = [];

        for (const email of emails) {
          const result = await this.orchestrator.processEmail(email);
          processedEmails.push(result.finalEmail);
        }

        res.json(processedEmails);
      } catch (error) {
        this.logger.error('Failed to receive emails', error);
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Failed to receive emails' 
        });
      }
    });

    this.app.get('/api/emails/:id',
      this.authMiddleware.requireAuth,
      this.authMiddleware.requirePermission('emails', 'read'),
      async (req: AuthenticatedRequest, res) => {
      try {
        const email = await this.emailService.getById(req.params.id);
        if (!email) {
          res.status(404).json({ error: 'Email not found' });
        } else {
          res.json(email);
        }
      } catch (error) {
        this.logger.error('Failed to get email', error);
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Failed to get email' 
        });
      }
    });

    this.app.put('/api/emails/:id',
      this.authMiddleware.requireAuth,
      this.authMiddleware.requirePermission('emails', 'update'),
      async (req: AuthenticatedRequest, res) => {
      try {
        const email = await this.emailService.update(req.params.id, req.body);
        res.json(email);
      } catch (error) {
        this.logger.error('Failed to update email', error);
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Failed to update email' 
        });
      }
    });

    this.app.delete('/api/emails/:id',
      this.authMiddleware.requireAuth,
      this.authMiddleware.requirePermission('emails', 'delete'),
      async (req: AuthenticatedRequest, res) => {
      try {
        const success = await this.emailService.delete(req.params.id);
        res.json({ success });
      } catch (error) {
        this.logger.error('Failed to delete email', error);
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Failed to delete email' 
        });
      }
    });

    this.app.post('/api/emails/search',
      this.authMiddleware.requireAuth,
      this.authMiddleware.requirePermission('emails', 'read'),
      async (req: AuthenticatedRequest, res) => {
      try {
        const emails = await this.emailService.search(req.body);
        res.json(emails);
      } catch (error) {
        this.logger.error('Failed to search emails', error);
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Failed to search emails' 
        });
      }
    });

    this.app.get('/api/emails/threads',
      this.authMiddleware.requireAuth,
      this.authMiddleware.requirePermission('emails', 'read'),
      async (_req: AuthenticatedRequest, res) => {
      try {
        const threads = await this.emailService.getThreads();
        res.json(threads);
      } catch (error) {
        this.logger.error('Failed to get threads', error);
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Failed to get threads' 
        });
      }
    });

    this.app.get('/api/agents',
      this.authMiddleware.requireAuth,
      this.authMiddleware.requirePermission('agents', 'read'),
      (_req: AuthenticatedRequest, res) => {
      const agents = this.orchestrator.getAgents();
      res.json(agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        status: agent.getStatus(),
      })));
    });

    this.app.get('/api/agents/:id/status',
      this.authMiddleware.requireAuth,
      this.authMiddleware.requirePermission('agents', 'read'),
      (req: AuthenticatedRequest, res) => {
      const status = this.orchestrator.getAgentStatus(req.params.id);
      if (!status) {
        res.status(404).json({ error: 'Agent not found' });
      } else {
        res.json(status);
      }
    });
  }

  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      this.logger.info(`Client connected: ${socket.id}`);

      socket.on('subscribe', (room: string) => {
        socket.join(room);
        this.logger.info(`Client ${socket.id} joined room: ${room}`);
      });

      socket.on('unsubscribe', (room: string) => {
        socket.leave(room);
        this.logger.info(`Client ${socket.id} left room: ${room}`);
      });

      socket.on('process-email', async (email: Email) => {
        try {
          const result = await this.orchestrator.processEmail(email);
          socket.emit('email-processed', result);
          this.io.to('email-updates').emit('email-processed', result);
        } catch (error) {
          socket.emit('error', {
            message: error instanceof Error ? error.message : 'Processing failed',
          });
        }
      });

      socket.on('disconnect', () => {
        this.logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  async start(): Promise<void> {
    this.server.listen(this.port, () => {
      this.logger.info(`Email server running on port ${this.port}`);
    });
  }

  async stop(): Promise<void> {
    await this.orchestrator.shutdown();
    await this.database.disconnect();
    this.server.close();
    this.logger.info('Server stopped');
  }
}