/**
 * Test file for Indian Tax Number Validation
 * Run with: npx ts-node src/lib/tax-validation.test.ts
 */

import { validatePAN, validateTAN, validateCIN, validateGST, getTaxNumberError } from './tax-validation.js';

// Test data
const testCases = {
  PAN: {
    valid: ['ABCDE1234F', 'AAAAA0000A', 'ZZZZZ9999Z'],
    invalid: ['ABCD1234F', 'ABCDE12345', 'abcde1234f', '1234567890', 'ABCDE1234', 'ABCDE1234FF']
  },
  TAN: {
    valid: ['ABCD12345E', 'AAAA00000A', 'ZZZZ99999Z'],
    invalid: ['ABC12345E', 'ABCD123456', 'abcd12345e', '1234567890', 'ABCD12345', 'ABCD12345EE']
  },
  CIN: {
    valid: ['U12345AA2021AAA123456', 'L99999BB1999BBB999999', 'U00001AA2023CCC000001'],
    invalid: ['U1234AA2021AAA123456', 'X12345AA2021AAA123456', 'u12345aa2021aaa123456', 'U12345AA21AAA123456', 'U12345A2021AAA123456']
  },
  GST: {
    valid: ['12ABCDE1234F1Z5', '29AAAAA0000A1Z1', '07ZZZZZ9999Z9Z9'],
    invalid: ['1ABCDE1234F1Z5', '12ABCDE1234F1Z', '12abcde1234f1z5', 'A2ABCDE1234F1Z5', '12ABCDE1234F1A5']
  }
};

function runTests() {
  console.log('🧪 Testing Indian Tax Number Validation\n');

  let totalTests = 0;
  let passedTests = 0;

  // Test PAN validation
  console.log('📋 Testing PAN validation:');
  testCases.PAN.valid.forEach(pan => {
    totalTests++;
    const isValid = validatePAN(pan);
    if (isValid) {
      console.log(`✅ Valid PAN: ${pan}`);
      passedTests++;
    } else {
      console.log(`❌ Expected valid PAN: ${pan}`);
    }
  });

  testCases.PAN.invalid.forEach(pan => {
    totalTests++;
    const isValid = validatePAN(pan);
    if (!isValid) {
      console.log(`✅ Invalid PAN: ${pan}`);
      passedTests++;
    } else {
      console.log(`❌ Expected invalid PAN: ${pan}`);
    }
  });

  // Test TAN validation
  console.log('\n📋 Testing TAN validation:');
  testCases.TAN.valid.forEach(tan => {
    totalTests++;
    const isValid = validateTAN(tan);
    if (isValid) {
      console.log(`✅ Valid TAN: ${tan}`);
      passedTests++;
    } else {
      console.log(`❌ Expected valid TAN: ${tan}`);
    }
  });

  testCases.TAN.invalid.forEach(tan => {
    totalTests++;
    const isValid = validateTAN(tan);
    if (!isValid) {
      console.log(`✅ Invalid TAN: ${tan}`);
      passedTests++;
    } else {
      console.log(`❌ Expected invalid TAN: ${tan}`);
    }
  });

  // Test CIN validation
  console.log('\n📋 Testing CIN validation:');
  testCases.CIN.valid.forEach(cin => {
    totalTests++;
    const isValid = validateCIN(cin);
    if (isValid) {
      console.log(`✅ Valid CIN: ${cin}`);
      passedTests++;
    } else {
      console.log(`❌ Expected valid CIN: ${cin}`);
    }
  });

  testCases.CIN.invalid.forEach(cin => {
    totalTests++;
    const isValid = validateCIN(cin);
    if (!isValid) {
      console.log(`✅ Invalid CIN: ${cin}`);
      passedTests++;
    } else {
      console.log(`❌ Expected invalid CIN: ${cin}`);
    }
  });

  // Test GST validation
  console.log('\n📋 Testing GST validation:');
  testCases.GST.valid.forEach(gst => {
    totalTests++;
    const isValid = validateGST(gst);
    if (isValid) {
      console.log(`✅ Valid GST: ${gst}`);
      passedTests++;
    } else {
      console.log(`❌ Expected valid GST: ${gst}`);
    }
  });

  testCases.GST.invalid.forEach(gst => {
    totalTests++;
    const isValid = validateGST(gst);
    if (!isValid) {
      console.log(`✅ Invalid GST: ${gst}`);
      passedTests++;
    } else {
      console.log(`❌ Expected invalid GST: ${gst}`);
    }
  });

  // Test empty values (should be valid)
  console.log('\n📋 Testing empty values (should be valid):');
  const emptyTests = ['', undefined, null];
  emptyTests.forEach(value => {
    totalTests += 4;
    if (validatePAN(value as any)) passedTests++;
    if (validateTAN(value as any)) passedTests++;
    if (validateCIN(value as any)) passedTests++;
    if (validateGST(value as any)) passedTests++;
  });
  console.log(`✅ Empty values handled correctly`);

  // Test error messages
  console.log('\n📋 Testing error messages:');
  const errorTests = [
    { type: 'PAN' as const, value: 'INVALID', expected: 'Invalid PAN format' },
    { type: 'TAN' as const, value: 'INVALID', expected: 'Invalid TAN format' },
    { type: 'CIN' as const, value: 'INVALID', expected: 'Invalid CIN format' },
    { type: 'GST' as const, value: 'INVALID', expected: 'Invalid GST format' }
  ];

  errorTests.forEach(test => {
    totalTests++;
    const error = getTaxNumberError(test.type, test.value);
    if (error && error.includes(test.expected)) {
      console.log(`✅ Error message for ${test.type}: ${error}`);
      passedTests++;
    } else {
      console.log(`❌ Expected error message for ${test.type}, got: ${error}`);
    }
  });

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed');
  }
  console.log('='.repeat(50));
}

// Run the tests
runTests();
