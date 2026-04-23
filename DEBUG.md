# 今天吃什么 - 调试与优化任务清单

## 一、已执行的检查与修复（本次完成）

### 1. 页面与配置完整性 ✅
- **结果**：`app.json` 中 27 个页面均有对应的 `.js/.json/.wxml/.wxss` 四件套，无缺失。
- **注意**：存在未在 `app.json` 中注册的页面/残留：
  - `pages/test-design/`：完整四件套，疑似开发/UI 测试页，未注册可保留作本地调试。
  - `pages/map-exercise/`、`pages/map-navigation/`：仅有 `.json`，无 `.js/.wxml/.wxss`，为残缺页面且未注册，建议后续若要使用则补全或删除目录。

### 2. TabBar 图标缺失 ✅ 已修复
- **问题**：`app.json` 的 `tabBar.list` 引用了 8 张图标（home/home-active, fridge/fridge-active, report/report-active, profile/profile-active），`images/` 目录下原先仅有说明文件，无实际图片，会导致底部栏图标加载失败。
- **修复**：已在 `images/` 下生成 8 个最小占位 PNG（1x1 透明图），保证 TabBar 可正常显示。后续请按 `images/README.md` 替换为正式图标（建议 81×81px，未选灰/选中绿 #4CD9A1）。
- **脚本**：`scripts/create-placeholder-icons.js` 可重复执行以重新生成占位图。

### 3. 移除本地 Mock ✅（与当前代码一致）
- **现状**：已删除 `utils/mock.js`，`app.js` 无 `useMockData` / `fastDevLogin`；`utils/api.js` 仅走真实 `wx.request` / `wx.uploadFile`。
- **联调**：需配置后端地址 `globalData.apiBaseUrl` 与微信合法域名；开发者工具可临时关闭域名校验。

### 4. 其他配置与代码
- **project.config.json**：`appid`、`libVersion`、`minified` 等配置正常。
- **sitemap.json**：规则为允许全部页面，无异常。
- **app.js**：启动流程（延迟 `checkLogin`、`getUserLocation`）、登录与静默失败逻辑合理；**`apiBaseUrl`** 为唯一 Base URL 配置入口。

---

## 二、建议的后续 Debug / 优化任务

### 高优先级
1. **替换 TabBar 图标**  
   将 `images/` 下 8 张占位图替换为正式图标（见 `images/README.md`），保证品牌与体验一致。

2. **清理或补全未注册页面**  
   - 若不需要：删除 `pages/map-exercise/`、`pages/map-navigation/` 下仅有的 `.json`，避免误注册导致白屏。  
   - 若需要：在 `app.json` 中注册并补全对应页面的 `.js/.wxml/.wxss`。

3. **真机/体验版验证**  
   - 在微信开发者工具与真机上分别验证：首页、冰箱、健康管理、我的 四个 Tab 及主要子页面（转盘、菜谱、餐厅、报告等）无报错、无白屏。  
   - 确认定位权限与 `getUserLocation` 在真机上的表现（拒绝/超时时的降级）。

### 中优先级
4. **网络与登录**  
   - 对接真实后端，验证登录、`api.login`、token 存储、401 清 token 与 `wxLogin` 流程。  
   - 若 Django 等返回 **201/204**，需同步放宽 `utils/api.js` 中 `request` 的 HTTP 状态判断，避免误失败（参见《前端接口与小程序对接说明》1.3）。  
   - 确认 `project.config.json` 中“不校验合法域名”仅在开发阶段使用，上线前配置好 request 合法域名。

5. **空状态与缺图**  
   - 按 `images/README.md` 补充空状态图（如 empty-plate、empty-fridge、empty-shop）及默认头像/商家图，避免列表为空或无图时布局/体验异常。

6. **分包与体积（若包体偏大）**  
   - 考虑将非首屏、非 Tab 页面放入分包（如 `packages` 或 `subpackages`），控制主包体积，加快首屏加载。

### 低优先级
7. **test-design 页面**  
   若仅作开发调试用，建议不加入 `app.json`；若需在真机预览，可临时注册或通过编译模式进入。

8. **控制台与日志**  
   - 上线前收敛或移除调试用 `console.log`，避免泄露内部逻辑或影响性能。

9. **权限与隐私**  
   - 核对 `app.json` 中 `permission`、`requiredPrivateInfos` 与《小程序用户隐私保护指引》一致，避免提审被拒。

---

## 三、快速自检命令（可选）

- 在项目根目录执行：  
  `node scripts/create-placeholder-icons.js`  
  用于重新生成 TabBar 占位图（若误删或需重置）。

---

*文档生成自项目优化与 Debug 检查，可根据迭代情况更新本清单。*
