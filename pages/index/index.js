// pages/index/index.js - 重构版
const api = require('../../utils/api.js')
const { getWindowMetricsSafe } = require('../../utils/platform.js')
const util = require('../../utils/util.js')
const notifications = require('../../utils/notifications.js')

Page({
  data: {
    timeText: '',
    userName: '',
    userAvatar: '',
    greetingText: '早上好',
    currentDate: '',
    weatherIcon: '☀️',
    
    dailySummary: {
      intake_actual: 0,
      daily_limit: 2000,
      macros: {
        carbg: 0,
        proteing: 0,
        fatg: 0
      },
      percent: 0,
      healthLevel: 'excellent',
      healthLevelText: '状态良好 ✨'
    },
    
    progressPercent: 0,
    progressDeg: 0,
    progressColor: '#4CD9A1',
    remainingCalories: 2000,
    remainingLabel: '剩余',
    remainingClass: 'positive',
    
    carbPercent: 45,
    carbPercentText: 45,
    proteinPercent: 30,
    proteinPercentText: 30,
    fatPercent: 25,
    fatPercentText: 25,
    
    mealRecords: [
      { id: 1, name: '全麦面包 + 牛奶', icon: '🍞', time: '08:30 早餐', calories: 320 },
      { id: 2, name: '西兰花炒鸡胸肉', icon: '🥗', time: '12:15 午餐', calories: 450 }
    ],
    
    healthTip: '晚餐尽量在睡前3小时吃完，减少碳水摄入有助于提升睡眠质量。',
    healthTips: [
      '晚餐尽量在睡前3小时吃完，减少碳水摄入有助于提升睡眠质量。',
      '早餐要吃饱，午餐要吃好，晚餐要吃少。',
      '每天喝够8杯水，有助于新陈代谢和排毒。',
      '细嚼慢咽不仅帮助消化，还能增加饱腹感。',
      '每天至少吃5种不同颜色的蔬果，营养更均衡。',
      '控制盐分摄入在6g以内，预防高血压。',
      '饭后30分钟再运动，避免消化不良。',
      '保持规律作息，让身体形成健康的生物钟。'
    ],
    currentTipIndex: 0,
    loading: false,
    tipTimer: null,
    tipAnimKey: 0,

    loadingSummary: false,
    todayWorkout: {
      minutes: 0,
      calories: 0
    },

    // 课程首页数据
    bannerImage: 'https://images.pexels.com/photos/410648/pexels-photo-410648.jpeg?auto=compress&cs=tinysrgb&w=800',
    // 首页功能入口（九宫格）
    categories: [
      { key: 'cook', text: '自己做', icon: '🍳', type: 'green' },
      { key: 'smart-choice', text: '帮我选', icon: '🎯', type: 'orange' },
      { key: 'restaurant', text: '点外卖', icon: '🛵', type: 'blue' },
      { key: 'shopping-list', text: '购物清单', icon: '🛒', type: 'pink' },
      { key: 'challenge', text: '健康挑战', icon: '🏆', type: 'green' },
      { key: 'remedy', text: '朋克急救养生', icon: '💊', type: 'purple' },
      { key: 'ai-nutritionist', text: 'AI营养师', icon: '🤖', type: 'lavender' },
      { key: 'snap-scan', text: '拍图识热量', icon: '📷', type: 'lightBlue' },
      { key: 'carbon-tracker', text: '碳足迹', icon: '🌱', type: 'green' },
      // 预留更多功能位
      { key: 'seasonal', text: '当季好物', icon: '🌸', type: 'pink' },
      { key: 'favorites', text: '我的收藏', icon: '❤️', type: 'pink' },
      { key: 'community', text: '吃货社区', icon: '💬', type: 'blue' }
    ],
    // 分类分页（每页最多8个）
    categoryGroups: [],
    currentCategoryPage: 0,
    categoryPageWidth: 375,
    // 推荐卡片封面在主包 images/covers；应季食材图在分包 packageCook/images/seasonal
    courses: [
      {
        id: 1,
        key: 'report',
        title: '今日饮食报告',
        subtitle: '一键查看热量与营养分布',
        cover: '/images/covers/japanese-cuisine.png'
      },
      {
        id: 2,
        key: 'fridge',
        title: '智能冰箱管理',
        subtitle: '看看冰箱还能做什么菜',
        cover: '/images/covers/fridge.png'
      },
      {
        id: 3,
        key: 'challenge',
        title: '21 天健康挑战',
        subtitle: '连击打卡赢勋章和奖励',
        cover: '/images/covers/light-salad.png'
      },
      {
        id: 4,
        key: 'community',
        title: '社区分享',
        subtitle: '动态·菜谱·商家，分享与发现健康饮食',
        cover: '/images/covers/vegetarian-restaurant.png'
      },
      {
        id: 5,
        key: 'remedy',
        title: '朋克养生急救包',
        subtitle: '对症食疗·熬夜暴食宿醉一键补救',
        cover: '/images/covers/course-remedy.png'
      }
    ],
    unreadCount: 0,
    // 智能选餐联动：当前餐段，用于首页快捷入口与跳转传参
    smartChoiceMealType: 'lunch',
    smartChoiceMealTypeName: '午餐',

    // 兼容/性能：轻量模式
    liteMode: false
  },

  onLoad() {
    try {
      const app = getApp()
      this.setData({ liteMode: !!(app && app.globalData && app.globalData.liteMode) })
    } catch (e) {}

    this.initPage()
    this.buildCategoryGroups()
    this.refreshAll()
    this.startTipAutoSwitch()
    this.refreshUnread()
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar && typeof tabBar.setSelected === 'function') tabBar.setSelected(0)
    const meal = this.getCurrentMealType()
    this.setData({
      smartChoiceMealType: meal.id,
      smartChoiceMealTypeName: meal.name
    })
    this.refreshAll()
    this.refreshUnread()
  },

  onUnload() {
    this.clearTipTimer()
  },

  startTipAutoSwitch() {
    this.clearTipTimer()
    // 轻量模式下降低频率，减少定时器负担
    const intervalMs = this.data.liteMode ? 9000 : 5000
    const timer = setInterval(() => {
      this.nextTip()
    }, intervalMs)
    this.setData({ tipTimer: timer })
  },

  clearTipTimer() {
    const tid = this.data.tipTimer
    if (tid) {
      clearInterval(tid)
      this.setData({ tipTimer: null })
    }
  },

  buildCategoryGroups() {
    const list = this.data.categories || []
    const size = 8
    const groups = []
    for (let i = 0; i < list.length; i += size) {
      groups.push(list.slice(i, i + size))
    }
    this.setData({ categoryGroups: groups })
  },

  onCategoryScroll(e) {
    const scrollLeft = e.detail.scrollLeft || 0
    const width = this.data.categoryPageWidth || 375
    if (width <= 0) return
    const page = Math.round(scrollLeft / width)
    if (page !== this.data.currentCategoryPage) {
      this.setData({ currentCategoryPage: page })
    }
  },

  initPage() {
    const hour = new Date().getHours()
    let greetingText = '早上好'
    let weatherIcon = '☀️'
    
    if (hour < 6) {
      greetingText = '夜深了，注意休息'
      weatherIcon = '🌙'
    } else if (hour < 9) {
      greetingText = '早安，美好的一天'
      weatherIcon = '🌅'
    } else if (hour < 12) {
      greetingText = '上午好，精神满满'
      weatherIcon = '☀️'
    } else if (hour < 14) {
      greetingText = '中午好，记得吃午餐'
      weatherIcon = '🌤️'
    } else if (hour < 18) {
      greetingText = '下午好，继续加油'
      weatherIcon = '⛅'
    } else if (hour < 22) {
      greetingText = '晚上好，放松一下'
      weatherIcon = '🌆'
    } else {
      greetingText = '夜深了，注意休息'
      weatherIcon = '🌙'
    }
    
    const today = new Date()
    const month = today.getMonth() + 1
    const day = today.getDate()
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const weekday = weekdays[today.getDay()]
    const h = String(today.getHours()).padStart(2, '0')
    const m = String(today.getMinutes()).padStart(2, '0')
    let pageWidth = 375
    try {
      const info = getWindowMetricsSafe()
      pageWidth = info.windowWidth || 375
    } catch (e) {
      console.log('获取系统信息失败', e)
    }
    
    this.setData({
      greetingText,
      weatherIcon,
      currentDate: `${month}月${day}日 周${weekday}`,
      timeText: `${h}:${m}`,
      categoryPageWidth: pageWidth
    })
    
    this.loadUserInfo()
  },

  async loadUserInfo() {
    try {
      const userInfo = await api.getUserProfile()
      if (userInfo) {
        this.setData({
          userName: userInfo.nickname || '',
          userAvatar: userInfo.avatar || userInfo.avatar_url || ''
        })
      } 
    } catch (error) {
      console.log('获取用户信息失败')
    }
  },

  async loadDailySummary() {
    if (this.data.loadingSummary) {
      return
    }
    
    this.setData({ loadingSummary: true })
    
    try {
      const today = util.formatDate(new Date())
      const summary = await api.getDailySummary(today)
      
      const intakeActual = summary.intake_actual || summary.consumed || 0
      const dailyLimit = summary.daily_limit || summary.target || 2000
      const macros = summary.macros || {
        carbg: summary.carb || 0,
        proteing: summary.protein || 0,
        fatg: summary.fat || 0
      }
      
      let progressPercent = summary.percent
      if (progressPercent === undefined || progressPercent === null) {
        progressPercent = dailyLimit > 0 ? (intakeActual / dailyLimit) * 100 : 0
      }
      
      const progressDeg = Math.min(progressPercent, 100) * 3.6
      
      let progressColor = '#4CD9A1'
      let healthLevel = 'excellent'
      let healthLevelText = '状态良好'
      
      if (progressPercent < 90) {
        progressColor = '#4CD9A1'
        healthLevel = 'excellent'
        healthLevelText = '状态良好'
      } else if (progressPercent <= 110) {
        progressColor = '#FF9F66'
        healthLevel = 'good'
        healthLevelText = '接近目标'
      } else {
        progressColor = '#FF7B54'
        healthLevel = 'danger'
        healthLevelText = '已超标'
      }
      
      const remaining = dailyLimit - intakeActual
      const remainingCalories = Math.abs(remaining)
      const remainingLabel = remaining >= 0 ? '剩余' : '超出'
      const remainingClass = remaining >= 0 ? 'positive' : 'negative'
      
      const totalMacros = macros.carbg + macros.proteing + macros.fatg
      const carbPercent = totalMacros > 0 ? Math.round((macros.carbg / totalMacros) * 100) : 45
      const proteinPercent = totalMacros > 0 ? Math.round((macros.proteing / totalMacros) * 100) : 30
      const fatPercent = totalMacros > 0 ? Math.round((macros.fatg / totalMacros) * 100) : 25

      this.setData({
        dailySummary: {
          intake_actual: intakeActual,
          daily_limit: dailyLimit,
          macros: macros,
          percent: progressPercent,
          healthLevel: healthLevel,
          healthLevelText: healthLevelText
        },
        progressPercent,
        progressDeg,
        progressColor,
        remainingCalories,
        remainingLabel,
        remainingClass,
        carbPercent,
        carbPercentText: carbPercent,
        proteinPercent,
        proteinPercentText: proteinPercent,
        fatPercent,
        fatPercentText: fatPercent
      })
      
    } catch (error) {
      console.error('加载摘要失败', error)
    } finally {
      this.setData({ loadingSummary: false })
    }
  },

  async loadTodayWorkout() {
    try {
      const stats = await api.getTodayWorkoutStats()
      const minutes = stats.minutes ?? (stats.totalDuration != null ? Math.round(stats.totalDuration / 60) : null) ?? stats.duration ?? 0
      const calories = stats.calories ?? stats.totalCalories ?? stats.kcal ?? 0
      this.setData({
        todayWorkout: {
          minutes,
          calories
        }
      })
    } catch (error) {
      console.log('加载运动统计失败', error)
    }
  },

  async refreshAll() {
    // 串行请求：SSH 穿透下并行易触发 ERR_EMPTY_RESPONSE / request:fail
    await this.loadDailySummary()
    await this.loadTodayWorkout()
  },

  onHide() {},

  nextTip() {
    const tips = this.data.healthTips || []
    if (tips.length === 0) return
    const nextIndex = (this.data.currentTipIndex + 1) % tips.length
    this.setData({
      currentTipIndex: nextIndex,
      healthTip: tips[nextIndex],
      tipAnimKey: (this.data.tipAnimKey || 0) + 1
    })
  },

  onTipRefresh() {
    this.nextTip()
    this.startTipAutoSwitch()
  },

  goToReport() {
    wx.switchTab({ url: '/pages/report/report' })
  },

  goToProfile() {
    wx.switchTab({ url: '/pages/profile/profile' })
  },

  onNotificationTap() {
    wx.navigateTo({ url: '/packageCommunity/notifications/notifications' })
  },

  goToAddFood() {
    wx.navigateTo({ url: '/packageHealth/intake-edit/index' })
  },

  goToCook() {
    wx.navigateTo({ url: '/packageCook/cook/cook' })
  },

  goToRestaurant() {
    wx.navigateTo({ url: '/packageRestaurant/restaurant/restaurant' })
  },

  // 根据当前时间得到餐段 id 与名称
  getCurrentMealType() {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 10) return { id: 'breakfast', name: '早餐' }
    if (hour >= 10 && hour < 14) return { id: 'lunch', name: '午餐' }
    if (hour >= 14 && hour < 17) return { id: 'afternoon_tea', name: '下午茶' }
    if (hour >= 17 && hour < 21) return { id: 'dinner', name: '晚餐' }
    return { id: 'snack', name: '加餐' }
  },

  goToSmartChoice(options) {
    const meal = options && options.meal_type ? { id: options.meal_type, name: (this.data.smartChoiceMealTypeName || '选餐') } : this.getCurrentMealType()
    const q = meal.id ? `?meal_type=${meal.id}` : ''
    wx.navigateTo({ url: `/packageCook/smart-choice/smart-choice${q}` })
  },

  goToSnapScan() {
    wx.navigateTo({ url: '/packageCook/snap-scan/snap-scan' })
  },

  goToRemedy() {
    wx.navigateTo({ url: '/packageHealth/remedy/remedy' })
  },

  goToAIChat() {
    wx.navigateTo({ url: '/packageAI/ai-chat/ai-chat' })
  },

  goToWorkout() {
    wx.navigateTo({ url: '/packageHealth/map-run/map-run' })
  },

  goToChallenge() {
    wx.navigateTo({ url: '/packageUser/challenge/challenge' })
  },

  goToCarbonTracker() {
    wx.navigateTo({ url: '/packageHealth/carbon-tracker/carbon-tracker' })
  },

  goToShoppingList() {
    wx.navigateTo({ url: '/packageUser/shopping-list/shopping-list' })
  },

  goToAINutritionist() {
    wx.navigateTo({ url: '/packageAI/ai-nutritionist/ai-nutritionist' })
  },

  refreshUnread() {
    const count = notifications.getUnreadCount()
    this.setData({ unreadCount: count })
  },

  // 新首页交互
  onSearchTap() {
    wx.navigateTo({ url: '/packageCook/ingredient-recognize/ingredient-recognize' })
  },

  onCategoryTap(e) {
    const item = e.currentTarget.dataset.item || {}
    const key = item.key

    switch (key) {
      case 'cook':
        this.goToCook()
        break
      case 'smart-choice':
        this.goToSmartChoice()
        break
      case 'restaurant':
        this.goToRestaurant()
        break
      case 'shopping-list':
        this.goToShoppingList()
        break
      case 'challenge':
        this.goToChallenge()
        break
      case 'ai-nutritionist':
        this.goToAINutritionist()
        break
      case 'snap-scan':
        this.goToSnapScan()
        break
      case 'carbon-tracker':
        this.goToCarbonTracker()
        break
      case 'remedy':
        this.goToRemedy()
        break
      case 'seasonal':
        wx.navigateTo({ url: '/packageCook/seasonal/seasonal' })
        break
      case 'favorites':
        wx.navigateTo({ url: '/packageUser/favorites/favorites' })
        break
      case 'community':
        wx.navigateTo({ url: '/packageCommunity/community/community' })
        break
      default:
        wx.showToast({
          title: item.text || '功能开发中',
          icon: 'none'
        })
    }
  },

  goToCourseList() {
    // 横幅「查看今日方案」跳到智能推荐页，生成专属饮食方案
    this.goToSmartChoice()
  },

  onCourseTap(e) {
    const item = e.currentTarget.dataset.item || {}
    const key = item.key

    switch (key) {
      case 'report':
        this.goToReport()
        break
      case 'fridge':
        wx.switchTab({ url: '/pages/fridge/fridge' })
        break
      case 'challenge':
        this.goToChallenge()
        break
      case 'community':
        wx.navigateTo({ url: '/packageCommunity/community/community' })
        break
      case 'remedy':
        this.goToRemedy()
        break
      default:
        wx.showToast({
          title: item.title || '功能开发中',
          icon: 'none'
        })
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    try {
      await this.refreshAll()
    } finally {
      wx.stopPullDownRefresh()
    }
  }
})
