## 应季食材图片命名约定

本目录由脚本生成 **600×600**（统一风格插画）PNG。若需重新生成（改 `scripts/generate-seasonal-images.js` 内 SVG 后），在项目根目录执行：

```bash
npm run generate-seasonal-images
```

把 PNG 图片放到本目录后，页面会自动优先展示图片；如果没放图，会自动降级为 emoji 封面。

### 统一命名（脚本默认 600×600 PNG）

- `bamboo_shoot.png`：春笋
- `spinach.png`：菠菜
- `strawberry.png`：草莓
- `pea.png`：豌豆
- `toon.png`：香椿

### 可选扩展

后续新增食材时，建议在 `packageCook/seasonal/seasonal.js` 里补充映射：

- 食材名 -> 图片路径 `/images/seasonal/<xxx>.png`

### 近期补充的命名（与 `seasonal.js` 中 `detailMap` / `imageMap` 对应）

- `leek.png`：韭菜  
- `tomato.png`：番茄  
- `asparagus.png`：芦笋  
- `cherry.png`：樱桃  
- `broad_bean.png`：蚕豆  
- `cucumber.png`：黄瓜  
- `orange.png`：橙子  

将对应 PNG 放入本目录后，应季页会自动显示大图；未放置时仍使用渐变 + emoji 封面。

