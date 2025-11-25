import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const createBackupSchema = z.object({
  encryptedKeys: z.string(),
  salt: z.string(),
});

const restoreBackupSchema = z.object({
  // No body needed, user is from JWT token
});

export async function backupRoutes(app: FastifyInstance) {
  /**
   * POST /api/backup/create
   * Create or update encrypted key backup
   */
  app.post('/api/backup/create', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;
      const body = createBackupSchema.parse(request.body);

      // Check if backup already exists
      const existing = await app.pg.query(
        'SELECT id FROM key_backups WHERE user_id = $1',
        [userId]
      );

      if (existing.rows.length > 0) {
        // Update existing backup
        await app.pg.query(
          `UPDATE key_backups 
           SET encrypted_keys = $1, salt = $2, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $3`,
          [body.encryptedKeys, body.salt, userId]
        );
      } else {
        // Create new backup
        await app.pg.query(
          `INSERT INTO key_backups (user_id, encrypted_keys, salt)
           VALUES ($1, $2, $3)`,
          [userId, body.encryptedKeys, body.salt]
        );
      }

      reply.send({
        success: true,
        message: 'Backup created successfully',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      app.log.error({ error }, 'Error creating backup');
      reply.status(500).send({
        success: false,
        error: 'Failed to create backup',
        message: errorMessage,
      });
    }
  });

  /**
   * GET /api/backup/restore
   * Get encrypted key backup for restoration
   */
  app.get('/api/backup/restore', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;

      const result = await app.pg.query(
        `SELECT encrypted_keys, salt, created_at, updated_at 
         FROM key_backups 
         WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'No backup found',
        });
      }

      const backup = result.rows[0];
      
      reply.send({
        success: true,
        data: {
          encryptedKeys: backup.encrypted_keys,
          salt: backup.salt,
          createdAt: backup.created_at,
          updatedAt: backup.updated_at,
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      app.log.error({ error }, 'Error restoring backup');
      reply.status(500).send({
        success: false,
        error: 'Failed to restore backup',
        message: errorMessage,
      });
    }
  });

  /**
   * GET /api/backup/status
   * Check if user has a backup
   */
  app.get('/api/backup/status', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;

      const result = await app.pg.query(
        `SELECT created_at, updated_at 
         FROM key_backups 
         WHERE user_id = $1`,
        [userId]
      );

      const hasBackup = result.rows.length > 0;

      reply.send({
        success: true,
        hasBackup,
        backup: hasBackup ? {
          createdAt: result.rows[0].created_at,
          updatedAt: result.rows[0].updated_at,
        } : null,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      app.log.error({ error }, 'Error checking backup status');
      reply.status(500).send({
        success: false,
        error: 'Failed to check backup status',
        message: errorMessage,
      });
    }
  });

  /**
   * DELETE /api/backup/delete
   * Delete encrypted key backup
   */
  app.delete('/api/backup/delete', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;

      const result = await app.pg.query(
        'DELETE FROM key_backups WHERE user_id = $1 RETURNING id',
        [userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'No backup found',
        });
      }

      reply.send({
        success: true,
        message: 'Backup deleted successfully',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      app.log.error({ error }, 'Error deleting backup');
      reply.status(500).send({
        success: false,
        error: 'Failed to delete backup',
        message: errorMessage,
      });
    }
  });
}
