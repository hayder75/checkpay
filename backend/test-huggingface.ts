/**
 * Simple test script to verify Hugging Face setup
 * Run with: npx tsx test-huggingface.ts
 */

import dotenv from 'dotenv';
import { extractTxnIdWithLLM } from './src/utils/llmExtractor';

// Load environment variables
dotenv.config();

async function testHuggingFace() {
  console.log('🧪 Testing Hugging Face Setup...\n');

  // Check if API key is configured
  if (!process.env.HUGGINGFACE_API_KEY) {
    console.error('❌ HUGGINGFACE_API_KEY not found in .env file');
    console.log('\n📝 To set it up:');
    console.log('1. Go to https://huggingface.co/settings/tokens');
    console.log('2. Create a new token (Read permission)');
    console.log('3. Add it to backend/.env: HUGGINGFACE_API_KEY=hf_your_token_here\n');
    process.exit(1);
  }

  console.log('✅ HUGGINGFACE_API_KEY found');
  console.log(`📦 Model: ${process.env.HUGGINGFACE_MODEL || 'meta-llama/Llama-3-8B-Instruct'}`);
  console.log(`🔧 Provider: ${process.env.AI_PROVIDER || 'auto'}\n`);

  // Test with a sample SMS
  const sampleSMS = `You have received KES 1,500.00 from John Doe. Transaction ID: MP123456789. Balance: KES 5,000.00.`;

  console.log('📱 Testing with sample SMS:');
  console.log(`   "${sampleSMS}"\n`);

  try {
    console.log('⏳ Calling Hugging Face API... (this may take 10-30 seconds on first call)\n');
    
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
      console.log('🎉 Hugging Face is working correctly!');
    } else {
      console.log('⚠️  No transaction ID extracted. This might be normal if the model needs adjustment.');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('Model is loading')) {
      console.log('\n💡 The model is still loading. Wait 30-60 seconds and try again.');
    } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.log('\n💡 Check that your HUGGINGFACE_API_KEY is correct.');
    } else if (error.message.includes('rate limit')) {
      console.log('\n💡 Rate limit reached. Wait a few seconds and try again.');
    }
    
    process.exit(1);
  }
}

testHuggingFace();





