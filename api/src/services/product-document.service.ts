import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
// Catalogs/brochures run larger than lead attachments (5MB); allow up to 25MB.
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/** Fields safe to return to clients — deliberately excludes storagePath. */
const documentSelect = {
  id: true,
  title: true,
  category: true,
  productTags: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  version: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { id: true, name: true } },
} as const;

function normalizeTags(tags: string[] | undefined): string[] {
  return (tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 20);
}

export async function listProductDocuments(
  organizationId: string,
  opts: { category?: string; q?: string; includeInactive?: boolean },
) {
  return prisma.productDocument.findMany({
    where: {
      organizationId,
      ...(opts.includeInactive ? {} : { isActive: true }),
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.q ? { title: { contains: opts.q, mode: 'insensitive' as const } } : {}),
    },
    orderBy: [{ category: 'asc' }, { title: 'asc' }],
    select: documentSelect,
  });
}

/** Returns the raw row (incl. storagePath) for streaming — callers must not leak storagePath. */
export async function getProductDocumentFile(organizationId: string, id: string) {
  return prisma.productDocument.findFirst({
    where: { id, organizationId, isActive: true },
  });
}

export async function createProductDocument(
  organizationId: string,
  uploadedById: string,
  input: {
    title: string;
    category?: string;
    productTags?: string[];
    fileName: string;
    mimeType: string;
    dataBase64: string;
  },
) {
  let buf: Buffer;
  try {
    buf = Buffer.from(input.dataBase64, 'base64');
  } catch {
    return { error: 'INVALID_BASE64' as const };
  }
  if (buf.length === 0 || buf.length > MAX_DOCUMENT_BYTES) {
    return { error: 'FILE_TOO_LARGE' as const };
  }

  const safeName = input.fileName.replace(/[^\w.\-()+ ]/g, '_').slice(0, 200);
  const storageName = `${randomUUID()}-${safeName}`;
  const dir = path.join(UPLOAD_DIR, organizationId, 'product-documents');
  await mkdir(dir, { recursive: true });
  const storagePath = path.join(dir, storageName);
  await writeFile(storagePath, buf);

  const document = await prisma.productDocument.create({
    data: {
      organizationId,
      uploadedById,
      title: input.title.trim().slice(0, 200),
      category: input.category?.trim() || null,
      productTags: normalizeTags(input.productTags),
      fileName: safeName,
      mimeType: input.mimeType,
      sizeBytes: buf.length,
      storagePath,
    },
    select: documentSelect,
  });
  return { document };
}

export async function updateProductDocument(
  organizationId: string,
  id: string,
  patch: { title?: string; category?: string | null; productTags?: string[]; isActive?: boolean },
) {
  const existing = await prisma.productDocument.findFirst({ where: { id, organizationId } });
  if (!existing) return null;

  const document = await prisma.productDocument.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 200) } : {}),
      ...(patch.category !== undefined ? { category: patch.category?.trim() || null } : {}),
      ...(patch.productTags !== undefined ? { productTags: normalizeTags(patch.productTags) } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
    },
    select: documentSelect,
  });
  return { document };
}

export async function deactivateProductDocument(organizationId: string, id: string) {
  const existing = await prisma.productDocument.findFirst({ where: { id, organizationId } });
  if (!existing) return null;
  await prisma.productDocument.update({ where: { id }, data: { isActive: false } });
  return { ok: true as const };
}
