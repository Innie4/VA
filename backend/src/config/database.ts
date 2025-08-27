import { PrismaClient, Prisma } from '@prisma/client';
import { logger as dbLogger } from '../utils/logger';

// Type definitions
type PrismaClientType = InstanceType<typeof PrismaClient>;
type PrismaPromiseType = ReturnType<typeof Prisma.validator>;

// Prisma client singleton
class DatabaseManager {
  private static instance: DatabaseManager;
  private prisma: PrismaClientType;
  private isConnected: boolean = false;
  private connectionRetries: number = 0;
  private maxRetries: number = 5;
  private retryDelay: number = 5000; // 5 seconds

  private constructor() {
    this.prisma = new PrismaClient({
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
      ],
      errorFormat: 'pretty',
    });

    this.setupEventListeners();
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private setupEventListeners(): void {
    // Log database queries in development
    this.prisma.$on('query' as never, (e: any) => {
      if (process.env.NODE_ENV === 'development') {
        dbLogger.debug('Database Query', {
          query: e.query,
          params: e.params,
          duration: `${e.duration}ms`,
          timestamp: e.timestamp,
        });
      }
    });

    // Log database errors
    this.prisma.$on('error' as never, (e: any) => {
      dbLogger.error('Database Error', {
        message: e.message,
        target: e.target,
        timestamp: e.timestamp,
      });
    });

    // Note: 'info' and 'warn' events are not available in current Prisma version
    // Only 'query' and 'error' events are supported
  }

  public async connect(): Promise<void> {
    try {
      console.log('Attempting to connect to database...');
      console.log('Database URL:', this.getMaskedDatabaseUrl());
      await this.prisma.$connect();
      console.log('Prisma $connect successful');
      this.isConnected = true;
      this.connectionRetries = 0;
      
      dbLogger.info('Database connected successfully', {
        provider: 'postgresql',
        url: this.getMaskedDatabaseUrl(),
      });

      // Test the connection
      await this.healthCheck();
    } catch (error) {
      this.isConnected = false;
      this.connectionRetries++;
      
      dbLogger.error('Database connection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        retries: this.connectionRetries,
        maxRetries: this.maxRetries,
      });

      if (this.connectionRetries < this.maxRetries) {
        dbLogger.info(`Retrying database connection in ${this.retryDelay / 1000} seconds...`);
        setTimeout(() => this.connect(), this.retryDelay);
      } else {
        dbLogger.error('Max database connection retries exceeded');
        throw error;
      }
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      dbLogger.info('Database disconnected successfully');
    } catch (error) {
      dbLogger.error('Error disconnecting from database', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      dbLogger.error('Database health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  public getClient(): PrismaClientType {
    if (!this.isConnected) {
      dbLogger.warn('Attempting to use database client before connection is established');
    }
    return this.prisma;
  }

  public isHealthy(): boolean {
    return this.isConnected;
  }

  private getMaskedDatabaseUrl(): string {
    const url = process.env.DATABASE_URL || '';
    return url.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@');
  }

  // Transaction helper
  public async transaction<T>(fn: (prisma: Omit<PrismaClientType, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  // Batch operations helper
  public async batchWrite(operations: any[]): Promise<any[]> {
    return this.prisma.$transaction(operations);
  }

  // Database statistics
  public async getStats(): Promise<any> {
    try {
      const stats = await this.prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        LIMIT 10
      `;
      
      return stats;
    } catch (error) {
      dbLogger.error('Failed to get database stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  // Connection pool info
  public getConnectionInfo(): any {
    return {
      isConnected: this.isConnected,
      connectionRetries: this.connectionRetries,
      maxRetries: this.maxRetries,
      databaseUrl: this.getMaskedDatabaseUrl(),
    };
  }
}

// Export singleton instance
const dbInstance = DatabaseManager.getInstance();

// Database middleware for request logging
const logDatabaseQueries = () => {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      
      if (duration > 1000) { // Log slow requests (>1s)
        dbLogger.warn('Slow database operation detected', {
          method: req.method,
          path: req.path,
          duration: `${duration}ms`,
          userId: req.user?.id,
        });
      }
    });
    
    next();
  };
};

// Database seeding helper
const seedDatabase = async (): Promise<void> => {
  try {
    dbLogger.info('Starting database seeding...');
    
    // Create default roles if they don't exist
    const roles = ['user', 'moderator', 'admin', 'super_admin'];
    
    for (const roleName of roles) {
      await dbInstance.getClient().role.upsert({
        where: { name: roleName },
        update: {},
        create: {
          name: roleName,
          description: `Default ${roleName} role`,
          permissions: JSON.stringify(getDefaultPermissions(roleName)),
        },
      });
    }
    
    // Create default admin user if it doesn't exist
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    
    const adminRole = await dbInstance.getClient().role.findUnique({
      where: { name: 'admin' },
    });
    
    if (adminRole) {
      await dbInstance.getClient().user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
          email: adminEmail,
          password: adminPassword, // This should be hashed in real implementation
          firstName: 'Admin',
          lastName: 'User',
          roleId: adminRole.id,
          isEmailVerified: true,
          tier: 'premium',
        },
      });
    }
    
    dbLogger.info('Database seeding completed successfully');
  } catch (error) {
    dbLogger.error('Database seeding failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

// Helper function to get default permissions for roles
function getDefaultPermissions(roleName: string): string[] {
  const permissions: Record<string, string[]> = {
    user: [
      'chat:create',
      'chat:read',
      'chat:update',
      'chat:delete',
      'profile:read',
      'profile:update',
    ],
    moderator: [
      'chat:create',
      'chat:read',
      'chat:update',
      'chat:delete',
      'chat:moderate',
      'profile:read',
      'profile:update',
      'users:read',
    ],
    admin: [
      'chat:*',
      'profile:*',
      'users:*',
      'system:read',
      'system:update',
    ],
    super_admin: [
      '*:*', // All permissions
    ],
  };
  
  return permissions[roleName] || [];
}

// Cleanup function for graceful shutdown
const cleanup = async (): Promise<void> => {
  try {
    await dbInstance.disconnect();
    dbLogger.info('Database cleanup completed');
  } catch (error) {
    dbLogger.error('Database cleanup failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Database migration helper
const runMigrations = async (): Promise<void> => {
  try {
    dbLogger.info('Running database migrations...');
    
    // In a real application, you would run Prisma migrations here
    // For now, we'll just log that migrations would be run
    dbLogger.info('Database migrations completed (placeholder)');
  } catch (error) {
    dbLogger.error('Database migrations failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
};

export {
  dbInstance as db,
  logDatabaseQueries,
  seedDatabase,
  cleanup,
  runMigrations,
  dbInstance as default
};