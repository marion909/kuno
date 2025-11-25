import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const addReactionSchema = z.object({
  messageId: z.string(),
  emoji: z.string().max(10),
});

const removeReactionSchema = z.object({
  messageId: z.string(),
  emoji: z.string().max(10),
});

export async function reactionRoutes(app: FastifyInstance) {
  /**
   * POST /api/reactions
   * Add a reaction to a message
   */
  app.post('/api/reactions', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;
      const body = addReactionSchema.parse(request.body);

      // Insert reaction (will fail if duplicate due to UNIQUE constraint)
      await app.pg.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji)
         VALUES ($1, $2, $3)
         ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
        [body.messageId, userId, body.emoji]
      );

      // Get all reactions for this message
      const result = await app.pg.query(
        `SELECT mr.emoji, COUNT(*) as count, 
         ARRAY_AGG(u.username) as users
         FROM message_reactions mr
         JOIN users u ON mr.user_id = u.id
         WHERE mr.message_id = $1
         GROUP BY mr.emoji`,
        [body.messageId]
      );

      reply.send({
        success: true,
        reactions: result.rows,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      app.log.error({ error }, 'Error adding reaction');
      reply.status(500).send({
        success: false,
        error: 'Failed to add reaction',
        message: errorMessage,
      });
    }
  });

  /**
   * DELETE /api/reactions
   * Remove a reaction from a message
   */
  app.delete('/api/reactions', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request.user as any).userId;
      const body = removeReactionSchema.parse(request.body);

      await app.pg.query(
        `DELETE FROM message_reactions
         WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
        [body.messageId, userId, body.emoji]
      );

      // Get remaining reactions for this message
      const result = await app.pg.query(
        `SELECT mr.emoji, COUNT(*) as count,
         ARRAY_AGG(u.username) as users
         FROM message_reactions mr
         JOIN users u ON mr.user_id = u.id
         WHERE mr.message_id = $1
         GROUP BY mr.emoji`,
        [body.messageId]
      );

      reply.send({
        success: true,
        reactions: result.rows,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      app.log.error({ error }, 'Error removing reaction');
      reply.status(500).send({
        success: false,
        error: 'Failed to remove reaction',
        message: errorMessage,
      });
    }
  });

  /**
   * GET /api/reactions/:messageId
   * Get all reactions for a message
   */
  app.get<{ Params: { messageId: string } }>('/api/reactions/:messageId', {
    onRequest: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { messageId } = request.params;

      const result = await app.pg.query(
        `SELECT mr.emoji, COUNT(*) as count,
         ARRAY_AGG(u.username) as users
         FROM message_reactions mr
         JOIN users u ON mr.user_id = u.id
         WHERE mr.message_id = $1
         GROUP BY mr.emoji`,
        [messageId]
      );

      reply.send({
        success: true,
        messageId,
        reactions: result.rows,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      app.log.error({ error }, 'Error fetching reactions');
      reply.status(500).send({
        success: false,
        error: 'Failed to fetch reactions',
        message: errorMessage,
      });
    }
  });
}
