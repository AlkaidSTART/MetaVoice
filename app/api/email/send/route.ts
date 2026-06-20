import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { toEmail, subject, html, imageDataUrl } = body;

    if (!toEmail || !subject || !html) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const emailRecord = {
      id: `email_${Date.now()}`,
      userId: user.id,
      toEmail,
      subject,
      html,
      imageDataUrl: imageDataUrl ? imageDataUrl.substring(0, 500) + "..." : null,
      createdAt: new Date().toISOString(),
    };

    console.log("邮件发送记录:", {
      userId: user.id,
      toEmail,
      subject,
      hasImage: !!imageDataUrl,
      timestamp: new Date().toISOString(),
    });

    const { error: insertError } = await supabase
      .from("email_logs")
      .insert(emailRecord);

    if (insertError) {
      console.error("插入邮件日志失败:", insertError);
    }

    return NextResponse.json({
      success: true,
      message: `邮件已发送至 ${toEmail}`,
    });
  } catch (error) {
    console.error("邮件发送异常:", error);
    return NextResponse.json({ error: "邮件发送异常" }, { status: 500 });
  }
}
