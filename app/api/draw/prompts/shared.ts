export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 360;

export const DRAW_JSON_SCHEMA_PROMPT = `【JSON Schema】
{
  "shapes": [
    {
      "type": "rectangle | circle | ellipse | line | triangle | polygon | path | text",
      "x": number,
      "y": number,
      "anchor": "top-left | center | bottom-right",
      "label": "语义标签，如 太阳/云/树/房子/兔子/小猫/鱼/船/草地/天空/星星/月亮/鸟/花/河/路/人/小孩/雪人/蘑菇/石头/栅栏/桥/秋千/滑梯 等",
      "scale": "small | medium | large | xl",
      "z": number,
      "width": number,
      "height": number,
      "radius": number,
      "rx": number, "ry": number,
      "x2": number, "y2": number,
      "points": [x1,y1,x2,y2,...],
      "segments": [
        {"cmd":"M","x":number,"y":number},
        {"cmd":"L","x":number,"y":number},
        {"cmd":"Q","x1":number,"y1":number,"x":number,"y":number},
        {"cmd":"C","x1":number,"y1":number,"x2":number,"y2":number,"x":number,"y":number},
        {"cmd":"Z"}
      ],
      "closed": boolean,
      "text": string,
      "fontSize": number,
      "fontWeight": "normal | bold",
      "fillColor": "#RRGGBB 或名称",
      "strokeColor": "#RRGGBB 或名称",
      "strokeWidth": number,
      "opacity": number,
      "rotation": number,
      "sketch": {
        "roughness": number,
        "seed": number,
        "wobble": number
      }
    }
  ],
  "backgroundColor": "#RRGGBB 或名称 | null"
}`;

export const DRAW_RULES_PROMPT = `【anchor 语义】
- top-left：(x,y) 是形状的左上角（rectangle/triangle 的左上、text 基线左端、line 起点、polygon 第一个顶点）。
- center：(x,y) 是几何中心（circle/ellipse/polygon/rectangle 的中心、text 文本框中心）。
- bottom-right：(x,y) 是右下角（rectangle）。
- path 的 (x,y) 是兜底锚点（segments 各自携带绝对坐标，x,y 仅在首段非 M 或缺省坐标时兜底）。

【label 必填规则】
- 每个 shape 必须填写 label 字段，用中文描述该图形是什么（如 太阳、云、树、房子、兔子、小猫、鱼、船、草地、天空、星星、月亮、鸟、花、河、路、人、小孩、雪人、蘑菇、石头、栅栏、桥、秋千、滑梯）。
- 组合物体（如房子=墙体+屋顶+门+窗）的每个子 shape 必须用"物体名+部件名"格式标注 label（如 房子墙体、房子屋顶、房子门、房子窗户），同一物体的子部件 label 前缀必须一致，这样系统才能将它们归为一组整体移动。
- 动物也必须用统一前缀（如 兔子身体、兔子耳朵、兔子眼睛、兔子尾巴 → 前缀都是"兔子"）。
- 背景元素（如天空底色、草地底色）也要标注 label（如 天空、草地）。

【动物绘制技法——最重要的规则】
动物绝不能只用 circle+triangle 硬拼！那样看起来像几何图形堆叠，不像活物。必须按以下技法绘制：

1. 身体轮廓用 path（闭合贝塞尔曲线）：
   - 用 M 移到起点，然后交替使用 C（三次贝塞尔）和 Q（二次贝塞尔）画出流畅的有机轮廓，最后 Z 闭合。
   - 三次贝塞尔 C 有两个控制点，可以画出 S 形弧线和自然的身体曲线。
   - 例如画兔子身体：M 左侧 → C 上方弧线到头顶 → C 头顶到右侧 → C 右侧到底部 → C 底部回到左侧 → Z
   - 身体轮廓必须 closed=true，设 fillColor 填充色和 strokeColor 描边色。

2. 耳朵用 path 或 ellipse：
   - 长耳朵（兔子）：用 path 画两条对称的闭合曲线，每条耳朵 2-3 段 C 曲线。
   - 圆耳朵（熊、猫）：用 ellipse，rx≈ry*0.6 做略扁的椭圆。
   - 尖耳朵（猫、狐狸）：用 path 画三角形但用 Q 让尖端圆润。

3. 眼睛用 circle（小圆点）+ circle（更小的高光点）：
   - 黑色眼珠：circle, radius≈4-6, fillColor="#2C2C2C"
   - 白色高光：circle, radius≈2-3, fillColor="#FFFFFF", 偏左上

4. 鼻子用 ellipse 或 path：
   - 小椭圆鼻子：ellipse, rx≈5, ry≈4, fillColor="#FF8A80"（粉色）或 "#4E342E"（棕色）
   - 三角鼻子：path 画倒三角但用 Q 让角圆润

5. 四肢用 path（闭合贝塞尔）或粗描边 path（开放曲线）：
   - 短腿：path 画小椭圆/胶囊形，closed=true, fillColor 与身体同色
   - 长腿：path 画细长闭合曲线
   - 尾巴：path 画闭合曲线（蓬松尾巴）或开放曲线（细尾巴），加 sketch 增加毛绒感

6. 必须加 sketch 手绘风格：
   - 动物的身体、耳朵、尾巴等有机形状加 sketch: {roughness: 0.4-0.7, seed: 随机整数, wobble: 0.3}
   - 眼睛、鼻子等小细节不加 sketch

7. 颜色要温暖自然：
   - 兔子：#F5F5F5（白）/ #FFCCBC（浅粉）/ #D7CCC8（灰）
   - 小猫：#FFB74D（橘）/ #9E9E9E（灰）/ #F5F5F5（白）
   - 小狗：#D7CCC8（浅棕）/ #8D6E63（深棕）/ #F5F5F5（白）
   - 小熊：#8D6E63（棕）/ #A1887F（浅棕）
   - 小猪：#F8BBD0（粉）
   - 小鸡：#FFF176（黄）+ #FF8A65（嘴/脚）
   - 青蛙：#66BB6A（绿）+ #FFF176（肚皮）

【人物绘制技法】
- 头部：circle 或 ellipse，较大
- 身体：path 画梯形/圆角矩形轮廓，closed=true
- 四肢：path 画闭合胶囊形
- 五官：小 circle（眼睛）+ path（嘴巴弧线，开放曲线，closed=false）
- 头发：path 画多条弧线，strokeColor 填色

【path 使用要点】
- path 是画有机形状的核心工具，不仅用于弧线/波浪，更是画动物身体、耳朵、尾巴、四肢的首选。
- 用 Q（二次贝塞尔）画单弧：M 起点 → Q 控制点 终点。
- 用 C（三次贝塞尔）画 S 弧或复杂曲线：M 起点 → C 控制点1 控制点2 终点。
- 闭合有机形状：closed=true 并给 fillColor 填充，末段加 {"cmd":"Z"}。
- 开放曲线（如嘴巴微笑、胡须、尾巴细线）只设 strokeColor，closed=false。
- sketch 让形状有手绘抖动感：动物/人物/植物的有机形状加 sketch（roughness 0.4-0.7）；精确几何（太阳圆盘、矩形墙、窗户）不要加。

【语义定位约定】
- 请优先用用户语言中的位置词决定区域：左上/右上/左下/右下/中间/左边/右边/上方/下方。
- 天空元素（太阳、月亮、云、星星、彩虹、鸟）必须在画布上半区；太阳默认右上安全区，不能贴边。
- 地面元素（房子、树、花、草地、道路、动物、人物）必须在画布下半区，并与地面接触或接近。
- 主要主体之间要保留清晰间距，不要把两个主体中心放在同一坐标附近。

【关键规则】
1. 画布为 ${CANVAS_WIDTH}×${CANVAS_HEIGHT}，坐标必须在 [0,${CANVAS_WIDTH}] × [0,${CANVAS_HEIGHT}] 内，元素整体不得超出画布。画布较小，请精确计算坐标，动物五官（眼睛/鼻子/嘴巴）之间只差几个像素，务必仔细对齐。
2. 颜色统一用 #RRGGBB 六位十六进制（如 #FFB7C5、#87CEEB、#4CAF50），不要写 rgb()。
3. 按 z 值规划图层：背景元素（天空、草地）z=0，主体 z=1，前景装饰 z=2+。
4. 同一物体用多个 shape 组合时，让它们的坐标/尺寸真实拼接（例如屋顶三角形的底边要落在墙体矩形顶部），且子部件之间的相对位置必须紧凑合理，不能散开——系统会按 label 前缀将同一物体的子部件作为整体移动，如果子部件之间距离过大，移动后会变形。
5. 半透明效果（云、阴影、水面反光）必须用 opacity 字段，取值 0.5-0.9。
6. 画面要面向儿童：温暖、明亮、可爱、清晰，优先使用圆润形体、简单表情、童趣自然物、家庭友好场景。
7. 画面必须合理：物体之间要符合常识和空间关系，例如房子在地面上、树长在草地上、太阳在天空、鱼在水里、人物/动物比例不要夸张失控。
8. 不要生成诡异、恐怖、阴森、畸形、肢体错乱、漂浮断裂、密集眼睛、尖牙、血迹、怪物化儿童/动物、成人化或不适合儿童的元素。
9. 如果用户描述本身偏恐怖、怪异或不适合儿童，请转译为安全童趣版本，例如"怪物"画成友好的毛绒小怪兽，"黑暗森林"画成月光下安静的小树林。
10. 只输出要求的结构，不要 markdown 代码块、不要解释文字、不要前后缀。`;

export const DRAW_EXAMPLES_PROMPT = `【参考示例 1：儿童友好单元素】
用户要"画一个红色圆形"，输出一个像贴纸一样温和明亮的圆：
{"shapes":[{"type":"circle","label":"红色圆形","x":240,"y":180,"anchor":"center","z":0,"radius":60,"fillColor":"#FF8A80","strokeColor":"#E57373","strokeWidth":3}],"backgroundColor":"#FFFFFF"}

【参考示例 2：用 path 画一只可爱的兔子（展示动物绘制技法）】
{
  "backgroundColor": "#E8F5E9",
  "shapes": [
    {"type":"rectangle","label":"草地","x":0,"y":260,"anchor":"top-left","z":0,"width":480,"height":100,"fillColor":"#A5D6A7"},
    {"type":"path","label":"兔子身体","x":0,"y":0,"anchor":"top-left","z":1,"closed":true,"fillColor":"#FAFAFA","strokeColor":"#E0E0E0","strokeWidth":2,"sketch":{"roughness":0.5,"seed":7,"wobble":0.3},"segments":[
      {"cmd":"M","x":210,"y":270},
      {"cmd":"C","x1":185,"y1":270,"x2":170,"y2":250,"x":170,"y":230},
      {"cmd":"C","x1":170,"y1":210,"x2":180,"y2":190,"x":195,"y":185},
      {"cmd":"C","x1":205,"y1":181,"x2":215,"y1":179,"x":225,"y":179},
      {"cmd":"C","x1":235,"y1":179,"x2":245,"y1":181,"x":255,"y":185},
      {"cmd":"C","x1":270,"y1":190,"x2":280,"y2":210,"x":280,"y":230},
      {"cmd":"C","x1":280,"y2":250,"x2":265,"y2":270,"x":240,"y":270},
      {"cmd":"Z"}
    ]},
    {"type":"path","label":"兔子头","x":0,"y":0,"anchor":"top-left","z":2,"closed":true,"fillColor":"#FAFAFA","strokeColor":"#E0E0E0","strokeWidth":2,"sketch":{"roughness":0.5,"seed":8,"wobble":0.3},"segments":[
      {"cmd":"M","x":225,"y":185},
      {"cmd":"C","x1":205,"y1":185,"x2":190,"y2":170,"x":190,"y":155},
      {"cmd":"C","x1":190,"y1":140,"x2":200,"y2":130,"x":225,"y":130},
      {"cmd":"C","x1":250,"y1":130,"x2":260,"y2":140,"x":260,"y":155},
      {"cmd":"C","x1":260,"y2":170,"x2":245,"y2":185,"x":225,"y":185},
      {"cmd":"Z"}
    ]},
    {"type":"path","label":"兔子左耳","x":0,"y":0,"anchor":"top-left","z":2,"closed":true,"fillColor":"#FAFAFA","strokeColor":"#E0E0E0","strokeWidth":2,"sketch":{"roughness":0.5,"seed":9,"wobble":0.3},"segments":[
      {"cmd":"M","x":208,"y":135},
      {"cmd":"C","x1":205,"y1":120,"x2":200,"y2":95,"x":203,"y":85},
      {"cmd":"C","x1":204,"y1":78,"x2":213,"y2":78,"x":215,"y":85},
      {"cmd":"C","x1":218,"y1":95,"x2":215,"y2":120,"x":213,"y":135},
      {"cmd":"Z"}
    ]},
    {"type":"path","label":"兔子右耳","x":0,"y":0,"anchor":"top-left","z":2,"closed":true,"fillColor":"#FAFAFA","strokeColor":"#E0E0E0","strokeWidth":2,"sketch":{"roughness":0.5,"seed":10,"wobble":0.3},"segments":[
      {"cmd":"M","x":238,"y":135},
      {"cmd":"C","x1":235,"y1":120,"x2":233,"y2":95,"x":235,"y":85},
      {"cmd":"C","x1":237,"y1":78,"x2":245,"y2":78,"x":248,"y":85},
      {"cmd":"C","x1":250,"y1":95,"x2":248,"y2":120,"x":245,"y":135},
      {"cmd":"Z"}
    ]},
    {"type":"path","label":"兔子左耳内","x":0,"y":0,"anchor":"top-left","z":3,"closed":true,"fillColor":"#FFCDD2","strokeColor":"#FFCDD2","strokeWidth":1,"sketch":{"roughness":0.4,"seed":11,"wobble":0.2},"segments":[
      {"cmd":"M","x":207,"y":133},
      {"cmd":"C","x1":205,"y1":119,"x2":202,"y2":98,"x":204,"y":89},
      {"cmd":"C","x1":205,"y1":83,"x2":211,"y2":83,"x":213,"y":89},
      {"cmd":"C","x1":215,"y1":98,"x2":214,"y2":119,"x":212,"y":133},
      {"cmd":"Z"}
    ]},
    {"type":"path","label":"兔子右耳内","x":0,"y":0,"anchor":"top-left","z":3,"closed":true,"fillColor":"#FFCDD2","strokeColor":"#FFCDD2","strokeWidth":1,"sketch":{"roughness":0.4,"seed":12,"wobble":0.2},"segments":[
      {"cmd":"M","x":239,"y":133},
      {"cmd":"C","x1":237,"y1":119,"x2":235,"y2":98,"x":237,"y":89},
      {"cmd":"C","x1":238,"y1":83,"x2":244,"y2":83,"x":246,"y":89},
      {"cmd":"C","x1":248,"y1":98,"x2":246,"y2":119,"x":244,"y":133},
      {"cmd":"Z"}
    ]},
    {"type":"circle","label":"兔子左眼","x":213,"y":153,"anchor":"center","z":3,"radius":3,"fillColor":"#37474F"},
    {"type":"circle","label":"兔子左眼高光","x":212,"y":152,"anchor":"center","z":4,"radius":1.2,"fillColor":"#FFFFFF"},
    {"type":"circle","label":"兔子右眼","x":238,"y":153,"anchor":"center","z":3,"radius":3,"fillColor":"#37474F"},
    {"type":"circle","label":"兔子右眼高光","x":237,"y":152,"anchor":"center","z":4,"radius":1.2,"fillColor":"#FFFFFF"},
    {"type":"ellipse","label":"兔子鼻子","x":225,"y":163,"anchor":"center","z":3,"rx":3,"ry":2,"fillColor":"#FF8A80"},
    {"type":"path","label":"兔子嘴巴","x":0,"y":0,"anchor":"top-left","z":3,"closed":false,"strokeColor":"#BCAAA4","strokeWidth":1.5,"segments":[
      {"cmd":"M","x":225,"y":165},
      {"cmd":"Q","x1":220,"y1":169,"x":218,"y":168},
      {"cmd":"M","x":225,"y":165},
      {"cmd":"Q","x1":230,"y1":169,"x":233,"y":168}
    ]},
    {"type":"path","label":"兔子尾巴","x":0,"y":0,"anchor":"top-left","z":2,"closed":true,"fillColor":"#FFFFFF","strokeColor":"#E0E0E0","strokeWidth":1.5,"sketch":{"roughness":0.6,"seed":13,"wobble":0.4},"segments":[
      {"cmd":"M","x":278,"y":230},
      {"cmd":"C","x1":285,"y1":225,"x2":290,"y2":228,"x":290,"y":233},
      {"cmd":"C","x1":290,"y1":238,"x2":285,"y2":240,"x":278,"y":238},
      {"cmd":"Z"}
    ]},
    {"type":"path","label":"兔子前左腿","x":0,"y":0,"anchor":"top-left","z":2,"closed":true,"fillColor":"#FAFAFA","strokeColor":"#E0E0E0","strokeWidth":1.5,"sketch":{"roughness":0.4,"seed":14,"wobble":0.3},"segments":[
      {"cmd":"M","x":198,"y":260},
      {"cmd":"C","x1":193,"y1":260,"x2":190,"y2":265,"x":193,"y":270},
      {"cmd":"C","x1":195,"y1":274,"x2":205,"y2":274,"x":208,"y":270},
      {"cmd":"C","x1":210,"y1":265,"x2":208,"y2":260,"x":203,"y":260},
      {"cmd":"Z"}
    ]},
    {"type":"path","label":"兔子前右腿","x":0,"y":0,"anchor":"top-left","z":2,"closed":true,"fillColor":"#FAFAFA","strokeColor":"#E0E0E0","strokeWidth":1.5,"sketch":{"roughness":0.4,"seed":15,"wobble":0.3},"segments":[
      {"cmd":"M","x":248,"y":260},
      {"cmd":"C","x1":243,"y1":260,"x2":240,"y2":265,"x":243,"y":270},
      {"cmd":"C","x1":245,"y1":274,"x2":255,"y2":274,"x":258,"y":270},
      {"cmd":"C","x1":260,"y1":265,"x2":258,"y2":260,"x":253,"y":260},
      {"cmd":"Z"}
    ]}
  ]
}

【参考示例 3：蓝天白云下的小房子，旁边有树，太阳在右上角】
{
  "backgroundColor": "#E3F2FD",
  "shapes": [
    {"type":"rectangle","label":"草地","x":0,"y":250,"anchor":"top-left","z":0,"width":480,"height":110,"fillColor":"#A5D6A7"},
    {"type":"circle","label":"太阳","x":410,"y":60,"anchor":"center","z":1,"radius":28,"fillColor":"#FFD54F","strokeColor":"#FFB300","strokeWidth":2},
    {"type":"rectangle","label":"房子墙体","x":180,"y":200,"anchor":"top-left","z":1,"width":120,"height":75,"fillColor":"#FFE0B2","strokeColor":"#A1887F","strokeWidth":2},
    {"type":"polygon","label":"房子屋顶","x":180,"y":200,"anchor":"top-left","z":2,"points":[180,200,240,150,300,200],"fillColor":"#EF9A9A","strokeColor":"#D87A7A","strokeWidth":2},
    {"type":"rectangle","label":"房子门","x":225,"y":235,"anchor":"top-left","z":2,"width":30,"height":40,"fillColor":"#5D4037"},
    {"type":"rectangle","label":"房子窗户","x":190,"y":215,"anchor":"top-left","z":2,"width":25,"height":25,"fillColor":"#81D4FA","strokeColor":"#FFFFFF","strokeWidth":1.5},
    {"type":"rectangle","label":"树干","x":100,"y":215,"anchor":"top-left","z":1,"width":14,"height":60,"fillColor":"#6D4C41"},
    {"type":"circle","label":"树冠","x":107,"y":200,"anchor":"center","z":1,"radius":40,"fillColor":"#66BB6A","sketch":{"roughness":0.5,"seed":12,"wobble":0.4}},
    {"type":"ellipse","label":"云","x":300,"y":90,"anchor":"center","z":2,"rx":35,"ry":16,"fillColor":"#FFFFFF","opacity":0.9},
    {"type":"ellipse","label":"云","x":330,"y":98,"anchor":"center","z":2,"rx":28,"ry":14,"fillColor":"#FFFFFF","opacity":0.9}
  ]
}`;
