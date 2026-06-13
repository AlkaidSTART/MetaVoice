import { dashScopeFetch } from "@/lib/dashscope/client";

export type ImageGenerationResult = {
  imageUrl: string;
  taskId: string;
  raw?: unknown;
};

export async function generateImageWithDashScope(
  prompt: string,
  sourceImageDataUrl?: string,
): Promise<ImageGenerationResult> {
  const sourceImage = sourceImageDataUrl?.startsWith("data:")
    ? sourceImageDataUrl
    : undefined;
  const response = await dashScopeFetch(
    "/api/v1/services/aigc/text2image/image-synthesis",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: "wanx2.1-t2i-turbo",
        input: {
          prompt,
          ...(sourceImage ? { base_image_url: sourceImage } : {}),
        },
        parameters: {
          size: "1024*1024",
          n: 1,
          style: "<auto>",
        },
      }),
    },
  );

  const taskData = await response.json();
  const taskId = taskData?.output?.task_id;

  if (!taskId) {
    throw new Error(taskData?.message || "Failed to create image generation task");
  }

  const imageUrl = await pollImageTask(taskId);

  return {
    imageUrl,
    taskId,
    raw: taskData,
  };
}

async function pollImageTask(taskId: string, maxRetries = 25) {
  for (let index = 0; index < maxRetries; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const response = await dashScopeFetch(`/api/v1/tasks/${taskId}`);
    const data = await response.json();
    const status = data?.output?.task_status;

    if (status === "SUCCEEDED") {
      const url = data?.output?.results?.[0]?.url;

      if (!url) {
        throw new Error("Image task succeeded but no result URL was returned");
      }

      return url;
    }

    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(`Image generation failed with status: ${status}`);
    }
  }

  throw new Error("Image generation timed out");
}
