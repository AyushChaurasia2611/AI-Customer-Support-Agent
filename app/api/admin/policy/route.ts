import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "refund-policy.md");
    const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
    return NextResponse.json({ content });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Failed to read refund policy", details: errorMsg }, { status: 500 });
  }
}
