import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { throttlerConfig, THROTTLE_LIMIT_LOGIN, THROTTLE_LIMIT_FORGOT } from '../../config/throttle.config';

describe('AuthController (limitation de débit, ANO-002)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(throttlerConfig)],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn().mockRejectedValue(new UnauthorizedException('Identifiants invalides')),
            forgotPassword: jest.fn().mockResolvedValue({ message: 'ok' }),
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it(`renvoie 429 sur la connexion au-delà de ${THROTTLE_LIMIT_LOGIN} tentatives par minute`, async () => {
    const server = app.getHttpServer() as App;
    for (let i = 0; i < THROTTLE_LIMIT_LOGIN; i++) {
      await request(server).post('/auth/login').send({ email: 'a@b.c', password: 'faux' }).expect(401);
    }
    await request(server).post('/auth/login').send({ email: 'a@b.c', password: 'faux' }).expect(429);
  });

  it(`renvoie 429 sur la réinitialisation au-delà de ${THROTTLE_LIMIT_FORGOT} demandes par minute`, async () => {
    const server = app.getHttpServer() as App;
    for (let i = 0; i < THROTTLE_LIMIT_FORGOT; i++) {
      await request(server).post('/auth/forgot-password').send({ email: 'a@b.c' }).expect(200);
    }
    await request(server).post('/auth/forgot-password').send({ email: 'a@b.c' }).expect(429);
  });
});
