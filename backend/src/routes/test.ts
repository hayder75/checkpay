/**
 * Test Routes
 * Endpoints for testing pattern recognition and extraction
 */

import { Router, Request, Response } from 'express';
import { testPatternRecognition, testMultipleSMS, SAMPLE_SMS_TESTS, generateTestReport } from '../utils/testHelpers';

const router = Router();

/**
 * POST /test/pattern
 * Test pattern recognition with a single SMS
 */
router.post('/pattern', async (req: Request, res: Response) => {
  try {
    const { smsText, expectedTxnId } = req.body;
    
    if (!smsText || !expectedTxnId) {
      return res.status(400).json({
        success: false,
        error: 'smsText and expectedTxnId are required',
      });
    }
    
    const result = await testPatternRecognition({
      text: smsText,
      expectedTxnId,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /test/batch
 * Test multiple SMS samples
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { samples } = req.body;
    
    if (!samples || !Array.isArray(samples)) {
      return res.status(400).json({
        success: false,
        error: 'samples array is required',
      });
    }
    
    const results = await testMultipleSMS(samples);
    const report = generateTestReport(results);
    
    res.json({
      success: true,
      data: results,
      report,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /test/samples
 * Run tests with predefined sample SMS
 */
router.get('/samples', async (req: Request, res: Response) => {
  try {
    const results = await testMultipleSMS(SAMPLE_SMS_TESTS);
    const report = generateTestReport(results);
    
    res.json({
      success: true,
      data: results,
      report,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;





