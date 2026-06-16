import { NextResponse } from 'next/server';

async function parseJsonSafely(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.slice(0, 120)}`);
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return NextResponse.json({ success: false, message: '未上传图片' }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const botFormData = new FormData();
    botFormData.append('image', new Blob([buffer], { type: image.type }), 'canvas.png');

    const response = await fetch('http://localhost:3001/send-image', {
      method: 'POST',
      body: botFormData,
    });

    const result = await parseJsonSafely(response);
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error('Send to WeChat error:', error);
    return NextResponse.json({ success: false, message: '发送失败' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const response = await fetch('http://localhost:3001/status');
    const status = await parseJsonSafely(response);
    return NextResponse.json(status, { status: response.status });
  } catch (error) {
    console.error('Fetch WeChat status error:', error);
    return NextResponse.json({ ready: false, hasTargetContact: false, targetContactName: null });
  }
}
