import { plainToInstance, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min, validateSync, } from 'class-validator'

enum NodeEnv {
    Development ='development',
    Test ="test",
    Production ='production',
}

class EnvVars {
    @IsEnum(NodeEnv)
    NODE_ENV : NodeEnv =NodeEnv.Development;

    @Type(()=>Number)
    @IsInt()
    @Min(1)
    PORT :number=3000

    @IsString()
    DATABASE_URL!:string

    @IsString()
    REDIS_HOST!:string

    @Type(()=>Number)
    @IsInt()
    @Min(1)
    REDIS_PORT!:number;

    @IsOptional()
    @IsString()
    REDIS_PASSWORD?:string

    @IsOptional()
    @IsString()
    QUEUE_PREFIX?:string

    @Type(()=>Number)
    @IsInt()
    @Min(100)
    WEBHOOK_BACKOFF_MS:number=5000;

    @Type(()=>Number)
    @IsInt()
    @Min(1)
    WEBHOOK_MAX_ATTEMPTS:number=5;

    @Type(()=>Number)
    @IsInt()
    @Min(100)
    OUTBOX_POLL_INTERVAL_MS:number=5000;

    @Type(()=>Number)
    @IsInt()
    @Min(1)
    OUTBOX_BATCH_SIZE:number=20;

    @Type(()=>Number)
    @IsInt()
    @Min(100)
    OUTBOX_BACKOFF_MS:number=5000;

    @Type(()=>Number)
    @IsInt()
    @Min(1)
    OUTBOX_MAX_ATTEMPTS:number=5;

    @Type(()=>Number)
    @IsInt()
    @Min(100)
    OUTBOX_STALE_AFTER_MS:number=30000;

    @Type(()=>Number)
    @IsInt()
    @Min(1000)
    RECONCILIATION_INTERVAL_MS:number=60000;

}

export function validate(config: Record<string,unknown>){
    const validated = plainToInstance(EnvVars,config,{
        enableImplicitConversion:true,
    });
    const errors = validateSync(validated, {
        skipMissingProperties: false
    });

    if(errors.length >0){
        throw new Error(errors.toString());
    }

    return validated;
}
