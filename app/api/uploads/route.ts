import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function matchesImageSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "owner") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Image storage is not configured yet." }, { status: 503 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 415 });
  if (file.size < 1 || file.size > MAX_IMAGE_SIZE) return NextResponse.json({ error: "Images must be smaller than 4 MB." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!matchesImageSignature(file.type, bytes)) return NextResponse.json({ error: "The selected file does not match its image type." }, { status: 415 });

  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const blob = await put(`service-images/${crypto.randomUUID()}.${extension}`, new Blob([bytes], { type: file.type }), {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
  });
  return NextResponse.json({ url: blob.url });
}
