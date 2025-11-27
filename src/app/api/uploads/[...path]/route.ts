import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const params = await context.params;
    const parts = params?.path ?? [];
    // uploads saved as `/uploads/...` => map to process cwd uploads folder
    const uploadsRoot = path.join(process.cwd(), "uploads");
    const requested = path.join(uploadsRoot, ...parts);
    const normalizedRoot = path.normalize(uploadsRoot);
    const normalizedRequested = path.normalize(requested);

    // Prevent path traversal: ensure requested path is inside uploadsRoot
    if (!normalizedRequested.startsWith(normalizedRoot)) {
      return new Response("Not Found", { status: 404 });
    }

    // Read file
    const data = await fs.readFile(normalizedRequested);
    const contentType = getContentType(normalizedRequested);

    // Use Uint8Array view for standards-compliant BodyInit
    const body = new Uint8Array(data);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e: any) {
    if (e?.code === "ENOENT") {
      return new Response("Not Found", { status: 404 });
    }
    console.error("/api/uploads error:", e);
    return new Response("Internal Server Error", { status: 500 });
  }
}
