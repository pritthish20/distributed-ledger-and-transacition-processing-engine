import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Distributed Ledger API')
    .setDescription('API docs for the transaction processing engine')
    .setVersion('1.0.0')
    .build();

    const document = SwaggerModule.createDocument(app,swaggerConfig);

  SwaggerModule.setup('docs',app, document);

  await app.listen(process.env.PORT ?? 3000)
}
bootstrap();
