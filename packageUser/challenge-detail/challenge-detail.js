// pages/challenge-detail/challenge-detail.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    challengeId: null,
    challenge: null,
    myProgress: null,
    loading: true,
    showJoinModal: false
  },

  // 兼容：后端直返 data 或旧结构 { data: ... }
  unwrap(res) {
    if (!res) return null
    return res.data !== undefined ? res.data : res
  },

  onLoad(options) {
    const challengeId = options.id
    if (!challengeId) {
      util.showToast('挑战ID不存在')
      wx.navigateBack()
      return
    }
    
    this.setData({ challengeId })
    this.loadChallengeDetail()
  },

  onShow() {
    // 每次显示时刷新进度
    if (this.data.challengeId) {
      this.loadChallengeDetail()
    }
  },

  // 加载挑战详情
  async loadChallengeDetail() {
    try {
      this.setData({ loading: true })
      
      const raw = await api.getChallengeDetail(this.data.challengeId)
      const challenge = this.unwrap(raw)
      
      if (challenge) {
        // 统一数据格式
        const formattedChallenge = {
          id: challenge.id,
          name: challenge.name,
          type: challenge.type,
          description: challenge.description,
          icon: challenge.icon,
          duration: challenge.duration,
          difficulty: challenge.difficulty || '',
          tags: challenge.tags || [],
          estimatedDailyMinutes: challenge.estimated_daily_minutes ?? challenge.estimatedDailyMinutes ?? null,
          suitableFor: challenge.suitable_for || challenge.suitableFor || [],
          highlights: challenge.highlights || [],
          rules: challenge.rules || [],
          tips: challenge.tips || [],
          samplePlan: challenge.sample_plan || challenge.samplePlan || [],
          faq: challenge.faq || [],
          reward: {
            points: challenge.reward?.points || challenge.reward_points,
            badge: challenge.reward?.badge || challenge.reward_badge,
            badgeIcon: challenge.reward?.badge_icon || challenge.reward?.badgeIcon
          },
          requirements: challenge.requirements || []
        }
        
        this.setData({
          challenge: formattedChallenge,
          myProgress: challenge.my_progress || null
        })
        
        // 如果有进行中的进度，自动检查
        if (challenge.my_progress && challenge.my_progress.status === 'active') {
          this.autoCheckProgress()
        }
      }
    } catch (e) {
      console.error('加载挑战详情失败', e)
      util.showToast('加载失败，请稍后重试')
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 自动检查进度
  async autoCheckProgress() {
    if (!this.data.myProgress || !this.data.myProgress.progress_id) return
    
    try {
      const raw = await api.checkChallengeProgress(this.data.myProgress.progress_id)
      const data = this.unwrap(raw)
      if (data) {
        const { completed, status } = data
        
        if (completed && status === 'completed') {
          this.showCompletionAnimation()
          // 重新加载详情
          setTimeout(() => {
            this.loadChallengeDetail()
          }, 2000)
        } else {
          // 更新进度
          this.setData({
            'myProgress.current_days': data.current_days,
            'myProgress.progress': data.progress,
            'myProgress.status': data.status
          })
        }
      }
    } catch (e) {
      console.error('检查进度失败', e)
    }
  },

  // 显示完成动画
  showCompletionAnimation() {
    const challenge = this.data.challenge
    const reward = challenge.reward
    
    // 显示完成提示
    wx.showModal({
      title: '🎉 挑战完成！',
      content: `恭喜完成挑战"${challenge.name}"！\n\n获得奖励：\n+${reward.points}积分\n${reward.badgeIcon} ${reward.badge}徽章`,
      showCancel: false,
      confirmText: '太棒了！',
      confirmColor: '#FF6B35',
      success: () => {
        // 发放奖励
        if (reward) {
          // 更新积分
          const currentPoints = wx.getStorageSync('userPoints') || 0
          const newPoints = currentPoints + (reward.points || 0)
          wx.setStorageSync('userPoints', newPoints)
          
          // 添加徽章
          const badges = wx.getStorageSync('userBadges') || []
          const badgeName = reward.badge
          const badgeIcon = reward.badgeIcon
          
          if (badgeName && !badges.some(b => b.id === badgeName || b.name === badgeName)) {
            badges.push({
              id: badgeName,
              name: badgeName,
              icon: badgeIcon,
              unlockedAt: new Date().toISOString()
            })
            wx.setStorageSync('userBadges', badges)
          }
        }
      }
    })
    
    // 触发页面震动（如果支持）
    if (wx.vibrateShort) {
      wx.vibrateShort({
        type: 'heavy'
      })
    }
  },

  // 加入挑战
  async joinChallenge() {
    try {
      util.showLoading('加入中...')
      
      const raw = await api.joinChallenge(this.data.challengeId)
      const data = this.unwrap(raw)
      
      if (data) {
        util.showSuccess('已加入挑战！')
        
        // 重新加载详情
        await this.loadChallengeDetail()
      }
    } catch (e) {
      console.error('加入挑战失败', e)
      util.showToast(e.message || '加入失败，请稍后重试')
    } finally {
      util.hideLoading()
    }
  },

  // 手动检查进度
  async checkProgress() {
    if (!this.data.myProgress || !this.data.myProgress.progress_id) {
      util.showToast('进度信息不存在')
      return
    }
    
    try {
      util.showLoading('检查中...')
      const raw = await api.checkChallengeProgress(this.data.myProgress.progress_id)
      const data = this.unwrap(raw)
      
      if (data) {
        if (data.completed) {
          this.showCompletionAnimation()
        } else {
          util.showToast(`当前进度：${data.current_days}天`)
        }
        
        // 更新进度并重新加载
        this.setData({
          'myProgress.current_days': data.current_days,
          'myProgress.progress': data.progress,
          'myProgress.status': data.status
        })
        
        await this.loadChallengeDetail()
      }
    } catch (e) {
      console.error('检查进度失败', e)
      util.showToast('检查失败，请稍后重试')
    } finally {
      util.hideLoading()
    }
  },

  // 退出挑战
  abandonChallenge() {
    if (!this.data.myProgress || !this.data.myProgress.progress_id) {
      util.showToast('进度信息不存在')
      return
    }
    
    wx.showModal({
      title: '确认退出',
      content: `确定要退出挑战"${this.data.challenge.name}"吗？退出后进度将无法恢复。`,
      success: async (res) => {
        if (res.confirm) {
          try {
            util.showLoading('退出中...')
            await api.abandonChallenge(this.data.myProgress.progress_id)
            util.showToast('已退出挑战')
            
            // 返回上一页
            setTimeout(() => {
              wx.navigateBack()
            }, 1500)
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

  // 格式化日期
  formatDate(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}月${day}日`
  },

  // 获取完成条件文本
  getRequirementText(requirement) {
    if (requirement.type === 'consecutive_days') {
      return `连续${requirement.target}天`
    } else if (requirement.type === 'daily_calories') {
      if (requirement.max) {
        return `每日卡路里不超过${requirement.target}kcal`
      } else {
        return `每日卡路里达到${requirement.target}kcal`
      }
    } else if (requirement.type === 'daily_protein') {
      return `每日蛋白质≥${requirement.target}g`
    } else if (requirement.type === 'vegetable_variety') {
      return `摄入${requirement.target}种不同颜色蔬菜`
    }
    return '完成挑战条件'
  }
})
