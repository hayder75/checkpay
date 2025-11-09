import { Router } from 'express';
import prisma from '../utils/prisma';

const router = Router();

/**
 * Get all countries (public endpoint for frontend country selector)
 */
router.get('/', async (req, res) => {
  try {
    const countries = await prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        code: true,
        name: true,
        banks: true,
        currencies: true,
      },
    });

    res.json({
      success: true,
      data: countries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch countries',
    });
  }
});

export default router;



