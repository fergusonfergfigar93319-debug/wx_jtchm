// pages/map-run/map-run.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    // 地图相关
    latitude: 39.908823,
    longitude: 116.397470,
    scale: 16,
    markers: [],
    polyline: [],
    // 运动状态
    isRunning: false,
    isPaused: false,
    // 运动数据
    currentWorkout: {
      type: 'running', // running, walking, cycling
      distance: 0, // 距离（米）
      duration: 0, // 持续时间（秒）
      calories: 0, // 消耗卡路里
      speed: 0, // 平均速度（km/h）
      pace: 0, // 配速（分钟/公里）
      startTime: null,
      pauseTime: 0, // 暂停累计时间
      lastPauseTime: null
    },
    // 轨迹点
    trackPoints: [],
    // 运动类型选项
    workoutTypes: [
      { value: 'running', label: '跑步', icon: '🏃', color: '#FF5252' },
      { value: 'walking', label: '步行', icon: '🚶', color: '#4CAF50' },
      { value: 'cycling', icon: '🚴', label: '骑行', color: '#2196F3' }
    ],
    // 运动历史
    workoutHistory: [],
    // 今日统计
    todayStats: {
      totalDistance: 0,
      totalDuration: 0,
      totalCalories: 0,
      workoutCount: 0
    },
    // 定时器
    timer: null,
    // 位置监听器
    locationListener: null
  },

  onLoad() {
    this.initLocation()
    this.loadTodayStats()
    this.loadWorkoutHistory()
  },

  onUnload() {
    this.stopWorkout()
    this.clearTimer()
  },

  onHide() {
    // 页面隐藏时暂停运动（如果正在运动）
    if (this.data.isRunning && !this.data.isPaused) {
      this.pauseWorkout()
    }
  },

  onShow() {
    // 页面显示时恢复运动（如果之前暂停了）
    if (this.data.isRunning && this.data.isPaused) {
      this.resumeWorkout()
    }
  },

  // 初始化位置
  initLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude
        })
        // 添加当前位置标记
        this.addCurrentLocationMarker(res.latitude, res.longitude)
      },
      fail: (err) => {
        console.error('获取位置失败', err)
        util.showToast('获取位置失败，请检查定位权限')
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

  // 开始运动
  startWorkout() {
    if (this.data.isRunning) {
      return
    }

    // 请求位置权限
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.userLocation']) {
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => {
              this.doStartWorkout()
            },
            fail: () => {
              util.showToast('需要位置权限才能记录运动轨迹')
            }
          })
        } else {
          this.doStartWorkout()
        }
      }
    })
  },

  // 执行开始运动
  doStartWorkout() {
    const startTime = Date.now()
    const firstPoint = {
      latitude: this.data.latitude,
      longitude: this.data.longitude,
      timestamp: startTime
    }

    this.setData({
      isRunning: true,
      isPaused: false,
      'currentWorkout.startTime': startTime,
      'currentWorkout.distance': 0,
      'currentWorkout.duration': 0,
      'currentWorkout.calories': 0,
      'currentWorkout.speed': 0,
      'currentWorkout.pace': 0,
      'currentWorkout.pauseTime': 0,
      trackPoints: [firstPoint]
    })

    // 开始监听位置变化
    this.startLocationListener()
    // 开始计时器
    this.startTimer()
    
    util.showSuccess('运动已开始')
  },

  // 暂停运动
  pauseWorkout() {
    if (!this.data.isRunning || this.data.isPaused) {
      return
    }

    const pauseTime = Date.now()
    this.setData({
      isPaused: true,
      'currentWorkout.lastPauseTime': pauseTime
    })

    this.stopLocationListener()
    this.clearTimer()
    
    util.showToast('运动已暂停', 'none')
  },

  // 恢复运动
  resumeWorkout() {
    if (!this.data.isRunning || !this.data.isPaused) {
      return
    }

    const resumeTime = Date.now()
    const pauseDuration = resumeTime - this.data.currentWorkout.lastPauseTime
    const totalPauseTime = this.data.currentWorkout.pauseTime + pauseDuration

    this.setData({
      isPaused: false,
      'currentWorkout.pauseTime': totalPauseTime,
      'currentWorkout.lastPauseTime': null
    })

    this.startLocationListener()
    this.startTimer()
    
    util.showToast('运动已恢复', 'none')
  },

  // 结束运动
  async stopWorkout() {
    if (!this.data.isRunning) {
      return
    }

    wx.showModal({
      title: '结束运动',
      content: `本次运动：${(this.data.currentWorkout.distance / 1000).toFixed(2)}km，消耗${this.data.currentWorkout.calories.toFixed(0)}kcal`,
      confirmText: '保存',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          await this.saveWorkout()
        }
        this.resetWorkout()
      }
    })
  },

  // 保存运动记录
  async saveWorkout() {
    try {
      const workoutData = {
        type: this.data.currentWorkout.type,
        distance: this.data.currentWorkout.distance,
        duration: this.data.currentWorkout.duration,
        calories: this.data.currentWorkout.calories,
        speed: this.data.currentWorkout.speed,
        pace: this.data.currentWorkout.pace,
        track_points: this.data.trackPoints,
        start_time: this.data.currentWorkout.startTime
      }

      await api.saveWorkout(workoutData)
      util.showSuccess('运动记录已保存')
      
      // 刷新统计数据
      this.loadTodayStats()
      this.loadWorkoutHistory()
    } catch (error) {
      console.error('保存运动记录失败', error)
      util.showToast('保存失败，请重试')
    }
  },

  // 重置运动
  resetWorkout() {
    this.stopLocationListener()
    this.clearTimer()
    
    this.setData({
      isRunning: false,
      isPaused: false,
      'currentWorkout.distance': 0,
      'currentWorkout.duration': 0,
      'currentWorkout.calories': 0,
      'currentWorkout.speed': 0,
      'currentWorkout.pace': 0,
      'currentWorkout.startTime': null,
      'currentWorkout.pauseTime': 0,
      'currentWorkout.lastPauseTime': null,
      trackPoints: [],
      polyline: []
    })
  },

  // 开始位置监听
  startLocationListener() {
    this.data.locationListener = setInterval(() => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          this.updateLocation(res.latitude, res.longitude)
        },
        fail: (err) => {
          console.error('获取位置失败', err)
        }
      })
    }, 3000) // 每3秒更新一次位置
  },

  // 停止位置监听
  stopLocationListener() {
    if (this.data.locationListener) {
      clearInterval(this.data.locationListener)
      this.data.locationListener = null
    }
  },

  // 更新位置
  updateLocation(lat, lng) {
    if (!this.data.isRunning || this.data.isPaused) {
      return
    }

    const trackPoints = this.data.trackPoints
    if (trackPoints.length > 0) {
      const lastPoint = trackPoints[trackPoints.length - 1]
      const distance = this.calculateDistance(
        lastPoint.latitude,
        lastPoint.longitude,
        lat,
        lng
      )
      
      // 更新总距离
      const newDistance = this.data.currentWorkout.distance + distance
      
      // 计算卡路里（根据运动类型和距离）
      const calories = this.calculateCalories(
        this.data.currentWorkout.type,
        newDistance,
        this.data.currentWorkout.duration
      )
      
      // 计算速度和配速
      const speed = this.calculateSpeed(newDistance, this.data.currentWorkout.duration)
      const pace = this.calculatePace(speed)

      this.setData({
        latitude: lat,
        longitude: lng,
        'currentWorkout.distance': newDistance,
        'currentWorkout.calories': calories,
        'currentWorkout.speed': speed,
        'currentWorkout.pace': pace
      })
    }

    // 添加新的轨迹点
    const newPoint = {
      latitude: lat,
      longitude: lng,
      timestamp: Date.now()
    }
    
    const updatedPoints = [...trackPoints, newPoint]
    this.setData({ trackPoints: updatedPoints })
    
    // 更新轨迹线
    this.updatePolyline(updatedPoints)
  },

  // 更新轨迹线
  updatePolyline(points) {
    if (points.length < 2) {
      return
    }

    const polyline = [{
      points: points.map(p => ({
        latitude: p.latitude,
        longitude: p.longitude
      })),
      color: this.getWorkoutTypeColor(),
      width: 6,
      arrowLine: true
    }]

    this.setData({ polyline })
  },

  // 开始计时器
  startTimer() {
    this.clearTimer()
    
    this.data.timer = setInterval(() => {
      if (!this.data.isPaused) {
        const now = Date.now()
        const startTime = this.data.currentWorkout.startTime
        const pauseTime = this.data.currentWorkout.pauseTime
        const duration = Math.floor((now - startTime - pauseTime) / 1000)

        // 更新速度和配速
        const distance = this.data.currentWorkout.distance
        const speed = this.calculateSpeed(distance, duration)
        const pace = this.calculatePace(speed)
        const calories = this.calculateCalories(
          this.data.currentWorkout.type,
          distance,
          duration
        )

        this.setData({
          'currentWorkout.duration': duration,
          'currentWorkout.speed': speed,
          'currentWorkout.pace': pace,
          'currentWorkout.calories': calories
        })
      }
    }, 1000)
  },

  // 清除计时器
  clearTimer() {
    if (this.data.timer) {
      clearInterval(this.data.timer)
      this.data.timer = null
    }
  },

  // 计算两点间距离（米）
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000 // 地球半径（米）
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  },

  // 计算速度（km/h）
  calculateSpeed(distance, duration) {
    if (duration === 0) return 0
    const distanceKm = distance / 1000
    const durationHours = duration / 3600
    return durationHours > 0 ? distanceKm / durationHours : 0
  },

  // 计算配速（分钟/公里）
  calculatePace(speed) {
    if (speed === 0) return 0
    return 60 / speed
  },

  // 计算卡路里
  calculateCalories(type, distance, duration) {
    // 基础代谢系数（kcal/kg/km）
    const baseFactors = {
      running: 1.0,
      walking: 0.5,
      cycling: 0.3
    }
    
    const factor = baseFactors[type] || 0.5
    // 假设平均体重70kg
    const weight = 70
    const distanceKm = distance / 1000
    
    return Math.round(factor * weight * distanceKm)
  },

  // 获取运动类型颜色
  getWorkoutTypeColor() {
    const type = this.data.workoutTypes.find(t => t.value === this.data.currentWorkout.type)
    return type ? type.color : '#6BCB77'
  },

  // 切换运动类型
  changeWorkoutType(e) {
    const type = e.currentTarget.dataset.type
    if (this.data.isRunning) {
      util.showToast('运动进行中，无法切换类型')
      return
    }
    this.setData({
      'currentWorkout.type': type
    })
  },

  // 格式化时间
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`
  },

  // 格式化距离
  formatDistance(meters) {
    if (meters < 1000) {
      return `${Math.round(meters)}m`
    }
    return `${(meters / 1000).toFixed(2)}km`
  },

  // 加载今日统计
  async loadTodayStats() {
    try {
      const stats = await api.getTodayWorkoutStats()
      this.setData({ todayStats: stats })
    } catch (error) {
      console.error('加载今日统计失败', error)
    }
  },

  // 加载运动历史
  async loadWorkoutHistory() {
    try {
      const history = await api.getWorkoutHistory()
      const items = history.items || history || []
      // 处理日期格式
      items.forEach(item => {
        item.date = item.date || item.start_time?.split(' ')[0] || new Date().toISOString().split('T')[0]
      })
      this.setData({ workoutHistory: items })
    } catch (error) {
      console.error('加载运动历史失败', error)
    }
  },

  // 查看历史详情
  viewHistoryDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/packageHealth/map-run/history-detail?id=${id}`
    })
  },

  // 地图控件点击事件
  onMapTap(e) {
    // 可以添加点击地图的功能
  },

  // 地图标记点击事件
  onMarkerTap(e) {
    const markerId = e.detail.markerId
    // 处理标记点击
  }
})
