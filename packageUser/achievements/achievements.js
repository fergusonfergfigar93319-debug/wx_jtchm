// pages/achievements/achievements.js
const util = require('../../utils/util.js')
const api = require('../../utils/api.js')

Page({
  data: {
    achievements: [],
    unlockedCount: 0,
    totalCount: 0,
    categories: [
      { value: 'all', label: '全部' },
      { value: 'daily', label: '每日' },
      { value: 'weekly', label: '每周' },
      { value: 'monthly', label: '每月' },
      { value: 'special', label: '特殊' }
    ],
    filterCategory: 'all',
    userPoints: 0,
    userLevel: 1
  },

  onLoad() {
    this.loadAchievements()
    this.loadUserStats()
  },

  // 加载成就列表
  async loadAchievements() {
    let allAchievements = []
    try {
      const raw = await api.getAchievements()
      allAchievements = Array.isArray(raw) ? raw : (raw && (raw.items || raw.results)) || []
    } catch (e) {
      console.warn('获取成就列表失败', e)
    }
    const unlocked = wx.getStorageSync('userBadges') || []

    const achievements = allAchievements.map(achievement => {
      const id = achievement.id != null ? achievement.id : achievement.slug
      const unlockedBadge = unlocked.find(b => b.id === id || b.id === achievement.id)
      return {
        ...achievement,
        id,
        unlocked: !!unlockedBadge,
        unlockedAt: unlockedBadge ? unlockedBadge.unlockedAt : null
      }
    })

    const unlockedCount = achievements.filter(a => a.unlocked).length

    this.setData({
      achievements,
      unlockedCount,
      totalCount: achievements.length
    })
  },

  // 加载用户统计
  loadUserStats() {
    const points = wx.getStorageSync('userPoints') || 0
    const level = this.calculateLevel(points)
    
    this.setData({
      userPoints: points,
      userLevel: level
    })
  },

  // 计算等级
  calculateLevel(points) {
    // 每100积分升1级
    return Math.floor(points / 100) + 1
  },

  // 筛选分类
  filterByCategory(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ filterCategory: category })
  },

  // 查看详情
  viewDetail(e) {
    const achievement = e.currentTarget.dataset.achievement
    // 可以跳转到详情页或显示详情弹窗
    if (achievement.unlocked) {
      util.showToast(`已解锁：${achievement.name}`)
    } else {
      util.showToast(`未解锁：${achievement.description}`)
    }
  }
})