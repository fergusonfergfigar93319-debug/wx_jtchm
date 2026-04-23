const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

function safeArray(v) {
  return Array.isArray(v) ? v : []
}

function clampNum(v, min, max) {
  const n = Number(v)
  if (Number.isNaN(n)) return min
  return Math.max(min, Math.min(max, n))
}

function buildNutritionEstimate(item) {
  const name = (item && item.name) || ''
  const cat = (item && item.category) || 'vegetable'

  const baseByCategory = {
    vegetable: { kcal: 25, protein: 2.0, carbs: 4.5, fat: 0.3, fiber: 2.2, highlight: '低脂高纤维' },
    fruit: { kcal: 45, protein: 0.7, carbs: 11.0, fat: 0.2, fiber: 2.0, highlight: '维生素与抗氧化' },
    meat: { kcal: 165, protein: 20.0, carbs: 0.0, fat: 9.0, fiber: 0.0, highlight: '优质蛋白' }
  }

  const override = {
    '春笋': { kcal: 27, protein: 2.6, carbs: 5.2, fat: 0.2, fiber: 2.8, highlight: '高纤维、清爽低脂' },
    '菠菜': { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, highlight: '叶酸/铁/维K（焯水更佳）' },
    '草莓': { kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2.0, highlight: '维C与花青素' },
    '豌豆': { kcal: 81, protein: 5.4, carbs: 14.5, fat: 0.4, fiber: 5.1, highlight: '植物蛋白+纤维' },
    '香椿': { kcal: 40, protein: 3.0, carbs: 5.0, fat: 0.7, fiber: 2.0, highlight: '香气浓郁（焯水去亚硝酸盐）' }
  }

  const b = override[name] || baseByCategory[cat] || baseByCategory.vegetable
  return {
    kcal: clampNum(b.kcal, 0, 999),
    protein: clampNum(b.protein, 0, 99).toFixed(1),
    carbs: clampNum(b.carbs, 0, 99).toFixed(1),
    fat: clampNum(b.fat, 0, 99).toFixed(1),
    fiber: clampNum(b.fiber, 0, 99).toFixed(1),
    highlight: b.highlight || ''
  }
}

Page({
  data: {
    liteMode: false,
    month: 0,
    season: '',
    regionName: '你所在地区',
    item: {},
    nutrition: {
      kcal: 0,
      protein: '0.0',
      carbs: '0.0',
      fat: '0.0',
      fiber: '0.0',
      highlight: ''
    },
    recipesLoading: false,
    recipes: [],
    recipesError: ''
  },

  onLoad(options) {
    try {
      const app = getApp()
      this.setData({ liteMode: !!(app && app.globalData && app.globalData.liteMode) })
    } catch (e) {}

    const month = Number(options.month) || (new Date().getMonth() + 1)
    const season = options.season ? decodeURIComponent(options.season) : ''
    const regionName = options.region ? decodeURIComponent(options.region) : '你所在地区'

    let item = {}
    try {
      const raw = wx.getStorageSync('seasonal_detail_item')
      if (raw && typeof raw === 'object') item = raw
    } catch (e) {}

    // 兜底：只有 name 时也能加载
    const name = options.name ? decodeURIComponent(options.name) : (item.name || '')
    if (!item.name && name) item = { ...item, name }

    this.setData({
      month,
      season,
      regionName,
      item
    })

    if (item && item.name) {
      wx.setNavigationBarTitle({ title: item.name })
    }

    const nutrition = buildNutritionEstimate(item)
    this.setData({ nutrition })

    this.loadRecipes(item)
  },

  async loadRecipes(item) {
    const ingredient = item && item.name ? String(item.name).trim() : ''
    if (!ingredient) {
      this.setData({ recipesLoading: false, recipesError: '食材信息不完整' })
      return
    }

    try {
      this.setData({ recipesLoading: true, recipes: [], recipesError: '' })
      const result = await api.searchRecommend({
        mode: 'cook',
        use_fridge: false,
        filters: { keyword: ingredient }
      })
      let recipes = safeArray(result && result.recommendations)

      recipes = recipes
        .map(r => ({
          id: r.id,
          name: r.name || '未知菜谱',
          tags: safeArray(r.tags).slice(0, 3),
          cooking_time: r.cooking_time || 0,
          calories: r.calories || r.calories_per_100g || 0,
          match_reason: r.match_reason || ''
        }))
        .filter(r => r.id)
        .slice(0, 8)

      this.setData({
        recipesLoading: false,
        recipes,
        recipesError: recipes.length ? '' : '暂时没找到匹配菜谱，可点「用它做菜」获得更多推荐。'
      })
    } catch (err) {
      console.error('加载菜谱失败', err)
      this.setData({
        recipesLoading: false,
        recipes: [],
        recipesError: '加载失败，可稍后重试'
      })
    }
  },

  async addToFridge() {
    const item = this.data.item
    if (!item || !item.name) return
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
      this.setData({ item: { ...item, added: true, amount_in_fridge: (item.amount_in_fridge || 0) + 1 } })
    } catch (err) {
      console.error('添加失败', err)
      util.showToast('添加失败，请稍后重试')
    }
  },

  goSmartChoice() {
    const item = this.data.item
    if (!item || !item.name) return
    wx.navigateTo({
      url: `/packageCook/smart-choice/smart-choice?ingredient=${encodeURIComponent(item.name)}&fromSeasonalDetail=true`,
      fail(err) {
        console.error('跳转智能搜餐失败', err)
        util.showToast('跳转失败，请稍后再试')
      }
    })
  },

  goRecipeDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({
      url: `/packageCook/cook-detail/cook-detail?id=${id}`,
      fail(err) {
        console.error('跳转菜谱详情失败', err)
        util.showToast('跳转失败，请稍后再试')
      }
    })
  }
})

