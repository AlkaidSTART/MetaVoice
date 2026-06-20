export interface SendEmailRequest {
  toEmail: string;
  subject: string;
  html: string;
  imageDataUrl?: string;
}

export interface SendEmailResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
  try {
    const response = await fetch("/api/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("邮件发送失败:", errorText);
      return { success: false, error: "邮件发送失败" };
    }

    const result = await response.json();
    return { success: true, message: result.message };
  } catch (error) {
    console.error("邮件发送异常:", error);
    return { success: false, error: "邮件发送异常" };
  }
}
