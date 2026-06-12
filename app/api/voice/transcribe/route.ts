import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    if (!process.env.DASHSCOPE_API_KEY) {
      return NextResponse.json({
        transcript: "画一个红色的圆形在中间",
        warning: "DASHSCOPE_API_KEY environment variable is not defined. Falling back to local mock.",
      });
    }

    // Call DashScope Qwen3-ASR-Flash
    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen3-asr-flash",
          input: {
            audio_format: "webm",
            sample_rate: 16000,
          },
          parameters: {
            language_hints: ["zh", "en"],
          },
        }),
      }
    );

    const data = await response.json();
    return NextResponse.json({
      transcript: data.output.results[0].transcription,
      duration: data.output.results[0].duration,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
