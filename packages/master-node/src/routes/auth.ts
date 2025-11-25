import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { registerSchema, loginSchema } from '../schemas';
import { authService } from '../services/auth';

export async function authRoutes(app: FastifyInstance) {
  /**
   * POST /api/auth/register
   * Register a new user
   */
  app.post('/api/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = registerSchema.parse(request.body);
      
      const { user, device } = await authService.register(
        body.username,
        body.password,
        body.deviceName
      );

      // Generate JWT token
      const token = app.jwt.sign({
        userId: user.id,
        username: user.username,
        deviceId: device.id,
      });

      return reply.code(201).send({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
          },
          device: {
            id: device.id,
            deviceName: device.device_name,
            registrationId: device.registration_id,
          },
          token,
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }

      if (error.message === 'Username already exists') {
        return reply.code(409).send({
          success: false,
          error: error.message,
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * POST /api/auth/login
   * Login existing user
   */
  app.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = loginSchema.parse(request.body);
      
      const { user, device } = await authService.login(
        body.username,
        body.password,
        body.deviceName
      );

      // Generate JWT token
      const token = app.jwt.sign({
        userId: user.id,
        username: user.username,
        deviceId: device.id,
      });

      return reply.code(200).send({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
          },
          device: {
            id: device.id,
            deviceName: device.device_name,
            registrationId: device.registration_id,
          },
          token,
        },
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      }

      if (error.message === 'Invalid credentials') {
        return reply.code(401).send({
          success: false,
          error: 'Invalid credentials',
        });
      }

      app.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * GET /api/auth/me
   * Get current user info (requires authentication)
   */
  app.get('/api/auth/me', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userId } = request.user as any;
      
      const user = await authService.getUserById(userId);
      const devices = await authService.getUserDevices(userId);

      if (!user) {
        return reply.code(404).send({
          success: false,
          error: 'User not found',
        });
      }

      return reply.code(200).send({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            createdAt: user.created_at,
          },
          devices: devices.map(d => ({
            id: d.id,
            deviceName: d.device_name,
            registrationId: d.registration_id,
            lastSeenAt: d.last_seen_at,
          })),
        },
      });
    } catch (error) {
      app.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error',
      });
    }
  });
}
