/**
 * 微信机器人服务
 * 用于自动发送画布内容到微信用户
 */

import { WechatyBuilder, Contact, Message } from 'wechaty';
import { FileBox } from 'file-box';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';

const app = express();
const port = process.env.WECHATY_PORT || 3001;

// 配置 multer 用于接收图片
const upload = multer({
  dest: path.join(__dirname, '../uploads/'),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// 存储目标联系人
let targetContact: Contact | null = null;
let isBotReady = false;

// 创建机器人
const bot = WechatyBuilder.build({
  name: 'VoiceCanvasBot',
});

bot
  .on('scan', (qrcode, status) => {
    console.log(`Scan QR Code to login: https://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`);
    console.log(`Scan status: ${status}`);
  })
  .on('login', async (user) => {
    console.log(`Bot logged in as ${user.name()}`);
    isBotReady = true;
  })
  .on('logout', () => {
    console.log('Bot logged out');
    isBotReady = false;
  })
  .on('message', async (msg: Message) => {
    if (!msg.from()) return;
    
    const text = msg.text();
    const contact = msg.from()!;
    
    // 设置目标联系人（发送 "绑定" 指令）
    if (text === '绑定') {
      targetContact = contact;
      await contact.say('已绑定为目标联系人，绘图完成后将自动发送图片');
      console.log(`Target contact set: ${contact.name()}`);
    }
    
    // 查询绑定状态
    if (text === '状态') {
      if (targetContact && targetContact.id === contact.id) {
        await contact.say('您已绑定为目标联系人');
      } else {
        await contact.say('未绑定，请发送"绑定"指令');
      }
    }
  });

// 启动机器人
bot.start().catch(console.error);

// API 路由：发送图片到微信
app.post('/send-image', upload.single('image'), async (req, res) => {
  if (!isBotReady) {
    return res.status(503).json({ success: false, message: '机器人未就绪' });
  }
  
  if (!targetContact) {
    return res.status(400).json({ success: false, message: '未设置目标联系人' });
  }
  
  if (!req.file) {
    return res.status(400).json({ success: false, message: '未上传图片' });
  }
  
  try {
    const imagePath = path.join(__dirname, '../uploads/', req.file.filename);
    
    // 发送图片
    const imageFile = FileBox.fromFile(imagePath);
    await targetContact.say(imageFile);
    
    // 删除临时文件
    fs.unlinkSync(imagePath);
    
    res.json({ success: true, message: '图片发送成功' });
  } catch (error) {
    console.error('Send image error:', error);
    res.status(500).json({ success: false, message: '发送失败' });
  }
});

// API 路由：检查机器人状态
app.get('/status', (req, res) => {
  res.json({
    ready: isBotReady,
    hasTargetContact: targetContact !== null,
    targetContactName: targetContact?.name() || null,
  });
});

// API 路由：设置目标联系人
app.post('/set-contact', async (req, res) => {
  if (!isBotReady) {
    return res.status(503).json({ success: false, message: '机器人未就绪' });
  }
  
  const { contactName } = req.body;
  
  try {
    const contact = await bot.Contact.find({ name: contactName });
    
    if (!contact) {
      return res.status(404).json({ success: false, message: '未找到联系人' });
    }
    
    targetContact = contact;
    res.json({ success: true, message: `已设置目标联系人: ${contact.name()}` });
  } catch (error) {
    res.status(500).json({ success: false, message: '设置失败' });
  }
});

// 启动服务
app.listen(port, () => {
  console.log(`Wechaty server running on port ${port}`);
});
