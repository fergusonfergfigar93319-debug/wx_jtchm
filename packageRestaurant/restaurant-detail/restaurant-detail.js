// pages/restaurant-detail/restaurant-detail.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')
const config = require('../../utils/config.js')

/** 将相对路径补全为可请求的绝对 URL（与 api Base 同源） */
function resolveMediaUrl(url) {
  if (!url || typeof url !== 'string') return ''
  const u = url.trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u) || u.startsWith('wxfile://') || u.startsWith('data:') || u.startsWith('cloud://')) {
    return util.normalizeExternalImageUrl(u)
  }
  if (u.startsWith('//')) return util.normalizeExternalImageUrl('https:' + u)
  const base = config.getApiBaseUrl().replace(/\/api\/v1\/?$/, '')
  if (u.startsWith('/')) return base + u
  return base + '/' + u
}

/**
 * 详情接口可能用 image / cover / cover_image 等字段；无门店图时用首道菜品图兜底
 */
function pickRestaurantCoverUrl(restaurant, menuDishes) {
  const candidates = [
    restaurant.image,
    restaurant.cover,
    restaurant.cover_image,
    restaurant.banner,
    restaurant.photo,
    restaurant.logo,
    restaurant.pic,
    restaurant.head_img,
    restaurant.shop_image,
    restaurant.main_image,
    restaurant.store_image
  ]
  for (const raw of candidates) {
    const abs = resolveMediaUrl(raw)
    if (abs && !util.isBackendDummyImageUrl(abs)) return abs
  }
  if (Array.isArray(restaurant.photos) && restaurant.photos.length) {
    const first = restaurant.photos[0]
    const raw = typeof first === 'string' ? first : (first && (first.url || first.image || first.src))
    const abs = resolveMediaUrl(raw)
    if (abs && !util.isBackendDummyImageUrl(abs)) return abs
  }
  if (Array.isArray(restaurant.images) && restaurant.images.length) {
    for (const entry of restaurant.images) {
      const raw = typeof entry === 'string' ? entry : (entry && (entry.url || entry.image || entry.src))
      const abs = resolveMediaUrl(raw)
      if (abs && !util.isBackendDummyImageUrl(abs)) return abs
    }
  }
  if (Array.isArray(menuDishes)) {
    for (const d of menuDishes) {
      if (!d) continue
      const raw = d.image || d.cover || d.cover_image || d.photo
      const abs = resolveMediaUrl(raw)
      if (abs && !util.isBackendDummyImageUrl(abs)) return abs
    }
  }
  return ''
}

/** 详情页展示用距离文案；无有效数据时不显示，避免出现单独的「m」 */
function formatRestaurantDistance(raw) {
  if (raw === null || raw === undefined || raw === '') return ''
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) return ''
    if (raw >= 1000) return (raw / 1000).toFixed(1).replace(/\.0$/, '') + 'km'
    return Math.round(raw) + 'm'
  }
  const s = String(raw).trim()
  if (!s) return ''
  if (/^[\d.]+\s*(km|m)$/i.test(s)) return s.replace(/\s+/g, '')
  const n = parseFloat(s.replace(/[^\d.]/g, ''))
  if (Number.isNaN(n) || n < 0) return ''
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'km'
  return Math.round(n) + 'm'
}

Page({
  data: {
    restaurantId: '',
    restaurant: {},
    headerImageError: false,
    distanceText: '',
    recommendedDishes: [],
    healthClass: '',
    healthText: '',
    platforms: [],
    isFavorite: false,
    showPlatformModal: false,
    selectedDish: null,
    showDishModal: false,
    deliveryTime: '30-45分钟', // 预计配送时间
    minOrderPrice: 20, // 起送价
    deliveryFee: 5, // 配送费
    showSauceTip: false, // 显示酱汁分离提醒
    sauceTipData: null, // 酱汁分离提醒数据
    showBlacklistModal: false, // 显示黑榜标记弹窗
    blacklistReasons: [
      '图片仅供参考',
      '分量不足',
      '卫生问题',
      '味道不好',
      '配送慢',
      '价格虚高',
      '服务差',
      '其他'
    ],
    selectedBlacklistReasons: [],
    blacklistNote: '' // 备注
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ restaurantId: options.id })
      this.loadUserProfile() // 先加载用户信息以获取过敏原
      this.loadRestaurantDetail()
    }
  },

  // 加载商家详情
  async loadRestaurantDetail() {
    try {
      util.showLoading('加载中...')
      const restaurant = await api.getRestaurantDetail(this.data.restaurantId)

      const menuForCover = restaurant.recommended_dishes || restaurant.menu || []
      const coverUrl = pickRestaurantCoverUrl(restaurant, menuForCover)
      const imageDisplay = coverUrl || util.resolveRestaurantCoverUrl(restaurant)
      const restaurantMerged = {
        ...restaurant,
        image: imageDisplay
      }
      
      const healthClass = util.getHealthColor(restaurantMerged.health_rating || restaurantMerged.rating)
      const healthText = util.getHealthText(restaurantMerged.health_rating || restaurantMerged.rating)
      
      // 推荐菜品（从后端返回的 recommended_dishes 或 menu 字段获取）
      let recommendedDishes = restaurantMerged.recommended_dishes || restaurantMerged.menu || []
      
      // 应用过敏原和忌口过滤，并标记包含过敏原的菜品
      recommendedDishes = this.applyAllergenFilter(recommendedDishes)
      
      // 计算价格/蛋白比
      recommendedDishes = recommendedDishes.map(dish => {
        const price = dish.price || 0
        const protein = dish.nutrition?.protein || dish.protein || 0
        const pricePerProtein = util.calculatePricePerProtein(price, protein)
        
        return {
          ...dish,
          price_per_protein: pricePerProtein,
          price_per_protein_text: pricePerProtein ? util.formatPricePerProtein(pricePerProtein) : null,
          is_high_protein: protein >= 20 // 高蛋白菜品（20g以上）
        }
      })
      
      // 按价格/蛋白比排序（性价比高的在前）
      recommendedDishes.sort((a, b) => {
        const aRatio = a.price_per_protein ? parseFloat(a.price_per_protein) : Infinity
        const bRatio = b.price_per_protein ? parseFloat(b.price_per_protein) : Infinity
        return aRatio - bRatio
      })
      
      // 外卖平台信息
      const platforms = restaurantMerged.platforms || [
        { name: 'meituan', label: '美团外卖', app_id: 'wxde8ac0a21135c07d', path: 'pages/shop/index' },
        { name: 'eleme', label: '饿了么', app_id: 'wxece3a9a4c82f58c9', path: 'pages/shop/index' }
      ]
      
      // 配送信息
      const deliveryTime = restaurantMerged.delivery_time || '30-45分钟'
      const minOrderPrice = restaurantMerged.min_order_price || 20
      const deliveryFee = restaurantMerged.delivery_fee || 5
      const distanceText = formatRestaurantDistance(restaurantMerged.distance)
      
      this.setData({
        restaurant: restaurantMerged,
        headerImageError: false,
        distanceText,
        recommendedDishes,
        healthClass,
        healthText,
        platforms,
        deliveryTime,
        minOrderPrice,
        deliveryFee
      })
      
      // 检查收藏状态
      this.checkFavorite()
    } catch (error) {
      console.error('加载详情失败', error)
      util.showToast('加载失败')
    } finally {
      util.hideLoading()
    }
  },

  /** 头图加载失败时改用本地「暫無店鋪圖」提示圖 */
  onRestaurantHeaderImageError() {
    const r = this.data.restaurant || {}
    if (String(r.image || '').indexOf('/images/placeholders/restaurant-no-cover') >= 0) {
      this.setData({ headerImageError: true })
      return
    }
    const fallback = util.resolveRestaurantCoverUrl({ ...r, image: '', photos: [] })
    this.setData({
      'restaurant.image': fallback,
      headerImageError: false
    })
  },

  // 应用过敏原和忌口过滤
  applyAllergenFilter(dishes) {
    try {
      // 获取用户偏好信息
      const app = getApp()
      const userInfo = app.globalData.userInfo
      if (!userInfo) {
        // 尝试从API获取
        this.loadUserProfile()
        return dishes.map(dish => ({ ...dish, hasAllergen: false }))
      }
      
      const allergens = userInfo.allergens || []
      const restrictions = userInfo.diet_tags || []
      
      if (allergens.length === 0 && restrictions.length === 0) {
        return dishes.map(dish => ({ ...dish, hasAllergen: false }))
      }
      
      // 标记包含过敏原的菜品（不隐藏，但标记出来）
      return dishes.map(dish => {
        const hasAllergen = util.containsAllergenOrRestriction(
          dish.name || '', 
          allergens, 
          restrictions
        ) || util.containsAllergenOrRestriction(
          dish.description || dish.suggestion || '', 
          allergens, 
          restrictions
        )
        
        return {
          ...dish,
          hasAllergen: hasAllergen,
          allergenWarning: hasAllergen ? '⚠️ 包含您的过敏原或忌口' : null
        }
      })
    } catch (error) {
      console.error('应用过敏原过滤失败', error)
      return dishes.map(dish => ({ ...dish, hasAllergen: false }))
    }
  },

  // 加载用户信息（用于获取过敏原）
  async loadUserProfile() {
    try {
      const app = getApp()
      const userInfo = await api.getUserProfile()
      app.globalData.userInfo = userInfo
    } catch (error) {
      console.error('加载用户信息失败', error)
    }
  },
  
  // 跳转外卖小程序
  goToOrder(e) {
    const platformName = e.currentTarget.dataset.platform
    const platforms = this.data.platforms || []
    
    // 检查是否需要显示酱汁分离提醒
    const sauceTip = this.checkSauceSeparationTip()
    if (sauceTip && sauceTip.shouldShow) {
      this.setData({
        showSauceTip: true,
        sauceTipData: sauceTip
      })
      return
    }
    
    // 如果只有一个平台，直接跳转；否则显示选择弹窗
    if (platforms.length === 1) {
      this.navigateToPlatform(platforms[0])
    } else if (platforms.length > 1) {
      this.setData({ showPlatformModal: true })
    } else {
      util.showToast('暂无可用的外卖平台')
    }
  },

  // 检查是否需要显示酱汁分离提醒
  checkSauceSeparationTip() {
    const dishes = this.data.recommendedDishes || []
    if (dishes.length === 0) return null
    
    // 需要酱汁分离的菜品关键词
    const sauceDishKeywords = ['沙拉', '盖饭', '拌饭', '拌面', '凉面', '凉皮', '凉菜', '手抓饼', '卷饼']
    
    let totalCalories = 0
    let sauceCalories = 0
    const matchedDishes = []
    
    dishes.forEach(dish => {
      const dishName = dish.name || ''
      const calories = dish.calories || dish.estimated_calories || 0
      
      // 检查是否是需要酱汁分离的菜品
      const needsSauceSeparation = sauceDishKeywords.some(keyword => dishName.includes(keyword))
      
      if (needsSauceSeparation && calories > 0) {
        totalCalories += calories
        // 酱汁通常占热量的30%
        const dishSauceCalories = Math.round(calories * 0.3)
        sauceCalories += dishSauceCalories
        matchedDishes.push({
          name: dishName,
          calories: calories,
          sauceCalories: dishSauceCalories
        })
      }
    })
    
    if (matchedDishes.length > 0 && sauceCalories > 0) {
      return {
        shouldShow: true,
        matchedDishes: matchedDishes,
        totalCalories: totalCalories,
        sauceCalories: sauceCalories,
        savedCalories: sauceCalories,
        savedPercent: 30
      }
    }
    
    return null
  },

  // 确认酱汁分离提醒（继续下单）
  confirmSauceTip() {
    this.setData({ showSauceTip: false })
    
    // 复制提醒文案到剪贴板，方便用户备注
    const tipText = '酱汁分装，谢谢'
    wx.setClipboardData({
      data: tipText,
      success: () => {
        util.showSuccess('已复制备注文案到剪贴板')
      }
    })
    
    // 继续跳转流程
    const platforms = this.data.platforms || []
    if (platforms.length === 1) {
      this.navigateToPlatform(platforms[0])
    } else if (platforms.length > 1) {
      this.setData({ showPlatformModal: true })
    }
  },

  // 取消酱汁分离提醒
  cancelSauceTip() {
    this.setData({ showSauceTip: false })
    
    // 继续跳转流程（不复制备注）
    const platforms = this.data.platforms || []
    if (platforms.length === 1) {
      this.navigateToPlatform(platforms[0])
    } else if (platforms.length > 1) {
      this.setData({ showPlatformModal: true })
    }
  },

  // 选择平台
  selectPlatform(e) {
    const platformName = e.currentTarget.dataset.platform
    const platforms = this.data.platforms || []
    const targetPlatform = platforms.find(p => p.name === platformName)
    
    if (targetPlatform) {
      this.setData({ showPlatformModal: false })
      this.navigateToPlatform(targetPlatform)
    }
  },

  // 跳转到指定平台
  navigateToPlatform(platform) {
    if (!platform || !platform.app_id) {
      util.showToast('平台信息不完整')
      return
    }
    
    const restaurant = this.data.restaurant
    
    // 检查是否支持跳转
    wx.checkIsSupportSoterAuthentication({
      success: () => {
        // 支持跳转
        this.doNavigateToPlatform(platform)
      },
      fail: () => {
        // 不支持，尝试直接跳转
        this.doNavigateToPlatform(platform)
      }
    })
  },

  // 执行跳转
  doNavigateToPlatform(platform) {
    const restaurant = this.data.restaurant
    
    // 构建跳转路径和参数
    let path = platform.path || ''
    const extraData = {
      restaurant_name: restaurant.name || '',
      restaurant_id: restaurant.id || '',
      address: restaurant.address || ''
    }
    
    // 根据不同平台构建不同的路径
    if (platform.name === 'meituan') {
      // 美团外卖路径格式
      path = path || `pages/shop/index?shopId=${restaurant.id || ''}`
    } else if (platform.name === 'eleme') {
      // 饿了么路径格式
      path = path || `pages/shop/index?restaurantId=${restaurant.id || ''}`
    }
    
    util.showLoading('正在跳转...')
    
    // 使用 wx.navigateToMiniProgram 跳转到外卖小程序
    wx.navigateToMiniProgram({
      appId: platform.app_id,
      path: path,
      extraData: extraData,
      envVersion: 'release', // release: 正式版, trial: 体验版, develop: 开发版
      success: (res) => {
        console.log('跳转成功', res)
        util.hideLoading()
        util.showSuccess('跳转成功')
      },
      fail: (err) => {
        console.error('跳转失败', err)
        util.hideLoading()
        
        // 根据错误码给出不同提示
        let errorMsg = '跳转失败'
        if (err.errMsg) {
          if (err.errMsg.includes('not installed')) {
            errorMsg = '未安装该小程序，请先安装'
          } else if (err.errMsg.includes('permission')) {
            errorMsg = '无权限跳转，请检查设置'
          } else if (err.errMsg.includes('network')) {
            errorMsg = '网络错误，请稍后重试'
          }
        }
        
        // 如果跳转失败，提供备用方案：复制商家名称到剪贴板
        wx.showModal({
          title: '跳转失败',
          content: `${errorMsg}。是否复制商家名称到剪贴板，方便您手动搜索？`,
          confirmText: '复制',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              wx.setClipboardData({
                data: this.data.restaurant.name || '',
                success: () => {
                  util.showSuccess('已复制到剪贴板')
                }
              })
            }
          }
        })
      }
    })
  },

  // 关闭平台选择弹窗
  closePlatformModal() {
    this.setData({ showPlatformModal: false })
  },

  // 检查收藏状态
  async checkFavorite() {
    try {
      const favorites = wx.getStorageSync('favorites') || []
      const isFavorite = favorites.some(item => 
        String(item.id) === String(this.data.restaurantId) && item.type === 'restaurant'
      )
      this.setData({ isFavorite })
    } catch (error) {
      console.error('检查收藏状态失败', error)
    }
  },

  // 切换收藏
  async toggleFavorite() {
    try {
      const restaurantId = this.data.restaurantId
      const restaurant = this.data.restaurant
      const isFavorite = this.data.isFavorite
      
      // 获取当前收藏列表
      const favorites = wx.getStorageSync('favorites') || []
      const favoriteIndex = favorites.findIndex(item => 
        String(item.id) === String(restaurantId) && item.type === 'restaurant'
      )
      
      if (isFavorite) {
        // 取消收藏
        if (favoriteIndex > -1) {
          favorites.splice(favoriteIndex, 1)
          wx.setStorageSync('favorites', favorites)
          
          // 尝试调用后端API
          try {
            await api.unfavorite(restaurantId, 'restaurant')
          } catch (e) {
            console.log('后端取消收藏失败，使用本地存储', e)
          }
          
          this.setData({ isFavorite: false })
          util.showSuccess('已取消收藏')
        }
      } else {
        // 添加收藏
        const favoriteItem = {
          id: restaurantId,
          type: 'restaurant',
          name: restaurant.name || '未知餐厅',
          image: restaurant.image || '',
          rating: restaurant.rating || 0,
          distance: restaurant.distance || '',
          address: restaurant.address || '',
          createdAt: new Date().toISOString()
        }
        
        favorites.push(favoriteItem)
        wx.setStorageSync('favorites', favorites)
        
        // 尝试调用后端API
        try {
          await api.favoriteRestaurant(restaurantId)
        } catch (e) {
          console.log('后端收藏失败，使用本地存储', e)
        }
        
        this.setData({ isFavorite: true })
        util.showSuccess('已收藏')
      }
    } catch (error) {
      console.error('切换收藏失败', error)
      util.showToast('操作失败，请重试')
    }
  },

  // 选择菜品
  selectDish(e) {
    const dish = e.currentTarget.dataset.dish
    // 显示菜品详情弹窗
    this.setData({
      selectedDish: dish,
      showDishModal: true
    })
  },

  // 关闭菜品详情弹窗
  closeDishModal() {
    this.setData({
      showDishModal: false,
      selectedDish: null
    })
  },

  // 查看菜品详情
  viewDishDetail(dish) {
    // 可以在这里添加更多菜品信息展示
    console.log('查看菜品详情', dish)
  },

  // 记录菜品
  async recordDish(e) {
    const dish = e.currentTarget.dataset.dish || this.data.selectedDish
    if (!dish) return
    
    try {
      util.showLoading('记录中...')
      
      const calories = dish.calories || dish.estimated_calories || 0
      
      await api.logIntake({
        source_type: 2, // 外卖
        source_id: this.data.restaurantId,
        food_name: dish.name,
        calories: calories,
        portion: 1.0
      })
      
      util.showSuccess(`已记录 +${calories} kcal`)
      
      // 关闭弹窗
      this.closeDishModal()
      
      // 延迟返回，让用户看到成功提示
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('记录失败', error)
      util.showToast('记录失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 记录这一餐
  recordMeal() {
    // 跳转到搜索页面，搜索该商家的菜品
    wx.navigateTo({
      url: `/packageCook/cook/cook?restaurantId=${this.data.restaurantId}`
    })
  },

  // 打开地图导航
  openMap() {
    const restaurant = this.data.restaurant
    if (!restaurant.location && !restaurant.address) {
      util.showToast('暂无位置信息')
      return
    }
    
    const latitude = restaurant.location?.lat || restaurant.latitude
    const longitude = restaurant.location?.lng || restaurant.longitude
    const name = restaurant.name || '商家位置'
    
    if (latitude && longitude) {
      wx.openLocation({
        latitude: latitude,
        longitude: longitude,
        name: name,
        address: restaurant.address || '',
        scale: 18,
        success: () => {
          console.log('打开地图成功')
        },
        fail: (err) => {
          console.error('打开地图失败', err)
          util.showToast('打开地图失败')
        }
      })
    } else {
      // 如果没有经纬度，尝试使用地址进行搜索
      util.showToast('正在获取位置信息...')
    }
  },

  // 拨打电话
  makePhoneCall() {
    const phone = this.data.restaurant.phone
    if (!phone) {
      util.showToast('暂无联系电话')
      return
    }
    
    wx.makePhoneCall({
      phoneNumber: phone,
      success: () => {
        console.log('拨打电话成功')
      },
      fail: (err) => {
        console.error('拨打电话失败', err)
        util.showToast('拨打电话失败')
      }
    })
  },

  // 跳转到拼单页面
  goToGroupOrder() {
    wx.navigateTo({
      url: `/packageRestaurant/group-order/group-order?restaurantId=${this.data.restaurantId}&restaurantName=${encodeURIComponent(this.data.restaurant.name || '商家')}`
    })
  },

  // 显示黑榜标记弹窗
  showBlacklistModal() {
    this.setData({ 
      showBlacklistModal: true,
      selectedBlacklistReasons: [],
      blacklistNote: ''
    })
  },

  // 关闭黑榜标记弹窗
  closeBlacklistModal() {
    this.setData({ 
      showBlacklistModal: false,
      selectedBlacklistReasons: [],
      blacklistNote: ''
    })
  },

  // 切换避坑理由选择
  toggleBlacklistReason(e) {
    const reason = e.currentTarget.dataset.reason
    const reasons = [...this.data.selectedBlacklistReasons]
    const index = reasons.indexOf(reason)
    
    if (index > -1) {
      reasons.splice(index, 1)
    } else {
      reasons.push(reason)
    }
    
    this.setData({ selectedBlacklistReasons: reasons })
  },

  // 输入备注
  onBlacklistNoteInput(e) {
    this.setData({ blacklistNote: e.detail.value })
  },

  // 提交黑榜标记
  async submitBlacklist() {
    if (this.data.selectedBlacklistReasons.length === 0) {
      util.showToast('请至少选择一个避坑理由')
      return
    }
    
    try {
      util.showLoading('提交中...')
      
      // 保存到本地存储（实际应该调用后端API）
      const blacklistData = {
        restaurant_id: this.data.restaurantId,
        restaurant_name: this.data.restaurant.name,
        reasons: this.data.selectedBlacklistReasons,
        note: this.data.blacklistNote,
        created_at: new Date().toISOString()
      }
      
      let blacklist = wx.getStorageSync('restaurant_blacklist') || []
      // 检查是否已标记
      const existingIndex = blacklist.findIndex(item => item.restaurant_id === this.data.restaurantId)
      if (existingIndex > -1) {
        // 更新现有记录
        blacklist[existingIndex] = blacklistData
      } else {
        // 新增记录
        blacklist.push(blacklistData)
      }
      
      wx.setStorageSync('restaurant_blacklist', blacklist)
      
      util.showSuccess('避坑标记已保存')
      this.closeBlacklistModal()
      
      // 显示社区统计
      this.showBlacklistStats()
    } catch (error) {
      console.error('提交失败', error)
      util.showToast('提交失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 显示黑榜统计
  showBlacklistStats() {
    const blacklist = wx.getStorageSync('restaurant_blacklist') || []
    const currentBlacklist = blacklist.find(item => item.restaurant_id === this.data.restaurantId)
    
    if (currentBlacklist) {
      // 统计该商家的避坑理由
      const reasonCounts = {}
      blacklist.forEach(item => {
        if (item.restaurant_id === this.data.restaurantId) {
          item.reasons.forEach(reason => {
            reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
          })
        }
      })
      
      let content = `该商家已被 ${blacklist.filter(item => item.restaurant_id === this.data.restaurantId).length} 人标记避坑\n\n`
      content += '主要避坑理由：\n'
      Object.entries(reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .forEach(([reason, count]) => {
          content += `• ${reason} (${count}次)\n`
        })
      
      wx.showModal({
        title: '社区避坑统计',
        content: content,
        showCancel: false,
        confirmText: '知道了'
      })
    }
  },

  // 分享到社区
  shareToCommunity() {
    const { restaurant } = this.data
    if (!restaurant || !restaurant.id) {
      util.showToast('商家信息不完整')
      return
    }
    
    wx.navigateTo({
      url: `/packageCommunity/community/community?share=true&type=restaurant&id=${restaurant.id}&name=${encodeURIComponent(restaurant.name || '')}&image=${encodeURIComponent(restaurant.image || '')}`
    })
  }
})
