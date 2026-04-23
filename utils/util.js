// utils/util.js - 工具函数
const app = getApp()

/**
 * 高德等外站图片常为 http，在 HTTPS/H5 下会触发 Mixed Content；小程序拉取也更稳妥用 https。
 * 不改动本地开发地址（localhost / 内网 IP），避免断连本机 API。
 */
function normalizeExternalImageUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const u = url.trim()
  if (!u || !/^http:\/\//i.test(u)) return u
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(u)) return u
  if (/^http:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u)) return u
  return 'https://' + u.slice(7)
}

/**
 * 後端常返回的「假封面」：尺寸 placeholder、占位站、預設圖檔名等，應視為無圖並走本地兜底。
 */
function isBackendDummyImageUrl(url) {
  if (!url || typeof url !== 'string') return true
  let s
  try {
    s = decodeURIComponent(url.trim()).toLowerCase()
  } catch (e) {
    s = url.trim().toLowerCase()
  }
  if (!s) return true
  // 路徑或檔名中帶 200×200 等典型占位尺寸
  if (/200\s*[x×*]\s*200/.test(s)) return true
  // 常见占位图服务
  if (/via\.placeholder\.com|placehold\.it|placehold\.co|dummyimage\.com|fakeimg\.pl|picsum\.photos/.test(s)) return true
  if (/placeholder\.com|placekitten|placeholder\.porn|lorempixel/.test(s)) return true
  // 路徑或檔名暗示占位/默认
  if (/\/(?:default|placeholder|empty|dummy|no[-_]?image|missing)[^/]*\.(png|jpe?g|webp|gif)(\?|$)/i.test(s)) return true
  if (/[?&](?:w|width)=200\b[^&]*[&?]?(?:h|height)=200\b/i.test(s)) return true
  return false
}

/** 列表/推薦中不展示的商家名（全角括號會正規化為半角後比對） */
function normalizeRestaurantListName(s) {
  return String(s || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
}

const HIDDEN_RESTAURANT_NAMES = new Set([
  normalizeRestaurantListName('必胜客(文理学院店)')
])

/**
 * 是否從「幫我選」「點外賣」等列表中過濾該條（命中黑名單且非菜譜）。
 */
function shouldHideRestaurantListItem(item) {
  if (!item || typeof item !== 'object') return false
  if (item.type === 'recipe') return false
  if (Array.isArray(item.ingredients) && item.ingredients.length > 0) return false
  const names = [item.name, item.store_name, item.restaurant_name]
    .map(normalizeRestaurantListName)
    .filter(Boolean)
  return names.some(n => HIDDEN_RESTAURANT_NAMES.has(n))
}

/** 主包内菜谱封面兜底图（images/recipes 与 images/covers） */
const RECIPE_COVER_FALLBACK_POOL = [
  '/images/recipes/placeholder-stirfry.png',
  '/images/recipes/placeholder-salad.png',
  '/images/recipes/placeholder-meat-dish.png',
  '/images/recipes/placeholder-soup.png',
  '/images/recipes/placeholder-bowl.png',
  '/images/recipes/placeholder-combo.png',
  '/images/covers/light-salad.png',
  '/images/covers/japanese-cuisine.png'
]

function simpleHash(str) {
  let h = 0
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/**
 * 从接口对象提取首张可用的菜谱封面 URL（多字段兼容）
 */
function pickRecipeCoverFromPayload(raw) {
  if (!raw || typeof raw !== 'object') return ''
  const keys = ['image', 'cover_image', 'cover', 'cover_url', 'thumb', 'thumbnail', 'photo', 'pic', 'picture']
  for (let i = 0; i < keys.length; i++) {
    const v = raw[keys[i]]
    if (v != null && String(v).trim()) {
      const u = normalizeExternalImageUrl(String(v).trim())
      if (u && !isBackendDummyImageUrl(u)) return u
    }
  }
  if (Array.isArray(raw.photos) && raw.photos.length) {
    const p0 = raw.photos[0]
    const s = typeof p0 === 'string' ? p0 : (p0 && (p0.url || p0.image || p0.src))
    if (s) {
      const u = normalizeExternalImageUrl(String(s).trim())
      if (u && !isBackendDummyImageUrl(u)) return u
    }
  }
  return ''
}

const RECIPE_COVER_KEYWORD_FALLBACKS = [
  { re: /意面|披萨|通心粉|千层面|pasta/i, path: '/images/recipes/placeholder-pasta.png' },
  { re: /奶昔|果汁|果昔|思慕雪|smoothie/i, path: '/images/recipes/placeholder-smoothie.png' },
  { re: /沙拉|轻食/, path: '/images/recipes/placeholder-salad.png' },
  { re: /汤|粥|羹|煲|炖/, path: '/images/recipes/placeholder-soup.png' },
  { re: /面|粉|卤|拉面|米线|河粉|面条|炒面|拌面|打卤/, path: '/images/recipes/placeholder-noodles.png' },
  { re: /鸡|鸭|牛|羊|排骨|肉|鱼|虾|蟹|蛋/, path: '/images/recipes/placeholder-meat-dish.png' },
  { re: /炒|煎|爆|烧|烤/, path: '/images/recipes/placeholder-stirfry.png' }
]

/**
 * 后端未返回或外链失效时，用语义关键词 + 稳定哈希选用本地封面，避免列表灰块。
 */
function resolveRecipeCoverUrl(recipe) {
  const primary = pickRecipeCoverFromPayload(recipe)
  if (primary) return primary
  const name = String(recipe && recipe.name || '')
  for (let i = 0; i < RECIPE_COVER_KEYWORD_FALLBACKS.length; i++) {
    const row = RECIPE_COVER_KEYWORD_FALLBACKS[i]
    if (row.re.test(name)) return row.path
  }
  const seed = String((recipe && recipe.id != null ? recipe.id : '') + name)
  const idx = simpleHash(seed) % RECIPE_COVER_FALLBACK_POOL.length
  return RECIPE_COVER_FALLBACK_POOL[idx]
}

/** 門店/商家無圖時的本地提示圖（主包 images/placeholders） */
const RESTAURANT_NO_COVER_PLACEHOLDER = '/images/placeholders/restaurant-no-cover.png'

/**
 * 與菜譜相同欄位兼容；無有效外鏈時返回「暫無店鋪圖」佔位圖路徑。
 */
function resolveRestaurantCoverUrl(entity) {
  const primary = pickRecipeCoverFromPayload(entity)
  if (primary) return primary
  return RESTAURANT_NO_COVER_PLACEHOLDER
}

/** 头像 URL 加时间戳，避免保存同地址后 <image> 仍显示旧缓存 */
function withAvatarCacheBust(url) {
  if (!url || typeof url !== 'string') return ''
  const t = Date.now()
  return url.indexOf('?') >= 0 ? `${url}&_t=${t}` : `${url}?_t=${t}`
}

/**
 * 从接口返回体（含 data / profile / user 等嵌套）中解析头像 URL。
 * 兼容 snake_case、camelCase 及仅返回 file_url 的上传响应。
 */
function extractAvatarUrlFromPayload(raw) {
  if (raw == null) return ''
  if (typeof raw === 'string') {
    const t = raw.trim()
    return t
  }
  if (typeof raw !== 'object') return ''
  const keys = [
    'avatar',
    'avatar_url',
    'avatarUrl',
    'AvatarUrl',
    'headimgurl',
    'head_img',
    'headimg',
    'photo',
    'image_url',
    'profile_picture',
    'file_url',
    'file_url_display'
  ]
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (Object.prototype.hasOwnProperty.call(raw, k)) {
      const v = raw[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  if (typeof raw.file === 'string' && raw.file.trim()) return raw.file.trim()
  if (typeof raw.url === 'string') {
    const u = raw.url.trim()
    if (u && (/^https?:\/\//i.test(u) || u.startsWith('/') || u.startsWith('wxfile://'))) return u
  }
  const nests = ['data', 'profile', 'user', 'result', 'body']
  for (let j = 0; j < nests.length; j++) {
    const nest = raw[nests[j]]
    if (nest != null && typeof nest === 'object') {
      const inner = extractAvatarUrlFromPayload(nest)
      if (inner) return inner
    }
  }
  return ''
}

// 格式化日期
function formatDate(date, format = 'YYYY-MM-DD') {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
}

// 计算时间差（用于显示食材新鲜度）
function timeAgo(date) {
  const now = new Date()
  const past = new Date(date)
  const diff = now - past
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  return `${Math.floor(days / 30)}个月前`
}

// 食材同义词映射（用于模糊匹配）
const ingredientSynonyms = {
  '西红柿': ['番茄', '番茄', 'tomato'],
  '鸡蛋': ['蛋', '鸡蛋', 'egg'],
  '土豆': ['马铃薯', '洋芋', 'potato'],
  '青椒': ['甜椒', '彩椒', 'pepper'],
  '洋葱': ['葱头', 'onion'],
  '大蒜': ['蒜', '蒜头', 'garlic'],
  '胡萝卜': ['红萝卜', 'carrot'],
  '白菜': ['大白菜', 'cabbage'],
  '花菜': ['花椰菜', 'cauliflower'],
  '茄子': ['茄', 'eggplant']
}

// 标准化食材名称
function normalizeIngredient(name) {
  for (const [standard, synonyms] of Object.entries(ingredientSynonyms)) {
    if (synonyms.includes(name) || name === standard) {
      return standard
    }
  }
  return name
}

// 计算BMI
function calculateBMI(height, weight) {
  if (!height || !weight) return 0
  const heightInM = height / 100
  return (weight / (heightInM * heightInM)).toFixed(1)
}

// 格式化卡路里
function formatCalories(cal) {
  if (cal >= 1000) {
    return `${(cal / 1000).toFixed(1)}k`
  }
  return Math.round(cal).toString()
}

// 健康评分颜色
function getHealthColor(score) {
  if (score >= 80) return 'health-green'
  if (score >= 60) return 'health-yellow'
  return 'health-red'
}

// 健康评分文字
function getHealthText(score) {
  if (score >= 80) return '🟢 推荐'
  if (score >= 60) return '🟡 适量'
  return '🔴 高热量'
}

// 根据商家信息计算健康评分（红绿灯避雷针）
function calculateHealthScore(restaurant) {
  if (!restaurant) return 50
  
  // 如果已有健康评分，直接使用
  if (restaurant.health_score !== undefined && restaurant.health_score !== null) {
    return restaurant.health_score
  }
  
  let score = 50 // 基础分
  const name = (restaurant.name || '').toLowerCase()
  const tags = restaurant.tags || []
  const tagStr = tags.join(' ').toLowerCase()
  
  // 高热量关键词（减分）
  const highCalorieKeywords = [
    '炸', '炸鸡', '烧烤', '火锅', '麻辣', '重口味', '油腻', 
    '汉堡', '披萨', '快餐', '油炸', '炸串', '炸物'
  ]
  
  // 健康关键词（加分）
  const healthyKeywords = [
    '轻食', '沙拉', '健康', '低脂', '低卡', '减脂', '健身', 
    '素食', '有机', '天然', '清淡', '蒸', '煮', '炖'
  ]
  
  // 检查高热量关键词
  for (const keyword of highCalorieKeywords) {
    if (name.includes(keyword) || tagStr.includes(keyword)) {
      score -= 20
    }
  }
  
  // 检查健康关键词
  for (const keyword of healthyKeywords) {
    if (name.includes(keyword) || tagStr.includes(keyword)) {
      score += 15
    }
  }
  
  // 根据评分范围调整
  if (restaurant.rating) {
    const rating = parseFloat(restaurant.rating) || 0
    // 评分高的商家可能更注重品质，适当加分
    if (rating >= 4.5) {
      score += 5
    }
  }
  
  // 限制在0-100范围内
  score = Math.max(0, Math.min(100, score))
  
  return Math.round(score)
}

// 获取健康等级（红绿灯）
function getHealthLevel(score) {
  if (score >= 80) return { level: 'green', label: '🟢 健康推荐', desc: '轻食绿洲' }
  if (score >= 60) return { level: 'yellow', label: '🟡 适量选择', desc: '普通商家' }
  return { level: 'red', label: '🔴 热量炸弹', desc: '高油高盐' }
}

// 计算价格/蛋白比（每克蛋白质单价）
function calculatePricePerProtein(price, protein) {
  if (!price || !protein || protein <= 0) return null
  const priceNum = parseFloat(price)
  const proteinNum = parseFloat(protein)
  if (isNaN(priceNum) || isNaN(proteinNum) || proteinNum <= 0) return null
  return (priceNum / proteinNum).toFixed(2)
}

// 格式化价格/蛋白比显示
function formatPricePerProtein(pricePerProtein) {
  if (!pricePerProtein) return null
  return `¥${pricePerProtein}/g蛋白`
}

// 食材替代知识库
const ingredientSubstitutes = {
  '料酒': [
    { name: '白酒', impact: '风味更浓，去腥效果更好' },
    { name: '黄酒', impact: '风味相似，更温和' },
    { name: '柠檬汁', impact: '去腥效果，但风味不同' }
  ],
  '生抽': [
    { name: '老抽', impact: '颜色更深，味道更重' },
    { name: '酱油', impact: '基本可替代' },
    { name: '盐', impact: '只有咸味，缺少鲜味' }
  ],
  '老抽': [
    { name: '生抽+糖', impact: '颜色和甜度接近' },
    { name: '酱油', impact: '颜色稍浅' }
  ],
  '醋': [
    { name: '柠檬汁', impact: '酸味相似，但风味不同' },
    { name: '白醋', impact: '酸度相似，但缺少香味' }
  ],
  '糖': [
    { name: '蜂蜜', impact: '甜度更高，有特殊香味' },
    { name: '冰糖', impact: '甜度相似，更清甜' }
  ],
  '盐': [
    { name: '生抽', impact: '有咸味和鲜味' },
    { name: '酱油', impact: '有咸味和鲜味' }
  ],
  '姜': [
    { name: '姜粉', impact: '风味相似，但缺少新鲜感' },
    { name: '姜汁', impact: '风味相似' }
  ],
  '蒜': [
    { name: '蒜粉', impact: '风味相似，但缺少新鲜感' },
    { name: '蒜蓉', impact: '风味相似' }
  ],
  '葱': [
    { name: '洋葱', impact: '风味不同，但可增加香味' },
    { name: '小葱', impact: '风味相似' }
  ],
  '香菜': [
    { name: '芹菜叶', impact: '风味相似，但稍淡' },
    { name: '小葱', impact: '可增加香味，但风味不同' }
  ],
  '辣椒': [
    { name: '辣椒粉', impact: '辣度相似，但缺少新鲜感' },
    { name: '干辣椒', impact: '辣度更高，风味不同' }
  ],
  '牛奶': [
    { name: '椰奶', impact: '风味不同，但可增加香味' },
    { name: '豆浆', impact: '营养相似，但风味不同' }
  ],
  '黄油': [
    { name: '植物油', impact: '缺少奶香味' },
    { name: '猪油', impact: '风味不同，但可增加香味' }
  ],
  '鸡蛋': [
    { name: '鸭蛋', impact: '风味相似，但稍腥' },
    { name: '鹌鹑蛋', impact: '风味相似，但体积小' }
  ]
}

// 获取食材替代建议
function getIngredientSubstitute(ingredientName) {
  if (!ingredientName) return null
  
  // 精确匹配
  if (ingredientSubstitutes[ingredientName]) {
    return ingredientSubstitutes[ingredientName]
  }
  
  // 模糊匹配
  const normalizedName = ingredientName.toLowerCase()
  for (const [key, substitutes] of Object.entries(ingredientSubstitutes)) {
    if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
      return substitutes
    }
  }
  
  return null
}

// 食材市场均价（元/单位，用于成本估算）
const ingredientMarketPrices = {
  // 蔬菜类（元/斤）
  '西红柿': 5, '番茄': 5, '土豆': 3, '青椒': 6, '洋葱': 4, '胡萝卜': 4,
  '白菜': 2, '菠菜': 5, '芹菜': 5, '黄瓜': 4, '茄子': 5, '豆角': 8,
  '蘑菇': 8, '萝卜': 2, '南瓜': 3, '西兰花': 8,
  // 肉禽类（元/斤）
  '鸡胸肉': 15, '鸡肉': 12, '牛肉': 45, '猪肉': 25, '羊肉': 40,
  // 水产类（元/斤）
  '鱼': 20, '虾': 35, '蟹': 50,
  // 蛋奶类
  '鸡蛋': 6, '牛奶': 12, '酸奶': 8,
  // 主食类（元/斤）
  '大米': 5, '面条': 6,
  // 调料类（元/瓶或元/包）
  '油': 15, '盐': 3, '糖': 5, '醋': 5, '酱油': 8, '料酒': 8
}

// 估算食材成本
function estimateIngredientCost(ingredientName, amount, unit) {
  if (!ingredientName || !amount) return 0
  
  // 获取市场均价
  let pricePerUnit = ingredientMarketPrices[ingredientName] || 0
  
  // 如果找不到精确匹配，尝试模糊匹配
  if (pricePerUnit === 0) {
    const normalizedName = ingredientName.toLowerCase()
    for (const [key, price] of Object.entries(ingredientMarketPrices)) {
      if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
        pricePerUnit = price
        break
      }
    }
  }
  
  if (pricePerUnit === 0) return 0 // 无法估算
  
  // 根据单位转换
  let cost = 0
  if (unit === 'g' || unit === '克') {
    cost = (pricePerUnit / 500) * amount // 假设价格是元/斤，1斤=500g
  } else if (unit === 'kg' || unit === '千克') {
    cost = pricePerUnit * amount * 2 // 1kg = 2斤
  } else if (unit === '斤') {
    cost = pricePerUnit * amount
  } else if (unit === '个' || unit === '只' || unit === '条' || unit === '根') {
    // 假设单个食材的平均重量，这里简化处理
    cost = pricePerUnit * amount * 0.1 // 假设每个约0.1斤
  } else if (unit === '适量') {
    cost = pricePerUnit * 0.05 // 适量按0.05斤计算
  } else {
    // 其他单位，按默认处理
    cost = pricePerUnit * amount * 0.1
  }
  
  return Math.round(cost * 100) / 100 // 保留2位小数
}

// 估算菜谱总成本
function estimateRecipeCost(ingredients) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return 0
  
  let totalCost = 0
  ingredients.forEach(ing => {
    const name = ing.name || ''
    const amount = parseFloat(ing.amount || 0) || 0
    const unit = ing.unit || ing.amount?.replace(/[\d.]/g, '') || '个'
    
    const cost = estimateIngredientCost(name, amount, unit)
    totalCost += cost
  })
  
  return Math.round(totalCost * 100) / 100
}

// 食材价格数据库（市场均价，单位：元/斤或元/个）
const ingredientPrices = {
  // 蔬菜类（元/斤）
  '西红柿': 5, '番茄': 5, '土豆': 3, '青椒': 6, '洋葱': 4, '胡萝卜': 4, '西兰花': 8,
  '白菜': 2, '菠菜': 5, '芹菜': 5, '黄瓜': 4, '茄子': 5, '豆角': 6, '蘑菇': 8,
  '萝卜': 3, '南瓜': 3, '冬瓜': 2, '丝瓜': 5, '苦瓜': 6, '豆芽': 3, '韭菜': 5,
  '生菜': 4, '青菜': 3, '花菜': 5, '莲藕': 6, '山药': 8, '芋头': 5, '红薯': 3,
  // 肉禽类（元/斤）
  '鸡胸肉': 15, '鸡肉': 12, '鸡': 12, '鸡腿': 10, '鸡翅': 18, '牛肉': 45, '牛排': 60,
  '猪肉': 25, '排骨': 30, '里脊': 28, '五花肉': 25, '羊肉': 40, '鸭肉': 12, '鸭': 12,
  '培根': 35, '火腿': 20,
  // 水产类（元/斤）
  '鱼': 15, '鱼肉': 15, '草鱼': 12, '鲫鱼': 10, '带鱼': 20, '三文鱼': 50,
  '虾': 35, '大虾': 40, '小虾': 25, '基围虾': 45, '蟹': 50, '螃蟹': 50, '大闸蟹': 80,
  '鱿鱼': 25, '章鱼': 30, '墨鱼': 25, '贝类': 15, '扇贝': 20, '生蚝': 15, '蛤蜊': 12,
  // 主食类（元/斤）
  '大米': 5, '米饭': 5, '米': 5, '面条': 4, '面': 4, '挂面': 4, '方便面': 3,
  '面包': 8, '馒头': 3, '花卷': 3, '饺子': 15, '包子': 12, '馄饨': 15, '汤圆': 10,
  '年糕': 6, '米粉': 5, '河粉': 5,
  // 蛋奶类
  '鸡蛋': 0.8, '蛋': 0.8, '鸡蛋白': 0.8, '蛋黄': 0.8, '鸭蛋': 1, '鹌鹑蛋': 0.3,
  '牛奶': 12, '酸奶': 8, '奶酪': 30, '芝士': 30, '黄油': 25, '奶油': 20,
  // 水果类（元/斤）
  '苹果': 8, '香蕉': 5, '橙子': 6, '橘子': 5, '葡萄': 12, '草莓': 20, '西瓜': 3,
  '哈密瓜': 6, '桃子': 8, '梨': 6, '樱桃': 30, '芒果': 10, '菠萝': 5, '柠檬': 8,
  '柚子': 5, '火龙果': 8, '猕猴桃': 12, '蓝莓': 40, '荔枝': 15,
  // 调料类
  '油': 15, '食用油': 15, '盐': 3, '糖': 5, '醋': 5, '酱油': 8, '生抽': 8, '老抽': 8,
  '料酒': 6, '蒜': 8, '大蒜': 8, '姜': 10, '生姜': 10, '葱': 5, '大葱': 5, '小葱': 5,
  '香菜': 8, '胡椒': 20, '辣椒': 8, '花椒': 30, '八角': 25, '桂皮': 30
}

// 估算食材价格
function estimateIngredientPrice(name, amount) {
  if (!name) return 0
  
  // 查找价格
  let pricePerUnit = 0
  const normalizedName = name.toLowerCase()
  
  for (const [key, price] of Object.entries(ingredientPrices)) {
    if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
      pricePerUnit = price
      break
    }
  }
  
  if (pricePerUnit === 0) {
    // 如果找不到，使用默认价格
    pricePerUnit = 5 // 默认5元/斤
  }
  
  // 解析数量
  if (!amount || amount === '适量') {
    // 适量按0.1斤计算
    return pricePerUnit * 0.1
  }
  
  // 解析数量单位
  const amountStr = String(amount).toLowerCase()
  
  // 如果是重量单位（g, kg, 斤, 两）
  if (amountStr.includes('g') || amountStr.includes('kg') || amountStr.includes('斤') || amountStr.includes('两')) {
    const numMatch = amountStr.match(/(\d+\.?\d*)/)
    if (numMatch) {
      let num = parseFloat(numMatch[1])
      if (amountStr.includes('kg')) {
        num = num * 2 // 1kg = 2斤
      } else if (amountStr.includes('g')) {
        num = num / 500 // 500g = 1斤
      } else if (amountStr.includes('两')) {
        num = num / 10 // 10两 = 1斤
      }
      return pricePerUnit * num
    }
  }
  
  // 如果是数量单位（个、只、条等）
  if (amountStr.includes('个') || amountStr.includes('只') || amountStr.includes('条') || amountStr.includes('根')) {
    const numMatch = amountStr.match(/(\d+\.?\d*)/)
    if (numMatch) {
      const num = parseFloat(numMatch[1])
      // 单个价格估算（根据食材类型）
      if (name.includes('蛋')) {
        return pricePerUnit * num // 鸡蛋按个计价
      } else if (name.includes('苹果') || name.includes('香蕉') || name.includes('橙子')) {
        return (pricePerUnit / 5) * num // 水果按个，假设5个/斤
      } else {
        return (pricePerUnit / 3) * num // 其他按个，假设3个/斤
      }
    }
  }
  
  // 默认按0.2斤计算
  return pricePerUnit * 0.2
}

// 计算菜谱总成本
function calculateRecipeCost(ingredients) {
  if (!Array.isArray(ingredients)) return 0
  
  let totalCost = 0
  ingredients.forEach(ing => {
    const ingName = typeof ing === 'string' ? ing : (ing.name || '')
    const amount = typeof ing === 'string' ? '' : (ing.amount || '')
    totalCost += estimateIngredientPrice(ingName, amount)
  })
  
  return Math.round(totalCost * 100) / 100 // 保留2位小数
}

// 显示Toast（增强版）
function showToast(title, icon = 'none', duration = 2000) {
  // 限制标题长度
  if (title.length > 15) {
    title = title.substring(0, 15) + '...'
  }
  
  wx.showToast({
    title,
    icon,
    duration,
    mask: true // 添加遮罩，防止用户操作
  })
}

// 统一错误处理（增强版）
function handleError(error, options = {}) {
  const {
    title = '操作失败',
    showRetry = false,
    onRetry = null,
    logError = true
  } = options

  // 记录错误日志
  if (logError) {
    console.error('Error:', error)
  }

  // 解析错误信息
  let errorMessage = title
  if (error) {
    if (typeof error === 'string') {
      errorMessage = error
    } else if (error.message) {
      errorMessage = error.message
    } else if (error.errMsg) {
      errorMessage = error.errMsg
    }
  }

  // 网络错误特殊处理
  if (errorMessage.includes('网络') || errorMessage.includes('request:fail') || errorMessage.includes('timeout')) {
    errorMessage = '网络连接失败，请检查网络设置'
    
    // 网络错误提供重试选项
    if (showRetry && onRetry) {
      wx.showModal({
        title: '网络错误',
        content: '网络连接失败，是否重试？',
        confirmText: '重试',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm && onRetry) {
            onRetry()
          }
        }
      })
      return
    }
  }

  // 显示错误提示
  showToast(errorMessage, 'none')
}

// 带重试的请求封装（增强版）
async function requestWithRetry(requestFn, options = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onRetry = null,
    shouldRetry = (error) => {
      // 默认只在网络错误时重试
      const errorMsg = error?.message || error?.errMsg || ''
      return errorMsg.includes('网络') || 
             errorMsg.includes('request:fail') || 
             errorMsg.includes('timeout')
    }
  } = options

  let lastError = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await requestFn()
      // 成功时，如果有之前的重试，提示成功
      if (attempt > 0) {
        showToast('加载成功', 'success', 1000)
      }
      return result
    } catch (error) {
      lastError = error
      
      // 判断是否应该重试
      if (attempt < maxRetries && shouldRetry(error)) {
        // 执行重试回调
        if (onRetry) {
          onRetry(attempt + 1, maxRetries, error)
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
        continue
      } else {
        // 不重试或达到最大重试次数，抛出错误
        throw error
      }
    }
  }

  // 所有重试都失败
  throw lastError
}

// 显示Loading
function showLoading(title = '加载中...') {
  wx.showLoading({
    title,
    mask: true
  })
}

// 隐藏Loading
function hideLoading() {
  wx.hideLoading()
}

// 显示确认对话框（增强版）
function showConfirm(content, title = '提示', showCancel = true) {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      showCancel,
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        resolve(res.confirm)
      },
      fail: () => {
        resolve(false)
      }
    })
  })
}

// 显示成功提示（带震动反馈）
function showSuccess(title) {
  wx.vibrateShort()
  showToast(title, 'success')
}

// 检查是否包含过敏原或忌口
function containsAllergenOrRestriction(text, allergens = [], restrictions = []) {
  if (!text || typeof text !== 'string') return false
  
  const textLower = text.toLowerCase()
  const allKeywords = [...allergens, ...restrictions]
  
  // 过敏原关键词映射（更精确的匹配）
  const allergenKeywords = {
    '花生': ['花生', '花生米', '花生酱', '花生油', '花生碎'],
    '海鲜': ['海鲜', '虾', '蟹', '鱼', '贝', '鱿鱼', '章鱼', '生蚝', '扇贝', '蛤蜊', '海带', '紫菜'],
    '牛奶': ['牛奶', '奶', '乳', '芝士', '奶酪', '黄油', '奶油'],
    '鸡蛋': ['鸡蛋', '蛋', '蛋黄', '蛋白', '蛋清'],
    '大豆': ['大豆', '黄豆', '豆腐', '豆浆', '豆制品'],
    '小麦': ['小麦', '面粉', '面', '面包', '馒头', '面条', '饺子', '包子'],
    '坚果': ['坚果', '核桃', '杏仁', '腰果', '开心果', '榛子'],
    '芝麻': ['芝麻', '芝麻酱', '芝麻油'],
    '虾': ['虾', '大虾', '小虾', '基围虾', '对虾', '龙虾'],
    '蟹': ['蟹', '螃蟹', '大闸蟹', '梭子蟹'],
    '鱼': ['鱼', '鱼肉', '草鱼', '鲫鱼', '带鱼', '三文鱼', '金枪鱼'],
    '芒果': ['芒果', '芒果干'],
    '菠萝': ['菠萝', '凤梨'],
    '香菜': ['香菜', '芫荽'],
    '辣椒': ['辣椒', '辣', '辣椒粉', '辣椒油', '辣椒酱']
  }
  
  // 检查每个过敏原
  for (const allergen of allergens) {
    const keywords = allergenKeywords[allergen] || [allergen]
    for (const keyword of keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        return true
      }
    }
  }
  
  // 检查每个忌口
  for (const restriction of restrictions) {
    if (textLower.includes(restriction.toLowerCase())) {
      return true
    }
  }
  
  return false
}

// 过滤包含过敏原或忌口的项目
function filterByAllergens(items, allergens = [], restrictions = [], field = 'name') {
  if (!Array.isArray(items) || items.length === 0) return items
  if (!allergens || allergens.length === 0) {
    if (!restrictions || restrictions.length === 0) {
      return items
    }
  }
  
  return items.filter(item => {
    // 检查名称
    const name = item[field] || item.name || ''
    if (containsAllergenOrRestriction(name, allergens, restrictions)) {
      return false
    }
    
    // 检查标签
    const tags = item.tags || []
    for (const tag of tags) {
      if (containsAllergenOrRestriction(tag, allergens, restrictions)) {
        return false
      }
    }
    
    // 检查描述
    const description = item.description || ''
    if (containsAllergenOrRestriction(description, allergens, restrictions)) {
      return false
    }
    
    return true
  })
}

// ========== 制作步骤增强 ==========
function parseStepTime(text) {
  if (!text || typeof text !== 'string') return null
  const minuteMatch = text.match(/(\d+)\s*分钟/)
  if (minuteMatch) return parseInt(minuteMatch[1], 10)
  const hourMatch = text.match(/(\d+)\s*小时/)
  if (hourMatch) return parseInt(hourMatch[1], 10) * 60
  const secondMatch = text.match(/(\d+)\s*秒/)
  if (secondMatch) return Math.ceil(parseInt(secondMatch[1], 10) / 60)
  return null
}

const stepDetailHints = {
  '腌制': '腌制时用手抓匀可让调料更好渗透，腌制15-20分钟口感更佳',
  '切丁': '切成约1-1.5cm小丁，大小一致受热更均匀',
  '切丝': '顺着纹理切丝口感更好，粗细均匀',
  '炒香': '小火炒至出香味，注意别炒糊',
  '炒熟': '大火快炒至变色即可，避免过老',
  '焯水': '水开后放入，煮至变色捞出，可去腥去涩',
  '调味': '先尝味再加盐，少量多次添加',
  '出锅': '装盘后可撒葱花或香菜点缀'
}

function getStepDetailHint(text) {
  if (!text || typeof text !== 'string') return null
  for (const [keyword, hint] of Object.entries(stepDetailHints)) {
    if (text.includes(keyword)) return hint
  }
  return null
}

function normalizeRecipeSteps(rawSteps) {
  if (!Array.isArray(rawSteps) || rawSteps.length === 0) return []
  return rawSteps.map((item) => {
    if (typeof item === 'object' && item !== null && item.text) {
      return {
        text: item.text,
        detail: item.detail || getStepDetailHint(item.text),
        time: item.time != null ? item.time : parseStepTime(item.text),
        tips: item.tips || null,
        image: item.image || null,
        completed: false
      }
    }
    const text = typeof item === 'string' ? item : String(item)
    return {
      text,
      detail: getStepDetailHint(text),
      time: parseStepTime(text),
      tips: null,
      image: null,
      completed: false
    }
  })
}

const WATER_INTAKE_STORAGE_KEY = 'water_intake_daily' // 兼容：按“杯”存的旧结构
const WATER_INTAKE_ML_STORAGE_KEY = 'water_intake_ml_daily' // 新：按“ml”存手动饮水
const WATER_INTAKE_EVENTS_KEY = 'water_intake_events_daily' // 新：按条记录（ml）
const WATER_EVENTS_LIMIT_PER_DAY = 500 // 防止历史过多导致卡顿
const DEFAULT_WATER_GOAL_CUPS = 8
const DEFAULT_WATER_GOAL_ML = 2000
const DEFAULT_CUP_ML = 250

/** 获取某日的手动饮水量（ml，不含食物水分） */
function getWaterManualMlForDate(dateStr) {
  try {
    // 事件存储优先（支持“查看记录”）
    const evRaw = wx.getStorageSync(WATER_INTAKE_EVENTS_KEY)
    const evMap = evRaw && typeof evRaw === 'object' ? evRaw : {}
    const events = Array.isArray(evMap[dateStr]) ? evMap[dateStr] : null
    if (events && events.length) {
      const sum = events.reduce((acc, it) => acc + (typeof it.ml === 'number' ? it.ml : 0), 0)
      return Math.max(0, Math.round(sum))
    }

    // 新存储优先
    const rawMl = wx.getStorageSync(WATER_INTAKE_ML_STORAGE_KEY)
    const mapMl = rawMl && typeof rawMl === 'object' ? rawMl : {}
    const vMl = mapMl[dateStr]
    if (typeof vMl === 'number' && vMl >= 0) return Math.max(0, Math.round(vMl))

    // 兼容旧：直接读取“杯数”存储并换算（避免与 getWaterIntakeForDate 互相递归）
    const raw = wx.getStorageSync(WATER_INTAKE_STORAGE_KEY)
    const map = raw && typeof raw === 'object' ? raw : {}
    const v = map[dateStr]
    const cups = typeof v === 'number' && v >= 0 ? Math.min(v, DEFAULT_WATER_GOAL_CUPS) : 0
    return Math.max(0, Math.round(cups * DEFAULT_CUP_ML))
  } catch (e) {
    return 0
  }
}

/** 设置某日的手动饮水量（ml，不含食物水分） */
function setWaterManualMlForDate(dateStr, ml) {
  try {
    // 同步覆盖事件：用一条“手动设置”记录表示（保留可追溯）
    const n = typeof ml === 'number' && ml >= 0 ? Math.round(ml) : 0
    setWaterEventsForDate(dateStr, n > 0 ? [{ ts: Date.now(), ml: n, source: 'manual_set' }] : [])

    const raw = wx.getStorageSync(WATER_INTAKE_ML_STORAGE_KEY)
    const map = raw && typeof raw === 'object' ? raw : {}
    map[dateStr] = n
    wx.setStorageSync(WATER_INTAKE_ML_STORAGE_KEY, map)
    return n
  } catch (e) {
    return 0
  }
}

/** 饮水目标（ml，可从用户档案扩展） */
function getWaterGoalMl() {
  return DEFAULT_WATER_GOAL_ML
}

/** 估算饮食记录带来的“食物水分”（ml） */
function estimateFoodWaterMlFromTimeline(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) return 0

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

  const hasAny = (name, keywords) => keywords.some(k => name.includes(k))
  const toNum = (v) => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }

  // 关键词：饮品/高含水食物
  const drinkKeywords = ['水', '饮料', '茶', '咖啡', '牛奶', '豆浆', '酸奶', '汤', '羹', '粥', '果汁', '苏打水', '气泡水']
  const fruitKeywords = ['西瓜', '哈密瓜', '葡萄', '橙', '橘', '柚', '梨', '苹果', '草莓', '桃', '香蕉', '猕猴桃', '蓝莓']
  const vegKeywords = ['黄瓜', '西红柿', '番茄', '白菜', '生菜', '菠菜', '冬瓜', '丝瓜', '西兰花', '萝卜']

  let total = 0
  for (const r of timeline) {
    const name = String(r && (r.food_name || r.name || '')).trim()
    if (!name) continue

    // 若后端未来提供显式字段（优先使用）
    const explicit = toNum(r.water_ml || r.waterMl || r.hydration_ml)
    if (explicit > 0) {
      total += clamp(explicit, 0, 1200)
      continue
    }

    // 从分量里解析“g/ml”
    const portion = String(r.portion || '').toLowerCase()
    const gramMatch = portion.match(/(\d+(\.\d+)?)\s*(g|克)/)
    const mlMatch = portion.match(/(\d+(\.\d+)?)\s*(ml|毫升)/)

    // 1) 饮品：优先按 ml 估算
    if (hasAny(name, drinkKeywords)) {
      if (mlMatch) {
        total += clamp(Math.round(parseFloat(mlMatch[1])), 0, 1200)
      } else if (gramMatch) {
        total += clamp(Math.round(parseFloat(gramMatch[1])), 0, 1200)
      } else {
        // 默认一杯/一碗的保守估算
        total += 200
      }
      continue
    }

    // 2) 水果/蔬菜：若有克数，用含水率估算；否则用固定值保守加一点
    if (hasAny(name, fruitKeywords) || hasAny(name, vegKeywords)) {
      const ratio = hasAny(name, vegKeywords) ? 0.9 : 0.85
      if (gramMatch) {
        total += clamp(Math.round(parseFloat(gramMatch[1]) * ratio), 0, 600)
      } else {
        total += 120
      }
      continue
    }

    // 3) 其他普通食物：避免夸大，仅做极保守估算（按热量推断水分，不超过 150ml/条）
    const kcal = toNum(r.calories || r.kcal)
    if (kcal > 0) {
      total += clamp(Math.round(kcal * 0.25), 0, 150) // 0.25ml/kcal（保守）
    }
  }

  // 防止极端情况下虚高：每天食物水分最多按 1500ml 计入
  return clamp(Math.round(total), 0, 1500)
}

function getWaterEventsForDate(dateStr) {
  try {
    const raw = wx.getStorageSync(WATER_INTAKE_EVENTS_KEY)
    const map = raw && typeof raw === 'object' ? raw : {}
    const list = Array.isArray(map[dateStr]) ? map[dateStr] : []
    // 清理异常值
    const cleaned = list
      .map(it => ({
        ts: typeof it.ts === 'number' ? it.ts : Date.now(),
        ml: typeof it.ml === 'number' && it.ml > 0 ? Math.round(it.ml) : 0,
        source: it.source || 'manual'
      }))
      .filter(it => it.ml > 0)
      .sort((a, b) => b.ts - a.ts)
    if (cleaned.length > WATER_EVENTS_LIMIT_PER_DAY) {
      // 只保留最新的 N 条，避免每次排序渲染都卡
      const trimmed = cleaned.slice(0, WATER_EVENTS_LIMIT_PER_DAY)
      try {
        map[dateStr] = trimmed
        wx.setStorageSync(WATER_INTAKE_EVENTS_KEY, map)
      } catch (e) {}
      return trimmed
    }
    return cleaned
  } catch (e) {
    return []
  }
}

function setWaterEventsForDate(dateStr, events) {
  try {
    const raw = wx.getStorageSync(WATER_INTAKE_EVENTS_KEY)
    const map = raw && typeof raw === 'object' ? raw : {}
    map[dateStr] = Array.isArray(events) ? events : []
    wx.setStorageSync(WATER_INTAKE_EVENTS_KEY, map)
    return true
  } catch (e) {
    return false
  }
}

function addWaterEventForDate(dateStr, ml, source = 'manual') {
  const n = typeof ml === 'number' ? Math.round(ml) : 0
  if (n <= 0) return 0
  const current = getWaterEventsForDate(dateStr)
  const next = [{ ts: Date.now(), ml: n, source }].concat(current)
  setWaterEventsForDate(dateStr, next)
  return n
}

function clearWaterEventsForDate(dateStr) {
  return setWaterEventsForDate(dateStr, [])
}

/** 获取某日的饮水杯数（0-目标值），与旧页面兼容 */
function getWaterIntakeForDate(dateStr) {
  try {
    // 新存储：优先从事件/ml 存储折算为杯数（避免与 getWaterManualMlForDate 互相递归）
    let manualMl = 0

    const evRaw = wx.getStorageSync(WATER_INTAKE_EVENTS_KEY)
    const evMap = evRaw && typeof evRaw === 'object' ? evRaw : {}
    const events = Array.isArray(evMap[dateStr]) ? evMap[dateStr] : null
    if (events && events.length) {
      manualMl = events.reduce((acc, it) => acc + (typeof it.ml === 'number' ? it.ml : 0), 0)
    } else {
      const rawMl = wx.getStorageSync(WATER_INTAKE_ML_STORAGE_KEY)
      const mapMl = rawMl && typeof rawMl === 'object' ? rawMl : {}
      const vMl = mapMl[dateStr]
      manualMl = typeof vMl === 'number' && vMl >= 0 ? vMl : 0
    }

    if (manualMl > 0) {
      return Math.min(Math.floor(manualMl / DEFAULT_CUP_ML), DEFAULT_WATER_GOAL_CUPS)
    }

    // 旧存储：杯数
    const raw = wx.getStorageSync(WATER_INTAKE_STORAGE_KEY)
    const map = raw && typeof raw === 'object' ? raw : {}
    const v = map[dateStr]
    return typeof v === 'number' && v >= 0 ? Math.min(v, DEFAULT_WATER_GOAL_CUPS) : 0
  } catch (e) {
    return 0
  }
}

/** 设置某日的饮水杯数并持久化 */
function setWaterIntakeForDate(dateStr, cups) {
  try {
    // 同步写入新 ml 存储（用于新 UI）
    const nCups = typeof cups === 'number' && cups >= 0 ? Math.min(Math.floor(cups), DEFAULT_WATER_GOAL_CUPS) : 0
    setWaterManualMlForDate(dateStr, nCups * DEFAULT_CUP_ML)

    const raw = wx.getStorageSync(WATER_INTAKE_STORAGE_KEY)
    const map = raw && typeof raw === 'object' ? raw : {}
    map[dateStr] = nCups
    wx.setStorageSync(WATER_INTAKE_STORAGE_KEY, map)
    return nCups
  } catch (e) {
    return 0
  }
}

/** 饮水目标杯数（可从用户档案扩展） */
function getWaterGoalCups() {
  return DEFAULT_WATER_GOAL_CUPS
}

module.exports = {
  formatDate,
  normalizeExternalImageUrl,
  isBackendDummyImageUrl,
  shouldHideRestaurantListItem,
  pickRecipeCoverFromPayload,
  resolveRecipeCoverUrl,
  resolveRestaurantCoverUrl,
  withAvatarCacheBust,
  extractAvatarUrlFromPayload,
  timeAgo,
  normalizeIngredient,
  calculateBMI,
  formatCalories,
  getHealthColor,
  getHealthText,
  calculateHealthScore,
  getHealthLevel,
  calculatePricePerProtein,
  formatPricePerProtein,
  getIngredientSubstitute,
  estimateIngredientCost,
  estimateRecipeCost,
  showToast,
  showSuccess,
  showLoading,
  hideLoading,
  showConfirm,
  handleError,
  requestWithRetry,
  containsAllergenOrRestriction,
  filterByAllergens,
  parseStepTime,
  normalizeRecipeSteps,
  getWaterIntakeForDate,
  setWaterIntakeForDate,
  getWaterGoalCups,
  getWaterManualMlForDate,
  setWaterManualMlForDate,
  getWaterGoalMl,
  estimateFoodWaterMlFromTimeline,
  getWaterEventsForDate,
  setWaterEventsForDate,
  addWaterEventForDate,
  clearWaterEventsForDate
}
