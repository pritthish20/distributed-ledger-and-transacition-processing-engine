import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService implements OnModuleDestroy {
  private readonly redisClient: Redis;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.redisClient = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      password: this.configService.get<string>('redis.password') || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async getHealth() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    return {
      status: database.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded',
      checks: {
        database,
        redis,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
  }

  private async checkDatabase() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Database check failed',
      };
    }
  }

  private async checkRedis() {
    try {
      if (this.redisClient.status === 'wait') {
        await this.redisClient.connect();
      }

      await this.redisClient.ping();
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Redis check failed',
      };
    }
  }
}
