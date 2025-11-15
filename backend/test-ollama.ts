/**
 * Simple test script to verify Ollama setup
 * Run with: npx tsx test-ollama.ts
 */

import dotenv from 'dotenv';
import { extractTxnIdWithLLM } from './src/utils/llmExtractor';

// Load environment variables
dotenv.config();

async function testOllama() {
  console.log('🧪 Testing Ollama Setup...\n');

  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3';

  // First, check if Ollama is running
  try {
    const healthCheck = await fetch(`${ollamaUrl}/api/tags`);
    if (!healthCheck.ok) {
      throw new Error('Ollama service not responding');
    }
    console.log('✅ Ollama service is running');
  } catch (error: any) {
    console.error('❌ Ollama service not found');
    console.log('\n📝 To set it up:');
    console.log('1. Install Ollama: curl -fsSL https://ollama.com/install.sh | sh');
    console.log('2. Start the service (usually auto-starts after install)');
    console.log('3. Pull a model: ollama pull llama3');
    console.log('4. Verify: curl http://localhost:11434/api/tags\n');
    process.exit(1);
  }

  // Check if model is available
  try {
    const modelsResponse = await fetch(`${ollamaUrl}/api/tags`);
    const modelsData = await modelsResponse.json();
    const availableModels = modelsData.models?.map((m: any) => m.name) || [];
    
    if (!availableModels.length) {
      console.log('⚠️  No models found. Pull a model first:');
      console.log(`   ollama pull ${model}\n`);
    } else {
      console.log(`📦 Available models: ${availableModels.join(', ')}`);
      if (!availableModels.some((m: string) => m.includes(model.split(':')[0]))) {
        console.log(`⚠️  Model "${model}" not found. Pull it with:`);
        console.log(`   ollama pull ${model}\n`);
      } else {
        console.log(`✅ Model "${model}" is available\n`);
      }
    }
  } catch (error) {
    console.log('⚠️  Could not check available models\n');
  }

  console.log(`🔧 Configuration:`);
  console.log(`   URL: ${ollamaUrl}`);
  console.log(`   Model: ${model}`);
  console.log(`   Provider: ${process.env.AI_PROVIDER || 'auto'}\n`);

  // Test with a sample SMS
  const sampleSMS = `You have received KES 1,500.00 from John Doe. Transaction ID: MP123456789. Balance: KES 5,000.00.`;

  console.log('📱 Testing with sample SMS:');
  console.log(`   "${sampleSMS}"\n`);

  try {
    console.log('⏳ Calling Ollama API... (first call may take 10-30 seconds to load model)\n');
    
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
      console.log('🎉 Ollama is working correctly!');
      console.log('💡 This is 100% free and unlimited!');
    } else {
      console.log('⚠️  No transaction ID extracted. This might be normal if the model needs adjustment.');
      console.log('💡 Try a different model or adjust the prompt.');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Make sure Ollama is running:');
      console.log('   curl http://localhost:11434/api/tags');
      console.log('   If not running, start it: ollama serve');
    } else if (error.message.includes('model') || error.message.includes('not found')) {
      console.log(`\n💡 Pull the model first: ollama pull ${model}`);
    }
    
    process.exit(1);
  }
}

testOllama();





