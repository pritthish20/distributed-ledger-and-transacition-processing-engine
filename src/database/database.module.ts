import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports:[
    TypeOrmModule.forRootAsync({
      inject:[ConfigService],
      useFactory :(configService : ConfigService)=>({
        type:'postgres',
        url:configService.get<string>('database.url'),
        autoLoadEntities:true,
        synchronize:false,
        logging:false,
      }),
    }),
  ],
  providers: [DatabaseService]
})
export class DatabaseModule {}
