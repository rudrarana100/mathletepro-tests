import { NextResponse } from "next/server";
import { POST as submitExamPOST } from "@/app/api/submit-exam/route";

/**
 * Legacy submission route forwarder to official authenticated submit-exam handler
 */
export async function POST(request: Request) {
  return submitExamPOST(request);
}