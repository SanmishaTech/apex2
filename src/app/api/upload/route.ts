import { NextRequest, NextResponse } from "next/server";
import { guardApiAccess } from "@/lib/access-guard";
import {
  handleFileUpload,
  imageUploadConfig,
  documentUploadConfig,
  profileImageConfig,
  noticeDocumentUploadConfig,
} from "@/lib/upload";

export async function POST(req: NextRequest) {
  const auth = await guardApiAccess(req);
  if (auth.ok === false) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string; // 'image', 'document', 'profile'
    const prefix = formData.get("prefix") as string; // optional custom prefix

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name) {
      return NextResponse.json({ error: "Invalid file" }, { status: 400 });
    }

    // Select configuration based on type
    let config;
    let apiPath;

    switch (type) {
      case "profile":
        config = profileImageConfig;
        apiPath = "/api/images";
        break;
      case "notice":
        config = noticeDocumentUploadConfig;
        apiPath = "/api/uploads/notices";
        break;
      case "document":
        config = documentUploadConfig;
        apiPath = "/api/documents";
        break;
      case "image":
      default:
        config = imageUploadConfig;
        apiPath = "/api/images";
        break;
    }

    if (prefix === "notice") {
      config = noticeDocumentUploadConfig;
      apiPath = "/api/uploads/notices";
    }

    // Handle the upload
    const uploadResult = await handleFileUpload(file, config, prefix);

    if (!uploadResult.success) {
      return NextResponse.json({ error: uploadResult.error }, { status: 400 });
    }

    // Return the API URL for accessing the file
    const url = `${apiPath}/${uploadResult.filename}`;

    return NextResponse.json({
      success: true,
      filename: uploadResult.filename,
      url,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
