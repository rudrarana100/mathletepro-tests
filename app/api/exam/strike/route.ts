import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { testId, strikes } = await req.json();

    if (!testId || typeof strikes !== "number") {
      return NextResponse.json(
        { error: "Invalid parameters: testId and numeric strikes required" },
        { status: 400 }
      );
    }

    // Update strikes in attempts table
    const { error: updateError } = await supabase
      .from("attempts")
      .update({ strikes })
      .eq("user_id", user.id)
      .eq("test_id", testId);

    if (updateError) {
      console.warn("Could not update strikes in database:", updateError.message);
    }

    return NextResponse.json({ success: true, strikes });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
