const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addTestRents() {
  try {
    console.log('Adding test rent records...');
    
    // Create 5 more rent records to have 10 total
    const newRents = [
      {
        owner: 'Test Owner 1',
        pancardNo: 'ABCDE1234F',
        rentDay: 'Monthly',
        fromDate: new Date('2025-01-01'),
        toDate: new Date('2025-12-31'),
        description: 'Test rent description 1',
        depositAmount: 50000,
        rentAmount: 25000,
        bank: 'Test Bank 1',
        branch: 'Main Branch',
        accountNo: '1234567890',
        accountName: 'Test Account 1',
        ifscCode: 'TEST0001234'
      },
      {
        owner: 'Test Owner 2',
        pancardNo: 'BCDEF2345G',
        rentDay: 'Quarterly',
        fromDate: new Date('2025-02-01'),
        toDate: new Date('2025-11-30'),
        description: 'Test rent description 2',
        depositAmount: 60000,
        rentAmount: 30000,
        bank: 'Test Bank 2',
        branch: 'Secondary Branch',
        accountNo: '2345678901',
        accountName: 'Test Account 2',
        ifscCode: 'TEST0002345'
      },
      {
        owner: 'Test Owner 3',
        pancardNo: 'CDEFG3456H',
        rentDay: 'Yearly',
        fromDate: new Date('2025-03-01'),
        toDate: new Date('2026-02-28'),
        description: 'Test rent description 3',
        depositAmount: 75000,
        rentAmount: 40000,
        bank: 'Test Bank 3',
        branch: 'Third Branch',
        accountNo: '3456789012',
        accountName: 'Test Account 3',
        ifscCode: 'TEST0003456'
      },
      {
        owner: 'Test Owner 4',
        pancardNo: 'DEFGH4567I',
        rentDay: 'Monthly',
        fromDate: new Date('2025-04-01'),
        toDate: new Date('2025-10-31'),
        description: 'Test rent description 4',
        depositAmount: 45000,
        rentAmount: 22000,
        bank: 'Test Bank 4',
        branch: 'Fourth Branch',
        accountNo: '4567890123',
        accountName: 'Test Account 4',
        ifscCode: 'TEST0004567'
      },
      {
        owner: 'Test Owner 5',
        pancardNo: 'EFGHI5678J',
        rentDay: 'Quarterly',
        fromDate: new Date('2025-05-01'),
        toDate: new Date('2025-09-30'),
        description: 'Test rent description 5',
        depositAmount: 55000,
        rentAmount: 28000,
        bank: 'Test Bank 5',
        branch: 'Fifth Branch',
        accountNo: '5678901234',
        accountName: 'Test Account 5',
        ifscCode: 'TEST0005678'
      }
    ];

    for (const rent of newRents) {
      await prisma.rent.create({
        data: rent
      });
      console.log(`Created rent for ${rent.owner}`);
    }

    // Count total rents
    const totalRents = await prisma.rent.count();
    console.log(`\nTotal rents now: ${totalRents}`);
    
    console.log('Test data added successfully!');
  } catch (error) {
    console.error('Error adding test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestRents();
