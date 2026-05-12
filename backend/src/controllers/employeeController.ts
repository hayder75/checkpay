import { Response } from 'express';
import { z } from 'zod';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { requireBusinessOwnership } from '../utils/businessValidator';
import { generateAccessCode, generateQRCode, validateAccessCodeFormat, parseQRCodeData } from '../utils/accessCodeGenerator';
import { generateApiKey } from '../utils/generateApiKey';

const inviteEmployeeSchema = z.object({
  name: z.string().min(1).max(200),
  expiresInHours: z.number().optional().default(24),
});

const registerEmployeeSchema = z.object({
  code: z.string().optional(),
  qrData: z.string().optional(),
  name: z.string().min(1).max(200).optional(),
  // Optional: if not authenticated, allow creating account
  username: z.string().min(3).max(30).optional(),
  phone: z.string().min(10).optional(),
  password: z.string().min(6).optional(),
  country: z.string().optional(),
}).refine(data => data.code || data.qrData, {
  message: 'Either code or qrData is required',
});

/**
 * Invite employee (generate access code/QR)
 */
export async function inviteEmployee(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id: businessId } = req.params;
  const data = inviteEmployeeSchema.parse(req.body);

  // Require business ownership
  await requireBusinessOwnership(req.user.id, businessId);

  // Generate access code
  let code = generateAccessCode();
  let codeExists = await prisma.accessCode.findUnique({ where: { code } });
  while (codeExists) {
    code = generateAccessCode();
    codeExists = await prisma.accessCode.findUnique({ where: { code } });
  }

  // Calculate expiration
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + data.expiresInHours);

  // Generate QR code
  const qrCodeDataUrl = await generateQRCode({
    businessId,
    code,
    expiresAt,
  });

  // Save access code
  const accessCode = await prisma.accessCode.create({
    data: {
      businessId,
      code,
      qrCode: qrCodeDataUrl,
      expiresAt,
    },
  });

  res.status(201).json({
    success: true,
    data: {
      code,
      qrCode: qrCodeDataUrl,
      expiresAt,
      accessCodeId: accessCode.id,
    },
  });
}

/**
 * Get all employees for a business
 */
export async function getEmployees(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id: businessId } = req.params;

  // Validate access
  const { requireBusinessAccess } = await import('../utils/businessValidator');
  await requireBusinessAccess(req.user.id, businessId);

  const employees = await prisma.employee.findMany({
    where: {
      businessId,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
        },
      },
      _count: {
        select: {
          transactions: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  res.json({
    success: true,
    data: employees,
  });
}

/**
 * Get single employee
 */
export async function getEmployee(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id: businessId, employeeId } = req.params;

  // Validate access
  const { requireBusinessAccess } = await import('../utils/businessValidator');
  await requireBusinessAccess(req.user.id, businessId);

  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      businessId,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
        },
      },
      _count: {
        select: {
          transactions: true,
        },
      },
    },
  });

  if (!employee) {
    throw new AppError(404, 'Employee not found');
  }

  res.json({
    success: true,
    data: employee,
  });
}

/**
 * Update employee
 */
export async function updateEmployee(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id: businessId, employeeId } = req.params;
  const data = z.object({
    name: z.string().min(1).max(200).optional(),
    isActive: z.boolean().optional(),
    allowAccessAllTransactions: z.boolean().optional(),
  }).parse(req.body);

  // Require business ownership
  await requireBusinessOwnership(req.user.id, businessId);

  const employee = await prisma.employee.update({
    where: { id: employeeId },
    data,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  res.json({
    success: true,
    data: employee,
  });
}

/**
 * Remove employee
 */
export async function removeEmployee(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id: businessId, employeeId } = req.params;

  // Require business ownership
  await requireBusinessOwnership(req.user.id, businessId);

  await prisma.employee.update({
    where: { id: employeeId },
    data: { isActive: false },
  });

  res.json({
    success: true,
    message: 'Employee removed successfully',
  });
}

/**
 * Reauthorize employee (generate login code/QR for existing employee)
 */
export async function reauthorizeEmployee(req: AuthRequest, res: Response) {
  if (!req.user) {
    throw new AppError(401, 'Not authenticated');
  }

  const { id: businessId, employeeId } = req.params;
  const data = z.object({
    expiresInHours: z.number().optional().default(24),
  }).parse(req.body);

  // Require business ownership
  await requireBusinessOwnership(req.user.id, businessId);

  // Verify employee exists and belongs to this business
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, businessId },
  });

  if (!employee) {
    throw new AppError(404, 'Employee not found');
  }

  // Generate access code
  let code = generateAccessCode();
  let codeExists = await prisma.accessCode.findUnique({ where: { code } });
  while (codeExists) {
    code = generateAccessCode();
    codeExists = await prisma.accessCode.findUnique({ where: { code } });
  }

  // Calculate expiration
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + data.expiresInHours);

  // Generate QR code
  const qrCodeDataUrl = await generateQRCode({
    businessId,
    code,
    expiresAt,
    employeeId, // Include employeeId in QR data for faster lookup if needed
  });

  // Save access code with targetEmployeeId
  const accessCode = await prisma.accessCode.create({
    data: {
      businessId,
      code,
      qrCode: qrCodeDataUrl,
      expiresAt,
      targetEmployeeId: employeeId,
    },
  });

  res.status(201).json({
    success: true,
    data: {
      code,
      qrCode: qrCodeDataUrl,
      expiresAt,
      accessCodeId: accessCode.id,
    },
  });
}

/**
 * Register employee with code/QR
 * Can work with or without authentication:
 * - If authenticated: uses existing user account
 * - If not authenticated: creates new user account first
 */
export async function registerEmployee(req: AuthRequest, res: Response) {
  const data = registerEmployeeSchema.parse(req.body);
  
  let businessId: string;
  let code: string;
  let targetEmployeeId: string | null = null;

  // 1. Resolve Access Code / QR Data first
  if (data.qrData) {
    const qrData = parseQRCodeData(data.qrData);
    if (!qrData) {
      throw new AppError(400, 'Invalid QR code data');
    }
    businessId = qrData.businessId;
    code = qrData.code;
    // Note: parseQRCodeData doesn't currently return employeeId, but we can check the DB
  } else if (data.code) {
    code = data.code;
    if (!validateAccessCodeFormat(code)) {
      throw new AppError(400, 'Invalid access code format');
    }
  } else {
    throw new AppError(400, 'Either code or qrData is required');
  }

  // 2. Find access code in database
  const accessCode = await prisma.accessCode.findUnique({
    where: { code },
    include: { business: true },
  });

  if (!accessCode) {
    throw new AppError(404, 'Access code not found');
  }

  if (accessCode.isUsed) {
    throw new AppError(400, 'Access code already used');
  }

  if (accessCode.expiresAt && accessCode.expiresAt < new Date()) {
    throw new AppError(400, 'Access code expired');
  }

  businessId = accessCode.businessId;
  targetEmployeeId = accessCode.targetEmployeeId;

  // 3. RE-AUTHORIZATION LOGIC (Priority)
  // If this code is targeted at a specific employee, we log them in directly
  if (targetEmployeeId) {
    const targetEmployee = await prisma.employee.findUnique({
      where: { id: targetEmployeeId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!targetEmployee) {
      throw new AppError(404, 'Target employee not found');
    }

    // Update employee name if provided
    if (data.name && data.name !== targetEmployee.name) {
      await prisma.employee.update({
        where: { id: targetEmployee.id },
        data: { name: data.name },
      });
    }

    // Generate token for the target employee's user
    const jwtSecret = process.env.JWT_SECRET || 'test-secret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign({ userId: targetEmployee.userId }, jwtSecret, { expiresIn } as SignOptions);

    // Mark access code as used
    await prisma.accessCode.update({
      where: { code },
      data: {
        isUsed: true,
        usedBy: targetEmployee.id,
        usedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      data: {
        employee: targetEmployee,
        token,
        userId: targetEmployee.userId,
      },
      message: 'Logged in successfully',
    });
  }

  // 4. Handle User Account (Existing or New)
  let userId: string;
  let isNewUser = false;

  if (req.user) {
    userId = req.user.id;
  } else {
    // Not authenticated - need to create account first
    // For general registration, we still need username/phone
    if (!data.username && !data.phone) {
      throw new AppError(400, 'Please provide username or phone to create an account');
    }
    if (!data.password) {
      throw new AppError(400, 'Password is required to create an account');
    }

    // Check if username/phone already exists
    if (data.username) {
      const existing = await prisma.user.findUnique({ 
        where: { username: data.username },
      });
      if (existing) {
        throw new AppError(400, 'Username already taken. Please choose another.');
      }
    }

    if (data.phone) {
      const existing = await prisma.user.findUnique({ 
        where: { phone: data.phone },
      });
      if (existing) {
        throw new AppError(400, 'Phone number already registered.');
      }
    }

    // Generate API key
    let apiKey = generateApiKey();
    let keyExists = await prisma.user.findUnique({ where: { apiKey } });
    while (keyExists) {
      apiKey = generateApiKey();
      keyExists = await prisma.user.findUnique({ where: { apiKey } });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user account
    const newUser = await prisma.user.create({
      data: {
        username: data.username || null,
        phone: data.phone || null,
        password: hashedPassword,
        country: data.country || null,
        role: 'EMPLOYEE',
        apiKey,
        usageStats: {
          create: {
            appRequestsToday: 0,
            appRequestsMonth: 0,
            devRequestsToday: 0,
            devRequestsMonth: 0,
          },
        },
      },
    });

    userId = newUser.id;
    isNewUser = true;
  }

  // 5. Check if user is already an employee
  const existingEmployee = await prisma.employee.findFirst({
    where: {
      userId,
      businessId,
    },
  });

  if (existingEmployee) {
    // If name provided, update it
    if (data.name && data.name !== existingEmployee.name) {
      await prisma.employee.update({
        where: { id: existingEmployee.id },
        data: { name: data.name },
      });
    }

    // Generate token for the existing employee's user
    const jwtSecret = process.env.JWT_SECRET || 'test-secret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign({ userId: existingEmployee.userId }, jwtSecret, { expiresIn } as SignOptions);

    // Mark access code as used
    if (data.code) {
      await prisma.accessCode.update({
        where: { code },
        data: {
          isUsed: true,
          usedBy: existingEmployee.id,
          usedAt: new Date(),
        },
      });
    }

    return res.json({
      success: true,
      data: {
        employee: existingEmployee,
        token,
        userId: existingEmployee.userId,
      },
      message: 'Logged in successfully',
    });
  }

  // Create employee
  const employee = await prisma.employee.create({
    data: {
      userId,
      businessId,
      name: data.name || (data.username || data.phone || 'Employee'),
      accessCode: code,
    },
    include: {
      business: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Update user role to EMPLOYEE if not already (only if user was authenticated)
  if (req.user && req.user.role !== 'EMPLOYEE' && req.user.role !== 'BUSINESS_OWNER' && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
    await prisma.user.update({
      where: { id: userId },
      data: { role: 'EMPLOYEE' },
    });
  }

  // Mark access code as used
  if (data.code) {
    await prisma.accessCode.update({
      where: { code },
      data: {
        isUsed: true,
        usedBy: employee.id,
        usedAt: new Date(),
      },
    });
  }

  // If new user was created, generate token for them
  let token = null;
  if (isNewUser) {
    const jwtSecret = process.env.JWT_SECRET || 'test-secret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    token = jwt.sign({ userId }, jwtSecret, { expiresIn } as SignOptions);
  }

  res.status(201).json({
    success: true,
    data: {
      employee,
      ...(isNewUser && { token, userId }),
    },
    message: isNewUser 
      ? 'Account created and employee registered successfully' 
      : 'Employee registered successfully',
  });
}

