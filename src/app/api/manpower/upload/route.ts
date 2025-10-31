import { NextRequest } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import { Success, Error as ApiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import * as XLSX from 'xlsx';

// Utility to coerce possibly-empty string to null
function nil(v: any) { 
  if (v == null || v === '' || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  return v;
}

// POST /api/manpower/upload - Upload Excel file and bulk create manpower
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return ApiError('No file uploaded', 400);
    }

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return ApiError('Invalid file type. Please upload an Excel file (.xlsx or .xls)', 400);
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    
    if (!sheetName) {
      return ApiError('Excel file is empty', 400);
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet) as any[];

    if (!data || data.length === 0) {
      return ApiError('No data found in Excel file', 400);
    }

    // Validate and prepare data
    const errors: string[] = [];
    const validRecords: any[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Excel row number (1 for header + 1-indexed)

      // Extract values with multiple possible column name variations
      const firstName = nil(row['First Name*'] || row['First Name'] || row['firstName']);
      const middleName = nil(row['Middle Name'] || row['middleName']);
      const lastName = nil(row['Last Name*'] || row['Last Name'] || row['lastName']);
      const supplierName = nil(row['Supplier Name*'] || row['Supplier Name'] || row['supplierName']);
      const dateOfBirth = nil(row['Date of Birth (YYYY-MM-DD)'] || row['Date of Birth'] || row['dateOfBirth']);
      const address = nil(row['Address'] || row['address']);
      const location = nil(row['Location'] || row['location']);
      const mobileNumber = nil(row['Mobile Number'] || row['mobileNumber']);
      const wage = nil(row['Wage'] || row['wage']);
      const bank = nil(row['Bank'] || row['bank']);
      const branch = nil(row['Branch'] || row['branch']);
      const accountNumber = nil(row['Account Number'] || row['accountNumber']);
      const ifscCode = nil(row['IFSC Code'] || row['ifscCode']);
      const pfNo = nil(row['PF No'] || row['pfNo']);
      const esicNo = nil(row['ESIC No'] || row['esicNo']);
      const unaNo = nil(row['UNA No'] || row['unaNo']);
      const panNumber = nil(row['PAN Number'] || row['panNumber']);
      const aadharNo = nil(row['Aadhar No'] || row['aadharNo']);
      const voterIdNo = nil(row['Voter ID No'] || row['voterIdNo']);
      const drivingLicenceNo = nil(row['Driving Licence No'] || row['drivingLicenceNo']);
      const bankDetails = nil(row['Bank Details'] || row['bankDetails']);

      // Validate mandatory fields
      const rowErrors: string[] = [];
      if (!firstName) rowErrors.push('First Name is required');
      if (!lastName) rowErrors.push('Last Name is required');
      if (!supplierName) rowErrors.push('Supplier Name is required');

      if (rowErrors.length > 0) {
        errors.push(`Row ${rowNum}: ${rowErrors.join(', ')}`);
        continue;
      }

      // Prepare record for insertion (we'll resolve supplier names to IDs later)
      validRecords.push({
        firstName: String(firstName).trim(),
        middleName: middleName ? String(middleName).trim() : null,
        lastName: String(lastName).trim(),
        supplierName: String(supplierName).trim(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        address: address ? String(address).trim() : null,
        location: location ? String(location).trim() : null,
        mobileNumber: mobileNumber ? String(mobileNumber).trim() : null,
        wage: wage ? String(wage) : null,
        bank: bank ? String(bank).trim() : null,
        branch: branch ? String(branch).trim() : null,
        accountNumber: accountNumber ? String(accountNumber).trim() : null,
        ifscCode: ifscCode ? String(ifscCode).trim() : null,
        pfNo: pfNo ? String(pfNo).trim() : null,
        esicNo: esicNo ? String(esicNo).trim() : null,
        unaNo: unaNo ? String(unaNo).trim() : null,
        panNumber: panNumber ? String(panNumber).trim() : null,
        aadharNo: aadharNo ? String(aadharNo).trim() : null,
        voterIdNo: voterIdNo ? String(voterIdNo).trim() : null,
        drivingLicenceNo: drivingLicenceNo ? String(drivingLicenceNo).trim() : null,
        bankDetails: bankDetails ? String(bankDetails).trim() : null,
        watch: false,
      });
    }

    // If there are errors, return them
    if (errors.length > 0) {
      const errorSummary = `Found ${errors.length} validation error(s): ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? `; ... and ${errors.length - 5} more errors` : ''}`;
      return ApiError(errorSummary, 400);
    }

    if (validRecords.length === 0) {
      return ApiError('No valid records found to import', 400);
    }

    // Get all unique supplier names from the records
    const uniqueSupplierNames = [...new Set(validRecords.map(r => r.supplierName))];
    
    // Fetch all suppliers from database that match these names
    const existingSuppliers = await prisma.manpowerSupplier.findMany({
      where: { 
        supplierName: { 
          in: uniqueSupplierNames 
        } 
      },
      select: { id: true, supplierName: true }
    });
    
    // Create a map of supplier name -> supplier ID for quick lookup
    const supplierNameToIdMap = new Map<string, number>();
    existingSuppliers.forEach(s => {
      supplierNameToIdMap.set(s.supplierName.toLowerCase().trim(), s.id);
    });
    
    // Check for missing suppliers
    const missingSuppliers: string[] = [];
    const recordsWithSupplierIds: any[] = [];
    
    for (const record of validRecords) {
      const supplierId = supplierNameToIdMap.get(record.supplierName.toLowerCase().trim());
      if (!supplierId) {
        missingSuppliers.push(record.supplierName);
      } else {
        // Replace supplierName with supplierId for database insertion
        const { supplierName, ...rest } = record;
        recordsWithSupplierIds.push({
          ...rest,
          supplierId
        });
      }
    }
    
    if (missingSuppliers.length > 0) {
      const uniqueMissing = [...new Set(missingSuppliers)];
      const supplierList = uniqueMissing.slice(0, 5).join(', ');
      const extra = uniqueMissing.length > 5 ? ` and ${uniqueMissing.length - 5} more` : '';
      return ApiError(
        `Supplier name(s) not found: ${supplierList}${extra}. Please verify supplier names match existing suppliers exactly (case-sensitive).`,
        400
      );
    }

    // Bulk insert records
    try {
      const result = await prisma.manpower.createMany({
        data: recordsWithSupplierIds,
        skipDuplicates: false,
      });

      return Success({
        message: `Successfully uploaded ${result.count} manpower record(s)`,
        count: result.count,
      }, 201);
    } catch (dbError: any) {
      console.error('Database error:', dbError);
      // Extract a user-friendly error message
      let errorMsg = 'Failed to insert records. Please check your data.';
      if (dbError?.message) {
        // Try to extract the relevant part of Prisma errors
        if (dbError.message.includes('Invalid value provided')) {
          errorMsg = 'Data type mismatch in Excel file. Please ensure all fields have correct data types.';
        } else if (dbError.message.includes('Unique constraint')) {
          errorMsg = 'Duplicate records found. Please check for duplicate entries in your Excel file.';
        } else {
          errorMsg = `Database error: ${dbError.message.split('\n')[0]}`;
        }
      }
      return ApiError(errorMsg, 500);
    }
  } catch (e: any) {
    console.error('Upload error:', e);
    return ApiError(e?.message || 'Failed to process uploaded file');
  }
}
