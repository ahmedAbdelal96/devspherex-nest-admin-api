/**
 * Logging Service Tests
 *
 * Tests the Winston-based LoggingService without requiring a real
 * database or writing actual log files.
 */

import { LoggingService } from './logging.service';
import { AppLogMeta } from './logging.types';

// Save/restore env
const originalEnv = { ...process.env };

function cleanEnv() {
  // Reset all logging env vars without touching NODE_ENV
  delete process.env['LOG_LEVEL'];
  delete process.env['LOG_TO_CONSOLE'];
  delete process.env['LOG_TO_FILE'];
  delete process.env['LOG_DIR'];
  delete process.env['LOG_FILE_MAX_SIZE'];
  delete process.env['LOG_RETENTION_DAYS'];
  delete process.env['LOG_PRETTY_CONSOLE'];
  delete process.env['LOG_JSON_FILE'];
}

beforeEach(() => {
  cleanEnv();
});

afterAll(() => {
  process.env = originalEnv;
});

describe('LoggingService', () => {
  describe('construction', () => {
    it('can be instantiated without throwing', () => {
      expect(() => new LoggingService()).not.toThrow();
    });
  });

  describe('log methods', () => {
    let service: LoggingService;

    beforeEach(() => {
      cleanEnv();
      process.env['NODE_ENV'] = 'development';
      service = new LoggingService();
    });

    it('info() does not throw', () => {
      expect(() => service.info('Test info message', 'TestContext')).not.toThrow();
    });

    it('warn() does not throw', () => {
      expect(() => service.warn('Test warn message', 'TestContext')).not.toThrow();
    });

    it('error() does not throw', () => {
      expect(() => service.error('Test error message', 'TestContext')).not.toThrow();
    });

    it('debug() does not throw', () => {
      expect(() => service.debug('Test debug message', 'TestContext')).not.toThrow();
    });

    it('verbose() does not throw', () => {
      expect(() => service.verbose!('Test verbose message', 'TestContext')).not.toThrow();
    });

    it('log() with info level does not throw', () => {
      expect(() => service.log('info', 'Test message')).not.toThrow();
    });

    it('log() with message-only signature does not throw', () => {
      expect(() => service.log('Test message', 'TestContext')).not.toThrow();
    });

    it('can be called with metadata without throwing', () => {
      expect(() =>
        service.info('Message with meta', 'Context', {
          requestId: 'req-123',
          userId: 'user-1',
          path: '/api/users',
          method: 'GET',
        }),
      ).not.toThrow();
    });
  });

  describe('sensitive data redaction', () => {
    let service: LoggingService;

    beforeEach(() => {
      cleanEnv();
      process.env['NODE_ENV'] = 'development';
      service = new LoggingService();
    });

    it('can log with sensitive metadata without throwing', () => {
      expect(() =>
        service.info('Login attempt', 'AuthService', {
          password: 'secret123',
          accessToken: 'tok123',
          authorization: 'Bearer xyz',
        } as unknown as AppLogMeta),
      ).not.toThrow();
    });

    it('can log with deeply nested sensitive data without throwing', () => {
      expect(() =>
        service.info('User update', 'UserService', {
          user: {
            name: 'Alice',
            password: 'secret',
            profile: { apiKey: 'key123' },
          },
        } as unknown as AppLogMeta),
      ).not.toThrow();
    });

    it('can log with array of objects containing sensitive data without throwing', () => {
      expect(() =>
        service.info('Batch operation', 'BatchService', {
          items: [
            { name: 'Item1', token: 'tok1' },
            { name: 'Item2', token: 'tok2' },
          ],
        } as unknown as AppLogMeta),
      ).not.toThrow();
    });
  });

  describe('Error handling', () => {
    let service: LoggingService;

    beforeEach(() => {
      cleanEnv();
      process.env['NODE_ENV'] = 'development';
      service = new LoggingService();
    });

    it('error() with Error object and stack does not throw', () => {
      const err = new Error('Something went wrong');
      expect(() =>
        service.error(err.message, 'TestContext', { stack: err.stack }),
      ).not.toThrow();
    });

    it('error() with Error object containing sensitive data in stack does not throw', () => {
      // Create an error with a message that contains something that looks like a token
      const err = new Error('Auth failed with token=secret123 and password=pw');
      expect(() =>
        service.error(err.message, 'AuthService', { stack: err.stack }),
      ).not.toThrow();
    });
  });
});

describe('buildLoggingConfig', () => {
  // Re-import with fresh module state for each test
  const reimport = (env: string) => {
    jest.resetModules();
    process.env['NODE_ENV'] = env;
    return jest.requireActual('./logging.config');
  };

  beforeEach(cleanEnv);

  it('returns debug level in development by default', () => {
    const { buildLoggingConfig: cfg } = reimport('development');
    delete process.env['LOG_LEVEL'];
    const config = cfg();
    expect(config.level).toBe('debug');
  });

  it('returns info level in production by default', () => {
    const { buildLoggingConfig: cfg } = reimport('production');
    delete process.env['LOG_LEVEL'];
    const config = cfg();
    expect(config.level).toBe('info');
  });

  it('returns silenced config in test environment', () => {
    const { buildLoggingConfig: cfg } = reimport('test');
    const config = cfg();
    expect(config.silenced).toBe(true);
    expect(config.toConsole).toBe(false);
    expect(config.toFile).toBe(false);
  });

  it('uses LOG_LEVEL when set to a valid level', () => {
    const { buildLoggingConfig: cfg } = reimport('development');
    process.env['LOG_LEVEL'] = 'warn';
    const config = cfg();
    expect(config.level).toBe('warn');
  });

  it('falls back to default when LOG_LEVEL is invalid', () => {
    const { buildLoggingConfig: cfg } = reimport('development');
    process.env['LOG_LEVEL'] = 'not-a-level';
    const config = cfg();
    expect(config.level).toBe('debug');
  });

  it('respects LOG_TO_CONSOLE=false', () => {
    const { buildLoggingConfig: cfg } = reimport('development');
    process.env['LOG_TO_CONSOLE'] = 'false';
    const config = cfg();
    expect(config.toConsole).toBe(false);
  });

  it('respects LOG_TO_FILE=false', () => {
    const { buildLoggingConfig: cfg } = reimport('development');
    process.env['LOG_TO_FILE'] = 'false';
    const config = cfg();
    expect(config.toFile).toBe(false);
  });

  it('uses custom LOG_DIR', () => {
    const { buildLoggingConfig: cfg } = reimport('development');
    process.env['LOG_DIR'] = 'custom-logs';
    const config = cfg();
    expect(config.dir).toBe('custom-logs');
  });

  it('uses custom LOG_FILE_MAX_SIZE', () => {
    const { buildLoggingConfig: cfg } = reimport('development');
    process.env['LOG_FILE_MAX_SIZE'] = '10m';
    const config = cfg();
    expect(config.fileMaxSize).toBe('10m');
  });

  it('uses custom LOG_RETENTION_DAYS', () => {
    const { buildLoggingConfig: cfg } = reimport('development');
    process.env['LOG_RETENTION_DAYS'] = '7';
    const config = cfg();
    expect(config.fileRetentionDays).toBe(7);
  });

  it('enables pretty console in development by default', () => {
    const { buildLoggingConfig: cfg } = reimport('development');
    const config = cfg();
    expect(config.prettyConsole).toBe(true);
  });

  it('disables pretty console in production by default', () => {
    const { buildLoggingConfig: cfg } = reimport('production');
    const config = cfg();
    expect(config.prettyConsole).toBe(false);
  });

  it('enables jsonFile in production by default', () => {
    const { buildLoggingConfig: cfg } = reimport('production');
    const config = cfg();
    expect(config.jsonFile).toBe(true);
  });
});

describe('getNodeEnv', () => {
  beforeEach(cleanEnv);

  it('returns the current NODE_ENV', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      configurable: true,
      writable: true,
    });
    // Re-import to pick up the new NODE_ENV
    jest.resetModules();
    const { getNodeEnv: gne } = jest.requireActual('./logging.config');
    expect(gne()).toBe('production');
  });

  it('defaults to development when NODE_ENV is not set', () => {
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    jest.resetModules();
    // When NODE_ENV is undefined, delete it so getNodeEnv() falls back to 'development'
    delete process.env['NODE_ENV'];
    const { getNodeEnv: gne } = jest.requireActual('./logging.config');
    expect(gne()).toBe('development');
  });
});