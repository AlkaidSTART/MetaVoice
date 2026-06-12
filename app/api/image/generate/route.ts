import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    if (!process.env.DASHSCOPE_API_KEY) {
      return NextResponse.json({
        imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
        warning: "DASHSCOPE_API_KEY is not defined. Falling back to default pattern image.",
      });
    }

    const response = await fetch(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
        body: JSON.stringify({
          model: "wanx2.1-t2i-turbo",
          input: { prompt },
          parameters: {
            size: "1024*1024",
            n: 1,
            style: "<auto>",
          },
        }),
      }
    );

    const taskData = await response.json();
    const taskId = taskData.output.task_id;

    if (!taskId) {
      throw new Error(taskData.message || "Failed to start image task");
    }

    const imageUrl = await pollImageTask(taskId);
    return NextResponse.json({ imageUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

async function pollImageTask(taskId: string, maxRetries = 20): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 1200));
    const res = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      { headers: { Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}` } }
    );
    const data = await res.json();
    if (data.output.task_status === "SUCCEEDED") {
      return data.output.results[0].url;
    }
    if (data.output.task_status === "FAILED") {
      throw new Error("Image generation failed");
    }
  }
  throw new Error("Timeout");
}
