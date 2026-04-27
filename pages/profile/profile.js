// pages/profile/profile.js
const api = require('../../utils/api.js')
const auth = require('../../utils/auth.js')
const { isDevChannelToken } = require('../../utils/config.js')
const util = require('../../utils/util.js')
const { getWindowMetricsSafe } = require('../../utils/platform.js')
const lottie = require('lottie-miniprogram')
const personalAnimationData = require('../../assets/personal.js')
const app = getApp()

Page({
  data: {
    // 顶部展示（参照首页）
    timeText: '',
    currentDate: '',
    profileGreeting: '今天也要好好照顾自己',
    userInfo: {},
    bmi: '0.0',
    bmiStatus: 'normal', // normal, low, high, very-high
    bmiPercent: 50, // BMI在健康范围中的百分比位置
    allergens: [],
    tastePreferences: [],
    spicinessLevel: 0, // 辣度等级 0-5
    showAllergenModal: false,
    showTasteModal: false,
    streakDays: 0, // 坚持记录天数
    macrosTarget: null, // 三大营养素目标
    goalKcal: {
      lose: 0,
      maintain: 0,
      gain: 0
    },
    weightHistory: [], // 体重历史记录
    totalMeals: 0, // 总记录数
    perfectDays: 0, // 达标天数
    weightChange: 0, // 体重变化（kg）
    loading: false, // 加载状态
    refreshing: false, // 刷新状态
    // 常见过敏源选项
    allergenOptions: [
      '花生', '海鲜', '牛奶', '鸡蛋', '大豆', '小麦', '坚果', '芝麻', 
      '虾', '蟹', '鱼', '芒果', '菠萝', '其他'
    ],
    // 口味偏好选项
    tasteOptions: [
      '辣', '甜', '酸', '咸', '清淡', '低脂', '高蛋白', '低卡', 
      '素食', '无糖', '少油', '高纤维'
    ],
    selectedAllergens: [],
    selectedTastes: [],
    // 新增功能数据
    favoritesCount: 0, // 收藏总数
    favoritesPreview: [], // 收藏预览（最多3个）
    todayRecords: 0, // 今日记录数
    weekRecords: 0, // 本周记录数
    monthRecords: 0, // 本月记录数
    recentRecords: [], // 最近记录（最多5条）
    weekAvgKcal: 0, // 本周平均摄入
    complianceRate: 0, // 达标率
    nutritionBalance: 0, // 营养素均衡度
    reminders: { // 提醒设置
      meal: false,
      log: false,
      weight: false
    },
    badges: [], // 成就徽章（全部）
    featuredBadges: [], // 个性名片上展示的代表徽章（最多3个）
    weeklyData: [], // 周报数据
    nutritionData: null, // 营养素分布数据
    showAvatarLottie: true,
    avatarSrc: '', // 带头像缓存戳，保存后强制刷新 <image>
    // Bento 营养环：今日摄入相对「每日营养素目标」的完成度 0–100
    todayConsumed: 0,
    todayTarget: 2000,
    carbsPct: 0,
    proteinPct: 0,
    fatPct: 0,
    bmiStatusLabel: '健康',
    spicinessLabelText: '不辣',
    navScrolled: false
  },

  onPageScroll(e) {
    const top = (e && e.scrollTop) || 0
    const next = top > 20
    if (next !== this.data.navScrolled) {
      this.setData({ navScrolled: next })
    }
  },

  onLoad() {
    this.initPageHeader()
    this.loadUserProfile()
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar && typeof tabBar.setSelected === 'function') tabBar.setSelected(3)
    this.initPageHeader()
    // 每次显示时刷新（不显示loading，避免频繁闪烁）
    // 延迟一点时间，确保从编辑页面返回时数据已保存
    setTimeout(() => {
      this.loadUserProfile(false)
    }, 100)
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadUserProfile(true).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 初始化顶部时间与日期（与首页逻辑保持一致风格）
  initPageHeader() {
    const now = new Date()
    const h = String(now.getHours()).padStart(2, '0')
    const m = String(now.getMinutes()).padStart(2, '0')
    const month = now.getMonth() + 1
    const day = now.getDate()
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const weekday = weekdays[now.getDay()]

    // 简单根据时间段调整个人问候语，功能不影响其他逻辑
    let profileGreeting = '今天也要好好照顾自己'
    const hour = now.getHours()
    if (hour < 6) {
      profileGreeting = '夜深了，今天的胃也该休息啦 🌙'
    } else if (hour < 10) {
      profileGreeting = '早安，给身体充个电吧 ☀️'
    } else if (hour < 14) {
      profileGreeting = '午安，好好享受美味时光 🍱'
    } else if (hour < 18) {
      profileGreeting = '下午好，随时补充一点能量 🍵'
    } else {
      profileGreeting = '晚上好，今天过得开心吗 🌟'
    }

    this.setData({
      timeText: `${h}:${m}`,
      currentDate: `${month}月${day}日 周${weekday}`,
      profileGreeting
    })
  },

  // 初始化头像 Lottie 动效（仅在有自定义/已选头像时展示，避免与无头像占位叠层）
  initAvatarLottie() {
    if (!this.data.userInfo || !this.data.userInfo.avatar) {
      return
    }
    if (this._lottieAvatarInited) {
      return
    }
    try {
      const query = wx.createSelectorQuery().in(this)
      query
        .select('#profileLottie')
        .fields({ node: true, size: true })
        .exec((res) => {
          const canvas = res && res[0] && res[0].node
          if (!canvas || !lottie) {
            return
          }
          const ctx = canvas.getContext('2d')
          const sys = getWindowMetricsSafe()
          const dpr = sys.pixelRatio || 2
          canvas.width = res[0].width * dpr
          canvas.height = res[0].height * dpr
          ctx.scale(dpr, dpr)

          if (typeof lottie.setup === 'function') {
            lottie.setup(canvas)
          }

          if (typeof lottie.loadAnimation !== 'function') {
            console.warn('lottie.loadAnimation 不可用', lottie)
            return
          }

          try {
            lottie.loadAnimation({
              loop: true,
              autoplay: true,
              animationData: personalAnimationData,
              renderer: 'canvas',
              rendererSettings: {
                context: ctx,
                clearCanvas: true
              }
            })
            this._lottieAvatarInited = true
          } catch (err) {
            console.error('Lottie 动画数据不兼容（如含 AE 表达式需导出时烘焙关键帧）', err)
            this.setData({ showAvatarLottie: false })
          }
        })
    } catch (e) {
      console.error('初始化头像 Lottie 失败', e)
      this.setData({ showAvatarLottie: false })
    }
  },

  // 加载用户信息
  async loadUserProfile(showLoading = true) {
    try {
      if (showLoading) {
        util.showLoading('加载中...')
        this.setData({ loading: true })
      } else {
        this.setData({ refreshing: true })
      }
      
      let profile = await api.getUserProfile()

      // 保存头像后若 GET 未带回 avatar（字段名差异或缓存），用编辑页写入的待同步地址顶一次
      if (this._pendingAvatarUrl) {
        const has = profile.avatar && String(profile.avatar).trim() !== ''
        if (!has) {
          profile = Object.assign({}, profile, { avatar: this._pendingAvatarUrl })
        }
        this._pendingAvatarUrl = null
      }

      // 验证数据有效性
      if (!profile || typeof profile !== 'object') {
        throw new Error('用户数据格式错误')
      }
      
      const bmi = parseFloat(util.calculateBMI(profile.height, profile.weight)) || 0
      const allergens = Array.isArray(profile.allergens) ? profile.allergens : []
      const tastePreferences = Array.isArray(profile.diet_tags) ? profile.diet_tags : []
      const spicinessLevel = profile.spiciness_level || 0
      
      // 计算BMI状态和百分比
      const bmiStatus = bmi > 0 ? this.calculateBMIStatus(bmi) : 'normal'
      const bmiPercent = bmi > 0 ? this.calculateBMIPercent(bmi) : 50
      
      // 计算坚持记录天数
      const streakDays = this.calculateStreakDays(profile.created_at || profile.first_login_date)
      
      // 计算三大营养素目标
      const macrosTarget = this.calculateMacrosTarget(profile.daily_kcal_limit, profile.goal_type)
      
      // 计算各目标类型的建议卡路里
      const goalKcal = this.calculateGoalKcal(profile.weight, profile.height)
      
      // 从后端用户档案中读取勋章与代表徽章（若已实现挑战系统）
      const profileBadges = Array.isArray(profile.badges) ? profile.badges : []
      const profileFeaturedBadges = Array.isArray(profile.featured_badges) ? profile.featured_badges : []
      const featuredBadges = profileFeaturedBadges.length > 0
        ? profileFeaturedBadges
        : profileBadges.slice(0, 3)
      
      // 获取统计数据（需要先设置userInfo以便计算体重变化）
      const avatarUrl = profile.avatar || ''
      if (!avatarUrl) {
        this._lottieAvatarInited = false
      }
      this.setData({
        userInfo: profile,
        avatarSrc: avatarUrl ? util.withAvatarCacheBust(avatarUrl) : '',
        badges: profileBadges,
        featuredBadges: featuredBadges
      })

      if (avatarUrl && this.data.showAvatarLottie) {
        wx.nextTick(() => {
          setTimeout(() => this.initAvatarLottie(), 80)
        })
      }

      const stats = await this.loadUserStats()

      let dailySummary = null
      try {
        dailySummary = await api.getDailySummary()
      } catch (e) {
        console.log('个人中心：今日摘要暂不可用', e)
      }
      const bentoNutrition = this._bentoFromDailySummary(
        dailySummary,
        macrosTarget,
        profile.daily_kcal_limit
      )
      
      // 先设置基础数据，以便loadPersonalData中的loadBadges可以访问
      this.setData({
        streakDays,
        totalMeals: stats.totalMeals || 0,
        perfectDays: stats.perfectDays || 0,
        weightChange: stats.weightChange || 0
      })
      
      // 加载个性化功能数据（此时可以访问stats数据）
      const personalData = await this.loadPersonalData()
      
      this.setData({
        bmi: bmi > 0 ? bmi.toFixed(1) : '0.0',
        bmiStatus,
        bmiStatusLabel: this.bmiStatusToLabel(bmiStatus),
        bmiPercent,
        allergens,
        tastePreferences,
        spicinessLevel,
        spicinessLabelText: this.spicinessToLabel(spicinessLevel),
        selectedAllergens: [...allergens],
        selectedTastes: [...tastePreferences],
        streakDays,
        macrosTarget,
        goalKcal,
        loading: false,
        refreshing: false,
        ...stats,
        ...personalData,
        ...bentoNutrition
      })
      
      // 延迟绘制体重图表，确保DOM已渲染
      if ((stats.weightHistory && stats.weightHistory.length > 0) || (this.data.weightChartData && this.data.weightChartData.weight_chart)) {
        setTimeout(() => {
          this.drawWeightChart()
        }, 300)
      }
    } catch (error) {
      console.error('加载用户信息失败', error)
      this.setData({
        loading: false,
        refreshing: false
      })
      const errorMsg = error.message || '加载失败，请重试'
      util.showToast(errorMsg.length > 15 ? '加载失败，请重试' : errorMsg)
    } finally {
      if (showLoading) {
        util.hideLoading()
      }
    }
  },

  // 计算BMI状态
  calculateBMIStatus(bmi) {
    if (bmi < 18.5) return 'low'
    if (bmi < 24) return 'normal'
    if (bmi < 28) return 'high'
    return 'very-high'
  },

  // 计算BMI在健康范围中的百分比位置（用于显示进度条）
  calculateBMIPercent(bmi) {
    // 正常范围是18.5-24，我们映射到0-100%
    if (bmi < 18.5) return (bmi / 18.5) * 30 // 偏瘦区域占30%
    if (bmi < 24) return 30 + ((bmi - 18.5) / (24 - 18.5)) * 50 // 正常区域占50%
    if (bmi < 28) return 80 + ((bmi - 24) / (28 - 24)) * 15 // 偏胖区域占15%
    return 95 + Math.min((bmi - 28) / 10, 0.05) * 100 // 肥胖区域
  },

  /** 今日摘要 → Bento 环形进度（与首页 loadDailySummary 字段兼容） */
  _bentoFromDailySummary(summary, macrosTarget, profileDailyLimit) {
    const fallback = {
      todayConsumed: 0,
      todayTarget: Math.round(parseFloat(profileDailyLimit) || 2000),
      carbsPct: 0,
      proteinPct: 0,
      fatPct: 0
    }
    if (!summary || typeof summary !== 'object') {
      return fallback
    }
    const intakeActual =
      summary.intake_actual != null
        ? summary.intake_actual
        : summary.consumed != null
          ? summary.consumed
          : 0
    const dailyLimit =
      summary.daily_limit != null
        ? summary.daily_limit
        : summary.target != null
          ? summary.target
          : fallback.todayTarget
    const macros = summary.macros || {
      carbg: summary.carb || 0,
      proteing: summary.protein || 0,
      fatg: summary.fat || 0
    }
    const pct = (actual, target) => {
      const a = Number(actual) || 0
      const t = Number(target) || 0
      if (t <= 0) return 0
      return Math.min(100, Math.round((a / t) * 100))
    }
    const mt = macrosTarget || {}
    return {
      todayConsumed: Math.round(Number(intakeActual) || 0),
      todayTarget: Math.round(Number(dailyLimit) || fallback.todayTarget),
      carbsPct: mt.carb != null ? pct(macros.carbg, mt.carb) : 0,
      proteinPct: mt.protein != null ? pct(macros.proteing, mt.protein) : 0,
      fatPct: mt.fat != null ? pct(macros.fatg, mt.fat) : 0
    }
  },

  bmiStatusToLabel(status) {
    const map = {
      low: '偏瘦',
      normal: '健康',
      high: '偏胖',
      'very-high': '需关注'
    }
    return map[status] || '健康'
  },

  spicinessToLabel(level) {
    const n = Number(level) || 0
    const labels = ['不辣', '微辣', '中辣', '重辣', '特辣', '变态辣']
    return labels[Math.min(n, labels.length - 1)] || '不辣'
  },

  // 计算坚持记录天数
  calculateStreakDays(firstLoginDate) {
    if (!firstLoginDate) return 0
    const firstDate = new Date(firstLoginDate)
    const today = new Date()
    const diffTime = today - firstDate
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(1, diffDays) // 至少显示1天
  },

  // 计算三大营养素目标
  calculateMacrosTarget(dailyKcal, goalType) {
    if (!dailyKcal) return null
    
    const kcal = parseFloat(dailyKcal)
    let carbPercent = 0.5  // 默认50%碳水
    let proteinPercent = 0.25 // 默认25%蛋白质
    let fatPercent = 0.25 // 默认25%脂肪
    
    // 根据目标类型调整比例
    if (goalType === 'lose') {
      // 减脂：降低碳水，提高蛋白质
      carbPercent = 0.4
      proteinPercent = 0.35
      fatPercent = 0.25
    } else if (goalType === 'gain') {
      // 增肌：提高碳水，提高蛋白质
      carbPercent = 0.5
      proteinPercent = 0.3
      fatPercent = 0.2
    }
    
    // 1g碳水=4kcal, 1g蛋白质=4kcal, 1g脂肪=9kcal
    return {
      carb: Math.round((kcal * carbPercent) / 4),
      protein: Math.round((kcal * proteinPercent) / 4),
      fat: Math.round((kcal * fatPercent) / 9)
    }
  },

  // 计算各目标类型的建议卡路里
  calculateGoalKcal(weight, height) {
    const w = parseFloat(weight) || 0
    const h = parseFloat(height) || 0
    if (w === 0 || h === 0) {
      return { lose: 0, maintain: 0, gain: 0 }
    }
    
    // 基础代谢率（简化计算）
    const bmr = w * 22 // 简化公式
    
    return {
      lose: Math.round(bmr * 1.2 - 300), // 减脂：基础代谢*1.2-300
      maintain: Math.round(bmr * 1.3), // 维持：基础代谢*1.3
      gain: Math.round(bmr * 1.5 + 300) // 增肌：基础代谢*1.5+300
    }
  },

  // 加载用户统计数据
  async loadUserStats() {
    try {
      const history = await api.getHistoryTrend().catch((err) => {
        console.log('获取历史趋势失败，使用默认值', err)
        return { 
          weights: [],
          total_meals: 0,
          perfect_days: 0
        }
      })
      
      // 处理体重历史数据
      let weightHistory = []
      if (history && history.weights && Array.isArray(history.weights)) {
        weightHistory = history.weights.map(item => {
          if (typeof item === 'number') {
            return { weight: item, date: new Date().toISOString() }
          }
          if (item && typeof item === 'object') {
            return {
              weight: parseFloat(item.weight || item) || 0,
              date: item.date || new Date().toISOString()
            }
          }
          return item
        }).filter(item => item && (item.weight > 0 || item.weight))
      }
      
      // 计算体重变化（如果有当前体重和历史体重）
      let weightChange = 0
      const currentWeight = parseFloat(this.data.userInfo.weight) || 0
      if (weightHistory.length > 0 && currentWeight > 0) {
        const firstWeight = parseFloat(weightHistory[0].weight || weightHistory[0]) || 0
        if (firstWeight > 0) {
          weightChange = parseFloat((currentWeight - firstWeight).toFixed(1))
        }
      } else if (weightHistory.length >= 2) {
        const firstWeight = parseFloat(weightHistory[0].weight || weightHistory[0]) || 0
        const lastWeight = parseFloat(weightHistory[weightHistory.length - 1].weight || weightHistory[weightHistory.length - 1]) || 0
        if (firstWeight > 0 && lastWeight > 0) {
          weightChange = parseFloat((lastWeight - firstWeight).toFixed(1))
        }
      }
      
      return {
        weightHistory,
        weightChartData: weightHistory.length > 0 ? weightHistory : null,
        totalMeals: history.total_meals || 0,
        perfectDays: history.perfect_days || 0,
        weightChange
      }
    } catch (error) {
      console.error('加载统计数据失败', error)
      return {
        weightHistory: [],
        totalMeals: 0,
        perfectDays: 0,
        weightChange: 0
      }
    }
  },

  // 设置目标
  async setGoal(e) {
    const goal = e.currentTarget.dataset.goal
    const goalKcal = this.data.goalKcal[goal]
    
    if (goalKcal === 0) {
      util.showToast('请先完善身体数据')
      // 引导用户去编辑页面
      setTimeout(() => {
        this.editProfile()
      }, 1500)
      return
    }
    
    // 如果已经是当前目标，不重复设置
    if (this.data.userInfo.goal_type === goal) {
      return
    }
    
    try {
      util.showLoading('设置中...')
      await api.updateUserProfile({
        goal_type: goal,
        daily_kcal_limit: goalKcal
      })
      
      // 重新计算营养素目标
      const macrosTarget = this.calculateMacrosTarget(goalKcal, goal)
      
      this.setData({
        'userInfo.goal_type': goal,
        'userInfo.daily_kcal_limit': goalKcal,
        macrosTarget
      })
      try {
        const summary = await api.getDailySummary()
        this.setData(this._bentoFromDailySummary(summary, macrosTarget, goalKcal))
      } catch (e) {
        /* ignore */
      }
      
      util.showSuccess('目标设置成功')
    } catch (error) {
      console.error('设置目标失败', error)
      const errorMsg = error.message || '设置失败，请重试'
      util.showToast(errorMsg.length > 15 ? '设置失败，请重试' : errorMsg)
    } finally {
      util.hideLoading()
    }
  },

  // 编辑个人资料
  editProfile() {
    wx.navigateTo({
      url: '/packageUser/profile-edit/profile-edit'
    })
  },

  goToFans() {
    util.showToast('粉丝列表敬请期待')
  },

  // 编辑过敏源
  editAllergens() {
    this.setData({
      showAllergenModal: true,
      selectedAllergens: [...this.data.allergens]
    })
  },

  // 关闭过敏源弹窗
  closeAllergenModal() {
    this.setData({
      showAllergenModal: false
    })
  },

  // 切换过敏源选择
  toggleAllergen(e) {
    const allergen = e.currentTarget.dataset.allergen
    const selectedAllergens = [...this.data.selectedAllergens]
    const index = selectedAllergens.indexOf(allergen)
    
    if (index > -1) {
      selectedAllergens.splice(index, 1)
    } else {
      selectedAllergens.push(allergen)
    }
    
    this.setData({
      selectedAllergens
    })
  },

  // 保存过敏源
  async saveAllergens() {
    try {
      util.showLoading('保存中...')
      await api.updateUserProfile({
        allergens: this.data.selectedAllergens
      })
      
      this.setData({
        allergens: [...this.data.selectedAllergens],
        showAllergenModal: false
      })
      
      util.showSuccess('保存成功')
    } catch (error) {
      console.error('保存过敏源失败', error)
      const errorMsg = error.message || '保存失败，请重试'
      util.showToast(errorMsg.length > 15 ? '保存失败，请重试' : errorMsg)
    } finally {
      util.hideLoading()
    }
  },

  // 编辑口味偏好
  editTaste() {
    this.setData({
      showTasteModal: true,
      selectedTastes: [...this.data.tastePreferences]
    })
  },

  // 关闭口味偏好弹窗
  closeTasteModal() {
    this.setData({
      showTasteModal: false
    })
  },

  // 切换口味偏好选择
  toggleTaste(e) {
    const taste = e.currentTarget.dataset.taste
    const selectedTastes = [...this.data.selectedTastes]
    const index = selectedTastes.indexOf(taste)
    
    if (index > -1) {
      selectedTastes.splice(index, 1)
    } else {
      selectedTastes.push(taste)
    }
    
    this.setData({
      selectedTastes
    })
  },

  // 调整辣度
  onSpicinessChange(e) {
    this.setData({
      spicinessLevel: e.detail.value
    })
  },

  // 保存口味偏好
  async saveTaste() {
    try {
      util.showLoading('保存中...')
      await api.updateUserProfile({
        diet_tags: this.data.selectedTastes,
        spiciness_level: this.data.spicinessLevel
      })
      
      this.setData({
        tastePreferences: [...this.data.selectedTastes],
        spicinessLevel: this.data.spicinessLevel,
        spicinessLabelText: this.spicinessToLabel(this.data.spicinessLevel),
        showTasteModal: false
      })
      
      util.showSuccess('保存成功')
    } catch (error) {
      console.error('保存口味偏好失败', error)
      const errorMsg = error.message || '保存失败，请重试'
      util.showToast(errorMsg.length > 15 ? '保存失败，请重试' : errorMsg)
    } finally {
      util.hideLoading()
    }
  },

  /**
   * 退出登录：通知后端拉黑 refresh_token，并清空本地存储（与登录页、设置里逻辑一致）
   * @returns {Promise<{ ok: boolean, error?: Error }>}
   */
  async performServerLogout() {
    const appInst = getApp()
    if (isDevChannelToken(appInst.globalData.accessToken)) {
      auth.clearSession(appInst)
      wx.clearStorageSync()
      return { ok: true }
    }
    const refresh =
      appInst.globalData.refreshToken ||
      wx.getStorageSync('refresh_token')
    if (!refresh) {
      auth.clearSession(appInst)
      wx.clearStorageSync()
      return { ok: true }
    }
    try {
      await api.logout(refresh)
    } catch (e) {
      return { ok: false, error: e }
    }
    auth.clearSession(appInst)
    wx.clearStorageSync()
    return { ok: true }
  },

  /** 个人中心 · 退出登录 */
  onLogoutTap() {
    wx.showModal({
      title: '安全登出',
      content:
        '将安全注销当前设备并清空本地数据。要短暂离开休息一下吗？',
      confirmText: '暂离',
      cancelText: '留下',
      success: async (res) => {
        if (!res.confirm) return
        util.showLoading('退出中...')
        const result = await this.performServerLogout()
        util.hideLoading()
        if (!result.ok) {
          wx.showToast({
            title:
              result.error &&
              result.error.message &&
              result.error.message.length < 18
                ? result.error.message
                : '退出失败，请重试',
            icon: 'none'
          })
          return
        }
        wx.reLaunch({ url: '/packageUser/login/login' })
      }
    })
  },

  /**
   * 重新登录：只清除本会话（access/refresh），不调用服务端 logout，便于换授权或网络异常时强制重登
   */
  onReloginTap() {
    wx.showModal({
      title: '刷新连接',
      content:
        '将清除本机状态并重新回到授权大门，要换个状态重新出发吗？',
      confirmText: '去刷新',
      cancelText: '再看看',
      success: (res) => {
        if (!res.confirm) return
        auth.clearSession(getApp())
        wx.reLaunch({
          url: '/packageUser/login/login?from=relogin'
        })
      }
    })
  },

  // 显示设置
  showSettings() {
    wx.showActionSheet({
      itemList: ['清理缓存', '安全登出'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showModal({
            title: '清除缓存',
            content: '确定要清除所有缓存数据吗？',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.clearStorageSync()
                util.showSuccess('缓存已清除')
                setTimeout(() => {
                  getApp().wxLogin()
                }, 1000)
              }
            }
          })
        } else if (res.tapIndex === 1) {
          wx.showModal({
            title: '退出登录',
            content: '确定要退出登录吗？',
            success: async (modalRes) => {
              if (!modalRes.confirm) return
              util.showLoading('退出中...')
              const result = await this.performServerLogout()
              util.hideLoading()
              if (!result.ok) {
                wx.showToast({
                  title:
                    result.error &&
                    result.error.message &&
                    result.error.message.length < 18
                      ? result.error.message
                      : '退出失败，请重试',
                  icon: 'none'
                })
                return
              }
              wx.reLaunch({ url: '/packageUser/login/login' })
            }
          })
        }
      }
    })
  },

  // 绘制体重图表
  drawWeightChart() {
    try {
      // ⚠️ 优化：优先使用后端提供的图表数据
      let chartData = []
      let chartConfig = {}
      let weightHistory = this.data.weightHistory || []
      
      if (this.data.weightChartData && this.data.weightChartData.weight_chart) {
        // 使用后端提供的图表数据
        const weightChart = this.data.weightChartData.weight_chart
        chartData = weightChart.data || []
        chartConfig = weightChart.config || {}
        
        // 从图表数据中提取体重和日期
        const weights = chartData.map(item => parseFloat(item.weight || 0)).filter(w => w > 0)
        const dates = chartData.map(item => {
          if (item.date) {
            try {
              const date = new Date(item.date)
              if (!isNaN(date.getTime())) {
                return `${date.getMonth() + 1}/${date.getDate()}`
              }
            } catch (e) {
              console.error('日期解析失败', e)
            }
          }
          return ''
        })
        
        if (weights.length === 0) {
          console.log('没有有效的体重数据，跳过图表绘制')
          return
        }
        
        this._drawWeightChartContent(weights, dates, chartConfig)
      } else if (weightHistory.length > 0) {
        // 兼容模式：使用历史数据
        const recentWeights = weightHistory.slice(-7)
        const weights = recentWeights.map(item => {
          const weight = parseFloat(item.weight || item)
          return isNaN(weight) ? 0 : weight
        }).filter(w => w > 0)
        
        if (weights.length === 0) {
          console.log('没有有效的体重数据，跳过图表绘制')
          return
        }
        
        const dates = recentWeights.map((item, index) => {
          if (item.date) {
            try {
              const date = new Date(item.date)
              if (!isNaN(date.getTime())) {
                return `${date.getMonth() + 1}/${date.getDate()}`
              }
            } catch (e) {
              console.error('日期解析失败', e)
            }
          }
          return `${index + 1}/${index + 1}`
        })
        
        this._drawWeightChartContent(weights, dates, chartConfig)
      } else {
        console.log('没有体重历史数据，跳过图表绘制')
        return
      }
    } catch (error) {
      console.error('绘制体重图表失败', error)
      // 静默失败，不影响页面其他功能
    }
  },
  
  // 绘制体重图表内容（提取为独立方法）
  _drawWeightChartContent(weights, dates, chartConfig) {
    try {
      // 获取Canvas实际尺寸
      const query = wx.createSelectorQuery().in(this)
      query.select('.weight-chart').boundingClientRect((rect) => {
        if (!rect || rect.width === 0 || rect.height === 0) {
          console.error('无法获取体重图表容器尺寸', rect)
          return
        }
        
        const systemInfo = getWindowMetricsSafe()
        const pixelRatio = systemInfo.pixelRatio || 2
        const width = rect.width * pixelRatio
        const height = rect.height * pixelRatio
        
        const ctx = wx.createCanvasContext('weightChart', this)
        if (!ctx) {
          console.error('无法创建Canvas上下文')
          return
        }
        
        const padding = 40 * pixelRatio
        const chartWidth = width - padding * 2
        const chartHeight = height - padding * 2
      
        const maxWeight = Math.max(...weights)
        const minWeight = Math.min(...weights)
        const weightRange = maxWeight - minWeight || 1
        
        // 清空画布
        ctx.clearRect(0, 0, width, height)
        
        // 绘制坐标轴
        ctx.setStrokeStyle('#E0E0E0')
        ctx.setLineWidth(1 * pixelRatio)
        ctx.beginPath()
        ctx.moveTo(padding, padding)
        ctx.lineTo(padding, height - padding)
        ctx.lineTo(width - padding, height - padding)
        ctx.stroke()
        
        // 绘制折线（使用后端配置的颜色）
        if (weights.length > 1) {
          const lineColor = chartConfig.colors ? (chartConfig.colors.line || '#4CAF50') : '#4CAF50'
          ctx.setStrokeStyle(lineColor)
          ctx.setLineWidth(3 * pixelRatio)
          ctx.beginPath()
          
          weights.forEach((weight, index) => {
            const x = padding + (chartWidth / (weights.length - 1)) * index
            const y = height - padding - ((weight - minWeight) / weightRange) * chartHeight
            
            if (index === 0) {
              ctx.moveTo(x, y)
            } else {
              ctx.lineTo(x, y)
            }
          })
          
          ctx.stroke()
        }
        
        // 绘制数据点（使用后端配置的颜色）
        const pointColor = chartConfig.colors ? (chartConfig.colors.point || lineColor) : lineColor
        ctx.setFillStyle(pointColor)
        weights.forEach((weight, index) => {
          const x = padding + (chartWidth / (weights.length - 1)) * index
          const y = height - padding - ((weight - minWeight) / weightRange) * chartHeight
          
          ctx.beginPath()
          ctx.arc(x, y, 6 * pixelRatio, 0, 2 * Math.PI)
          ctx.fill()
        })
        
        // 绘制日期标签
        ctx.setFillStyle('#999')
        ctx.setFontSize(20 * pixelRatio)
        dates.forEach((date, index) => {
          if (index < weights.length) {
            const x = padding + (chartWidth / (weights.length - 1)) * index
            const y = height - padding + 20 * pixelRatio
            ctx.fillText(date, x - 20 * pixelRatio, y)
          }
        })
        
        ctx.draw(false, () => {
          console.log('体重图表绘制完成')
        })
      }).exec()
    } catch (error) {
      console.error('绘制体重图表失败', error)
      // 静默失败，不影响页面其他功能
    }
  },

  // 显示关于
  showAbout() {
    wx.showModal({
      title: '关于',
      content: '今天吃什么 v1.0.0\n健康生活，从每一餐开始',
      showCancel: false
    })
  },

  // 显示反馈
  showFeedback() {
    wx.showModal({
      title: '意见反馈',
      editable: true,
      placeholderText: '请输入您的意见或建议...',
      success: (res) => {
        if (res.confirm && res.content) {
          // 这里可以发送反馈到后端
          util.showSuccess('反馈已提交，感谢您的建议！')
        }
      }
    })
  },

  // 点击头像
  onAvatarTap() {
    wx.navigateTo({
      url: '/packageUser/profile-edit/profile-edit'
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // ========== 新增个性化功能 ==========
  
  // 加载个性化数据
  async loadPersonalData() {
    try {
      // 并行加载多个数据
      const [favorites, records, report, reminders, badges] = await Promise.all([
        this.loadFavorites().catch(() => ({ count: 0, preview: [] })),
        this.loadRecordsSummary().catch(() => ({ today: 0, week: 0, month: 0, recent: [] })),
        this.loadReportSummary().catch(() => ({ weekAvgKcal: 0, complianceRate: 0, nutritionBalance: 0 })),
        this.loadReminders().catch(() => ({ meal: false, log: false, weight: false })),
        this.loadBadges().catch(() => [])
      ])
      
      return {
        favoritesCount: favorites.count || 0,
        favoritesPreview: favorites.preview || [],
        todayRecords: records.today || 0,
        weekRecords: records.week || 0,
        monthRecords: records.month || 0,
        recentRecords: records.recent || [],
        weekAvgKcal: report.weekAvgKcal || 0,
        complianceRate: report.complianceRate || 0,
        nutritionBalance: report.nutritionBalance || 0,
        reminders: reminders,
        badges: badges,
        featuredBadges: badges.slice(0, 3)
      }
    } catch (error) {
      console.error('加载个性化数据失败', error)
      return {}
    }
  },

  // 与「我的收藏」页、cook 快速收藏共用 storage key：favorites
  _favoritesFallbackFromStorage() {
    try {
      const raw = wx.getStorageSync('favorites') || []
      const list = Array.isArray(raw) ? raw : []
      const preview = list.slice(0, 3).map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name || '未知',
        image: item.image || ''
      }))
      return { count: list.length, preview }
    } catch (e) {
      return { count: 0, preview: [] }
    }
  },

  // 加载收藏数据（与「我的收藏」页共用 api.getFavorites，数据联动）
  async loadFavorites() {
    try {
      const res = await api.getFavorites('all')
      const favorites = Array.isArray(res) ? res : (res && res.list) ? res.list : []
      const preview = favorites.slice(0, 3).map(item => ({
        id: item.id,
        type: item.type,
        name: item.name || '未知',
        image: item.image || ''
      }))
      return { count: favorites.length, preview }
    } catch (error) {
      const msg = (error && error.message) || ''
      const local = this._favoritesFallbackFromStorage()
      if (/请求失败 \(5\d\d\)|500|502|503/.test(msg)) {
        console.warn(
          '[收藏] GET /diet/favorites/ 服务端异常，已用本地缓存收藏数展示。请修复 Django 该视图。',
          msg
        )
      } else {
        console.error('加载收藏失败', error)
      }
      if (local.count > 0) {
        return local
      }
      return { count: 0, preview: [] }
    }
  },

  // 加载记录摘要
  async loadRecordsSummary() {
    try {
      const today = new Date()
      const todayStr = util.formatDate(today)
      const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      
      const records = wx.getStorageSync('diet_records') || []
      
      const todayRecords = records.filter(r => r.date === todayStr).length
      const weekRecords = records.filter(r => new Date(r.date) >= weekStart).length
      const monthRecords = records.filter(r => new Date(r.date) >= monthStart).length
      const recentRecords = records.slice(-5).reverse().map(r => ({
        id: r.id,
        name: r.name || '未知',
        kcal: r.kcal || 0,
        time: r.time || '00:00'
      }))
      
      return {
        today: todayRecords,
        week: weekRecords,
        month: monthRecords,
        recent: recentRecords
      }
    } catch (error) {
      console.error('加载记录摘要失败', error)
      return { today: 0, week: 0, month: 0, recent: [] }
    }
  },

  // 加载报告摘要
  async loadReportSummary() {
    try {
      const today = new Date()
      const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      const records = wx.getStorageSync('diet_records') || []
      const weekRecords = records.filter(r => new Date(r.date) >= weekStart)
      
      const weekTotalKcal = weekRecords.reduce((sum, r) => sum + (r.kcal || 0), 0)
      const weekAvgKcal = weekRecords.length > 0 ? Math.round(weekTotalKcal / weekRecords.length) : 0
      
      const dailyKcalLimit = parseFloat(this.data.userInfo.daily_kcal_limit) || 2000
      const perfectDays = weekRecords.filter(r => {
        const dayRecords = records.filter(rec => rec.date === r.date)
        const dayKcal = dayRecords.reduce((sum, rec) => sum + (rec.kcal || 0), 0)
        return dayKcal <= dailyKcalLimit * 1.1 && dayKcal >= dailyKcalLimit * 0.9
      }).length
      const complianceRate = weekRecords.length > 0 ? Math.round((perfectDays / 7) * 100) : 0

      let carb = 0
      let protein = 0
      let fat = 0
      weekRecords.forEach((r) => {
        carb += Number(r.carb != null ? r.carb : r.carbs) || 0
        protein += Number(r.protein) || 0
        fat += Number(r.fat) || 0
      })
      const totalMacro = carb + protein + fat
      let nutritionData = null
      let nutritionBalance = 0
      if (totalMacro > 0) {
        nutritionData = {
          carbPercent: Math.round((carb / totalMacro) * 100),
          proteinPercent: Math.round((protein / totalMacro) * 100),
          fatPercent: Math.round((fat / totalMacro) * 100)
        }
        const { carbPercent: cp, proteinPercent: pp, fatPercent: fp } = nutritionData
        nutritionBalance = Math.max(0, 100 - (Math.abs(cp - 50) + Math.abs(pp - 25) + Math.abs(fp - 25)) / 2)
      }

      // 生成周报数据
      const weeklyData = []
      const days = ['日', '一', '二', '三', '四', '五', '六']
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
        const dateStr = util.formatDate(date)
        const dayRecords = records.filter(r => r.date === dateStr)
        const dayKcal = dayRecords.reduce((sum, r) => sum + (r.kcal || 0), 0)
        const percent = dailyKcalLimit > 0 ? Math.min((dayKcal / dailyKcalLimit) * 100, 100) : 0
        
        weeklyData.push({
          date: dateStr,
          day: days[date.getDay()],
          kcal: dayKcal,
          percent: percent
        })
      }

      return {
        weekAvgKcal,
        complianceRate,
        nutritionBalance,
        weeklyData,
        nutritionData
      }
    } catch (error) {
      console.error('加载报告摘要失败', error)
      return { 
        weekAvgKcal: 0, 
        complianceRate: 0, 
        nutritionBalance: 0,
        weeklyData: [],
        nutritionData: null
      }
    }
  },

  // 加载提醒设置
  async loadReminders() {
    try {
      const reminders = wx.getStorageSync('reminders') || {
        meal: false,
        log: false,
        weight: false
      }
      return reminders
    } catch (error) {
      console.error('加载提醒设置失败', error)
      return { meal: false, log: false, weight: false }
    }
  },

  // 加载成就徽章
  async loadBadges() {
    try {
      // 后端暂未实现 getAchievements 时走本地统计生成的徽章
      if (typeof api.getAchievements === 'function') {
        try {
          // 优先：调用后端成就接口，与挑战系统打通
          const res = await api.getAchievements()
          if (Array.isArray(res)) {
            return res
          }
          if (res && Array.isArray(res.data)) {
            return res.data
          }
        } catch (remoteErr) {
          // 接口未就绪时静默回退到本地规则，避免在控制台刷报错
          console.log('远程成就接口不可用，使用本地徽章规则', remoteErr)
        }
      }
      
      // 兜底：如果接口未实现，退回到本地规则生成基础徽章
      const badges = []
      const streakDays = this.data.streakDays || 0
      const totalMeals = this.data.totalMeals || 0
      const perfectDays = this.data.perfectDays || 0
      const weightChange = this.data.weightChange || 0
      
      if (streakDays >= 7) badges.push({ id: 'local_1', name: '坚持一周', icon: '🔥' })
      if (streakDays >= 30) badges.push({ id: 'local_2', name: '坚持一月', icon: '⭐' })
      if (streakDays >= 100) badges.push({ id: 'local_3', name: '百日坚持', icon: '👑' })
      if (totalMeals >= 50) badges.push({ id: 'local_4', name: '记录达人', icon: '📝' })
      if (totalMeals >= 200) badges.push({ id: 'local_5', name: '记录大师', icon: '📚' })
      if (perfectDays >= 7) badges.push({ id: 'local_6', name: '完美一周', icon: '✨' })
      if (weightChange < 0 && Math.abs(weightChange) >= 2) {
        badges.push({ id: 'local_7', name: '减重达人', icon: '🎯' })
      }
      
      return badges
    } catch (error) {
      console.error('加载徽章失败', error)
      return []
    }
  },

  // 查看收藏
  viewFavorites() {
    wx.navigateTo({
      url: '/packageUser/favorites/favorites'
    })
  },

  // 查看收藏详情
  viewFavoriteDetail(e) {
    const { id, type } = e.currentTarget.dataset
    if (type === 'recipe') {
      wx.navigateTo({
        url: `/packageCook/cook-detail/cook-detail?id=${id}`
      })
    } else {
      wx.navigateTo({
        url: `/packageRestaurant/restaurant-detail/restaurant-detail?id=${id}`
      })
    }
  },

  // 查看历史记录
  viewHistory() {
    wx.showToast({
      title: '历史记录功能开发中',
      icon: 'none'
    })
    // TODO: 跳转到历史记录页面
  },

  // 查看记录详情
  viewRecordDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.showToast({
      title: '记录详情功能开发中',
      icon: 'none'
    })
  },

  // 生成健康报告
  generateHealthReport() {
    wx.showToast({
      title: '健康报告功能开发中',
      icon: 'none'
    })
    // TODO: 跳转到健康报告页面
  },

  // 打开提醒设置
  openReminderSettings() {
    // 已经在页面中显示，可以展开更多设置
    wx.showToast({
      title: '提醒设置已展开',
      icon: 'none'
    })
  },

  // 切换提醒开关
  toggleReminder(e) {
    const type = e.currentTarget.dataset.type
    const value = e.detail.value
    
    const reminders = { ...this.data.reminders }
    reminders[type] = value
    
    this.setData({ reminders })
    
    // 保存到本地存储
    wx.setStorageSync('reminders', reminders)
    
    // 如果开启提醒，设置系统提醒
    if (value) {
      this.setupReminder(type)
    } else {
      this.cancelReminder(type)
    }
    
    util.showSuccess(value ? '提醒已开启' : '提醒已关闭')
  },

  // 设置系统提醒
  setupReminder(type) {
    // 这里可以调用微信小程序的提醒API
    // 注意：小程序需要用户授权才能设置提醒
    console.log('设置提醒:', type)
  },

  // 取消提醒
  cancelReminder(type) {
    console.log('取消提醒:', type)
  },

  // 查看成就
  // 跳转到挑战赛
  goToChallenge() {
    wx.navigateTo({
      url: '/packageUser/challenge/challenge'
    })
  },

  viewAchievements() {
    wx.navigateTo({
      url: '/packageUser/achievements/achievements'
    })
  },

  // 跳转到AI营养师（聊天版 - 核心功能）
  goToAINutritionist() {
    wx.navigateTo({
      url: '/packageAI/ai-nutritionist/ai-nutritionist'
    })
  },

  // 跳转到购物清单
  goToShoppingList() {
    wx.navigateTo({
      url: '/packageUser/shopping-list/shopping-list'
    })
  },

  // 跳转到拼单功能
  goToGroupOrder() {
    wx.navigateTo({
      url: '/packageRestaurant/group-order/group-order'
    })
  }
})
