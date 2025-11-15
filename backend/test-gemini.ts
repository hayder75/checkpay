/**
 * Simple test script to verify Gemini setup
 * Run with: npx tsx test-gemini.ts
 */

import dotenv from 'dotenv';
import { extractTxnIdWithLLM } from './src/utils/llmExtractor';

// Load environment variables
dotenv.config();

async function testGemini() {
  console.log('🧪 Testing Gemini Setup...\n');

  // Check if API key is configured
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in .env file');
    console.log('\n📝 To set it up:');
    console.log('1. Go to https://aistudio.google.com/app/apikey');
    console.log('2. Create a new API key');
    console.log('3. Add it to backend/.env: GEMINI_API_KEY=your_key_here\n');
    process.exit(1);
  }

  console.log('✅ GEMINI_API_KEY found');
  console.log(`📦 Model: ${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}`);
  console.log(`🔧 Provider: ${process.env.AI_PROVIDER || 'auto'}\n`);

  // Test with a sample SMS
  const sampleSMS = `You have received KES 1,500.00 from John Doe. Transaction ID: MP123456789. Balance: KES 5,000.00.`;

  console.log('📱 Testing with sample SMS:');
  console.log(`   "${sampleSMS}"\n`);

  try {
    console.log('⏳ Calling Gemini API...\n');
    
    const startTime = Date.now();
    const result = await extractTxnIdWithLLM(sampleSMS);
    const duration = Date.now() - startTime;

    console.log('✅ Extraction successful!\n');
    console.log('📊 Results:');
    console.log(`   Transaction ID: ${result.txnId || 'Not found'}`);
    console.log(`   Amount: ${result.amount || 'Not found'}`);
    console.log(`   Currency: ${result.currency || 'Not found'}`);
    console.log(`   Bank: ${result.bank || 'Not found'}`);
    console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
    console.log(`   Duration: ${duration}ms\n`);

    if (result.txnId) {
      console.log('🎉 Gemini is working correctly!');
      console.log('💡 Gemini has a generous free tier!');
    } else {
      console.log('⚠️  No transaction ID extracted. Check the SMS format.');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.log('\n💡 Check that your GEMINI_API_KEY is correct.');
    } else if (error.message.includes('429') || error.message.includes('rate limit')) {
      console.log('\n💡 Rate limit reached. Wait a few seconds and try again.');
    } else if (error.message.includes('503') || error.message.includes('overloaded')) {
      console.log('\n💡 Model is overloaded. Wait a moment and try again.');
    } else if (error.message.includes('quota')) {
      console.log('\n💡 You\'ve reached your quota limit.');
      console.log('   Check your usage at https://aistudio.google.com/app/apikey');
    }
    
    process.exit(1);
  }
}

testGemini();





