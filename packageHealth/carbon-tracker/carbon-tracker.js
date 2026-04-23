// pages/carbon-tracker/carbon-tracker.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    // ========== 碳足迹相关 ==========
    // 今日碳足迹数据
    todayCarbon: {
      total: 0, // 总碳足迹（kg CO2e）
      food: 0,  // 食物相关
      transport: 0, // 运输相关
      packaging: 0, // 包装相关
      offset: 0 // 运动抵消（负数表示减少）
    },
    // 本周碳足迹数据
    weeklyCarbon: {
      total: 0,
      avg: 0,
      trend: 'up' // up, down, stable
    },
    // 碳足迹等级
    carbonLevel: 'low', // low, medium, high
    // 日期选择
    selectedDate: '',
    
    // ========== 运动导航相关 ==========
    // 地图相关
    latitude: 39.908823,
    longitude: 116.397470,
    scale: 16,
    markers: [],
    polyline: [],
    // 今日统计
    todayStats: {
      totalDistance: 0,
      totalDuration: 0,
      totalCalories: 0,
      workoutCount: 0,
      carbonOffset: 0 // 碳足迹抵消量（kg CO2e）
    },
    // 显示用的碳抵消值
    carbonOffsetDisplay: '0.00'
  },

  onLoad() {
    const today = new Date()
    const selectedDate = util.formatDate(today)
    this.setData({ selectedDate })
    this.initLocation()
    this.loadAllData()
  },

  onShow() {
    this.loadAllData()
  },

  onUnload() {
    // 无需清理运动状态：本页仅做展示
  },

  onHide() {
    // 无需处理运动状态：本页仅做展示
  },

  onPullDownRefresh() {
    this.loadAllData().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 统一加载碳足迹与运动数据
  async loadAllData() {
    await Promise.all([
      this.loadCarbonData(),
      this.loadTodayStats()
    ])
  },

  // 加载碳足迹数据
  async loadCarbonData() {
    const defaultToday = {
      date: this.data.selectedDate,
      total: 0,
      food: 0,
      transport: 0,
      packaging: 0,
      offset: 0
    }
    const defaultWeekly = {
      total: 0,
      avg: 0,
      trend: 'stable'
    }
    try {
      util.showLoading('加载中...')

      let todayData = defaultToday
      let weeklyData = defaultWeekly
      let carbonOffset = 0

      try {
        todayData = await api.getCarbonFootprint(this.data.selectedDate)
        if (!todayData || typeof todayData.total !== 'number') todayData = { ...defaultToday, ...todayData }
      } catch (e) {
        console.warn('getCarbonFootprint 失败', e)
      }
      try {
        const weekRange = this.getWeekRange(this.data.selectedDate)
        weeklyData = await api.getWeeklyCarbonFootprint(weekRange.start, weekRange.end)
        if (!weeklyData || typeof weeklyData.avg !== 'number') weeklyData = { ...defaultWeekly, ...weeklyData }
      } catch (e) {
        console.warn('getWeeklyCarbonFootprint 失败', e)
      }

      const todayStats = await api.getTodayWorkoutStats().catch(() => ({ totalDistance: 0, totalDuration: 0, totalCalories: 0 }))
      carbonOffset = this.calculateCarbonOffset(todayStats)
      const adjustedTotal = Math.max(0, (todayData.total || 0) - carbonOffset)
      const carbonLevel = this.calculateCarbonLevel(adjustedTotal)

      this.setData({
        todayCarbon: {
          ...todayData,
          offset: -carbonOffset,
          total: adjustedTotal
        },
        weeklyCarbon: weeklyData,
        carbonLevel,
        carbonOffsetDisplay: carbonOffset > 0 ? `-${carbonOffset.toFixed(2)}` : '0.00'
      })
    } catch (error) {
      console.error('加载碳足迹失败', error)
      this.setData({
        todayCarbon: defaultToday,
        weeklyCarbon: defaultWeekly,
        carbonLevel: 'low',
        carbonOffsetDisplay: '0.00'
      })
      util.showToast('加载失败，请下拉重试')
    } finally {
      util.hideLoading()
    }
  },

  // 获取本周日期范围
  getWeekRange(dateStr) {
    const d = new Date(dateStr)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    
    const startDate = new Date(d)
    startDate.setDate(d.getDate() + diff)
    
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6)
    
    return {
      start: util.formatDate(startDate),
      end: util.formatDate(endDate)
    }
  },

  // 计算碳足迹等级
  calculateCarbonLevel(total) {
    // 根据每日碳足迹总量判断等级
    // 低：< 5kg CO2e
    // 中：5-10kg CO2e
    // 高：> 10kg CO2e
    if (total < 5) return 'low'
    if (total < 10) return 'medium'
    return 'high'
  },

  // ========== 运动导航功能 ==========
  // 初始化位置
  initLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude
        })
        this.addCurrentLocationMarker(res.latitude, res.longitude)
      },
      fail: (err) => {
        console.error('获取位置失败', err)
      }
    })
  },

  // 添加当前位置标记
  addCurrentLocationMarker(lat, lng) {
    const markers = [{
      id: 0,
      latitude: lat,
      longitude: lng,
      iconPath: '/images/location.png',
      width: 30,
      height: 30,
      callout: {
        content: '当前位置',
        color: '#333',
        fontSize: 12,
        borderRadius: 4,
        bgColor: '#fff',
        padding: 8,
        display: 'ALWAYS'
      }
    }]
    this.setData({ markers })
  },

  // 加载今日统计
  async loadTodayStats() {
    try {
      const stats = await api.getTodayWorkoutStats()
      const carbonOffset = this.calculateCarbonOffset(stats)
      this.setData({
        todayStats: {
          totalDistance: stats.totalDistance != null ? stats.totalDistance : 0,
          totalDuration: stats.totalDuration != null ? stats.totalDuration : 0,
          totalCalories: stats.totalCalories != null ? stats.totalCalories : 0,
          workoutCount: stats.workoutCount != null ? stats.workoutCount : 0,
          carbonOffset
        }
      })
    } catch (error) {
      console.warn('加载今日统计失败', error)
      this.setData({
        todayStats: {
          totalDistance: 0,
          totalDuration: 0,
          totalCalories: 0,
          workoutCount: 0,
          carbonOffset: 0
        }
      })
    }
  },

  // 计算碳足迹抵消
  calculateCarbonOffset(stats) {
    // 简化计算：根据运动距离和类型计算碳足迹抵消
    // 步行/跑步：每公里约减少0.2kg CO2e（相比开车）
    // 骑行：每公里约减少0.15kg CO2e（相比开车）
    // 这里简化处理，实际应该根据具体运动记录计算
    const offsetPerKm = 0.2
    const totalKm = (stats.totalDistance || 0) / 1000
    return totalKm * offsetPerKm
  },

  // 移动到当前位置
  moveToCurrentLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          scale: 16
        })
        this.addCurrentLocationMarker(res.latitude, res.longitude)
        util.showToast('已定位')
      },
      fail: () => {
        util.showToast('定位失败')
      }
    })
  },

  onMapTap(e) {},

  onMarkerTap(e) {}
  ,

  // 顶部「今日碳足迹」卡片点击
  onTodayCarbonTap() {
    const today = this.data.todayCarbon
    const totalNum = today.total || 0
    const foodNum = today.food || 0
    const transportNum = today.transport || 0
    const packagingNum = today.packaging || 0
    const offset = today.offset || 0

    const total = totalNum.toFixed(2)
    const food = foodNum.toFixed(2)
    const transport = transportNum.toFixed(2)
    const packaging = packagingNum.toFixed(2)
    const sign = offset <= 0 ? '-' : '+'
    const offsetAbs = Math.abs(offset).toFixed(2)

    // 计算百分比，避免使用占位字符导致排版拥挤
    const safeTotal = totalNum > 0 ? totalNum : (foodNum + transportNum + packagingNum || 1)
    const foodPct = Math.round((foodNum / safeTotal) * 100)
    const transportPct = Math.round((transportNum / safeTotal) * 100)
    const packagingPct = Math.round((packagingNum / safeTotal) * 100)

    wx.showModal({
      title: '今日碳足迹详情',
      content: [
        `总计：${total} kg CO₂e`,
        '',
        '来源占比',
        `· 食物：${food} kg（约 ${foodPct}%）`,
        `· 运输：${transport} kg（约 ${transportPct}%）`,
        `· 包装：${packaging} kg（约 ${packagingPct}%）`,
        '',
        '运动影响',
        `· 运动抵消：${sign}${offsetAbs} kg`
      ].join('\n'),
      showCancel: false
    })
  },

  // 「本周平均」卡片点击
  onWeekCarbonTap() {
    const week = this.data.weeklyCarbon
    const arrow = week.trend === 'down' ? '下降' : week.trend === 'up' ? '上升' : '持平'
    wx.showModal({
      title: '本周碳足迹',
      content: [
        `本周平均：${(week.avg || 0).toFixed(2)} kg CO₂e / 天`,
        `本周总计：${(week.total || 0).toFixed(2)} kg`,
        '',
        `相较于上周：${arrow}`
      ].join('\n'),
      showCancel: false
    })
  },

  // 「今日运动」卡片点击
  onTodayWorkoutCardTap() {
    const stats = this.data.todayStats
    const distanceStr = this.data.utils
      ? this.data.utils.formatDistance(stats.totalDistance || 0)
      : this.formatDistance(stats.totalDistance || 0)
    const durationStr = this.data.utils
      ? this.data.utils.formatDuration(stats.totalDuration || 0)
      : this.formatDuration(stats.totalDuration || 0)

    wx.showModal({
      title: '今日运动统计',
      content: [
        `总距离：${distanceStr}`,
        `总时长：${durationStr}`,
        `消耗能量：${(stats.totalCalories || 0).toFixed(0)} kcal`,
        '',
        '对碳足迹的影响',
        `· 预计抵消：${(stats.carbonOffset || 0).toFixed(2)} kg CO₂e`
      ].join('\n'),
      showCancel: false
    })
  },
})
