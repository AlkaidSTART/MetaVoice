import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    
    if (!image) {
      return NextResponse.json({ success: false, message: '未上传图片' }, { status: 400 });
    }
    
    // 转换为 Buffer
    const buffer = Buffer.from(await image.arrayBuffer());
    
    // 创建 FormData 发送到微信机器人服务
    const botFormData = new FormData();
    botFormData.append('image', new Blob([buffer], { type: image.type }), 'canvas.png');
    
    const response = await fetch('http://localhost:3001/send-image', {
      method: 'POST',
      body: botFormData,
    });
    
    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Send to WeChat error:', error);
    return NextResponse.json({ success: false, message: '发送失败' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const response = await fetch('http://localhost:3001/status');
    const status = await response.json();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ ready: false, hasTargetContact: false, targetContactName: null });
  }
}