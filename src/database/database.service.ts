import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class DatabaseService {
  constructor(private readonly dataSource: DataSource) {}

  async runInTransaction<T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(operation);
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }
}
