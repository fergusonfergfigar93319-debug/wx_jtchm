# 图片资源说明

本目录用于存放小程序所需的图片资源。

## 必需图片列表

### TabBar 图标（共8张，每张 81×81px，位于 `images/tabbar/`）

可通过脚本一键生成符合功能含义的图标：

```bash
npm run generate-tabbar-icons
```

1. **首页图标** - 房屋轮廓
   - `home.png` - 未选中（灰色 #8E8E93）
   - `home-active.png` - 选中（绿色 #4CD9A1）

2. **冰箱图标** - 冰箱双门轮廓
   - `fridge.png` / `fridge-active.png`

3. **健康管理图标** - 报表/图表
   - `report.png` / `report-active.png`

4. **我的图标** - 用户头像轮廓
   - `profile.png` / `profile-active.png`

### 空状态图片（建议尺寸：200x200px）

1. `empty-plate.png` - 空盘子（用于菜谱列表为空时）
2. `empty-shop.png` - 空商店（用于商家列表为空时）
3. `empty-fridge.png` - 空冰箱（用于冰箱为空时）

### 菜谱/食品图片（已配置）

- `tomato-egg.png` - 西红柿炒鸡蛋
- `shredded-pork-pepper.png` - 青椒肉丝
- `garlic-broccoli.png` - 蒜蓉西兰花
- `kungpao-chicken.png` - 宫保鸡丁
- `tomato-egg-soup.png` - 番茄鸡蛋汤
- `light-salad.png` - 轻食沙拉
- `healthy-fast-food.png` - 健康快餐
- `fried-chicken-burger.png` - 炸鸡汉堡
- `vegetarian-restaurant.png` - 素食餐厅
- `japanese-cuisine.png` - 日式料理

### 用户头像（卡通风格，已配置）

- `avatar-1.png` ~ `avatar-6.png` - 6 张预设头像供用户选择

### 默认图片

1. `default-avatar.png` - 默认头像（建议尺寸：120x120px，圆形）
2. `default-restaurant.png` - 默认商家图片（用于商家列表，建议尺寸：200x200px）

## 图片获取方式

### 方式一：使用图标库
推荐使用以下图标库：
- [IconFont](https://www.iconfont.cn/) - 阿里巴巴图标库
- [Flaticon](https://www.flaticon.com/) - 免费图标库
- [Icons8](https://icons8.com/) - 图标和插画

### 方式二：使用占位图
在开发阶段可以使用占位图：
- [Placeholder.com](https://via.placeholder.com/)
- [Lorem Picsum](https://picsum.photos/)

### 方式三：自己设计
使用设计工具（如 Figma、Sketch）设计图标。

## 图片格式要求

- **格式**: PNG（支持透明背景）
- **尺寸**: 建议使用 2x 或 3x 尺寸以适配高分辨率屏幕
- **大小**: 单张图片建议不超过 100KB
- **命名**: 使用小写字母和下划线，如 `home_active.png`

## 快速开始

如果暂时没有图片资源，可以：

1. **使用占位图**：先用占位图替代，后续再替换
2. **使用网络图片**：使用CDN上的图片URL（需要在小程序后台配置域名白名单）
3. **使用emoji**：某些场景可以用emoji替代（如空状态）

## 注意事项

1. 所有图片都需要在小程序后台配置域名白名单（如果使用网络图片）
2. TabBar图标必须是本地图片，不能使用网络图片
3. 图片路径在代码中使用相对路径，如 `/images/home.png`
