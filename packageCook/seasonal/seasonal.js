const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

const ANALYTICS_KEY = 'seasonal_analytics_v1'
/** 本期主推最多展示条数（轮播） */
const FEATURED_MAX = 3

function clamp(n, min, max) {
  if (typeof n !== 'number' || Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

function safeArray(v) {
  return Array.isArray(v) ? v : []
}

function getMonthKey(month) {
  return `m${String(month || '').trim() || 'unknown'}`
}

function nowISO() {
  try {
    return new Date().toISOString()
  } catch (e) {
    return ''
  }
}

function readAnalytics() {
  try {
    const v = wx.getStorageSync(ANALYTICS_KEY)
    return v && typeof v === 'object' ? v : {}
  } catch (e) {
    return {}
  }
}

function writeAnalytics(v) {
  try {
    wx.setStorageSync(ANALYTICS_KEY, v)
  } catch (e) {
    // ignore
  }
}

function incCounter(obj, pathArr, inc = 1) {
  let cur = obj
  for (let i = 0; i < pathArr.length - 1; i++) {
    const k = pathArr[i]
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {}
    cur = cur[k]
  }
  const last = pathArr[pathArr.length - 1]
  cur[last] = (typeof cur[last] === 'number' ? cur[last] : 0) + inc
}

function uniq(arr) {
  const s = new Set()
  safeArray(arr).forEach(v => {
    if (typeof v === 'string' && v.trim()) s.add(v.trim())
  })
  return Array.from(s)
}

/** 将营养长句拆成要点列表（优先分号，其次句号） */
function nutritionToBullets(text) {
  const t = String(text || '').trim()
  if (!t) return []
  let parts = t.split(/[；;]\s*/).map(s => s.trim()).filter(s => s.length >= 4)
  if (parts.length <= 1) {
    parts = t.split(/[。．]\s*/).map(s => s.trim()).filter(s => s.length >= 6)
  }
  if (!parts.length) return [t]
  return parts.slice(0, 8)
}

/** 无配置时的营养/当季/菜谱兜底文案 */
function defaultNutritionText(name, category) {
  const n = String(name || '食材').trim()
  if (category === 'fruit') {
    return `${n}含天然果糖、有机酸与多种维生素、矿物质；作为加餐替代高糖零食，分量可控更健康。`
  }
  return `${n}提供膳食纤维、维生素与矿物质；与优质蛋白和全谷物搭配，更适合作为一餐中的蔬菜主力。`
}

function defaultSeasonWhyText(name, month, regionText) {
  const n = String(name || '').trim()
  const m = Number(month) || 1
  const r = regionText && regionText !== '你附近' ? regionText : '本地市场'
  return `${m}月前后在${r}更容易买到新鲜「${n}」：应季采收集中、运输距离短，口感与性价比通常更友好。`
}

function defaultRecipeIdeas(name, category) {
  const n = String(name || '食材').trim()
  if (category === 'fruit') {
    return [`鲜食${n}`, `${n}酸奶碗`, `${n}燕麦杯`, `鲜切${n}拼盘`]
  }
  return [`清炒${n}`, `${n}汤`, `凉拌${n}`, `${n}小炒`]
}

function buildOpsSummary(counters) {
  const c = counters || {}
  const pv = c.page_view || 0
  const imp = c.impression || 0
  const detail = c.detail_open || 0
  const addClick = c.add_click || 0
  const addSuccess = c.add_success || 0
  const cookClick = c.cook_click || 0
  const dislike = c.dislike_click || 0

  const detailRate = imp > 0 ? detail / imp : 0
  const addRate = detail > 0 ? addSuccess / detail : 0
  const cookRate = detail > 0 ? cookClick / detail : 0

  const toPct = r => String(Math.round(clamp(r, 0, 1) * 100))

  return {
    pv,
    imp,
    detail,
    addClick,
    addSuccess,
    cookClick,
    dislike,
    detailRate: clamp(detailRate, 0, 1),
    addRate: clamp(addRate, 0, 1),
    cookRate: clamp(cookRate, 0, 1),
    detailRatePct: toPct(detailRate),
    addRatePct: toPct(addRate),
    cookRatePct: toPct(cookRate)
  }
}

Page({
  data: {
    currentMonth: 1,
    currentSeason: '',
    currentSeasonTip: '',
    userRegionName: '你所在地区',
    seasonalItems: [],
    /** 主推（列表前 FEATURED_MAX 项，大卡轮播） */
    featuredItems: [],
    /** 当前轮播索引，与 featuredItems 对应 */
    featuredIndex: 0,
    /** 其余应季（紧凑列表） */
    restItems: [],

    // 运营分析
    opsVisible: false,
    opsSummary: null
  },

  noop() {},

  /** 根据 seasonalItems 拆分主推 / 其余，用于分层 UI */
  syncSeasonalSplit() {
    const list = safeArray(this.data.seasonalItems)
    const n = Math.min(FEATURED_MAX, list.length)
    const featuredItems = list.slice(0, n)
    const restItems = list.slice(n)
    const prevIdx = typeof this.data.featuredIndex === 'number' ? this.data.featuredIndex : 0
    const featuredIndex = featuredItems.length
      ? Math.min(prevIdx, featuredItems.length - 1)
      : 0
    this.setData({
      featuredItems,
      featuredIndex,
      restItems
    })
  },

  /** 主推轮播切换 */
  onFeaturedSwiperChange(e) {
    const cur = e && e.detail && typeof e.detail.current === 'number' ? e.detail.current : 0
    this.setData({ featuredIndex: cur })
  },

  onLoad() {
    // 初始化内存埋点缓存，避免频繁同步 IO 卡顿
    this._analyticsMem = readAnalytics()
    this._analyticsFlushTimer = null

    this.initHeader()
    this.loadDataFromFridgePage()
    this.loadSeasonalFromServer()
    this.track('page_view')
    this.refreshOpsSummary()

    this.syncSeasonalSplit()
  },

  onShow() {
    // 返回时可轻量刷新，避免频繁请求
    this.loadDataFromFridgePage()
    this.refreshOpsSummary()
    this.syncSeasonalSplit()
  },

  onUnload() {
    // 页面销毁前尽量落盘一次
    try {
      if (this._analyticsFlushTimer) {
        clearTimeout(this._analyticsFlushTimer)
        this._analyticsFlushTimer = null
      }
      const payload = this._analyticsMem || {}
      wx.setStorage({ key: ANALYTICS_KEY, data: payload })
    } catch (e) {
      // ignore
    }
  },

  onPullDownRefresh() {
    this.loadSeasonalFromServer().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  initHeader() {
    const now = new Date()
    this.setData({
      currentMonth: now.getMonth() + 1
    })
  },

  // 优先从冰箱页面缓存中读取（避免数据割裂）
  loadDataFromFridgePage() {
    try {
      const app = getApp()
      const seasonalCache = app && app.globalData && app.globalData.fridgeSeasonalCache
      if (seasonalCache && Array.isArray(seasonalCache.items)) {
        const enhanced = this.enhanceSeasonalItems(seasonalCache.items, {
          month: seasonalCache.month || this.data.currentMonth,
          season: seasonalCache.currentSeason || '',
          region: seasonalCache.userRegionName || this.data.userRegionName
        })
        this.setData({
          seasonalItems: enhanced,
          currentMonth: seasonalCache.month || this.data.currentMonth,
          currentSeason: seasonalCache.currentSeason || '',
          currentSeasonTip: seasonalCache.currentSeasonTip || '',
          userRegionName: seasonalCache.userRegionName || this.data.userRegionName
        })
        this.syncSeasonalSplit()
        this.trackImpressions(enhanced)
      }
    } catch (e) {
      // 没有缓存时忽略
    }
  },

  // 预留：后端专门的季节接口
  async loadSeasonalFromServer() {
    // 当前版本中，主要数据仍来自冰箱页的本地规则，此处只做占位，方便以后接后端
    try {
      // 如果后端已经提供接口，可在此调用：
      // const res = await api.getSeasonalIngredients({ month: this.data.currentMonth, ... })
      // this.setData({ seasonalItems: res.items, ... })
      return
    } catch (e) {
      console.warn('加载应季食材接口失败，使用本地缓存', e)
    }
  },

  openDetail(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    this.track('detail_open', { name: item.name })
    try {
      wx.setStorage({
        key: 'seasonal_detail_item',
        data: item
      })
    } catch (e2) {
      try {
        wx.setStorageSync('seasonal_detail_item', item)
      } catch (e3) {}
    }

    wx.navigateTo({
      url: `/packageCook/seasonal-detail/seasonal-detail?name=${encodeURIComponent(item.name)}&month=${this.data.currentMonth}&season=${encodeURIComponent(this.data.currentSeason || '')}&region=${encodeURIComponent(this.data.userRegionName || '')}`
    })
  },

  openOps() {
    this.track('ops_open')
    this.refreshOpsSummary()
    this.setData({ opsVisible: true })
  },

  closeOps() {
    this.setData({ opsVisible: false })
  },

  getAnalyticsMem() {
    if (!this._analyticsMem || typeof this._analyticsMem !== 'object') {
      this._analyticsMem = readAnalytics()
    }
    return this._analyticsMem
  },

  scheduleAnalyticsFlush() {
    try {
      if (this._analyticsFlushTimer) return
      this._analyticsFlushTimer = setTimeout(() => {
        const payload = this._analyticsMem || {}
        this._analyticsFlushTimer = null
        // 用异步写入，减少主线程阻塞
        wx.setStorage({
          key: ANALYTICS_KEY,
          data: payload
        })
      }, 400)
    } catch (e) {
      // ignore
    }
  },

  async addToFridge(e) {
    const item = e.currentTarget.dataset.item
    if (!item || !item.name) return
    this.track('add_click', { name: item.name })
    try {
      const category = item.category || 'vegetable'
      const unit = item.unit || '个'
      const amount = unit === '适量' ? 0 : 1
      await api.addFridgeItem({
        name: item.name.trim(),
        category,
        unit,
        amount,
        created_at: new Date().toISOString()
      })
      util.showSuccess(item.added ? '已补货' : '已加入冰箱')
      this.track('add_success', { name: item.name })
      this.refreshOpsSummary()
    } catch (err) {
      console.error('添加应季食材失败', err)
      util.showToast('添加失败，请稍后重试')
    }
  },

  cookWith(e) {
    const item = e.currentTarget.dataset.item
    const dishHint = (e.currentTarget.dataset.dishHint || '').trim()
    if (!item || !item.name) return
    this.track('cook_click', { name: item.name, dish: dishHint || '' })
    let url = `/packageCook/smart-choice/smart-choice?ingredient=${encodeURIComponent(
      item.name
    )}&fromSeasonalPage=true`
    if (dishHint) {
      url += `&dish_hint=${encodeURIComponent(dishHint)}`
    }
    wx.navigateTo({
      url,
      fail(err) {
        console.error('跳转智能搜餐失败', err)
        util.showToast('跳转失败，请稍后再试')
      }
    })
  },

  async dislike(e) {
    const item = e.currentTarget.dataset.item
    if (!item || !item.name) return
    this.track('dislike_click', { name: item.name })
    const confirm = await util.showConfirm(
      `本月将不再推荐「${item.name}」的应季提醒，你可以稍后在设置中重新开启。`,
      '不感兴趣'
    )
    if (!confirm) return
    try {
      const name = item.name
      const disliked = wx.getStorageSync('seasonal_disliked_names') || []
      if (!disliked.includes(name)) {
        disliked.push(name)
        wx.setStorageSync('seasonal_disliked_names', disliked)
      }
      util.showToast('本月将不再推荐该食材')
      // 立即在当前列表移除
      const left = (this.data.seasonalItems || []).filter(i => i.name !== name)
      this.setData({ seasonalItems: left })
      this.syncSeasonalSplit()
      this.refreshOpsSummary()
    } catch (err) {
      console.error('记录不感兴趣失败', err)
    }
  },

  track(eventName, extra = {}) {
    try {
      const month = this.data.currentMonth
      const a = this.getAnalyticsMem()
      const mk = getMonthKey(month)
      if (!a[mk]) {
        a[mk] = { counters: {}, lastAt: '' }
      }
      incCounter(a[mk], ['counters', eventName], 1)
      a[mk].lastAt = nowISO()
      // 轻量记录最近一次事件上下文（方便调试/以后接后端）
      a[mk].lastEvent = { name: eventName, at: a[mk].lastAt, ...extra }
      this._analyticsMem = a
      this.scheduleAnalyticsFlush()
    } catch (e) {
      // ignore
    }
  },

  trackImpressions(items) {
    const list = safeArray(items)
    if (!list.length) return
    // 只统计一次“本次加载”的曝光（避免频繁 onShow 叠加）
    const cacheKey = `seasonal_imp_${getMonthKey(this.data.currentMonth)}`
    try {
      const existing = wx.getStorageSync(cacheKey)
      if (existing) return
      wx.setStorageSync(cacheKey, 1)
    } catch (e) {
      // ignore
    }
    this.track('impression', { count: list.length })
  },

  refreshOpsSummary() {
    try {
      const month = this.data.currentMonth
      const a = this.getAnalyticsMem()
      const mk = getMonthKey(month)
      const counters = (a[mk] && a[mk].counters) || {}
      this.setData({
        opsSummary: buildOpsSummary(counters)
      })
    } catch (e) {
      // ignore
    }
  },

  enhanceSeasonalItems(items, ctx) {
    const month = ctx && ctx.month
    const season = (ctx && ctx.season) || ''
    const region = (ctx && ctx.region) || ''

    const seasonText = season || `${month || ''}月当季`
    const regionText = region && region !== '你所在地区' ? region : '你附近'

    const detailMap = {
      韭菜: {
        image: '/packageCook/images/seasonal/leek.png',
        coverEmoji: '🥬',
        explain: `辛香开胃，快炒、做馅或烧烤都合适；春季叶片更嫩、香气更足。`,
        nutrition:
          '富含维生素 C、胡萝卜素与硫化物，风味鲜明；膳食纤维有助肠道蠕动；搭配鸡蛋、豆制品或虾仁更均衡。',
        seasonWhy:
          '早春回暖后新芽生长快，茎叶细嫩、香气浓，是一年中口感与性价比都较好的时段。',
        recipeIdeas: ['韭菜炒鸡蛋', '韭菜盒子', '韭菜炒虾仁', '烤韭菜', '韭菜猪肉饺'],
        benefits: ['风味鲜明', '搭配多样', '当季更嫩'],
        eatTips: ['大火快炒锁鲜', '与鸡蛋/虾仁经典组合', '当天买当天吃'],
        caution: ['肠胃敏感者适量', '术后/服药人群遵医嘱'],
        opsInsight: ['可做“周末早餐”主题', '与鸡蛋组合提升转化']
      },
      春笋: {
        image: '/packageCook/images/seasonal/bamboo_shoot.png',
        coverEmoji: '🎋',
        explain: `${seasonText}的新鲜春笋纤维细嫩，适合快炒/炖汤，口感清甜。`,
        nutrition:
          '低脂肪、热量不高，含较多不溶性膳食纤维，有助于饱腹感与肠道蠕动；钾含量也较可观。',
        seasonWhy:
          '春季雨后竹笋生长快、采挖集中，纤维细嫩涩味相对易处理；过季则易纤维化、口感下降。',
        recipeIdeas: ['腌笃鲜', '春笋炒腊肉', '油焖春笋', '春笋炖排骨', '春笋炒雪菜'],
        benefits: ['膳食纤维', '清爽低脂', '丰富口感'],
        eatTips: ['焯水去涩再烹饪', '搭配肉类更香', '尽量现买现吃'],
        caution: ['胃肠敏感者少量', '肾功能问题遵医嘱'],
        opsInsight: ['适合做“春季上新”主题', '引导“用它做菜”提升留存']
      },
      菠菜: {
        image: '/packageCook/images/seasonal/spinach.png',
        coverEmoji: '🥬',
        explain: `${regionText}${seasonText}的菠菜叶片嫩、含水足，做汤/快炒都很省时。`,
        nutrition:
          '富含叶酸、维生素 K、β-胡萝卜素与铁（吸收受膳食影响）；焯水可减少部分草酸，更适合搭配蛋类、豆制品。',
        seasonWhy:
          '春季光照与温差利于菠菜快速生长，叶薄嫩、水分足；采收期集中，市场新鲜度通常更好。',
        recipeIdeas: ['菠菜炒鸡蛋', '凉拌菠菜', '菠菜蛋花汤', '上汤菠菜', '菠菜拌豆腐丝'],
        benefits: ['维生素丰富', '补充膳食纤维', '搭配性强'],
        eatTips: ['焯水后更清爽', '搭配鸡蛋/豆腐', '2-3 天内吃完'],
        caution: ['草酸偏高，焯水更好', '肾结石人群注意'],
        opsInsight: ['“10 分钟快手菜”转化高', '搭配鸡蛋做组合推荐']
      },
      草莓: {
        image: '/packageCook/images/seasonal/strawberry.png',
        coverEmoji: '🍓',
        explain: `${seasonText}草莓香气足、甜酸平衡，适合作为健康零食或酸奶碗配料。`,
        nutrition:
          '维生素 C、花青素与多酚类物质含量较突出；天然果糖带来愉悦口感，但仍需控制总量。',
        seasonWhy:
          '春季主产区陆续上市，冷链成熟后风味与色泽更稳定；应季果香更足，更适合替代高糖零食。',
        recipeIdeas: ['草莓酸奶碗', '草莓燕麦杯', '鲜切草莓', '草莓奶昔（少糖）', '草莓水果沙拉'],
        benefits: ['口感愉悦', '维 C 摄入', '替代高糖零食'],
        eatTips: ['流水轻冲后再浸泡', '冷藏保存别久放', '优先当天吃'],
        caution: ['对浆果过敏者避免', '控糖人群注意分量'],
        opsInsight: ['适合“春日甜品”内容种草', '做“收藏/分享”引导']
      },
      豌豆: {
        image: '/packageCook/images/seasonal/pea.png',
        coverEmoji: '🫛',
        explain: `${seasonText}豌豆粒饱满鲜甜，适合小炒、焖饭与汤羹。`,
        nutrition:
          '含植物蛋白与膳食纤维，淀粉含量适中；鲜豌豆还含维生素 C 与钾，适合与全谷物搭配。',
        seasonWhy:
          '春季豌豆进入嫩粒期，糖分与鲜味物质积累好；过季则纤维增多、甜度下降。',
        recipeIdeas: ['豌豆炒虾仁', '豌豆焖饭', '豌豆玉米丁', '豌豆浓汤', '豌豆炒肉末'],
        benefits: ['植物蛋白', '鲜甜口感', '色彩丰富'],
        eatTips: ['快炒保持脆感', '可搭配玉米胡萝卜', '冷冻分装更省事'],
        caution: ['消化不良者适量'],
        opsInsight: ['适合做“便当饭”内容', '焖饭类转化高']
      },
      香椿: {
        image: '/packageCook/images/seasonal/toon.png',
        coverEmoji: '🌿',
        explain: `${seasonText}香椿气味独特，是春季限定风味，适合炒蛋或拌豆腐。`,
        nutrition:
          '含一定多酚与维生素，风味物质丰富；但硝酸盐/亚硝酸盐风险需通过焯水等方式降低。',
        seasonWhy:
          '香椿芽仅在春季萌发，采摘窗口短，属于典型“时令限定”；雨后品质与香气更佳。',
        recipeIdeas: ['香椿炒蛋', '香椿拌豆腐', '香椿酱', '香椿鱼卷', '香椿煎饼'],
        benefits: ['春季限定', '风味层次', '家常快手'],
        eatTips: ['焯水再烹饪', '与鸡蛋绝配', '少量尝鲜即可'],
        caution: ['过敏者慎用', '硝酸盐含量需焯水'],
        opsInsight: ['适合做“限定感”营销', '短视频种草']
      },
      番茄: {
        image: '/packageCook/images/seasonal/tomato.png',
        coverEmoji: '🍅',
        explain: `${seasonText}番茄酸甜适口，适合凉拌、炖煮与家常小炒。`,
        nutrition:
          '番茄红素（熟吃更易释放）、维生素 C 与钾；少油快炒或炖煮有助于脂溶性营养素吸收。',
        seasonWhy:
          '露地番茄在气温适宜时风味物质积累更充分；应季番茄酸甜平衡，更适合做汤与家常小炒。',
        recipeIdeas: ['番茄炒蛋', '番茄牛腩', '番茄鸡蛋汤', '糖拌番茄', '番茄炖豆腐'],
        benefits: ['百搭', '番茄红素', '家常必备'],
        eatTips: ['熟吃更释放番茄红素', '做汤/炒蛋都合适'],
        caution: ['胃酸过多者适量'],
        opsInsight: ['适合做“一周食谱”模板', '搭配鸡蛋组合']
      },
      芦笋: {
        image: '/packageCook/images/seasonal/asparagus.png',
        coverEmoji: '🥬',
        explain: `${seasonText}芦笋脆嫩低脂，适合清炒、烤制或白灼。`,
        nutrition:
          '热量低、膳食纤维与叶酸含量较好；含天门冬酰胺等呈鲜物质，适合少油烹饪突出本味。',
        seasonWhy:
          '春季芦笋抽薹快、茎秆细嫩；气温升高后纤维变粗，口感与价格优势都会下降。',
        recipeIdeas: ['白灼芦笋', '清炒芦笋', '芦笋炒虾仁', '烤芦笋', '芦笋培根卷'],
        benefits: ['低脂清爽', '口感脆', '摆盘好看'],
        eatTips: ['根老处略削皮', '少油快炒', '现做现吃'],
        caution: ['痛风人群适量'],
        opsInsight: ['适合做“轻食”主题', '健身人群推荐']
      },
      樱桃: {
        image: '/packageCook/images/seasonal/cherry.png',
        coverEmoji: '🍒',
        explain: `${seasonText}樱桃甜度高、汁水足，适合作为健康加餐。`,
        nutrition:
          '含花青素、钾与一定量的维生素 C；天然糖分较高，建议分次少量，替代饼干蛋糕更健康。',
        seasonWhy:
          '主产区集中采收期短，冷链运输成熟后仍能保持较好口感；过季多依赖贮藏果，鲜度与风味不同。',
        recipeIdeas: ['鲜食樱桃', '樱桃酸奶杯', '樱桃燕麦碗', '樱桃果酱（控糖）', '樱桃水果拼盘'],
        benefits: ['当季水果', '甜度高', '替代零食'],
        eatTips: ['冷藏保存', '吃前清洗', '分次食用'],
        caution: ['控糖人群注意份量'],
        opsInsight: ['适合做“下午茶替代”', '礼盒内容种草']
      },
      蚕豆: {
        image: '/packageCook/images/seasonal/broad_bean.png',
        coverEmoji: '🫘',
        explain: `${seasonText}蚕豆粉糯鲜香，适合葱油、快炒或焖饭。`,
        nutrition:
          '植物蛋白与淀粉含量较高，饱腹感强；同时含膳食纤维与 B 族维生素，适合搭配蔬菜平衡一餐。',
        seasonWhy:
          '春末嫩蚕豆上市集中，豆粒饱满粉糯；老熟后淀粉与口感变化明显，鲜食窗口更短。',
        recipeIdeas: ['葱油蚕豆', '蚕豆炒蛋', '蚕豆焖饭', '雪菜蚕豆', '蚕豆炒肉末'],
        benefits: ['植物蛋白', '饱腹感', '家常风味'],
        eatTips: ['剥壳后尽快烹饪', '搭配葱蒜更香'],
        caution: ['蚕豆病禁忌人群禁食'],
        opsInsight: ['适合做“春季家常”合集', '焖饭类转化高']
      },
      黄瓜: {
        image: '/packageCook/images/seasonal/cucumber.png',
        coverEmoji: '🥒',
        explain: `${seasonText}黄瓜清脆多汁，适合凉拌、快炒与蘸酱。`,
        nutrition:
          '水分高、热量低，含钾与少量维生素；适合作为加餐蔬菜，但不宜完全替代深色叶菜。',
        seasonWhy:
          '春夏气温升高后生长快、产量高，价格友好且口感更脆；应季黄瓜风味更清爽。',
        recipeIdeas: ['拍黄瓜', '黄瓜炒蛋', '黄瓜拌木耳', '黄瓜卷蘸酱', '黄瓜酸奶沙拉'],
        benefits: ['清爽补水', '低热量', '凉拌友好'],
        eatTips: ['冷藏后更脆', '少盐更清爽'],
        caution: ['脾胃虚寒者适量'],
        opsInsight: ['适合做“轻食凉拌”合集']
      },
      橙子: {
        image: '/packageCook/images/seasonal/orange.png',
        coverEmoji: '🍊',
        explain: `${seasonText}橙子酸甜适口，适合鲜食与榨汁（控量）。`,
        nutrition:
          '维生素 C、类黄酮与钾含量较好；与全谷物、坚果搭配可平衡一餐营养结构。',
        seasonWhy:
          '晚熟柑橘类在冬春之交集中上市，糖酸比更稳定；应季果皮香气足、汁水饱满。',
        recipeIdeas: ['鲜切橙子', '橙子酸奶杯', '橙子燕麦碗', '香橙鸡翅（少糖）', '橙子水果茶'],
        benefits: ['维C补充', '替代高糖饮料', '果香愉悦'],
        eatTips: ['分次食用', '榨汁不如直接吃纤维'],
        caution: ['胃酸过多者适量', '控糖注意份量'],
        opsInsight: ['适合做“替代奶茶”内容']
      }
    }

    // 其他应季食材图片映射（可持续补充；无 PNG 时走 emoji 封面）
    const imageMap = {
      豌豆: '/packageCook/images/seasonal/pea.png',
      香椿: '/packageCook/images/seasonal/toon.png',
      韭菜: '/packageCook/images/seasonal/leek.png',
      番茄: '/packageCook/images/seasonal/tomato.png',
      芦笋: '/packageCook/images/seasonal/asparagus.png',
      樱桃: '/packageCook/images/seasonal/cherry.png',
      蚕豆: '/packageCook/images/seasonal/broad_bean.png',
      黄瓜: '/packageCook/images/seasonal/cucumber.png',
      橙子: '/packageCook/images/seasonal/orange.png'
    }

    const fallbackByCategory = {
      vegetable: {
        benefits: ['更鲜更脆', '营养密度高', '性价比更好'],
        eatTips: ['少油快炒/清蒸', '搭配蛋白更均衡', '按需少量购买'],
        caution: ['生食需清洗彻底'],
        opsInsight: ['推荐“本周菜单”带动使用', '用“加到冰箱”促转化']
      },
      fruit: {
        benefits: ['自然甜味', '维生素补充', '替代加工零食'],
        eatTips: ['分次少量', '搭配酸奶/燕麦', '冷藏不宜久放'],
        caution: ['控糖人群注意份量'],
        opsInsight: ['适合做“下午茶替代”', '做“收藏/打卡”玩法']
      },
      meat: {
        benefits: ['优质蛋白', '饱腹感强', '搭配蔬菜更均衡'],
        eatTips: ['少油烹饪', '提前分装冷冻', '搭配粗粮更佳'],
        caution: ['高尿酸/高脂人群注意'],
        opsInsight: ['用“3 天备餐”提升复购', '搭配蔬菜做套餐']
      }
    }

    const palette = [
      { bg: '#FFF1F7', fg: '#FF3B7F' },
      { bg: '#F1FAFF', fg: '#2D7DFF' },
      { bg: '#F3FFF4', fg: '#1F9D3A' },
      { bg: '#FFF9EE', fg: '#D17A00' }
    ]

    return safeArray(items).map((it, idx) => {
      const name = it && it.name
      const base = detailMap[name] || {}
      const mappedImage = imageMap[name] || ''
      const byCat = fallbackByCategory[it.category] || fallbackByCategory.vegetable
      const p = palette[idx % palette.length]

      const benefits = uniq((base.benefits || []).concat(byCat.benefits || [])).slice(0, 4)
      const eatTips = uniq((base.eatTips || []).concat(byCat.eatTips || [])).slice(0, 5)
      const caution = uniq((base.caution || []).concat(byCat.caution || [])).slice(0, 4)
      const opsInsight = uniq((base.opsInsight || []).concat(byCat.opsInsight || [])).slice(0, 4)

      const explain = base.explain || `${regionText}${seasonText}更容易买到更新鲜的「${name}」，通常口感更好、价格更友好。`

      const nutritionText =
        base.nutrition || defaultNutritionText(name, it.category)
      const nutritionBullets =
        (base.nutritionBullets && base.nutritionBullets.length
          ? base.nutritionBullets
          : nutritionToBullets(nutritionText)
        ).slice(0, 8)
      const seasonWhyText =
        base.seasonWhy || defaultSeasonWhyText(name, month, regionText)
      const recipeIdeas =
        (base.recipeIdeas && base.recipeIdeas.length >= 2
          ? base.recipeIdeas
          : defaultRecipeIdeas(name, it.category)
        ).slice(0, 6)

      const desc =
        explain.length > 102
          ? `${explain.slice(0, 102)}…`
          : explain

      const imgSrc = base.image || mappedImage || it.image || ''
      const coverEmoji = base.coverEmoji || it.icon || '🥗'

      return {
        ...it,
        image: imgSrc,
        coverEmoji,
        coverBg: p.bg,
        coverFg: p.fg,
        /* 卡片色调（0–3），用于分层样式 */
        cardTone: idx % 4,
        /* 主推大卡用：无本地图时展示超大 emoji 插画区 */
        coverEmojiLarge: coverEmoji,
        explain,
        desc,
        nutritionText,
        nutritionBullets,
        seasonWhyText,
        recipeIdeas,
        benefits,
        eatTips,
        caution,
        opsInsight,
        // 用于卡片快速展示
        benefitHighlights: benefits.slice(0, 2)
      }
    })
  }
})

