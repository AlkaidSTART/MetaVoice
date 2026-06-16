import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File | null;

    if (!image) {
      return NextResponse.json({ success: false, message: '未上传图片' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: '图片已保存（演示模式）' 
    }, { status: 200 });
  } catch (error) {
    console.error('Send to WeChat error:', error);
    return NextResponse.json({ success: false, message: '发送失败' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    ready: true, 
    hasTargetContact: true, 
    targetContactName: '演示用户' 
  });
}