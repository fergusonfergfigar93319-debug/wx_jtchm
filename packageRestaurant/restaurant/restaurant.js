// pages/restaurant/restaurant.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')
const app = getApp()

Page({
  data: {
    locationText: '定位中...',
    filter: 'distance',
    showNightRemedy: false, // 显示深夜补救提示
    nightRemedyData: null, // 深夜补救数据
    filters: [
      { value: 'distance', label: '距离优先' },
      { value: 'rating', label: '评分优先' },
      { value: 'low_cal', label: '低卡优先' },
      { value: 'price_low', label: '价格从低' },
      { value: 'price_high', label: '价格从高' }
    ],
    healthFilters: [
      { value: 'all', label: '全部' },
      { value: 'green', label: '🟢 健康推荐' },
      { value: 'yellow', label: '🟡 适量选择' },
      { value: 'red', label: '🔴 高热量' }
    ],
    selectedHealthFilter: 'all',
    nutritionFilters: [
      { value: '', label: '全部' },
      { value: 'high_protein', label: '💪 高蛋白' },
      { value: 'low_gi', label: '📉 低GI' },
      { value: 'low_fat', label: '🥗 低脂' },
      { value: 'high_fiber', label: '🌾 高纤维' },
      { value: 'low_cal', label: '🔥 低卡' }
    ],
    selectedNutritionFilter: '',
    hungerLevel: '', // 饥饿程度：normal, hungry, very_hungry
    lastMealTime: null, // 上次进食时间
    showHungerSelector: false, // 显示饥饿程度选择器
    searchKeyword: '',
    showSearch: false,
    restaurants: [],
    loading: false,
    refreshing: false,
    hasMore: true,
    page: 1,
    pageSize: 20
  },

  onLoad() {
    this.updateLocation()
    this.loadUserProfile() // 先加载用户信息以获取过敏原
    this.calculateHungerLevel() // 计算饥饿程度
    this.loadRestaurants()
  },

  // 计算饥饿程度
  calculateHungerLevel() {
    try {
      // 获取上次进食时间（从本地存储或后端）
      const lastMeal = wx.getStorageSync('last_meal_time')
      if (lastMeal) {
        const lastMealTime = new Date(lastMeal)
        const now = new Date()
        const hoursSinceLastMeal = (now - lastMealTime) / (1000 * 60 * 60)
        
        let hungerLevel = 'normal'
        if (hoursSinceLastMeal >= 6) {
          hungerLevel = 'very_hungry' // 6小时以上，非常饿
        } else if (hoursSinceLastMeal >= 4) {
          hungerLevel = 'hungry' // 4-6小时，饿
        }
        
        this.setData({
          hungerLevel,
          lastMealTime: lastMeal
        })
      }
    } catch (error) {
      console.error('计算饥饿程度失败', error)
    }
  },

  // 显示/隐藏饥饿程度选择器
  toggleHungerSelector() {
    this.setData({ showHungerSelector: !this.data.showHungerSelector })
  },

  // 选择饥饿程度
  selectHungerLevel(e) {
    const level = e.currentTarget.dataset.level
    this.setData({ 
      hungerLevel: level,
      showHungerSelector: false
    })
    this.loadRestaurants(true) // 重新加载商家
  },

  // 更新位置
  updateLocation() {
    const location = app.globalData.location
    if (location) {
      // 这里可以调用逆地理编码API获取地址名称
      this.setData({ locationText: '当前位置' })
    } else {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          app.globalData.location = {
            latitude: res.latitude,
            longitude: res.longitude
          }
          this.setData({ locationText: '当前位置' })
          this.loadRestaurants()
        },
        fail: () => {
          this.setData({ locationText: '定位失败，点击重试' })
        }
      })
    }
  },

  // 加载商家列表
  async loadRestaurants(reset = false) {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    
    try {
      const location = app.globalData.location
      if (!location) {
        util.showToast('请先获取位置信息')
        this.setData({ loading: false, refreshing: false })
        return
      }

      const params = {
        mode: 'restaurant',
        lat: location.latitude,
        lng: location.longitude,
        filters: {
          sort_by: this.data.filter,
          keyword: this.data.searchKeyword || undefined,
          health_status: this.data.selectedHealthFilter !== 'all' ? this.data.selectedHealthFilter : undefined,
          nutrition_type: this.data.selectedNutritionFilter || undefined
        },
        page: reset ? 1 : this.data.page,
        page_size: this.data.pageSize
      }

      const result = await api.searchRecommend(params)
      let newRestaurants = (result.recommendations || []).filter(
        (r) => !util.shouldHideRestaurantListItem(r)
      )
      
      // 计算并增强健康评分（红绿灯避雷针）
      newRestaurants = newRestaurants.map(restaurant => {
        const healthScore = util.calculateHealthScore(restaurant)
        const healthLevel = util.getHealthLevel(healthScore)
        let cover = restaurant.image || ''
        if (!cover && Array.isArray(restaurant.photos) && restaurant.photos.length) {
          const p0 = restaurant.photos[0]
          cover = typeof p0 === 'string' ? p0 : (p0 && (p0.url || p0.image || p0.src)) || ''
        }
        cover = cover ? util.normalizeExternalImageUrl(cover) : ''
        if (cover && util.isBackendDummyImageUrl(cover)) cover = ''
        const imageResolved = cover || util.resolveRestaurantCoverUrl(restaurant)
        return {
          ...restaurant,
          image: imageResolved,
          imageFailed: false,
          _imgRetry: false,
          health_score: healthScore,
          health_rating: healthScore, // 兼容旧字段
          health_level: healthLevel.level,
          health_label: healthLevel.label,
          health_desc: healthLevel.desc
        }
      })
      
      // 应用营养素筛选
      if (this.data.selectedNutritionFilter) {
        newRestaurants = this.applyNutritionFilter(newRestaurants)
      }
      
      // 应用饥饿程度与血糖匹配
      if (this.data.hungerLevel && (this.data.hungerLevel === 'hungry' || this.data.hungerLevel === 'very_hungry')) {
        newRestaurants = this.applyHungerMatching(newRestaurants)
      }
      
      // 应用过敏原和忌口过滤
      newRestaurants = this.applyAllergenFilter(newRestaurants)
      
      // 如果选择了营养素筛选，只显示Top5
      if (this.data.selectedNutritionFilter && reset) {
        newRestaurants = newRestaurants.slice(0, 5)
      }
      
      // 检查是否需要显示深夜食堂负罪感缓冲
      if (reset) {
        this.checkNightRemedy(newRestaurants)
      }
      
      if (reset) {
        this.setData({
          restaurants: newRestaurants,
          page: 1,
          hasMore: newRestaurants.length >= this.data.pageSize
        })
      } else {
        this.setData({
          restaurants: [...this.data.restaurants, ...newRestaurants],
          page: this.data.page + 1,
          hasMore: newRestaurants.length >= this.data.pageSize
        })
      }
    } catch (error) {
      console.error('加载商家失败', error)
      util.showToast('加载失败，请重试')
    } finally {
      this.setData({ loading: false, refreshing: false })
    }
  },

  /** 外链门店图在工具/网络抖动时可能 ERR_NETWORK_CHANGED，重试一次后降级占位 */
  onRestaurantImageError(e) {
    const index = e.currentTarget.dataset.index
    if (index === undefined || index === null) return
    const list = this.data.restaurants
    const item = list[index]
    if (!item || !item.image) return
    if (item._imgRetry) {
      const fallback = util.resolveRestaurantCoverUrl({ ...item, image: '', photos: [] })
      this.setData({
        [`restaurants[${index}].image`]: fallback,
        [`restaurants[${index}].imageFailed`]: false
      })
      return
    }
    const sep = String(item.image).includes('?') ? '&' : '?'
    const newUrl = `${item.image}${sep}_retry=${Date.now()}`
    this.setData({
      [`restaurants[${index}].image`]: newUrl,
      [`restaurants[${index}]._imgRetry`]: true
    })
  },

  // 应用过敏原和忌口过滤
  applyAllergenFilter(restaurants) {
    try {
      // 获取用户偏好信息
      const userInfo = app.globalData.userInfo
      if (!userInfo) {
        // 尝试从API获取
        this.loadUserProfile()
        return restaurants
      }
      
      const allergens = userInfo.allergens || []
      const restrictions = userInfo.diet_tags || [] // 忌口信息（如不吃香菜）
      
      if (allergens.length === 0 && restrictions.length === 0) {
        return restaurants
      }
      
      // 过滤商家
      return util.filterByAllergens(restaurants, allergens, restrictions, 'name')
    } catch (error) {
      console.error('应用过敏原过滤失败', error)
      return restaurants
    }
  },

  // 加载用户信息（用于获取过敏原）
  async loadUserProfile() {
    try {
      const userInfo = await api.getUserProfile()
      app.globalData.userInfo = userInfo
    } catch (error) {
      console.error('加载用户信息失败', error)
    }
  },

  // 筛选切换
  onFilterTap(e) {
    const value = e.currentTarget.dataset.value
    this.setData({ filter: value })
    this.loadRestaurants(true)
  },

  // 健康筛选切换
  onHealthFilterTap(e) {
    const value = e.currentTarget.dataset.value
    this.setData({ selectedHealthFilter: value })
    this.loadRestaurants(true)
  },

  // 营养素筛选切换
  onNutritionFilterTap(e) {
    const value = e.currentTarget.dataset.value
    this.setData({ selectedNutritionFilter: value })
    this.loadRestaurants(true)
  },

  // 应用营养素筛选
  applyNutritionFilter(restaurants) {
    const filter = this.data.selectedNutritionFilter
    if (!filter) return restaurants
    
    return restaurants.filter(restaurant => {
      // 检查商家标签和推荐菜品
      const tags = (restaurant.tags || []).join(' ').toLowerCase()
      const name = (restaurant.name || '').toLowerCase()
      const dishes = restaurant.recommended_dishes || restaurant.menu || []
      
      switch (filter) {
        case 'high_protein':
          // 高蛋白：检查标签或菜品
          return tags.includes('高蛋白') || tags.includes('健身') || 
                 dishes.some(d => (d.nutrition?.protein || 0) >= 20)
        
        case 'low_gi':
          // 低GI：检查标签
          return tags.includes('低gi') || tags.includes('低升糖') || 
                 tags.includes('轻食') || tags.includes('健康')
        
        case 'low_fat':
          // 低脂：检查标签
          return tags.includes('低脂') || tags.includes('减脂') || 
                 tags.includes('轻食') || tags.includes('沙拉')
        
        case 'high_fiber':
          // 高纤维：检查标签
          return tags.includes('高纤维') || tags.includes('粗粮') || 
                 tags.includes('全麦') || tags.includes('蔬菜')
        
        case 'low_cal':
          // 低卡：检查健康评分
          return (restaurant.health_score || 50) >= 70
        
        default:
          return true
      }
    })
  },

  // 显示/隐藏搜索框
  toggleSearch() {
    this.setData({ showSearch: !this.data.showSearch })
    if (!this.data.showSearch) {
      // 显示搜索框时，清空关键词
      this.setData({ searchKeyword: '' })
    }
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  // 搜索确认
  onSearchConfirm() {
    this.loadRestaurants(true)
  },

  // 清空搜索
  clearSearch() {
    this.setData({ searchKeyword: '' })
    this.loadRestaurants(true)
  },

  // 下拉刷新
  onRefresh() {
    this.setData({ refreshing: true })
    this.loadRestaurants(true)
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadRestaurants()
    }
  },

  // 跳转到详情
  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/packageRestaurant/restaurant-detail/restaurant-detail?id=${id}`
    })
  },

  // 获取健康等级样式
  getHealthClass(rating) {
    return util.getHealthColor(rating)
  },

  // 获取健康等级文字
  getHealthText(rating) {
    return util.getHealthText(rating)
  },

  // 检查是否需要显示深夜食堂负罪感缓冲
  checkNightRemedy(restaurants) {
    const now = new Date()
    const hour = now.getHours()
    
    // 晚上9点后（21:00-23:59）
    if (hour >= 21) {
      // 检查是否有高热量商家
      const highCalorieRestaurants = restaurants.filter(r => {
        const healthScore = r.health_score || r.health_rating || 50
        return healthScore < 60 // 高热量商家（健康评分低于60）
      })
      
      if (highCalorieRestaurants.length > 0) {
        // 推荐补救方案
        const remedies = [
          { name: '乌龙茶', desc: '帮助消化，减少油腻感', icon: '🍵' },
          { name: '柠檬水', desc: '促进新陈代谢，补充维C', icon: '🍋' },
          { name: '第二天轻食', desc: '建议早餐选择低卡食物', icon: '🥗' },
          { name: '适量运动', desc: '15分钟散步帮助消耗热量', icon: '🚶' }
        ]
        
        this.setData({
          showNightRemedy: true,
          nightRemedyData: {
            restaurantCount: highCalorieRestaurants.length,
            remedies: remedies,
            message: `发现 ${highCalorieRestaurants.length} 个高热量商家，建议搭配以下补救方案：`
          }
        })
      }
    }
  },

  // 关闭深夜补救提示
  closeNightRemedy() {
    this.setData({ showNightRemedy: false })
  },

  // 跳转到补救页面
  goToRemedy() {
    this.setData({ showNightRemedy: false })
    wx.navigateTo({
      url: '/packageHealth/remedy/remedy?symptom=暴食'
    })
  },

  // 应用饥饿程度与血糖匹配
  applyHungerMatching(restaurants) {
    const hungerLevel = this.data.hungerLevel
    
    return restaurants.map(restaurant => {
      // 检查是否有低GI菜品和快速配送
      const dishes = restaurant.recommended_dishes || restaurant.menu || []
      const hasLowGI = dishes.some(dish => {
        const tags = (dish.tags || []).join(' ').toLowerCase()
        const name = (dish.name || '').toLowerCase()
        return tags.includes('低gi') || tags.includes('低升糖') || 
               tags.includes('轻食') || name.includes('沙拉')
      })
      
      // 检查配送时间（假设有配送时间缓存）
      const deliveryTime = restaurant.delivery_time_cache || 30 // 默认30分钟
      const isFastDelivery = deliveryTime <= 30 // 30分钟内为快速配送
      
      // 如果饥饿且符合条件，提高优先级
      if (hungerLevel === 'very_hungry' && hasLowGI && isFastDelivery) {
        restaurant.hunger_match_score = 100 // 完美匹配
        restaurant.hunger_match_tip = '💡 低GI快速配送，适合当前饥饿状态'
      } else if (hungerLevel === 'hungry' && (hasLowGI || isFastDelivery)) {
        restaurant.hunger_match_score = 70
        restaurant.hunger_match_tip = '💡 推荐快速配送或低GI食物'
      }
      
      return restaurant
    }).sort((a, b) => {
      // 按饥饿匹配度排序
      const scoreA = a.hunger_match_score || 0
      const scoreB = b.hunger_match_score || 0
      return scoreB - scoreA
    })
  }
})
