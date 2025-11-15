/**
 * Simple test script to verify OpenAI setup
 * Run with: npx tsx test-openai.ts
 */

import dotenv from 'dotenv';
import { extractTxnIdWithLLM } from './src/utils/llmExtractor';

// Load environment variables
dotenv.config();

async function testOpenAI() {
  console.log('🧪 Testing OpenAI Setup...\n');

  // Check if API key is configured
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in .env file');
    console.log('\n📝 To set it up:');
    console.log('1. Go to https://platform.openai.com/api-keys');
    console.log('2. Create a new secret key');
    console.log('3. Add it to backend/.env: OPENAI_API_KEY=sk_your_key_here\n');
    process.exit(1);
  }

  console.log('✅ OPENAI_API_KEY found');
  console.log(`📦 Model: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
  console.log(`🔧 Provider: ${process.env.AI_PROVIDER || 'auto'}\n`);

  // Test with a sample SMS
  const sampleSMS = `You have received KES 1,500.00 from John Doe. Transaction ID: MP123456789. Balance: KES 5,000.00.`;

  console.log('📱 Testing with sample SMS:');
  console.log(`   "${sampleSMS}"\n`);

  try {
    console.log('⏳ Calling OpenAI API...\n');
    
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
      console.log('🎉 OpenAI is working correctly!');
      console.log(`💡 Cost: ~$${((duration / 1000) * 0.00015).toFixed(6)} per request (estimated)`);
    } else {
      console.log('⚠️  No transaction ID extracted. Check the SMS format.');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.log('\n💡 Check that your OPENAI_API_KEY is correct.');
      console.log('   Make sure it starts with "sk-" and has no extra spaces.');
    } else if (error.message.includes('429') || error.message.includes('rate limit')) {
      console.log('\n💡 Rate limit reached. Wait a few seconds and try again.');
    } else if (error.message.includes('insufficient_quota') || error.message.includes('quota')) {
      console.log('\n💡 You\'ve used up your free credits.');
      console.log('   Add a payment method at https://platform.openai.com/account/billing');
      console.log('   Or use Ollama for unlimited free usage (see FREE_AI_API_OPTIONS.md)');
    } else if (error.message.includes('openai')) {
      console.log('\n💡 Make sure you have installed the openai package:');
      console.log('   npm install openai');
    }
    
    process.exit(1);
  }
}

testOpenAI();





