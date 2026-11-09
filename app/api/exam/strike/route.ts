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

    // Check test settings for max_strikes
    const { data: testData } = await supabase
      .from("tests")
      .select("max_strikes")
      .eq("id", testId)
      .maybeSingle();

    const maxStrikes = testData?.max_strikes ?? 3;
    if (maxStrikes === 0) {
      // Tab-switch checking disabled
      return NextResponse.json({ success: true, strikes: 0, disabled: true });
    }

    // Server-side strike persistence: higher value wins, cannot be reset downwards
    const { data: currentAttempt } = await supabase
      .from("attempts")
      .select("strikes")
      .eq("user_id", user.id)
      .eq("test_id", testId)
      .maybeSingle();

    const currentServerStrikes = currentAttempt?.strikes || 0;
    const finalStrikes = Math.max(currentServerStrikes, strikes);

    const { error: updateError } = await supabase
      .from("attempts")
      .update({ strikes: finalStrikes })
      .eq("user_id", user.id)
      .eq("test_id", testId);

    if (updateError) {
      console.warn("Could not update strikes in database:", updateError.message);
    }

    return NextResponse.json({ success: true, strikes: finalStrikes, maxStrikes });
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
