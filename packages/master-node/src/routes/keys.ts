import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { preKeyService } from '../services/prekey';

const uploadPreKeysSchema = z.object({
  identityKey: z.string(),
  signedPreKey: z.object({
    id: z.number(),
    publicKey: z.string(),
    signature: z.string(),
  }),
  oneTimePreKeys: z.array(z.object({
    id: z.number(),
    publicKey: z.string(),
  })),
});

export async function keyRoutes(app: FastifyInstance) {
  /**
   * POST /api/keys/upload
   * Upload PreKeys for current device
   */
  app.post('/api/keys/upload', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { deviceId } = request.user as any;
      const body = uploadPreKeysSchema.parse(request.body);

      await preKeyService.uploadPreKeys(
        deviceId,
        body.identityKey,
        body.signedPreKey,
        body.oneTimePreKeys
      );

      const availableCount = await preKeyService.getAvailablePreKeyCount(deviceId);

      return reply.code(200).send({
        success: true,
        data: {
          message: 'PreKeys uploaded successfully',
          availablePreKeys: availableCount,
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

      app.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * GET /api/keys/:username
   * Get PreKey bundle for a user (for initiating conversation)
   */
  app.get('/api/keys/:username', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest<{ Params: { username: string } }>, reply: FastifyReply) => {
    try {
      const { username } = request.params;

      // First, get user ID by username
      const userResult = await app.pg.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
      );

      if (userResult.rows.length === 0) {
        return reply.code(404).send({
          success: false,
          error: 'User not found',
        });
      }

      const userId = userResult.rows[0].id;

      // Get all device bundles for multi-device support
      const bundles = await preKeyService.getAllDevicePreKeyBundles(userId);

      if (bundles.length === 0) {
        return reply.code(404).send({
          success: false,
          error: 'No PreKeys available for this user',
        });
      }

      return reply.code(200).send({
        success: true,
        data: {
          userId,
          username,
          devices: bundles,
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

  /**
   * GET /api/keys/status
   * Get PreKey status for current device
   */
  app.get('/api/keys/status', {
    onRequest: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { deviceId } = request.user as any;

      const availableCount = await preKeyService.getAvailablePreKeyCount(deviceId);

      return reply.code(200).send({
        success: true,
        data: {
          availablePreKeys: availableCount,
          shouldRefill: availableCount < 10,
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
