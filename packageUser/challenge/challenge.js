// pages/challenge/challenge.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    activeChallenges: [], // 进行中的挑战
    availableChallenges: [], // 可加入的挑战
    completedChallenges: [], // 已完成的挑战
    myProgress: {}, // 我的进度映射 {challengeId: progress}
    showJoinModal: false,
    selectedChallenge: null,
    tabs: ['进行中', '可加入', '已完成'],
    currentTab: 0,
    loading: false,
    refreshing: false,
    reminderEnabled: true // 提醒开关
  },

  // 兼容：后端直返 data 或旧结构 { data: ... }
  unwrap(res) {
    if (!res) return null
    return res.data !== undefined ? res.data : res
  },

  onLoad() {
    this.loadChallenges()
    this.checkReminderSettings()
    this.setupDailyReminder()
  },

  onShow() {
    // 每次显示时刷新进度，并自动检查进度
    this.loadChallenges()
    this.autoCheckProgress()
    // 检查是否需要提醒
    this.setupDailyReminder()
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ refreshing: true })
    this.loadChallenges().finally(() => {
      this.setData({ refreshing: false })
      wx.stopPullDownRefresh()
    })
  },

  // 加载挑战列表
  async loadChallenges() {
    try {
      this.setData({ loading: true })
      
      // 调用API获取挑战列表
      const raw = await api.getChallengeTasks()
      const data = this.unwrap(raw)
      
      if (data) {
        const { available = [], active = [], completed = [] } = data
        
        // 构建进度映射
        const myProgress = {}
        active.forEach(challenge => {
          myProgress[challenge.id] = {
            status: 'active',
            currentDays: challenge.current_days || 0,
            progress: challenge.progress || 0,
            start_date: challenge.start_date,
            end_date: challenge.end_date,
            progress_id: challenge.progress_id
          }
        })
        completed.forEach(challenge => {
          myProgress[challenge.id] = {
            status: 'completed',
            completed_date: challenge.completed_date
          }
        })
        
        // 统一数据格式
        const formatChallenge = (challenge) => ({
          id: challenge.id,
          name: challenge.name,
          type: challenge.type,
          description: challenge.description,
          icon: challenge.icon,
          duration: challenge.duration,
          reward: {
            points: challenge.reward?.points || challenge.reward_points,
            badge: challenge.reward?.badge || challenge.reward_badge,
            badgeIcon: challenge.reward?.badge_icon || challenge.reward_badge_icon || challenge.reward?.badgeIcon
          },
          requirements: challenge.requirements || []
        })
        
        this.setData({
          activeChallenges: active.map(formatChallenge),
          availableChallenges: available.map(formatChallenge),
          completedChallenges: completed.map(formatChallenge),
          myProgress
        })
      }
    } catch (e) {
      console.error('加载挑战失败', e)
      util.showToast('加载失败，请稍后重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 自动检查进行中的挑战进度
  async autoCheckProgress() {
    const { activeChallenges, myProgress } = this.data
    
    if (activeChallenges.length === 0) return
    
    // 获取上次检查时间，避免频繁检查
    const lastCheckTime = wx.getStorageSync('lastChallengeCheckTime') || 0
    const now = Date.now()
    const checkInterval = 5 * 60 * 1000 // 5分钟检查一次
    
    if (now - lastCheckTime < checkInterval && lastCheckTime > 0) {
      return // 距离上次检查时间太短，跳过
    }
    
    try {
      let hasUpdate = false
      
      // 检查每个进行中的挑战
      for (const challenge of activeChallenges) {
        const progress = myProgress[challenge.id]
        if (progress && progress.progress_id) {
          try {
            const raw = await api.checkChallengeProgress(progress.progress_id)
            const data = this.unwrap(raw)
            if (data) {
              const { completed, status, current_days, progress: progressPercent } = data
              
              // 如果挑战完成，显示奖励动画
              if (completed && status === 'completed') {
                this.showCompletionAnimation(challenge)
                hasUpdate = true
                // 重新加载列表
                setTimeout(() => {
                  this.loadChallenges()
                }, 2000)
              } else {
                // 检查进度是否有变化
                const oldDays = progress.currentDays || 0
                const newDays = current_days || 0
                
                if (newDays > oldDays || progressPercent !== progress.progress) {
                  // 更新进度
                  this.updateProgress(challenge.id, data)
                  hasUpdate = true
                  
                  // 如果进度有显著提升，给用户提示
                  if (newDays > oldDays) {
                    // 静默更新，不打扰用户
                    console.log(`挑战"${challenge.name}"进度更新：${oldDays}天 → ${newDays}天`)
                  }
                }
              }
            }
          } catch (e) {
            console.error(`检查挑战 ${challenge.id} 进度失败`, e)
          }
        }
      }
      
      // 更新最后检查时间
      if (hasUpdate) {
        wx.setStorageSync('lastChallengeCheckTime', now)
      }
    } catch (e) {
      console.error('自动检查进度失败', e)
    }
  },

  // 更新单个挑战的进度
  updateProgress(challengeId, progressData) {
    const { myProgress } = this.data
    if (myProgress[challengeId]) {
      myProgress[challengeId] = {
        ...myProgress[challengeId],
        currentDays: progressData.current_days || myProgress[challengeId].currentDays,
        progress: progressData.progress || myProgress[challengeId].progress,
        status: progressData.status || myProgress[challengeId].status
      }
      this.setData({ myProgress })
    }
  },

  // 显示完成动画
  showCompletionAnimation(challenge) {
    // 显示完成提示
    wx.showModal({
      title: '🎉 挑战完成！',
      content: `恭喜完成挑战"${challenge.name}"！\n\n获得奖励：\n+${challenge.reward.points}积分\n${challenge.reward.badgeIcon} ${challenge.reward.badge}徽章`,
      showCancel: false,
      confirmText: '太棒了！',
      confirmColor: '#FF6B35'
    })
    
    // 发放奖励
    this.grantReward(challenge.reward)
    
    // 触发页面震动（如果支持）
    if (wx.vibrateShort) {
      wx.vibrateShort({
        type: 'heavy'
      })
    }
  },

  // 发放奖励
  grantReward(reward) {
    // 更新积分
    const currentPoints = wx.getStorageSync('userPoints') || 0
    const newPoints = currentPoints + (reward.points || 0)
    wx.setStorageSync('userPoints', newPoints)
    
    // 添加徽章
    const badges = wx.getStorageSync('userBadges') || []
    const badgeName = reward.badge || reward.badgeName
    const badgeIcon = reward.badgeIcon || reward.badge_icon
    
    if (badgeName && !badges.some(b => b.id === badgeName || b.name === badgeName)) {
      badges.push({
        id: badgeName,
        name: badgeName,
        icon: badgeIcon,
        unlockedAt: new Date().toISOString()
      })
      wx.setStorageSync('userBadges', badges)
    }
  },

  // 切换标签
  switchTab(e) {
    const index = e.currentTarget.dataset.index
    if (index !== this.data.currentTab) {
      this.setData({ currentTab: index })
    }
  },

  // 加入挑战
  joinChallenge(e) {
    const challenge = e.currentTarget.dataset.challenge
    this.setData({
      selectedChallenge: challenge,
      showJoinModal: true
    })
  },

  // 确认加入
  async confirmJoin() {
    const { selectedChallenge } = this.data
    if (!selectedChallenge) return
    
    try {
      util.showLoading('加入中...')
      
      // 调用API加入挑战
      const raw = await api.joinChallenge(selectedChallenge.id)
      const data = this.unwrap(raw)
      
      if (data) {
        util.showSuccess('已加入挑战！')
        
        this.setData({
          showJoinModal: false,
          selectedChallenge: null
        })
        
        // 重新加载列表
        await this.loadChallenges()
      }
    } catch (e) {
      console.error('加入挑战失败', e)
      util.showToast(e.message || '加入失败，请稍后重试')
    } finally {
      util.hideLoading()
    }
  },

  // 取消加入
  cancelJoin() {
    this.setData({
      showJoinModal: false,
      selectedChallenge: null
    })
  },

  // 重置挑战（清空本地进度，恢复可加入列表）
  resetChallenges() {
    wx.showModal({
      title: '重置挑战',
      content: '将清空本地挑战进度与完成记录，恢复默认可加入挑战。是否继续？',
      confirmText: '重置',
      confirmColor: '#FF6B35',
      success: async (res) => {
        if (!res.confirm) return
        try {
          wx.removeStorageSync('challengeProgress')
          wx.removeStorageSync('lastChallengeCheckTime')
          util.showSuccess('已重置')
          await this.loadChallenges()
          this.setData({ currentTab: 1 })
        } catch (e) {
          console.error('重置挑战失败', e)
          util.showToast('重置失败，请稍后重试')
        }
      }
    })
  },

  // 查看详情 - 跳转到详情页
  viewDetail(e) {
    const challenge = e.currentTarget.dataset.challenge
    if (!challenge || !challenge.id) return
    
    wx.navigateTo({
      url: `/packageUser/challenge-detail/challenge-detail?id=${challenge.id}`
    })
  },

  // 手动检查进度
  async checkProgress(e) {
    const challenge = e.currentTarget.dataset.challenge
    const progress = this.data.myProgress[challenge.id]
    
    if (!progress || !progress.progress_id) {
      util.showToast('进度信息不存在')
      return
    }
    
    try {
      util.showLoading('检查中...')
      const raw = await api.checkChallengeProgress(progress.progress_id)
      const data = this.unwrap(raw)
      
      if (data) {
        if (data.completed) {
          this.showCompletionAnimation(challenge)
        } else {
          util.showToast(`当前进度：${data.current_days}天`)
        }
        
        // 更新进度并重新加载
        this.updateProgress(challenge.id, data)
        await this.loadChallenges()
      }
    } catch (e) {
      console.error('检查进度失败', e)
      util.showToast('检查失败，请稍后重试')
    } finally {
      util.hideLoading()
    }
  },

  // 退出挑战
  async abandonChallenge(e) {
    const challenge = e.currentTarget.dataset.challenge
    const progress = this.data.myProgress[challenge.id]
    
    if (!progress || !progress.progress_id) {
      util.showToast('进度信息不存在')
      return
    }
    
    wx.showModal({
      title: '确认退出',
      content: `确定要退出挑战"${challenge.name}"吗？退出后进度将无法恢复。`,
      success: async (res) => {
        if (res.confirm) {
          try {
            util.showLoading('退出中...')
            await api.abandonChallenge(progress.progress_id)
            util.showToast('已退出挑战')
            
            // 重新加载列表
            await this.loadChallenges()
          } catch (e) {
            console.error('退出挑战失败', e)
            util.showToast('退出失败，请稍后重试')
          } finally {
            util.hideLoading()
          }
        }
      }
    })
  },

  // 检查提醒设置
  checkReminderSettings() {
    const reminderEnabled = wx.getStorageSync('challengeReminderEnabled')
    if (reminderEnabled !== undefined) {
      this.setData({ reminderEnabled: reminderEnabled !== false })
    }
  },

  // 设置每日提醒
  setupDailyReminder() {
    const { reminderEnabled } = this.data
    if (!reminderEnabled) return

    // 检查今天是否已经提醒过
    const today = new Date().toISOString().split('T')[0]
    const lastReminderDate = wx.getStorageSync('lastChallengeReminderDate')
    
    if (lastReminderDate === today) {
      return // 今天已经提醒过了
    }

    const { activeChallenges } = this.data
    if (activeChallenges.length > 0) {
      // 延迟提醒，避免页面加载时立即弹出
      setTimeout(() => {
        this.showDailyReminder(activeChallenges)
      }, 2000)
    }
  },

  // 显示每日提醒
  showDailyReminder(challenges) {
    const today = new Date().toISOString().split('T')[0]
    
    // 检查是否有需要完成的挑战
    const needAttention = challenges.filter(c => {
      const progress = this.data.myProgress[c.id]
      if (!progress) return false
      
      // 检查今天是否完成
      const daysSinceStart = Math.floor((new Date(today) - new Date(progress.start_date)) / (1000 * 60 * 60 * 24))
      return daysSinceStart >= 0 && daysSinceStart < c.duration
    })

    if (needAttention.length > 0) {
      const challengeNames = needAttention.map(c => c.name).join('、')
      wx.showToast({
        title: `今天还有${needAttention.length}个挑战待完成`,
        icon: 'none',
        duration: 3000
      })
      
      // 记录今天已提醒
      wx.setStorageSync('lastChallengeReminderDate', today)
    }
  },

  // 切换提醒开关
  toggleReminder() {
    const newValue = !this.data.reminderEnabled
    this.setData({ reminderEnabled: newValue })
    wx.setStorageSync('challengeReminderEnabled', newValue)
    
    if (newValue) {
      util.showToast('已开启挑战提醒')
      this.setupDailyReminder()
    } else {
      util.showToast('已关闭挑战提醒')
    }
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  }
})
