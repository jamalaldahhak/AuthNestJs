import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from '../services/auth.service.js';
import { vi } from 'vitest';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const authService = {
      getLoginOptions: vi.fn(),
      register: vi.fn(),
      login: vi.fn(),
      refresh: vi.fn(),
      getProfile: vi.fn(),
      logout: vi.fn(),
      logoutAll: vi.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
