import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { createPayloadHash } from '../../common/utils/hash.util';
import { IdempotencyRecordEntity } from './entities/idempotency-record.entity';
import { IdempotencyStatus } from './enums/idempotency-status.enum';

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyRecordEntity)
    private readonly idempotencyRepository: Repository<IdempotencyRecordEntity>,
  ) {}

  async execute<T>(
    endpoint: string,
    idempotencyKey: string | undefined,
    payload: unknown,
    operation: () => Promise<{
      statusCode: number;
      body: T;
      transactionId?: string;
    }>,
  ): Promise<T> {
    if (!idempotencyKey) {
      throw new ConflictException('Idempotency-Key header is required');
    }

    const requestHash = createPayloadHash(payload);
    const existingRecord = await this.idempotencyRepository.findOne({
      where: {
        endpoint,
        idempotencyKey,
      },
    });

    if (existingRecord) {
      this.assertRequestHash(existingRecord.requestHash, requestHash);

      if (existingRecord.status === IdempotencyStatus.COMPLETED && existingRecord.responseBody) {
        return existingRecord.responseBody as T;
      }

      if (existingRecord.status === IdempotencyStatus.PROCESSING) {
        throw new ConflictException('A request with this idempotency key is already being processed');
      }

      await this.idempotencyRepository.update(existingRecord.id, {
        status: IdempotencyStatus.PROCESSING,
        responseBody: null,
        responseCode: null,
        transactionId: null,
      });
    } else {
      try {
        await this.idempotencyRepository.insert({
          endpoint,
          idempotencyKey,
          requestHash,
          status: IdempotencyStatus.PROCESSING,
        });
      } catch (error) {
        if (error instanceof QueryFailedError) {
          const duplicate = await this.idempotencyRepository.findOne({
            where: {
              endpoint,
              idempotencyKey,
            },
          });

          if (duplicate) {
            this.assertRequestHash(duplicate.requestHash, requestHash);

            if (duplicate.status === IdempotencyStatus.COMPLETED && duplicate.responseBody) {
              return duplicate.responseBody as T;
            }
          }
        }

        throw error;
      }
    }

    const record = await this.idempotencyRepository.findOneOrFail({
      where: {
        endpoint,
        idempotencyKey,
      },
    });

    try {
      const result = await operation();
      await this.idempotencyRepository.save({
        id: record.id,
        status: IdempotencyStatus.COMPLETED,
        responseCode: result.statusCode,
        responseBody: result.body as unknown as Record<string, unknown>,
        transactionId: result.transactionId ?? null,
      });

      return result.body;
    } catch (error) {
      const normalized = this.normalizeError(error);

      await this.idempotencyRepository.save({
        id: record.id,
        status: IdempotencyStatus.FAILED,
        responseCode: normalized.statusCode,
        responseBody: normalized.body as unknown as Record<string, unknown>,
      });

      throw error;
    }
  }

  private assertRequestHash(existingHash: string, requestHash: string) {
    if (existingHash !== requestHash) {
      throw new ConflictException('Idempotency key has already been used with a different payload');
    }
  }

  private normalizeError(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      return {
        statusCode: error.getStatus(),
        body:
          typeof response === 'string'
            ? {
                message: response,
                statusCode: error.getStatus(),
              }
            : (response as Record<string, unknown>),
      };
    }

    if (error instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        body: {
          message: error.message,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      };
    }

    throw new InternalServerErrorException();
  }
}
