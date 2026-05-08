import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { generateTransferCode as generateTransferCodeUtil, validateTransferCodeFormat, isTransferCodeExpired } from '../utils/transferCodeGenerator';
import * as bcrypt from 'bcryptjs';

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  businessId: z.string().optional(),
  isOwnProject: z.boolean().optional().default(false),
  type: z.enum(['STANDALONE', 'CLUSTER', 'TRANSFERABLE']).optional().default('STANDALONE'),
  ingestUserApiKey: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['SETUP', 'READY', 'HANDED_OVER', 'ACTIVE']).optional(),
  type: z.enum(['STANDALONE', 'CLUSTER', 'TRANSFERABLE']).optional(),
  ingestUserApiKey: z.string().nullable().optional(),
});

const createVendorSchema = z.object({
  name: z.string().min(1).max(200),
  ownerCode: z.string().regex(/^\d{6}$/, 'ownerCode must be a 6-digit code').optional(),
});

const updateVendorSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  ownerCode: z.string().regex(/^\d{6}$/, 'ownerCode must be a 6-digit code').optional(),
  isActive: z.boolean().optional(),
});

export async function createProject(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  if (req.user.role !== 'DEVELOPER' && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Only developers can create projects');
  }

  const data = createProjectSchema.parse(req.body);
  const projectApiKey = `proj_api_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const businessId = data.businessId && data.businessId.trim() !== '' ? data.businessId : null;

  let ingestUserId: string | null = null;
  if (data.ingestUserApiKey && data.ingestUserApiKey.trim()) {
    const ingestUser = await prisma.user.findUnique({
      where: { apiKey: data.ingestUserApiKey.trim() },
      select: { id: true },
    });
    if (!ingestUser) {
      throw new AppError(400, 'Invalid API key. User not found.');
    }
    ingestUserId = ingestUser.id;
  }

  const project = await prisma.project.create({
    data: {
      name: data.name,
      description: data.description || null,
      developerId: req.user.id,
      businessId: businessId,
      isOwnProject: data.isOwnProject ?? false,
      status: 'SETUP',
      type: data.type || 'STANDALONE',
      projectApiKey,
      ingestUserId,
    },
    include: {
      business: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({ success: true, data: project });
}

export async function getProjects(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  let projects;

  if (req.user.role === 'DEVELOPER') {
    projects = await prisma.project.findMany({
      where: { developerId: req.user.id },
      include: {
        business: { select: { id: true, name: true } },
        _count: { select: { vendors: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  } else if (req.user.role === 'BUSINESS_OWNER') {
    const businesses = await prisma.business.findMany({
      where: { ownerId: req.user.id },
      select: { id: true },
    });
    
    projects = await prisma.project.findMany({
      where: { businessId: { in: businesses.map(b => b.id) } },
      include: {
        developer: { select: { id: true, username: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  } else {
    throw new AppError(403, 'Access denied');
  }

  res.json({ success: true, data: projects });
}

export async function getProject(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      business: true,
      developer: { select: { id: true, username: true, email: true } },
      projectPatterns: true,
      vendors: true,
    },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  if (req.user.role === 'DEVELOPER' && project.developerId !== req.user.id) {
    throw new AppError(403, 'Access denied');
  }

  if (req.user.role === 'BUSINESS_OWNER' && project.businessId) {
    const { requireBusinessAccess } = await import('../utils/businessValidator');
    await requireBusinessAccess(req.user.id, project.businessId);
  }

  res.json({ success: true, data: project });
}

export async function updateProject(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;
  const data = updateProjectSchema.parse(req.body);

  const project = await prisma.project.findUnique({ where: { id } });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  if (project.developerId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Only project developer can update project');
  }

  const updateData: any = { ...data };
  delete updateData.ingestUserApiKey;
  
  if (data.ingestUserApiKey !== undefined) {
    if (data.ingestUserApiKey === null || data.ingestUserApiKey === '') {
      updateData.ingestUserId = null;
    } else {
      const ingestUser = await prisma.user.findUnique({
        where: { apiKey: data.ingestUserApiKey.trim() },
        select: { id: true },
      });
      if (!ingestUser) {
        throw new AppError(400, 'Invalid API key. User not found.');
      }
      updateData.ingestUserId = ingestUser.id;
    }
  }

  const updated = await prisma.project.update({
    where: { id },
    data: updateData,
    include: { business: true },
  });

  res.json({ success: true, data: updated });
}

export async function handoverProject(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;
  const { ingestUserApiKey } = z.object({ ingestUserApiKey: z.string().min(1) }).parse(req.body);

  const project = await prisma.project.findUnique({ where: { id } });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  if (project.developerId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Only project developer can handover project');
  }

  const clientUser = await prisma.user.findUnique({
    where: { apiKey: ingestUserApiKey.trim() },
    select: { id: true, email: true, phone: true },
  });

  if (!clientUser) {
    throw new AppError(404, 'Client not found.');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.transaction.updateMany({
    where: { projectId: project.id, createdAt: { gte: today } },
    data: { userId: clientUser.id },
  });

  const updated = await prisma.project.update({
    where: { id },
    data: { ingestUserId: clientUser.id, status: 'HANDED_OVER', handoverDate: new Date() },
    include: { ingestUser: { select: { id: true, email: true, phone: true } } },
  });

  res.json({ success: true, data: updated, message: 'Project handed over successfully.' });
}

export async function getProjectStatus(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, status: true, handoverDate: true, businessId: true, createdAt: true },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  res.json({ success: true, data: project });
}

export async function generateTransferCode(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;
  const { phone } = z.object({ phone: z.string().optional() }).parse(req.body);

  const project = await prisma.project.findUnique({ where: { id } });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  if (project.developerId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Only project developer can generate transfer code');
  }

  if (project.status !== 'READY' && project.status !== 'SETUP') {
    throw new AppError(400, 'Project must be in SETUP or READY status');
  }

  let transferCode = generateTransferCodeUtil();
  let existing = await prisma.project.findUnique({ where: { transferCode } });
  while (existing) {
    transferCode = generateTransferCodeUtil();
    existing = await prisma.project.findUnique({ where: { transferCode } });
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  const updated = await prisma.project.update({
    where: { id },
    data: { transferCode, transferCodeExpiresAt: expiresAt, transferPhone: phone || req.user.phone || null },
    select: { id: true, name: true, transferCode: true, transferCodeExpiresAt: true, transferPhone: true },
  });

  res.json({
    success: true,
    data: { code: updated.transferCode, expiresAt: updated.transferCodeExpiresAt, projectName: updated.name },
    message: 'Transfer code generated successfully.',
  });
}

export async function acceptTransfer(req: Request, res: Response) {
  const { code, username, email, phone, password, businessId } = z.object({
    code: z.string().min(6).max(6),
    username: z.string().min(3).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    password: z.string().min(6).optional(),
    businessId: z.string().optional(),
  }).parse(req.body);

  if (!validateTransferCodeFormat(code)) {
    throw new AppError(400, 'Invalid transfer code format');
  }

  const project = await prisma.project.findUnique({
    where: { transferCode: code },
    include: { projectPatterns: true, developer: { select: { id: true, username: true } } },
  });

  if (!project) {
    throw new AppError(404, 'Invalid transfer code');
  }

  if (isTransferCodeExpired(project.transferCodeExpiresAt)) {
    throw new AppError(400, 'Transfer code has expired.');
  }

  if (project.transferredToUserId) {
    throw new AppError(400, 'This project has already been transferred');
  }

  let user = null;
  if (username || email || phone) {
    user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(username ? [{ username }] : []),
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });
  }

  if (user) {
    if (user.role !== 'BUSINESS_OWNER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      await prisma.user.update({ where: { id: user.id }, data: { role: 'BUSINESS_OWNER' } });
      user.role = 'BUSINESS_OWNER';
    }
  } else {
    if (!password) throw new AppError(400, 'Password is required for new account');
    if (!username && !email && !phone) throw new AppError(400, 'Username, email, or phone is required');

    const hashedPassword = await bcrypt.hash(password, 10);
    const apiKey = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    user = await prisma.user.create({
      data: {
        username: username || null, email: email || null, phone: phone || null,
        password: hashedPassword, role: 'BUSINESS_OWNER', apiKey,
        usageStats: { create: { appRequestsToday: 0, appRequestsMonth: 0, devRequestsToday: 0, devRequestsMonth: 0 } },
      },
    });
  }

  let targetBusinessId = businessId;
  if (!targetBusinessId) {
    const business = await prisma.business.create({
      data: { name: project.name + ' Business', description: 'Business from project: ' + project.name, ownerId: user.id, isActive: true },
    });
    targetBusinessId = business.id;
  } else {
    const business = await prisma.business.findUnique({ where: { id: targetBusinessId } });
    if (!business) throw new AppError(404, 'Business not found');
    if (business.ownerId !== user.id) throw new AppError(403, 'You do not own this business');
  }

  if (project.projectPatterns.length > 0) {
    await prisma.businessPattern.createMany({
      data: project.projectPatterns.map((pp) => ({
        businessId: targetBusinessId, patternId: pp.patternId, institution: pp.institution, isActive: pp.isActive,
      })),
    });
  }

  await prisma.transaction.updateMany({ where: { projectId: project.id }, data: { userId: user.id } });

  const updatedProject = await prisma.project.update({
    where: { id: project.id },
    data: {
      businessId: targetBusinessId, status: 'HANDED_OVER', handoverDate: new Date(),
      transferredToUserId: user.id, transferredAt: new Date(), transferCode: null, transferCodeExpiresAt: null,
    },
    include: { business: { select: { id: true, name: true } } },
  });

  res.json({
    success: true,
    data: { project: updatedProject, user: { id: user.id, username: user.username, email: user.email, phone: user.phone, role: user.role }, business: { id: targetBusinessId } },
    message: 'Project transferred successfully!',
  });
}

export async function getTransferCodeStatus(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, transferCode: true, transferCodeExpiresAt: true, transferPhone: true, transferredToUserId: true, transferredAt: true, status: true, developerId: true },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  if (project.developerId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Access denied');
  }

  const isExpired = project.transferCodeExpiresAt ? isTransferCodeExpired(project.transferCodeExpiresAt) : false;

  res.json({
    success: true,
    data: { hasCode: !!project.transferCode, code: project.transferCode, expiresAt: project.transferCodeExpiresAt, isExpired, isTransferred: !!project.transferredToUserId, transferredAt: project.transferredAt, status: project.status },
  });
}

export async function getProjectStats(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, name: true, developerId: true, projectApiKey: true },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  if (req.user.role === 'DEVELOPER' && project.developerId !== req.user.id) {
    throw new AppError(403, 'Access denied');
  }

  const now = new Date();
  const todayStart = new Date(now.setHours(0, 0, 0, 0));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const where = { projectId: project.id };

  const [transactions, total, statsArray] = await Promise.all([
    prisma.transaction.findMany({
      where, orderBy: { receivedAt: 'desc' }, skip, take: limit,
      include: { pattern: { select: { name: true, bank: true } } },
    }),
    prisma.transaction.count({ where }),
    Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.count({ where: { ...where, receivedAt: { gte: todayStart } } }),
      prisma.transaction.count({ where: { ...where, receivedAt: { gte: monthStart } } }),
      prisma.transaction.aggregate({ where, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { ...where, receivedAt: { gte: todayStart } }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { ...where, receivedAt: { gte: monthStart } }, _sum: { amount: true } }),
      prisma.transaction.count({ where: { ...where, verifiedAt: { not: null } } }),
      prisma.transaction.findMany({ where: { ...where, receivedAt: { gte: thirtyDaysAgo } }, select: { receivedAt: true } }),
    ]),
  ]);

  const dailyMap = new Map<string, number>();
  const dailyTransactions = statsArray[7] as { receivedAt: Date }[];
  dailyTransactions.forEach((txn) => {
    const dateStr = new Date(txn.receivedAt).toISOString().split('T')[0];
    dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + 1);
  });

  const allDays: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const dateStr = date.toISOString().split('T')[0];
    allDays.push({ date: dateStr, count: dailyMap.get(dateStr) || 0 });
  }

  res.json({
    success: true,
    data: {
      project: { id: project.id, name: project.name, projectApiKey: project.projectApiKey },
      stats: {
        total: statsArray[0] as number, today: statsArray[1] as number, thisMonth: statsArray[2] as number,
        totalAmount: (statsArray[3] as any)?._sum?.amount || 0, todayAmount: (statsArray[4] as any)?._sum?.amount || 0,
        monthAmount: (statsArray[5] as any)?._sum?.amount || 0, verified: statsArray[6] as number, daily: allDays,
      },
      transactions: { data: transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    },
  });
}

export async function getProjectClusterMembers(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id: projectId } = req.params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      type: true,
      developerId: true,
      ingestUserId: true,
    },
  });

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  if (project.developerId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Access denied');
  }

  if (project.type !== 'CLUSTER') {
    return res.json({
      success: true,
      data: {
        project: {
          id: project.id,
          name: project.name,
          type: project.type,
        },
        summary: {
          totalMembers: 0,
          activeMembers: 0,
          totalProcessedTransactions: 0,
          totalProcessedAmount: 0,
        },
        members: [],
      },
    });
  }

  const vendors = await prisma.vendor.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
  });

  const ownerCodes = vendors.map((v) => v.phone).filter((value): value is string => Boolean(value));

  const clusterRequests = ownerCodes.length
    ? await prisma.clusterRequest.findMany({
        where: {
          projectId,
          ownerCode: { in: ownerCodes },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          ownerCode: true,
          ownerId: true,
          status: true,
          createdAt: true,
          respondedAt: true,
          owner: {
            select: {
              id: true,
              username: true,
              phone: true,
              ownerCode: true,
            },
          },
        },
      })
    : [];

  const latestRequestByOwnerCode = new Map<string, (typeof clusterRequests)[number]>();
  for (const request of clusterRequests) {
    if (!latestRequestByOwnerCode.has(request.ownerCode)) {
      latestRequestByOwnerCode.set(request.ownerCode, request);
    }
  }

  const txByUser = await prisma.transaction.groupBy({
    by: ['userId'],
    where: { projectId },
    _count: { _all: true },
    _sum: { amount: true },
    _max: { receivedAt: true },
  });

  const txByUserMap = new Map<string, (typeof txByUser)[number]>();
  for (const row of txByUser) {
    txByUserMap.set(row.userId, row);
  }

  const members = vendors.map((vendor) => {
    const ownerCode = vendor.phone || null;
    const latestRequest = ownerCode ? latestRequestByOwnerCode.get(ownerCode) : undefined;
    const ownerId = latestRequest?.ownerId || null;
    const txRow = ownerId ? txByUserMap.get(ownerId) : undefined;

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      ownerId,
      ownerCode,
      ownerUsername: latestRequest?.owner?.username || null,
      ownerPhone: latestRequest?.owner?.phone || null,
      requestId: latestRequest?.id || null,
      requestStatus: latestRequest?.status || null,
      linkedAt: latestRequest?.respondedAt || latestRequest?.createdAt || null,
      isTrackingActive: latestRequest?.status === 'ACCEPTED' && project.ingestUserId === ownerId,
      processedTransactions: txRow?._count?._all || 0,
      processedAmount: txRow?._sum?.amount || 0,
      lastTransactionAt: txRow?._max?.receivedAt || null,
      canDelete: true,
      isVendorActive: vendor.isActive,
      vendorCreatedAt: vendor.createdAt,
    };
  });

  const summary = members.reduce(
    (acc, member) => {
      acc.totalMembers += 1;
      acc.totalProcessedTransactions += member.processedTransactions;
      acc.totalProcessedAmount += member.processedAmount;
      if (member.isTrackingActive) {
        acc.activeMembers += 1;
      }
      return acc;
    },
    {
      totalMembers: 0,
      activeMembers: 0,
      totalProcessedTransactions: 0,
      totalProcessedAmount: 0,
    }
  );

  return res.json({
    success: true,
    data: {
      project: {
        id: project.id,
        name: project.name,
        type: project.type,
      },
      summary,
      members,
    },
  });
}
// Vendor CRUD
export async function createVendor(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id: projectId } = req.params;
  const data = createVendorSchema.parse(req.body);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError(404, 'Project not found');
  if (project.developerId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Access denied');
  }

  let owner: { id: string; role: string } | null = null;
  if (project.type === 'CLUSTER') {
    if (!data.ownerCode) {
      throw new AppError(400, 'Owner ID is required for cluster vendors');
    }

    owner = await prisma.user.findUnique({
      where: { ownerCode: data.ownerCode },
      select: { id: true, role: true },
    });

    if (!owner) {
      throw new AppError(404, 'Owner ID not found');
    }

    if (!['BUSINESS_OWNER', 'ADMIN', 'SUPER_ADMIN'].includes(owner.role)) {
      throw new AppError(400, 'Owner ID does not belong to a business owner account');
    }
  }

  const existingVendor = data.ownerCode
    ? await prisma.vendor.findFirst({
        where: {
          projectId,
          phone: data.ownerCode,
        },
      })
    : null;

  const vendor = existingVendor
    ? await prisma.vendor.update({
        where: { id: existingVendor.id },
        data: {
          name: data.name,
          isActive: true,
        },
      })
    : await prisma.vendor.create({
        data: {
          projectId,
          name: data.name,
          // Keep owner ID in legacy phone column for backward compatibility until schema migration.
          phone: data.ownerCode || null,
        },
      });

  let clusterRequestId: string | null = null;
  let clusterRequestStatus: string | null = null;
  if (project.type === 'CLUSTER' && owner && data.ownerCode) {
    const latestClusterRequest = await prisma.clusterRequest.findFirst({
      where: {
        developerId: project.developerId,
        ownerId: owner.id,
        projectId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
      },
    });

    if (latestClusterRequest?.status === 'ACCEPTED' && project.ingestUserId === owner.id) {
      clusterRequestId = latestClusterRequest.id;
      clusterRequestStatus = latestClusterRequest.status;
    } else {
      await prisma.clusterRequest.updateMany({
        where: {
          developerId: project.developerId,
          ownerId: owner.id,
          projectId,
          status: 'PENDING',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        data: {
          status: 'EXPIRED',
          respondedAt: new Date(),
        },
      });

      const clusterRequest = await prisma.clusterRequest.create({
        data: {
          developerId: project.developerId,
          ownerId: owner.id,
          ownerCode: data.ownerCode,
          projectId,
          message: `Vendor link request for ${data.name}`,
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
          status: 'PENDING',
        },
        select: { id: true, status: true },
      });
      clusterRequestId = clusterRequest.id;
      clusterRequestStatus = clusterRequest.status;
    }
  }

  res.status(201).json({
    success: true,
    data: {
      ...vendor,
      ownerCode: vendor.phone,
      clusterRequestId,
      clusterRequestStatus,
    },
  });
}

export async function getVendors(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id: projectId } = req.params;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError(404, 'Project not found');
  if (project.developerId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Access denied');
  }

  const vendors = await prisma.vendor.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  const ownerCodes = vendors.map((vendor) => vendor.phone).filter((value): value is string => Boolean(value));
  const clusterRequests = ownerCodes.length
    ? await prisma.clusterRequest.findMany({
        where: {
          projectId,
          ownerCode: { in: ownerCodes },
        },
        select: {
          id: true,
          ownerCode: true,
          status: true,
          respondedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  const latestRequestByOwnerCode = new Map<string, (typeof clusterRequests)[number]>();
  for (const request of clusterRequests) {
    if (!latestRequestByOwnerCode.has(request.ownerCode)) {
      latestRequestByOwnerCode.set(request.ownerCode, request);
    }
  }

  res.json({
    success: true,
    data: vendors.map((vendor) => ({
      ...vendor,
      ownerCode: vendor.phone,
      clusterRequestId: vendor.phone ? latestRequestByOwnerCode.get(vendor.phone)?.id ?? null : null,
      clusterRequestStatus: vendor.phone ? latestRequestByOwnerCode.get(vendor.phone)?.status ?? null : null,
      clusterRequestRespondedAt: vendor.phone ? latestRequestByOwnerCode.get(vendor.phone)?.respondedAt ?? null : null,
      clusterRequestCreatedAt: vendor.phone ? latestRequestByOwnerCode.get(vendor.phone)?.createdAt ?? null : null,
    })),
  });
}

export async function updateVendor(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id: projectId, vendorId } = req.params;
  const data = updateVendorSchema.parse(req.body);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError(404, 'Project not found');
  if (project.developerId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Access denied');
  }

  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, projectId } });
  if (!vendor) throw new AppError(404, 'Vendor not found');

  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      name: data.name,
      isActive: data.isActive,
      phone: data.ownerCode,
    },
  });

  res.json({
    success: true,
    data: {
      ...updated,
      ownerCode: updated.phone,
    },
  });
}

export async function deleteVendor(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id: projectId, vendorId } = req.params;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new AppError(404, 'Project not found');
  if (project.developerId !== req.user.id && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError(403, 'Access denied');
  }

  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, projectId } });
  if (!vendor) throw new AppError(404, 'Vendor not found');

  await prisma.$transaction(async (tx) => {
    if (project.type === 'CLUSTER' && vendor.phone) {
      const latestAcceptedRequest = await tx.clusterRequest.findFirst({
        where: {
          projectId,
          ownerCode: vendor.phone,
          status: 'ACCEPTED',
        },
        orderBy: { createdAt: 'desc' },
        select: { ownerId: true },
      });

      if (latestAcceptedRequest && project.ingestUserId === latestAcceptedRequest.ownerId) {
        await tx.project.update({
          where: { id: projectId },
          data: { ingestUserId: null },
        });
      }

      await tx.clusterRequest.deleteMany({
        where: {
          projectId,
          ownerCode: vendor.phone,
        },
      });
    }

    await tx.vendor.delete({ where: { id: vendorId } });
  });

  res.json({ success: true, message: 'Vendor deleted' });
}
