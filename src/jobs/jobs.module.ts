import { Module } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Module({
  imports:[
    BullModule.forRootAsync({
      inject:[ConfigService],
      useFactory:(configService:ConfigService)=>({
        connection:{
          host:configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
        },
      }),
    }),
  ],
  providers: [JobsService]
})
export class JobsModule {}
