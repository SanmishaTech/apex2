import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { getMimeType, isValidFilename } from "@/lib/upload";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    for (const segment of pathSegments) {
      if (!isValidFilename(segment)) {
        return NextResponse.json(
          { error: "Invalid path segment" },
          { status: 400 }
        );
      }
    }

    const filePath = path.join(
      process.cwd(),
      "uploads",
      "rents",
      ...pathSegments
    );

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
    const filename = pathSegments[pathSegments.length - 1];
    const contentType = getMimeType(filename);

    return new NextResponse(fileBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error serving rent file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
