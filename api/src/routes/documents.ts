import { createReadStream } from 'node:fs';
import type { FastifyPluginAsync } from 'fastify';
import {
  listProductDocuments,
  getProductDocumentFile,
  createProductDocument,
  updateProductDocument,
  deactivateProductDocument,
} from '../services/product-document.service.js';

function isManager(role: string) {
  return role === 'MANAGER' || role === 'ADMIN';
}

export const documentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', app.authenticate);

  // List — any authenticated user (reps browse). Managers may include inactive.
  app.get('/', async (request) => {
    const { organizationId, role } = request.user;
    const q = request.query as { category?: string; q?: string; includeInactive?: string };
    const documents = await listProductDocuments(organizationId, {
      category: q.category?.trim() || undefined,
      q: q.q?.trim() || undefined,
      includeInactive: isManager(role) && q.includeInactive === 'true',
    });
    return { documents };
  });

  // Stream the file — any authenticated user in the org.
  app.get('/:id/file', async (request, reply) => {
    const { organizationId } = request.user;
    const { id } = request.params as { id: string };
    const doc = await getProductDocumentFile(organizationId, id);
    if (!doc) return reply.status(404).send({ error: 'Document not found' });
    reply.header('Content-Type', doc.mimeType || 'application/octet-stream');
    reply.header('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
    return reply.send(createReadStream(doc.storagePath));
  });

  // Upload — manager/admin only, enforced server-side (see R3 finding).
  app.post('/', async (request, reply) => {
    const { organizationId, sub: userId, role } = request.user;
    if (!isManager(role)) return reply.status(403).send({ error: 'Manager access required' });
    const body = (request.body ?? {}) as {
      title?: string;
      category?: string;
      productTags?: string[];
      fileName?: string;
      mimeType?: string;
      dataBase64?: string;
    };
    if (!body.title?.trim() || !body.fileName?.trim() || !body.dataBase64) {
      return reply.status(400).send({ error: 'title, fileName and dataBase64 are required' });
    }
    const result = await createProductDocument(organizationId, userId, {
      title: body.title,
      category: body.category,
      productTags: body.productTags,
      fileName: body.fileName,
      mimeType: body.mimeType || 'application/octet-stream',
      dataBase64: body.dataBase64,
    });
    if ('error' in result) {
      return reply
        .status(result.error === 'FILE_TOO_LARGE' ? 413 : 400)
        .send({ error: result.error });
    }
    return reply.status(201).send(result);
  });

  // Update metadata (rename / re-tag / activate-deactivate) — manager/admin only.
  app.patch('/:id', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManager(role)) return reply.status(403).send({ error: 'Manager access required' });
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      title?: string;
      category?: string | null;
      productTags?: string[];
      isActive?: boolean;
    };
    const result = await updateProductDocument(organizationId, id, body);
    if (!result) return reply.status(404).send({ error: 'Document not found' });
    return result;
  });

  // Soft delete (isActive = false) — manager/admin only.
  app.delete('/:id', async (request, reply) => {
    const { organizationId, role } = request.user;
    if (!isManager(role)) return reply.status(403).send({ error: 'Manager access required' });
    const { id } = request.params as { id: string };
    const result = await deactivateProductDocument(organizationId, id);
    if (!result) return reply.status(404).send({ error: 'Document not found' });
    return result;
  });
};
