const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Import the paginate function - same as used in API
async function paginate(params) {
  const page = Math.max(1, params.page || 1);
  const perPage = Math.min(100, Math.max(1, params.perPage || 10));
  const [total, rows] = await Promise.all([
    params.model.count({ where: params.where }),
    params.model.findMany({
      where: params.where,
      orderBy: params.orderBy,
      skip: (page - 1) * perPage,
      take: perPage,
      select: params.select,
    }),
  ]);
  return {
    data: rows,
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
  };
}

async function testPagination() {
  try {
    console.log('Testing Assets Pagination...\n');
    
    // Test with perPage = 5
    console.log('=== Testing with perPage = 5 ===');
    const result5 = await paginate({
      model: prisma.asset,
      where: {},
      orderBy: { createdAt: "desc" },
      page: 1,
      perPage: 5,
      select: {
        id: true,
        assetNo: true,
        assetName: true,
        createdAt: true,
      }
    });
    
    console.log('Results with perPage=5:', {
      page: result5.page,
      perPage: result5.perPage,
      total: result5.total,
      totalPages: result5.totalPages,
      dataLength: result5.data.length
    });
    
    // Test with perPage = 10
    console.log('\n=== Testing with perPage = 10 ===');
    const result10 = await paginate({
      model: prisma.asset,
      where: {},
      orderBy: { createdAt: "desc" },
      page: 1,
      perPage: 10,
      select: {
        id: true,
        assetNo: true,
        assetName: true,
        createdAt: true,
      }
    });
    
    console.log('Results with perPage=10:', {
      page: result10.page,
      perPage: result10.perPage,
      total: result10.total,
      totalPages: result10.totalPages,
      dataLength: result10.data.length
    });
    
    // Manual count
    const manualCount = await prisma.asset.count();
    console.log('\nManual count:', manualCount);
    
    // Expected calculations
    console.log('\nExpected calculations:');
    console.log('With 5 per page:', Math.ceil(manualCount / 5), 'pages');
    console.log('With 10 per page:', Math.ceil(manualCount / 10), 'pages');
    
  } catch (error) {
    console.error('Error testing pagination:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPagination();
