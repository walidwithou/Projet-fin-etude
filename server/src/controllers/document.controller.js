import { prisma } from '../db/prisma.js';
import { getSignedDownloadUrl, deleteFile } from '../services/storage.service.js';

/**
 * List documents with pagination and filters.
 * GET /api/admin/documents
 */
export async function listDocuments(req, res, next) {
  try {
    const { page = 1, limit = 20, therapistId, documentType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (therapistId) where.ownerId = therapistId;
    if (documentType) where.documentType = documentType;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          therapist: {
            select: {
              user: { select: { name: true, email: true } },
            },
          },
        },
      }),
      prisma.document.count({ where }),
    ]);

    res.json({
      success: true,
      data: documents.map(doc => ({
        id: doc.id,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        documentType: doc.documentType,
        storageProvider: doc.storageProvider,
        createdAt: doc.createdAt,
        therapist: doc.therapist ? {
          name: doc.therapist.user.name,
          email: doc.therapist.user.email,
        } : null,
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single document metadata.
 * GET /api/admin/documents/:id
 */
export async function getDocument(req, res, next) {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        therapist: {
          select: {
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    res.json({ success: true, data: doc });
  } catch (error) {
    next(error);
  }
}

/**
 * Generate a Filebase presigned download URL.
 * GET /api/admin/documents/:id/download
 */
export async function getDocumentDownloadUrl(req, res, next) {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const signedUrl = await getSignedDownloadUrl(doc.objectKey, {
      bucket: doc.bucketName,
      filename: doc.originalName,
      expiresIn: parseInt(process.env.SIGNED_URL_EXPIRY_SECONDS || '3600', 10),
    });

    // Audit log the download
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        actorRole: 'admin',
        action: 'document.downloaded',
        resourceType: 'document',
        resourceId: doc.id,
        newValue: { objectKey: doc.objectKey },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({
      success: true,
      data: {
        downloadUrl: signedUrl,
        expiresAt: new Date(Date.now() + parseInt(process.env.SIGNED_URL_EXPIRY_SECONDS || '3600') * 1000).toISOString(),
        filename: doc.originalName,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a document (from Filebase + database).
 * DELETE /api/admin/documents/:id
 */
export async function deleteDocument(req, res, next) {
  try {
    const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Delete from Filebase
    await deleteFile(doc.objectKey, doc.bucketName);

    // Delete from database
    await prisma.document.delete({ where: { id: doc.id } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        actorRole: 'admin',
        action: 'document.deleted',
        resourceType: 'document',
        resourceId: doc.id,
        newValue: { objectKey: doc.objectKey },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    next(error);
  }
}