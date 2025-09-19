import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    
    // Reconstruct the file path
    const filePath = pathSegments.join('/');
    
    // Security: prevent directory traversal
    if (filePath.includes('..') || filePath.includes('\\..')) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    // Try new location first (outside public), then fallback to old location
    const newPath = path.join(process.cwd(), 'uploads', filePath);
    const oldPath = path.join(process.cwd(), 'public', 'uploads', filePath);
    
    let absolutePath: string;
    let uploadsDir: string;
    
    // Check new location first
    try {
      const stats = await stat(newPath);
      if (stats.isFile()) {
        absolutePath = newPath;
        uploadsDir = path.join(process.cwd(), 'uploads');
      } else {
        throw new Error('Not found in new location');
      }
    } catch {
      // Fallback to old location
      try {
        const stats = await stat(oldPath);
        if (stats.isFile()) {
          absolutePath = oldPath;
          uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        } else {
          return new NextResponse('Not Found', { status: 404 });
        }
      } catch {
        return new NextResponse('Not Found', { status: 404 });
      }
    }
    
    // Security check: ensure file is within the uploads directory
    const normalizedPath = path.normalize(absolutePath);
    if (!normalizedPath.startsWith(uploadsDir)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    // Read the file
    const fileBuffer = await readFile(absolutePath);
    
    // Get MIME type based on file extension
    const getMimeType = (filePath: string): string => {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
      };
      return mimeTypes[ext] || 'application/octet-stream';
    };
    
    const mimeType = getMimeType(absolutePath);
    
    // Return the file with appropriate headers
    return new NextResponse(fileBuffer as BodyInit, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
      },
    });
    
  } catch (error) {
    console.error('File serving error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}