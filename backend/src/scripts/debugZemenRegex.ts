{
const text = `2:50

Download

-15,008.00

Transaction Time:

Transaction Type:

Successful

Transaction To:

Transaction Number:

ZemenGEBEYA

Where Ethlopla Shops Digitally

Finished

l LTE 734

(ETE)

Share

2025/11/10 02:49:56

Transfer Money

Zemenc

Bereket

CKA42NZW50

G QR Code >`;

// Test amount extraction
console.log('Testing amount...');
const amountRegex = /-?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d{2})?)\s*\(?ETB\)?/i;
const amountMatch = text.match(amountRegex);
console.log('Amount match:', amountMatch ? amountMatch[1] : 'NO');

// Test date/time
console.log('\nTesting date/time...');
const dateTimeRegex = /Transaction\s+Time[:\\s]*[\s\S]*?(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})/i;
const dateTimeMatch = text.match(dateTimeRegex);
console.log('Date/Time match:', dateTimeMatch ? [dateTimeMatch[1], dateTimeMatch[2]] : 'NO');

// Test transaction type
console.log('\nTesting transaction type...');
const typeRegex = /Transaction\s+Type[:\\s]*[\s\S]*?([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s*\n|\s*Transaction|\s*Successful|\s*Zemen)/i;
const typeMatch = text.match(typeRegex);
console.log('Type match:', typeMatch ? typeMatch[1] : 'NO');

// Test receiver
console.log('\nTesting receiver...');
const receiverRegex = /Transaction\s+To[:\\s]*[\s\S]*?([A-Za-z]+(?:\s+[A-Za-z]+)*?)(?:\s*\n|\s*Transaction|\s*Zemen)/i;
const receiverMatch = text.match(receiverRegex);
console.log('Receiver match:', receiverMatch ? receiverMatch[1] : 'NO');

// Test transaction number
console.log('\nTesting transaction number...');
const txnRegex = /Transaction\s+Number[:\\s]*[\s\S]*?([A-Z0-9]+)/i;
const txnMatch = text.match(txnRegex);
console.log('Txn ID match:', txnMatch ? txnMatch[1] : 'NO');

// Full regex test
console.log('\nTesting full regex...');
const fullRegex = new RegExp('(?i)(?:-)?\\s*(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?|\\d+(?:\\.\\d{2})?)\\s*\\(?ETB\\)?[\\s\\S]*?Transaction\\s+Time[:\\s]*[\\s\\S]*?(\\d{4}/\\d{2}/\\d{2})\\s+(\\d{2}:\\d{2}:\\d{2})[\\s\\S]*?Transaction\\s+Type[:\\s]*[\\s\\S]*?([A-Za-z]+(?:\\s+[A-Za-z]+)*?)(?:\\s*\\n|\\s*Transaction|\\s*Successful|\\s*Zemen)[\\s\\S]*?Transaction\\s+To[:\\s]*[\\s\\S]*?([A-Za-z]+(?:\\s+[A-Za-z]+)*?)(?:\\s*\\n|\\s*Transaction|\\s*Zemen)[\\s\\S]*?Transaction\\s+Number[:\\s]*[\\s\\S]*?([A-Z0-9]+)', 'is');
const fullMatch = text.match(fullRegex);
console.log('Full match:', fullMatch ? 'YES' : 'NO');
if (fullMatch) {
  console.log('Groups:', fullMatch.slice(1));
}
}
