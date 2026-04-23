// pages/smart-choice/smart-choice.js - 智能决策助手
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')
const app = getApp()

/** 无真实定位时满足后端必填经纬度（仅用于菜谱类推荐，不表示用户位置） */
const FALLBACK_LOCATION = { latitude: 39.9042, longitude: 116.4074 }

Page({
  data: {
    // 用户当前状态
    currentState: {
      intake_actual: 0,
      daily_limit: 2000,
      remaining: 2000,
      macros: {
        carbg: 0,
        proteing: 0,
        fatg: 0
      },
      mealType: 'lunch', // breakfast/lunch/dinner/snack
      currentHour: 12
    },
    
    // 推荐选项
    recommendations: [],
    currentIndex: 0,
    
    // 筛选模式
    filterMode: 'smart', // smart/healthy/match/random
    filterModes: [
      { id: 'smart', name: '智能推荐', icon: '🧠', desc: '综合最优' },
      { id: 'healthy', name: '健康优先', icon: '🥗', desc: '低卡营养' },
      { id: 'match', name: '匹配优先', icon: '🎯', desc: '冰箱匹配' },
      { id: 'random', name: '随机探索', icon: '🎲', desc: '发现惊喜' }
    ],
    
    // 场景类型
    mealTypes: [
      { id: 'breakfast', name: '早餐', icon: '🌅', time: '06:00-10:00' },
      { id: 'lunch', name: '午餐', icon: '☀️', time: '10:00-14:00' },
      { id: 'afternoon_tea', name: '下午茶', icon: '🍵', time: '14:00-17:00' },
      { id: 'dinner', name: '晚餐', icon: '🌙', time: '17:00-21:00' },
      { id: 'snack', name: '加餐', icon: '🍪', time: '随时' }
    ],
    
    // UI状态
    loading: false,
    showFilter: false,
    showMealType: false,
    hasLocation: false,
    location: null,
    mealPrepMode: false,
    showAdvanced: false,
    showSwipeHint: false,
    skeletonItems: [
      { type: 'rect', height: '380rpx', radius: '28rpx', margin: '28rpx 28rpx 0' },
      { type: 'text', width: '55%', height: '36rpx', margin: '24rpx 28rpx 12rpx' },
      { type: 'text', width: '35%', height: '26rpx', margin: '0 28rpx 20rpx' },
      { type: 'rect', height: '72rpx', radius: '16rpx', margin: '0 28rpx 28rpx' }
    ],

    // 对比模式
    compareMode: false,
    compareItems: [],
    compareActiveIdx: 0,
    compareDims: [],

    // 份量调整面板
    showPortionPanel: false,
    pendingItem: {},
    portionMultiplier: 1,
    portionOptions: [],
    portionCalories: 0,

    // 推荐理由详情面板
    showReasonPanel: false,
    reasonDetailItem: {},
    reasonDetailLines: [],
    reasonGoalLines: [],

    // 计算属性（用于WXML显示）
    currentMealTypeName: '午餐',
    currentFilterModeName: '智能推荐',
    currentFilterModeIcon: '🧠',
    intakePercent: 0,
    loadError: false,
    loadErrorMsg: '',
    confirmLoading: false,
    /** 从应季食材页「用它做菜」带入，联动菜谱推荐 */
    seasonalBoost: { active: false, ingredient: '', dishHint: '' }
  },

  onLoad(options) {
    // 从应季食材页：聚焦食材/菜名，走「自己做」菜谱模式
    let seasonalBoost = { active: false, ingredient: '', dishHint: '' }
    if (options.fromSeasonalPage === 'true' && options.ingredient) {
      let ing = String(options.ingredient || '')
      let dish = String(options.dish_hint || '')
      try {
        ing = decodeURIComponent(ing)
      } catch (e) {}
      try {
        dish = decodeURIComponent(dish)
      } catch (e2) {}
      seasonalBoost = { active: true, ingredient: ing.trim(), dishHint: dish.trim() }
    }
    this._seasonalBoost = seasonalBoost
    this.setData({ seasonalBoost })

    // 如果从智能备餐入口进入，自动开启备餐模式
    if (options.meal_prep === 'true') {
      this.setData({ mealPrepMode: true })
    }
    // 从首页快速记录传入餐段
    const mealType = options.meal_type || ''
    if (mealType && ['breakfast', 'lunch', 'dinner', 'snack', 'afternoon_tea'].includes(mealType)) {
      this.setData({ 'currentState.mealType': mealType })
    }

    // 首次进入显示滑动引导提示
    if (!wx.getStorageSync('sc_swipe_guided')) {
      this.setData({ showSwipeHint: true })
      setTimeout(() => {
        this.setData({ showSwipeHint: false })
        wx.setStorageSync('sc_swipe_guided', true)
      }, 2500)
    }

    this.initPage()
  },

  onShow() {
    // 每次显示时刷新用户状态
    this.loadCurrentState()
  },

  onPullDownRefresh() {
    this.loadRecommendations().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 初始化页面
  async initPage() {
    // 获取当前时间，判断餐段
    const hour = new Date().getHours()
    let mealType = 'lunch'
    if (hour >= 6 && hour < 10) mealType = 'breakfast'
    else if (hour >= 10 && hour < 14) mealType = 'lunch'
    else if (hour >= 14 && hour < 17) mealType = 'afternoon_tea'
    else if (hour >= 17 && hour < 21) mealType = 'dinner'
    else mealType = 'snack'
    
    this.setData({
      'currentState.currentHour': hour,
      'currentState.mealType': mealType
    })
    
    // 更新显示名称
    this.updateDisplayNames()
    
    // 加载用户状态和推荐
    await this.loadCurrentState()
    await this.loadRecommendations()
  },

  // 折叠/展开高级设置
  toggleAdvanced() {
    this.setData({ showAdvanced: !this.data.showAdvanced })
  },

  // 更新显示名称（用于WXML）
  updateDisplayNames() {
    const mealType = this.data.currentState.mealType
    const filterMode = this.data.filterMode
    
    const mealTypeItem = this.data.mealTypes.find(m => m.id === mealType)
    const filterModeItem = this.data.filterModes.find(m => m.id === filterMode)
    
    this.setData({
      currentMealTypeName: mealTypeItem ? mealTypeItem.name : '午餐',
      currentFilterModeName: filterModeItem ? filterModeItem.name : '智能推荐',
      currentFilterModeIcon: filterModeItem ? filterModeItem.icon : '🧠'
    })
  },

  // 加载用户当前状态
  async loadCurrentState() {
    try {
      const today = util.formatDate(new Date())
      const summary = await api.getDailySummary(today)
      
      const intakeActual = summary.intake_actual || 0
      const dailyLimit = summary.daily_limit || 2000
      const remaining = Math.max(0, dailyLimit - intakeActual)
      const macros = summary.macros || {
        carbg: 0,
        proteing: 0,
        fatg: 0
      }
      
      const intakePercent = dailyLimit > 0 ? Math.min(100, Math.round((intakeActual / dailyLimit) * 100)) : 0
      this.setData({
        'currentState.intake_actual': intakeActual,
        'currentState.daily_limit': dailyLimit,
        'currentState.remaining': remaining,
        'currentState.macros': macros,
        intakePercent
      })
    } catch (error) {
      console.error('加载用户状态失败', error)
    }
  },

  /**
   * 统一营养字段（兼容 carb/carbs、protein_g 等）
   */
  normalizeNutrition(raw) {
    if (!raw || typeof raw !== 'object') return { protein: 0, carb: 0, fat: 0, fiber: 0 }
    const protein = Number(raw.protein != null ? raw.protein : raw.protein_g) || 0
    const carb = Number(raw.carb != null ? raw.carb : raw.carbs != null ? raw.carbs : raw.carbohydrate) || 0
    const fat = Number(raw.fat != null ? raw.fat : raw.fat_g) || 0
    const fiber = Number(raw.fiber) || 0
    return { protein, carb, fat, fiber }
  },

  /**
   * 仅有热量时估算三大营养素（克），便于对比与进度条展示
   */
  estimateNutritionFromCalories(cal) {
    const c = Number(cal) || 0
    if (c <= 0) return { protein: 0, carb: 0, fat: 0, fiber: 0 }
    const protein = Math.max(0, Math.round((c * 0.26) / 4))
    const carb = Math.max(0, Math.round((c * 0.46) / 4))
    const fat = Math.max(0, Math.round((c * 0.28) / 9))
    const fiber = Math.max(0, Math.round(carb / 12))
    return { protein, carb, fat, fiber }
  },

  /**
   * 补全推荐项：商家从「招牌菜」取热量/营养；缺失时用热量估算
   */
  enrichRecommendationItem(item) {
    if (!item || typeof item !== 'object') return item
    const copy = { ...item }
    const isRestaurant =
      copy.type === 'restaurant' ||
      (Array.isArray(copy.recommended_dishes) && copy.recommended_dishes.length > 0 && !copy.ingredients)

    let dish = null
    if (isRestaurant && Array.isArray(copy.recommended_dishes) && copy.recommended_dishes.length > 0) {
      dish = copy.recommended_dishes[0]
    }

    let calories = Number(
      copy.calories ||
        copy.estimated_calories ||
        (dish && (dish.calories || dish.estimated_calories)) ||
        0
    )

    let nutrition = this.normalizeNutrition(copy.nutrition)
    if (dish && dish.nutrition) {
      const dn = this.normalizeNutrition(dish.nutrition)
      nutrition = { ...nutrition, ...dn }
    }

    const hasMacro =
      (nutrition.protein || 0) > 0 ||
      (nutrition.carb || 0) > 0 ||
      (nutrition.fat || 0) > 0

    if (calories > 0 && !hasMacro) {
      nutrition = { ...this.estimateNutritionFromCalories(calories), ...nutrition }
    }

    if (!hasMacro && calories <= 0 && dish) {
      calories = Number(dish.calories || dish.estimated_calories || 0)
      if (calories > 0) {
        nutrition = { ...this.estimateNutritionFromCalories(calories), ...nutrition }
      }
    }

    // 微信要求网络图片为 HTTPS；后端/高德常返回 http，统一升级（本地/内网 API 图不改动）
    const rawImageCandidates = [
      copy.image,
      dish && (dish.image || dish.cover || dish.photo),
      copy.cover_url,
      copy.cover,
      copy.photo,
      Array.isArray(copy.photos) && copy.photos.length ? copy.photos[0] : null
    ].filter(Boolean)
    let imageUrl = ''
    for (let i = 0; i < rawImageCandidates.length; i++) {
      const s = String(rawImageCandidates[i]).trim()
      if (!s) continue
      const candidate = util.normalizeExternalImageUrl(s)
      if (candidate && !util.isBackendDummyImageUrl(candidate)) {
        imageUrl = candidate
        break
      }
    }

    if (!imageUrl && !isRestaurant) {
      imageUrl = util.resolveRecipeCoverUrl(copy)
    }
    if (!imageUrl && isRestaurant) {
      imageUrl = util.resolveRestaurantCoverUrl(copy)
    }

    return {
      ...copy,
      calories,
      nutrition,
      image: imageUrl,
      store_name: copy.store_name || copy.restaurant_name || copy.name,
      restaurant_name: copy.restaurant_name || copy.name
    }
  },

  /**
   * 解析定位：页面缓存 → App 全局（onLaunch 异步写入）→ wx.getLocation
   * @returns {Promise<{latitude:number,longitude:number}|null>}
   */
  async resolveSearchLocation() {
    let loc = this.data.location
    if (loc && loc.latitude != null && loc.longitude != null) {
      return loc
    }
    const g = app.globalData.location
    if (g && g.latitude != null && g.longitude != null) {
      loc = { latitude: g.latitude, longitude: g.longitude }
      this.setData({ location: loc, hasLocation: true })
      return loc
    }
    try {
      const res = await new Promise((resolve, reject) => {
        wx.getLocation({
          type: 'gcj02',
          success: resolve,
          fail: reject
        })
      })
      loc = { latitude: res.latitude, longitude: res.longitude }
      app.globalData.location = loc
      this.setData({ location: loc, hasLocation: true })
      return loc
    } catch (e) {
      console.log('获取位置失败', e)
      return null
    }
  },

  // 加载推荐
  async loadRecommendations() {
    if (this.data.loading) return
    
    this.setData({ loading: true, loadError: false, loadErrorMsg: '' })
    
    try {
      const resolvedLoc = await this.resolveSearchLocation()
      
      // 获取冰箱库存（用于匹配优先模式）
      let fridgeItems = []
      try {
        const fridgeData = await api.getFridgeItems()
        fridgeItems = Array.isArray(fridgeData) ? fridgeData : (fridgeData.items || [])
      } catch (e) {
        console.log('获取冰箱数据失败')
      }
      
      // 构建推荐参数
      const isMatchMode = this.data.filterMode === 'match'
      const boost = this._seasonalBoost || this.data.seasonalBoost || {}
      const fromSeasonalCook = !!(boost && boost.active && boost.ingredient)
      // 应季「自己做」：强制菜谱模式，并带关键词（菜名优先，否则食材名）
      const params = {
        mode: fromSeasonalCook ? 'cook' : isMatchMode ? 'cook' : 'restaurant',
        meal_type: this.data.currentState.mealType,
        remaining_calories: this.data.currentState.remaining,
        macros: this.data.currentState.macros,
        filter_mode: this.data.filterMode,
        meal_prep: this.data.mealPrepMode || undefined, // 备餐模式
        count: 10
      }
      if (fromSeasonalCook) {
        const kw = (boost.dishHint || boost.ingredient || '').trim()
        if (kw) {
          params.filters = params.filters || {}
          params.filters.keyword = kw
        }
        params.seasonal_ingredient = boost.ingredient
        params.from_seasonal_page = true
      }
      
      // 匹配优先模式：传入冰箱数据，便于后端按食材匹配菜谱
      if (isMatchMode && fridgeItems.length > 0) {
        params.use_fridge = true
        params.fridge_ingredients = fridgeItems.map(i => i.name || i.ingredient_name).filter(Boolean)
      }
      
      // 附近外卖依赖真实定位；无定位时改为菜谱推荐，避免后端 400「需要经纬度」及假坐标搜附近店
      if (params.mode === 'restaurant' && !resolvedLoc) {
        params.mode = 'cook'
        wx.showToast({
          title: '未获取位置，已推荐菜谱',
          icon: 'none',
          duration: 2200
        })
      }

      params.lat = resolvedLoc ? resolvedLoc.latitude : FALLBACK_LOCATION.latitude
      params.lng = resolvedLoc ? resolvedLoc.longitude : FALLBACK_LOCATION.longitude

      // 标记当前是否为商家推荐模式（用于后续推断类型）
      const isRestaurantMode = params.mode === 'restaurant'
      
      // 调用推荐API
      const result = await api.searchRecommend(params)
      let items = result.recommendations || result.items || []
      items = items.filter((it) => !util.shouldHideRestaurantListItem(it))

      // 备餐模式：筛选适合备餐的菜谱
      if (this.data.mealPrepMode) {
        items = items.filter(item => {
          // 只推荐菜谱，不推荐商家
          if (item.type === 'restaurant' || item.restaurant_id) return false
          
          // 适合备餐的菜谱特征
          const tags = (item.tags || []).join(' ').toLowerCase()
          const name = (item.name || '').toLowerCase()
          const cookingTime = item.cooking_time || 0
          
          const isMealPrepSuitable = 
            tags.includes('备餐') || tags.includes('meal_prep') ||
            tags.includes('炖') || tags.includes('煮') || tags.includes('汤') ||
            name.includes('炖') || name.includes('咖喱') || name.includes('汤') ||
            (cookingTime >= 30 && cookingTime <= 120) // 30分钟-2小时适合备餐
          
          return isMealPrepSuitable
        })
        
        // 为备餐菜谱添加存储天数信息
        items = items.map(item => {
          const tags = (item.tags || []).join(' ').toLowerCase()
          const name = (item.name || '').toLowerCase()
          
          let storageDays = 3 // 默认3天
          if (tags.includes('炖') || name.includes('炖')) {
            storageDays = 4 // 炖菜可存4天
          } else if (tags.includes('咖喱') || name.includes('咖喱')) {
            storageDays = 5 // 咖喱可存5天
          } else if (tags.includes('汤') || name.includes('汤')) {
            storageDays = 3 // 汤类可存3天
          }
          
          return {
            ...item,
            meal_prep_suitable: true,
            storage_days: storageDays,
            meal_prep_tip: `可储存${storageDays}天，适合一次做多份`
          }
        })
      }
      
  // 处理推荐数据，添加 store_name、likes 等展示字段
      const recommendations = items.map((item, index) => {
        const enriched = this.enrichRecommendationItem(item)
        // 统一处理原始 id：优先使用后端返回的 id/restaurant_id
        const rawId = enriched.id || enriched.restaurant_id || `rec_${index}`
        const idStr = String(rawId)

        // 推断类型：
        // 1）后端显式给了 type，则直接使用；
        // 2）否则，如果当前是商家模式，则强制认为是商家；
        // 3）再兜底：B0 开头也认为是商家 ID；
        // 4）剩下的默认认为是菜谱。
        let type = enriched.type
        if (!type) {
          if (isRestaurantMode || idStr.startsWith('B0')) {
            type = 'restaurant'
          } else {
            type = 'recipe'
          }
        }

        const reasonObj = this.generateRecommendReason(enriched, index)
        const healthObj = this.getHealthScoreDisplay(enriched)
        return {
          ...enriched,
          id: rawId,
          name: enriched.name || '未知食物',
          type,
          calories: enriched.calories || 0,
          nutrition: enriched.nutrition || {},
          image: enriched.image || '',
          imageFailed: false,
          _imgRetry: false,
          rating: enriched.rating || 0,
          likes: enriched.likes != null ? enriched.likes : (80 + Math.floor(Math.random() * 150)),
          store_name: enriched.store_name || enriched.restaurant_name || '',
          distance: enriched.distance || '',
          reason: reasonObj.text,
          reasonTags: reasonObj.tags || [],
          healthScore: healthObj.score,
          healthLabel: healthObj.label,
          healthReasons: healthObj.reasons,
          matchScore: enriched.match_score || 0,
          tags: enriched.tags || this.generateTags(enriched),
          scoreDims: null // 在 setData 后通过 buildScoreDims 填充
        }
      })
      
      this.setData({
        recommendations,
        currentIndex: 0
      })

      // 填充每条推荐的多维评分（需在 setData 后，因为 buildScoreDims 读取 currentState）
      const dimsUpdates = {}
      recommendations.forEach((rec, i) => {
        dimsUpdates[`recommendations[${i}].scoreDims`] = this.buildScoreDims(rec)
      })
      if (Object.keys(dimsUpdates).length > 0) this.setData(dimsUpdates)
      
    } catch (error) {
      console.error('加载推荐失败', error)
      const errMsg = (error && error.message) ? error.message : '网络异常'
      this.setData({
        loadError: true,
        loadErrorMsg: errMsg
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 重试加载
  retryLoad() {
    this.setData({ loadError: false, loadErrorMsg: '' })
    this.loadRecommendations()
  },

  /**
   * 高德图等外链在开发者工具/网络抖动时易出现 net::ERR_NETWORK_CHANGED，先带参重试一次再降级占位。
   */
  onCardImageError(e) {
    const index = e.currentTarget.dataset.index
    if (index === undefined || index === null) return
    const rec = this.data.recommendations[index]
    if (!rec || !rec.image) return
    if (rec._imgRetry) {
      const localUrl =
        rec.type === 'restaurant'
          ? util.resolveRestaurantCoverUrl({ ...rec, image: '', photos: [] })
          : util.resolveRecipeCoverUrl({ ...rec, image: '', photos: [] })
      this.setData({
        [`recommendations[${index}].image`]: localUrl,
        [`recommendations[${index}].imageFailed`]: false
      })
      return
    }
    const sep = String(rec.image).includes('?') ? '&' : '?'
    const newUrl = `${rec.image}${sep}_retry=${Date.now()}`
    this.setData({
      [`recommendations[${index}].image`]: newUrl,
      [`recommendations[${index}]._imgRetry`]: true
    })
  },

  // 生成推荐理由：返回 { text, tags } 便于主文案 + 多标签展示
  generateRecommendReason(item, index) {
    const tags = []
    const calories = item.calories || 0
    const remaining = this.data.currentState.remaining
    const mealType = this.data.currentState.mealType

    // 卡路里相关
    if (calories <= remaining * 0.25) {
      tags.push('低卡健康')
    } else if (calories <= remaining * 0.5) {
      tags.push('热量适中')
    } else if (calories <= remaining * 0.75) {
      tags.push('满足需求')
    } else if (calories <= remaining) {
      tags.push('不超今日预算')
    } else if (remaining > 0) {
      tags.push('略超预算')
    }

    // 营养相关
    if (item.nutrition) {
      const { protein, carb, fat, fiber } = item.nutrition
      if (protein && protein > 20) tags.push('高蛋白')
      if (protein && protein > 15 && protein <= 20) tags.push('蛋白适中')
      if (carb !== undefined && carb < 25) tags.push('低碳水')
      if (fat !== undefined && fat < 10) tags.push('低脂肪')
      if (fiber && fiber >= 3) tags.push('高纤维')
    }

    // 匹配相关（后端/冰箱）
    if (item.match_score >= 95) {
      tags.push('完美匹配')
    } else if (item.match_score >= 80) {
      tags.push('食材匹配')
    }
    if (item.match_reason && typeof item.match_reason === 'string') {
      const short = item.match_reason.length > 8 ? item.match_reason.slice(0, 8) + '…' : item.match_reason
      if (!tags.includes(short) && !tags.some(t => t.includes('匹配'))) tags.push(short)
    }

    // 烹饪/时间
    const cookingTime = item.cooking_time || item.cook_time
    if (cookingTime !== undefined && cookingTime <= 15) tags.push('快手')
    if (cookingTime !== undefined && cookingTime >= 30 && cookingTime <= 90) tags.push('适合备餐')

    // 餐段专属
    if (mealType === 'breakfast' && calories < 450) tags.push('早餐优选')
    if (mealType === 'lunch' && calories >= 400 && calories <= 600) tags.push('午餐饱腹')
    if (mealType === 'afternoon_tea' && calories < 250) tags.push('下午茶轻负担')
    if (mealType === 'dinner' && calories < 550) tags.push('晚餐推荐')
    if (mealType === 'snack' && calories < 200) tags.push('加餐适宜')

    // 名称/标签关键词
    const name = (item.name || '').toLowerCase()
    const itemTags = (item.tags || []).join(' ').toLowerCase()
    const combined = name + ' ' + itemTags
    if (/\b(沙拉|轻食|蒸|煮|烤)\b/.test(combined)) tags.push('烹饪健康')
    if (/\b(低脂|减脂|低gi)\b/.test(combined)) tags.push('控卡友好')
    if (item.rating && item.rating >= 4.6) tags.push('高评分')

    const uniq = [...new Set(tags)]
    const text = uniq.length > 0 ? uniq.slice(0, 3).join(' · ') : '为你推荐'
    return { text, tags: uniq.slice(0, 6) }
  },

  // 计算健康评分（仅数字，供内部使用）
  calculateHealthScore(item) {
    let score = 70
    const calories = item.calories || 0
    const remaining = this.data.currentState.remaining

    if (calories <= remaining * 0.3) score += 20
    else if (calories <= remaining * 0.6) score += 10
    else if (calories > remaining) score -= 20

    if (item.nutrition) {
      const { protein, carb, fat } = item.nutrition
      if (protein && protein > 20) score += 10
      if (carb !== undefined && carb < 30) score += 5
      if (fat !== undefined && fat < 10) score += 5
    }

    const name = (item.name || '').toLowerCase()
    const healthyKeywords = ['沙拉', '轻食', '蒸', '煮', '烤', '低脂', '高蛋白']
    const unhealthyKeywords = ['油炸', '烧烤', '麻辣', '重油']
    if (healthyKeywords.some(k => name.includes(k))) score += 10
    if (unhealthyKeywords.some(k => name.includes(k))) score -= 10

    return Math.max(0, Math.min(100, score))
  },

  // 健康分展示：{ score, label, reasons }
  getHealthScoreDisplay(item) {
    const score = this.calculateHealthScore(item)
    const reasons = []
    const calories = item.calories || 0
    const remaining = this.data.currentState.remaining

    if (calories <= remaining * 0.35) reasons.push('低卡')
    if (item.nutrition) {
      const { protein, carb, fat } = item.nutrition
      if (protein && protein > 18) reasons.push('高蛋白')
      if (carb !== undefined && carb < 30) reasons.push('低碳')
      if (fat !== undefined && fat < 12) reasons.push('低脂')
    }
    const name = (item.name || '').toLowerCase()
    if (['沙拉', '轻食', '蒸', '煮', '烤'].some(k => name.includes(k))) reasons.push('烹饪方式佳')

    let label = '一般'
    if (score >= 85) label = '优秀'
    else if (score >= 70) label = '良好'
    else if (score >= 55) label = '一般'
    else label = '注意'

    return {
      score,
      label,
      reasons: reasons.slice(0, 4)
    }
  },

  // 生成标签
  generateTags(item) {
    const tags = []
    const calories = item.calories || 0
    
    if (calories < 300) tags.push('低卡')
    else if (calories < 500) tags.push('适中')
    else tags.push('高能')
    
    if (item.match_score && item.match_score > 80) tags.push('完美匹配')
    if (item.rating && item.rating > 4.5) tags.push('高评分')
    
    return tags.slice(0, 3)
  },

  // 切换筛选模式
  selectFilterMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.filterMode) {
      this.setData({ showFilter: false })
      return
    }
    
    this.setData({
      filterMode: mode,
      showFilter: false
    })
    
    // 更新显示名称
    this.updateDisplayNames()
    
    // 重新加载推荐
    this.loadRecommendations()
  },

  // 切换餐段
  selectMealType(e) {
    const mealType = e.currentTarget.dataset.type
    if (mealType === this.data.currentState.mealType) {
      this.setData({ showMealType: false })
      return
    }
    
    this.setData({
      'currentState.mealType': mealType,
      showMealType: false
    })
    
    // 更新显示名称
    this.updateDisplayNames()
    
    // 重新加载推荐
    this.loadRecommendations()
  },

  // 切换推荐卡片
  swipeCard(e) {
    const current = e.detail.current
    this.setData({ currentIndex: current })
  },

  // 直接跳转到指定索引
  goToIndex(e) {
    const index = e.currentTarget.dataset.index
    if (index >= 0 && index < this.data.recommendations.length) {
      this.setData({ currentIndex: index })
    }
  },

  // 不感兴趣：跳过当前推荐，可选上报偏好
  async skipCurrent() {
    const list = this.data.recommendations
    const idx = this.data.currentIndex
    if (list.length === 0) return
    const current = list[idx]
    
    wx.vibrateShort()
    
    // 若后端支持，可上报「不感兴趣」用于后续减少类似推荐
    try {
      if (current.id && String(current.id).indexOf('default_') !== 0) {
        await api.setPreference({
          target_type: current.type === 'restaurant' ? 'restaurant' : 'recipe',
          target_id: current.id,
          action: 'block'
        })
      }
    } catch (e) {
      console.log('上报不感兴趣失败，仅本地跳过', e)
    }
    
    const recommendations = list.filter((_, i) => i !== idx)
    const newIndex = idx >= recommendations.length ? Math.max(0, recommendations.length - 1) : idx
    this.setData({
      recommendations,
      currentIndex: newIndex
    })
    
    if (recommendations.length === 0) {
      this.loadRecommendations()
    }
  },

  // 确认选择
  async confirmChoice() {
    const current = this.data.recommendations[this.data.currentIndex]
    if (!current || this.data.confirmLoading) return
    
    this.setData({ confirmLoading: true })
    
    try {
      util.showLoading('记录中...')
      
      // 如果是商家，跳转到商家详情
      if (current.type === 'restaurant' && current.id) {
        wx.navigateTo({
          url: `/packageRestaurant/restaurant-detail/restaurant-detail?id=${current.id}`
        })
        return
      }
      
      // 如果是菜谱，记录摄入
      await api.logIntake({
        source_type: current.type === 'recipe' ? 1 : 2,
        source_id: current.id || '',
        food_name: current.name,
        calories: current.calories || 0,
        portion: 1.0
      })
      
      util.showToast(`已记录 +${current.calories || 0} kcal`)
      
      // 刷新状态
      setTimeout(() => {
        this.loadCurrentState()
        // 移除已选择的推荐
        const recommendations = this.data.recommendations.filter((_, i) => i !== this.data.currentIndex)
        const newIndex = Math.min(this.data.currentIndex, recommendations.length - 1)
        this.setData({
          recommendations,
          currentIndex: newIndex
        })
        
        // 如果列表为空，重新加载
        if (recommendations.length === 0) {
          this.loadRecommendations()
        }
      }, 1500)
      
    } catch (error) {
      console.error('记录失败', error)
      util.showToast('记录失败，请重试')
    } finally {
      util.hideLoading()
      this.setData({ confirmLoading: false })
    }
  },

  /** 跳轉菜譜/商家詳情（底部「詳情」與卡片點擊共用） */
  _navigateToDetailForItem(current) {
    if (!current) return

    if (current.type === 'restaurant' && current.id && String(current.id).indexOf('default_') !== 0) {
      wx.navigateTo({
        url: `/packageRestaurant/restaurant-detail/restaurant-detail?id=${current.id}`
      })
      return
    }
    if (current.type === 'recipe' && current.id && String(current.id).indexOf('default_') !== 0) {
      wx.navigateTo({
        url: `/packageCook/cook-detail/cook-detail?id=${current.id}`
      })
      return
    }
    util.showToast('当前为推荐预览，暂无详情页', 'none')
  },

  viewDetail() {
    const current = this.data.recommendations[this.data.currentIndex]
    this._navigateToDetailForItem(current)
  },

  /** 點擊當前卡片主體進入詳情（子區域用 catchtap 避免冒泡） */
  onCardBodyTap(e) {
    const idx = e.currentTarget.dataset.index
    if (idx === undefined || idx === null) return
    const item = this.data.recommendations[idx]
    this._navigateToDetailForItem(item)
  },

  // 刷新推荐
  refreshRecommendations() {
    wx.vibrateShort()
    this.loadRecommendations()
  },

  // 切换筛选面板
  toggleFilter() {
    this.setData({ showFilter: !this.data.showFilter })
  },

  // 切换餐段面板
  toggleMealType() {
    this.setData({ showMealType: !this.data.showMealType })
  },

  // 备餐模式切换
  onMealPrepToggle(e) {
    const mealPrepMode = e.detail.value
    this.setData({ mealPrepMode })
    this.loadRecommendations()
    
    if (mealPrepMode) {
      util.showToast('已开启备餐模式，推荐耐储存菜谱', 'none', 2000)
    }
  },

  // 阻止事件冒泡
  stopPropagation() {},

  // ===== 多维度评分 =====
  // 为每条推荐计算 scoreDims（热量/蛋白/碳水/脂肪 vs 今日剩余目标）
  buildScoreDims(item) {
    const remaining = this.data.currentState.remaining
    const macros = this.data.currentState.macros || {}
    const enriched = this.enrichRecommendationItem(item)
    const n = this.normalizeNutrition(enriched.nutrition)
    const cal = enriched.calories || 0

    // 热量：与剩余热量的比例
    const calPct = remaining > 0 ? Math.min(100, Math.round((cal / remaining) * 100)) : 0
    const calLevel = calPct <= 35 ? 'good' : calPct <= 65 ? 'ok' : calPct <= 90 ? 'warn' : 'over'

    // 蛋白质：目标约 60g/天，按剩余比例估算
    const proteinTarget = Math.max(10, Math.round(60 * (remaining / Math.max(1, this.data.currentState.daily_limit))))
    const proteinPct = proteinTarget > 0 ? Math.min(100, Math.round(((n.protein || 0) / proteinTarget) * 100)) : 0
    const proteinLevel = proteinPct >= 60 ? 'good' : proteinPct >= 30 ? 'ok' : 'low'

    // 碳水：目标约 250g/天
    const carbTarget = Math.max(20, Math.round(250 * (remaining / Math.max(1, this.data.currentState.daily_limit))))
    const carbPct = carbTarget > 0 ? Math.min(100, Math.round(((n.carb || 0) / carbTarget) * 100)) : 0
    const carbLevel = carbPct <= 40 ? 'good' : carbPct <= 70 ? 'ok' : 'warn'

    // 脂肪：目标约 65g/天
    const fatTarget = Math.max(5, Math.round(65 * (remaining / Math.max(1, this.data.currentState.daily_limit))))
    const fatPct = fatTarget > 0 ? Math.min(100, Math.round(((n.fat || 0) / fatTarget) * 100)) : 0
    const fatLevel = fatPct <= 35 ? 'good' : fatPct <= 65 ? 'ok' : 'warn'

    return [
      { label: '热量', val: `${cal}kcal`, pct: calPct, level: calLevel },
      { label: '蛋白', val: `${n.protein || 0}g`, pct: proteinPct, level: proteinLevel },
      { label: '碳水', val: `${n.carb || 0}g`, pct: carbPct, level: carbLevel },
      { label: '脂肪', val: `${n.fat || 0}g`, pct: fatPct, level: fatLevel }
    ]
  },

  // ===== 对比模式 =====
  toggleCompare() {
    const recs = this.data.recommendations
    if (recs.length < 2) {
      util.showToast('至少需要2个推荐才能对比', 'none')
      return
    }
    const on = !this.data.compareMode
    if (on) {
      const idx = this.data.currentIndex
      const a = this.enrichRecommendationItem(recs[idx])
      const b = this.enrichRecommendationItem(recs[(idx + 1) % recs.length])
      this.setData({
        compareMode: true,
        compareItems: [a, b],
        compareActiveIdx: 0,
        compareDims: this.buildCompareDims(a, b)
      })
    } else {
      this.setData({ compareMode: false })
    }
  },

  buildCompareDims(a, b) {
    const ea = this.enrichRecommendationItem(a)
    const eb = this.enrichRecommendationItem(b)
    const na = this.normalizeNutrition(ea.nutrition)
    const nb = this.normalizeNutrition(eb.nutrition)
    const calA = Number(ea.calories) || 0
    const calB = Number(eb.calories) || 0
    const dims = [
      { key: 'cal',     label: '热量',  vals: [`${calA} kcal`, `${calB} kcal`], rawA: calA, rawB: calB, lowerBetter: true },
      { key: 'protein', label: '蛋白质', vals: [`${na.protein}g`, `${nb.protein}g`], rawA: na.protein, rawB: nb.protein, lowerBetter: false },
      { key: 'carb',    label: '碳水',  vals: [`${na.carb}g`, `${nb.carb}g`], rawA: na.carb, rawB: nb.carb, lowerBetter: true },
      { key: 'fat',     label: '脂肪',  vals: [`${na.fat}g`, `${nb.fat}g`], rawA: na.fat, rawB: nb.fat, lowerBetter: true },
      { key: 'score',   label: '健康分', vals: [`${ea.healthScore || 0}`, `${eb.healthScore || 0}`], rawA: ea.healthScore || 0, rawB: eb.healthScore || 0, lowerBetter: false }
    ]
    return dims.map(d => {
      let winner = -1
      if (d.rawA !== d.rawB) {
        winner = d.lowerBetter ? (d.rawA < d.rawB ? 0 : 1) : (d.rawA > d.rawB ? 0 : 1)
      }
      return { ...d, winner }
    })
  },

  selectCompareItem(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    if (!Number.isNaN(idx)) this.setData({ compareActiveIdx: idx })
  },

  pickFromCompare(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const item = this.data.compareItems[idx]
    if (!item) return
    this.setData({ compareMode: false })
    // 找到该 item 在 recommendations 中的位置并跳转
    const recIdx = this.data.recommendations.findIndex(r => String(r.id) === String(item.id))
    if (recIdx >= 0) this.setData({ currentIndex: recIdx })
    this.openPortionPanel(item)
  },

  // ===== 份量调整面板 =====
  onConfirmTap() {
    const current = this.data.recommendations[this.data.currentIndex]
    if (!current || this.data.confirmLoading) return
    // 商家直接跳转，不弹份量
    if (current.type === 'restaurant' && current.id) {
      wx.navigateTo({ url: `/packageRestaurant/restaurant-detail/restaurant-detail?id=${current.id}` })
      return
    }
    this.openPortionPanel(current)
  },

  openPortionPanel(item) {
    const base = item.calories || 0
    const options = [
      { val: 0.5, label: '半份', cal: Math.round(base * 0.5) },
      { val: 1,   label: '1份',  cal: base },
      { val: 1.5, label: '1.5份', cal: Math.round(base * 1.5) },
      { val: 2,   label: '2份',  cal: Math.round(base * 2) }
    ]
    this.setData({
      showPortionPanel: true,
      pendingItem: item,
      portionMultiplier: 1,
      portionOptions: options,
      portionCalories: base
    })
  },

  selectPortion(e) {
    const val = e.currentTarget.dataset.val
    const base = this.data.pendingItem.calories || 0
    this.setData({
      portionMultiplier: val,
      portionCalories: Math.round(base * val)
    })
  },

  closePortionPanel() {
    this.setData({ showPortionPanel: false })
  },

  async addToPlan() {
    const item = this.data.pendingItem
    const multiplier = this.data.portionMultiplier
    if (!item.name) return
    try {
      await api.logIntake({
        source_type: item.type === 'recipe' ? 1 : 2,
        source_id: item.id || '',
        food_name: item.name,
        calories: Math.round((item.calories || 0) * multiplier),
        portion: multiplier,
        is_plan: true
      })
      util.showToast(`已加入今日计划 📅`)
      this.setData({ showPortionPanel: false })
    } catch (e) {
      util.showToast('加入计划失败，请重试')
    }
  },

  async confirmWithPortion() {
    const item = this.data.pendingItem
    const multiplier = this.data.portionMultiplier
    if (!item.name || this.data.confirmLoading) return
    this.setData({ confirmLoading: true, showPortionPanel: false })
    try {
      util.showLoading('记录中...')
      await api.logIntake({
        source_type: item.type === 'recipe' ? 1 : 2,
        source_id: item.id || '',
        food_name: item.name,
        calories: Math.round((item.calories || 0) * multiplier),
        portion: multiplier
      })
      util.showToast(`已记录 +${Math.round((item.calories || 0) * multiplier)} kcal`)
      setTimeout(() => {
        this.loadCurrentState()
        const recommendations = this.data.recommendations.filter(r => r.id !== item.id)
        const newIndex = Math.min(this.data.currentIndex, Math.max(0, recommendations.length - 1))
        this.setData({ recommendations, currentIndex: newIndex })
        if (recommendations.length === 0) this.loadRecommendations()
      }, 1500)
    } catch (e) {
      util.showToast('记录失败，请重试')
    } finally {
      util.hideLoading()
      this.setData({ confirmLoading: false })
    }
  },

  // ===== 推荐理由详情面板 =====
  showReasonDetail(e) {
    const idx = e.currentTarget.dataset.index
    const tag = e.currentTarget.dataset.tag
    const item = this.data.recommendations[idx]
    if (!item) return
    this.openReasonPanel(item, tag)
  },

  showScoreDetail(e) {
    const idx = e.currentTarget.dataset.index
    const item = this.data.recommendations[idx]
    if (!item) return
    this.openReasonPanel(item, null)
  },

  openReasonPanel(item, focusTag) {
    const remaining = this.data.currentState.remaining
    const daily = this.data.currentState.daily_limit || 2000
    const n = item.nutrition || {}
    const cal = item.calories || 0
    const lines = []

    // 热量分析
    if (cal <= remaining * 0.35) lines.push(`热量仅 ${cal} kcal，只占你剩余额度的 ${Math.round(cal/remaining*100)}%，非常轻盈`)
    else if (cal <= remaining * 0.65) lines.push(`热量 ${cal} kcal，占剩余额度 ${Math.round(cal/remaining*100)}%，比较合适`)
    else if (cal <= remaining) lines.push(`热量 ${cal} kcal，接近剩余额度上限，建议适量`)
    else lines.push(`热量 ${cal} kcal，略超今日剩余额度 ${remaining} kcal，注意控制份量`)

    // 营养分析
    if (n.protein && n.protein > 18) lines.push(`蛋白质 ${n.protein}g，有助于饱腹感和肌肉维持`)
    if (n.carb !== undefined && n.carb < 30) lines.push(`碳水 ${n.carb}g，属于低碳水选择，血糖波动小`)
    if (n.fat !== undefined && n.fat < 10) lines.push(`脂肪 ${n.fat}g，低脂健康`)
    if (n.fiber && n.fiber >= 3) lines.push(`膳食纤维 ${n.fiber}g，有助于消化`)

    // 匹配分析
    if (item.match_score >= 90) lines.push(`与你冰箱食材高度匹配（${item.match_score}%），减少食材浪费`)
    else if (item.match_score >= 70) lines.push(`冰箱有部分食材可用（匹配度 ${item.match_score}%）`)

    // 烹饪方式
    const name = (item.name || '').toLowerCase()
    if (['蒸', '煮', '烤'].some(k => name.includes(k))) lines.push('烹饪方式健康，少油少盐')
    if (item.cooking_time && item.cooking_time <= 15) lines.push(`制作仅需约 ${item.cooking_time} 分钟，快手方便`)

    // 与今日目标的关系
    const goalLines = []
    const consumed = this.data.currentState.intake_actual || 0
    const pct = daily > 0 ? Math.round((consumed / daily) * 100) : 0
    if (pct < 40) goalLines.push({ icon: '📊', text: `今日已摄入 ${pct}%，还有充足空间` })
    else if (pct < 75) goalLines.push({ icon: '📊', text: `今日已摄入 ${pct}%，选择适中热量更合适` })
    else goalLines.push({ icon: '⚠️', text: `今日已摄入 ${pct}%，建议选低卡选项` })

    const mealType = this.data.currentState.mealType
    const mealNames = { breakfast: '早餐', lunch: '午餐', afternoon_tea: '下午茶', dinner: '晚餐', snack: '加餐' }
    goalLines.push({ icon: '🕐', text: `当前餐段：${mealNames[mealType] || ''}，推荐热量范围 ${mealType === 'snack' || mealType === 'afternoon_tea' ? '150-300' : mealType === 'breakfast' ? '300-500' : '400-700'} kcal` })

    if (item.healthScore >= 80) goalLines.push({ icon: '💚', text: `健康评分 ${item.healthScore}，是本次推荐中的优质选择` })

    this.setData({
      showReasonPanel: true,
      reasonDetailItem: item,
      reasonDetailLines: lines.length > 0 ? lines : ['综合你的今日摄入和营养目标，这是一个均衡的选择'],
      reasonGoalLines: goalLines
    })
  },

  closeReasonPanel() {
    this.setData({ showReasonPanel: false })
  },
})
