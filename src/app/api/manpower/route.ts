import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Success, Error as ApiError, BadRequest as ApiBadRequest } from "@/lib/api-response";
import { guardApiAccess } from "@/lib/access-guard";
import { paginate } from "@/lib/paginate";
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Utility to coerce possibly-empty string to null
function nil(v: any) { return v == null || v === '' ? null : v; }

// Save uploaded file to /uploads/manpower and return URL
async function saveDoc(file: File | null, subname: string) {
  if (!file || file.size === 0) return null;
  const allowed = [
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (!allowed.includes(file.type || '')) throw new Error('Unsupported file type');
  if (file.size > 20 * 1024 * 1024) throw new Error('File too large (max 20MB)');
  const ext = path.extname(file.name) || '.bin';
  const filename = `${Date.now()}-${subname}-${crypto.randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), 'uploads', 'manpower');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/manpower/${filename}`;
}

// GET /api/manpower?search=&page=1&perPage=10&sort=firstName&order=asc
export async function GET(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));
  const search = (searchParams.get('search') || '').trim();
  const sort = (searchParams.get('sort') || 'firstName');
  const order = (searchParams.get('order') === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
  const supplierId = searchParams.get('supplierId');
  const isAssigned = searchParams.get('isAssigned');
  const currentSiteId = searchParams.get('currentSiteId');

  const where: any = {};
  
  // Text search
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { mobileNumber: { contains: search } },
      { panNumber: { contains: search } },
      { aadharNo: { contains: search } },
      { manpowerSupplier: { supplierName: { contains: search } } },
    ];
  }
  
  // Filter by supplier
  if (supplierId) {
    where.supplierId = parseInt(supplierId);
  }
  
  // Filter by assignment status
  if (isAssigned !== null && isAssigned !== undefined) {
    where.isAssigned = isAssigned === 'true';
  }
  
  // Filter by current site
  if (currentSiteId) {
    where.currentSiteId = parseInt(currentSiteId);
  }

  const sortable = new Set(['firstName','lastName','mobileNumber','wage','createdAt']);
  const orderBy: Record<string,'asc'|'desc'> = sortable.has(sort) ? { [sort]: order } : { firstName: 'asc' };

  const result = await paginate({
    model: prisma.manpower,
    where,
    orderBy,
    page,
    perPage,
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      supplierId: true,
      manpowerSupplier: { select: { id: true, supplierName: true } },
      mobileNumber: true,
      wage: true,
      // Assignment tracking fields
      category: true,
      skillSet: true,
      minWage: true,
      hours: true,
      esic: true,
      pf: true,
      pt: true,
      hra: true,
      mlwf: true,
      isAssigned: true,
      currentSiteId: true,
      assignedAt: true,
      createdAt: true,
      updatedAt: true,
    }
  });
  return Success(result);
}

// POST /api/manpower - supports multipart for document uploads
export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};
    let files: Record<string, File | null> = {};
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const get = (k: string) => form.get(k) as string | null;
      files = {
        pan: form.get('panDocument') as File,
        aadhar: form.get('aadharDocument') as File,
        voter: form.get('voterIdDocument') as File,
        dl: form.get('drivingLicenceDocument') as File,
        bank: form.get('bankDetailsDocument') as File,
      };
      body = {
        firstName: get('firstName'),
        middleName: get('middleName'),
        lastName: get('lastName'),
        supplierId: get('supplierId'),
        dateOfBirth: get('dateOfBirth'),
        address: get('address'),
        location: get('location'),
        mobileNumber: get('mobileNumber'),
        wage: get('wage'),
        bank: get('bank'),
        branch: get('branch'),
        accountNumber: get('accountNumber'),
        ifscCode: get('ifscCode'),
        pfNo: get('pfNo'),
        esicNo: get('esicNo'),
        unaNo: get('unaNo'),
        panNumber: get('panNumber'),
        aadharNo: get('aadharNo'),
        voterIdNo: get('voterIdNo'),
        drivingLicenceNo: get('drivingLicenceNo'),
        bankDetails: get('bankDetails'),
        watch: get('watch'),
      };
    } else {
      body = await req.json();
    }

    if (!body.firstName || !body.lastName) return ApiError('First and last name are required', 400);
    const supplierIdNum = Number(body.supplierId);
    if (!supplierIdNum || Number.isNaN(supplierIdNum)) return ApiError('Valid manpower supplier is required', 400);

    // Save any documents
    let panDocumentUrl: string | null = null;
    let aadharDocumentUrl: string | null = null;
    let voterIdDocumentUrl: string | null = null;
    let drivingLicenceDocumentUrl: string | null = null;
    let bankDetailsDocumentUrl: string | null = null;
    try {
      if (files.pan) panDocumentUrl = await saveDoc(files.pan, 'pan');
      if (files.aadhar) aadharDocumentUrl = await saveDoc(files.aadhar, 'aadhar');
      if (files.voter) voterIdDocumentUrl = await saveDoc(files.voter, 'voter');
      if (files.dl) drivingLicenceDocumentUrl = await saveDoc(files.dl, 'dl');
      if (files.bank) bankDetailsDocumentUrl = await saveDoc(files.bank, 'bank');
    } catch (e: any) {
      return ApiError(e?.message || 'Invalid document upload', 400);
    }

    const created = await prisma.manpower.create({
      data: {
        firstName: String(body.firstName).trim(),
        middleName: nil(body.middleName) as any,
        lastName: String(body.lastName).trim(),
        supplierId: supplierIdNum,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        address: nil(body.address) as any,
        location: nil(body.location) as any,
        mobileNumber: nil(body.mobileNumber) as any,
        wage: body.wage ? String(body.wage) as any : null,
        bank: nil(body.bank) as any,
        branch: nil(body.branch) as any,
        accountNumber: nil(body.accountNumber) as any,
        ifscCode: nil(body.ifscCode) as any,
        pfNo: nil(body.pfNo) as any,
        esicNo: nil(body.esicNo) as any,
        unaNo: nil(body.unaNo) as any,
        panNumber: nil(body.panNumber) as any,
        aadharNo: nil(body.aadharNo) as any,
        voterIdNo: nil(body.voterIdNo) as any,
        drivingLicenceNo: nil(body.drivingLicenceNo) as any,
        bankDetails: nil(body.bankDetails) as any,
        panDocumentUrl,
        aadharDocumentUrl,
        voterIdDocumentUrl,
        drivingLicenceDocumentUrl,
        bankDetailsDocumentUrl,
        watch: body.watch === true || body.watch === 'true',
      },
      select: { id: true }
    });
    return Success(created, 201);
  } catch (e) {
    return ApiError('Failed to create manpower');
  }
}

// PATCH /api/manpower
export async function PATCH(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;
  try {
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};
    let files: Record<string, File | null> = {};
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const get = (k: string) => form.get(k) as string | null;
      files = {
        pan: form.get('panDocument') as File,
        aadhar: form.get('aadharDocument') as File,
        voter: form.get('voterIdDocument') as File,
        dl: form.get('drivingLicenceDocument') as File,
        bank: form.get('bankDetailsDocument') as File,
      };
      body = {
        id: get('id'),
        firstName: get('firstName'),
        middleName: get('middleName'),
        lastName: get('lastName'),
        supplierId: get('supplierId'),
        dateOfBirth: get('dateOfBirth'),
        address: get('address'),
        location: get('location'),
        mobileNumber: get('mobileNumber'),
        wage: get('wage'),
        bank: get('bank'),
        branch: get('branch'),
        accountNumber: get('accountNumber'),
        ifscCode: get('ifscCode'),
        pfNo: get('pfNo'),
        esicNo: get('esicNo'),
        unaNo: get('unaNo'),
        panNumber: get('panNumber'),
        aadharNo: get('aadharNo'),
        voterIdNo: get('voterIdNo'),
        drivingLicenceNo: get('drivingLicenceNo'),
        bankDetails: get('bankDetails'),
        watch: get('watch'),
      };
    } else {
      body = await req.json();
    }
    const id = Number(body.id);
    if (!id || Number.isNaN(id)) return ApiError('id is required', 400);

    const data: Record<string, any> = {};
    const set = (k: string, v: any) => { if (v !== undefined) data[k] = v === '' ? null : typeof v === 'string' ? v.trim() : v; };
    set('firstName', body.firstName);
    set('middleName', body.middleName);
    set('lastName', body.lastName);
    if (body.supplierId !== undefined) data.supplierId = body.supplierId ? Number(body.supplierId) : null;
    if (body.dateOfBirth !== undefined) data.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    set('address', body.address);
    set('location', body.location);
    set('mobileNumber', body.mobileNumber);
    if (body.wage !== undefined) data.wage = body.wage === '' ? null : String(body.wage);
    set('bank', body.bank);
    set('branch', body.branch);
    set('accountNumber', body.accountNumber);
    set('ifscCode', body.ifscCode);
    set('pfNo', body.pfNo);
    set('esicNo', body.esicNo);
    set('unaNo', body.unaNo);
    set('panNumber', body.panNumber);
    set('aadharNo', body.aadharNo);
    set('voterIdNo', body.voterIdNo);
    set('drivingLicenceNo', body.drivingLicenceNo);
    set('bankDetails', body.bankDetails);
    if (body.watch !== undefined) data.watch = body.watch === true || body.watch === 'true';

    // Save doc files if any
    try {
      if (files.pan) data.panDocumentUrl = await saveDoc(files.pan, 'pan');
      if (files.aadhar) data.aadharDocumentUrl = await saveDoc(files.aadhar, 'aadhar');
      if (files.voter) data.voterIdDocumentUrl = await saveDoc(files.voter, 'voter');
      if (files.dl) data.drivingLicenceDocumentUrl = await saveDoc(files.dl, 'dl');
      if (files.bank) data.bankDetailsDocumentUrl = await saveDoc(files.bank, 'bank');
    } catch (e: any) {
      return ApiError(e?.message || 'Invalid document upload', 400);
    }

    if (!Object.keys(data).length) return ApiError('Nothing to update', 400);

    try {
      const updated = await prisma.manpower.update({ where: { id }, data, select: { id: true } });
      return Success(updated);
    } catch (e: any) {
      if (e?.code === 'P2025') return ApiError('Manpower record not found', 404);
      return ApiError('Failed to update manpower');
    }
  } catch (e) {
    return ApiError('Failed to update manpower');
  }
}
