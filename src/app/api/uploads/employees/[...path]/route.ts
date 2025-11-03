import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getMimeType, isValidFilename } from '@/lib/upload';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    
    // Validate path segments to prevent path traversal
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 400 }
      );
    }

    // Validate each segment
    for (const segment of pathSegments) {
      if (!isValidFilename(segment)) {
        return NextResponse.json(
          { error: 'Invalid path segment' },
          { status: 400 }
        );
      }
    }

    // Only allow specific subdirectories
    const allowedFolders = ['profiles', 'signatures', 'documents'];
    if (pathSegments.length < 2 || !allowedFolders.includes(pathSegments[0])) {
      return NextResponse.json(
        { error: 'Invalid folder' },
        { status: 400 }
      );
    }

    // Construct file path
    const filePath = path.join(
      process.cwd(),
      'uploads',
      'employees',
      ...pathSegments
    );
    
    // Check if file exists
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await readFile(filePath);
    
    // Get content type from the filename
    const filename = pathSegments[pathSegments.length - 1];
    const contentType = getMimeType(filename);
    
    // Return file with appropriate headers
    return new NextResponse(fileBuffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('Error serving employee file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
