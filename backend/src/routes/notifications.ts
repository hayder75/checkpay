import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

// Protected routes
router.use(authenticate as any);

// Get notifications with pagination
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 per page
  const skip = (page - 1) * limit;
  const unreadOnly = req.query.unreadOnly === 'true';

  const where: any = { userId };
  if (unreadOnly) {
    where.isRead = false;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  res.json({
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + notifications.length < total,
    },
  });
}));

// Get unread count
router.get('/unread-count', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const count = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
  res.json({ count });
}));

// Mark as read
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  
  const notification = await prisma.notification.findFirst({
    where: { id, userId },
  });

  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  res.json(updated);
}));

// Mark all as read
router.patch('/mark-all-read', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
    },
  });

  res.json({ 
    success: true,
    count: result.count,
  });
}));

// Batch mark as read
router.patch('/batch-read', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error('ids must be a non-empty array');
  }

  const result = await prisma.notification.updateMany({
    where: {
      id: { in: ids },
      userId, // Ensure user owns these notifications
    },
    data: {
      isRead: true,
    },
  });

  res.json({
    success: true,
    count: result.count,
  });
}));

// Delete notification
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { id } = req.params;
  
  const notification = await prisma.notification.findFirst({
    where: { id, userId },
  });

  if (!notification) {
    res.status(404);
    throw new Error('Notification not found');
  }

  await prisma.notification.delete({
    where: { id },
  });

  res.json({ success: true });
}));

// Register push token
router.post('/push-token', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { token, platform } = req.body;

  if (!token) {
    res.status(400);
    throw new Error('Token is required');
  }

  const pushToken = await prisma.pushToken.upsert({
    where: { token },
    update: { userId, platform },
    create: { userId, token, platform },
  });

  res.json(pushToken);
}));

// Unregister push token
router.delete('/push-token/:token', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const { token } = req.params;

  const pushToken = await prisma.pushToken.findFirst({
    where: { token, userId },
  });

  if (!pushToken) {
    res.status(404);
    throw new Error('Push token not found');
  }

  await prisma.pushToken.delete({
    where: { id: pushToken.id },
  });

  res.json({ success: true });
}));

export default router;
