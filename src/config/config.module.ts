import { Module } from '@nestjs/common';
import {ConfigModule as NestConfigModule} from '@nestjs/config'
import appConfig from './app.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import queueConfig from './queue.config';
import {validate} from './env.validator'

@Module({
    imports:[
        NestConfigModule.forRoot({
            isGlobal:true,
            cache:true,
            load:[appConfig,databaseConfig,redisConfig,queueConfig],
            validate
        }),
    ],
})
export class ConfigModule {}
