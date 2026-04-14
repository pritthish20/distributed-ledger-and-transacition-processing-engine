import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    status: 'wait',
    connect: jest.fn(),
    ping: jest.fn(),
    quit: jest.fn(),
  }));
});

describe('HealthService', () => {
  let service: HealthService;
  const dataSource = {
    query: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    configService.get.mockImplementation((key: string) => {
      if (key === 'redis.host') return '127.0.0.1';
      if (key === 'redis.port') return 6379;
      if (key === 'redis.password') return undefined;
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('returns ok when database and Redis are reachable', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    const redis = getRedisMock();
    redis.connect.mockResolvedValue(undefined);
    redis.ping.mockResolvedValue('PONG');

    const result = await service.getHealth();

    expect(result).toMatchObject({
      status: 'ok',
      checks: {
        database: { status: 'up' },
        redis: { status: 'up' },
      },
    });
  });

  it('returns degraded when database and Redis checks fail', async () => {
    dataSource.query.mockRejectedValue(new Error('db down'));
    const redis = getRedisMock();
    redis.connect.mockRejectedValue(new Error('redis down'));

    const result = await service.getHealth();

    expect(result.status).toBe('degraded');
    expect(result.checks.database).toEqual({
      status: 'down',
      error: 'db down',
    });
    expect(result.checks.redis).toEqual({
      status: 'down',
      error: 'redis down',
    });
  });
});

function getRedisMock() {
  return (Redis as unknown as jest.Mock).mock.results.at(-1)?.value;
}
