const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    date: '',
    isToday: true,
    waterManualMl: 0,
    waterFoodMl: 0,
    waterTotalMl: 0,
    waterGoalMl: 2000,
    waterProgressPct: 0,
    customMl: '',
    events: []
  },

  onLoad(options) {
    const today = util.formatDate(new Date())
    let date = today
    const raw = options && (options.date || '')
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(String(raw).trim())) {
      date = String(raw).trim()
    }
    this.setData({ date })
    this.refresh()
  },

  onShow() {
    this.refresh()
  },

  async refresh() {
    if (this._refreshing) return
    this._refreshing = true
    try {
      const date = this.data.date
      const goal = util.getWaterGoalMl()
      const events = util.getWaterEventsForDate(date).map(it => ({
        ...it,
        timeText: this._formatTime(it.ts),
        sourceLabel: it.source === 'manual_set' ? '手动设置' : '手动添加'
      }))
      const manualMl = util.getWaterManualMlForDate(date)

      let foodMl = 0
      try {
        const report = await api.getReportData(date, date)
        const timeline = (report && report.timeline) ? report.timeline : []
        foodMl = util.estimateFoodWaterMlFromTimeline(timeline)
      } catch (e) {
        foodMl = 0
      }

      const total = Math.min(manualMl + foodMl, goal * 2)
      const today = util.formatDate(new Date())
      const waterProgressPct = goal > 0 ? Math.min(100, Math.round((total / goal) * 1000) / 10) : 0
      this.setData({
        waterGoalMl: goal,
        events,
        waterManualMl: manualMl,
        waterFoodMl: foodMl,
        waterTotalMl: total,
        waterProgressPct,
        isToday: date === today
      })
    } finally {
      this._refreshing = false
    }
  },

  onDateChange(e) {
    const date = e.detail.value
    this.setData({ date })
    this.refresh()
  },

  addWater(e) {
    const ml = Number(e.currentTarget.dataset.ml) || 0
    if (ml <= 0) return
    util.addWaterEventForDate(this.data.date, ml, 'manual')
    this.refresh()
    wx.showToast({ title: `已记录 +${ml} ml`, icon: 'none', duration: 900 })
  },

  onCustomInput(e) {
    this.setData({ customMl: e.detail.value })
  },

  addCustom() {
    const ml = Math.round(parseFloat(this.data.customMl) || 0)
    if (!ml || ml <= 0) {
      wx.showToast({ title: '请输入有效 ml', icon: 'none' })
      return
    }
    if (ml > 2000) {
      wx.showToast({ title: '单次过大，请分次', icon: 'none' })
      return
    }
    util.addWaterEventForDate(this.data.date, ml, 'manual')
    this.setData({ customMl: '' })
    this.refresh()
    wx.showToast({ title: `已记录 +${ml} ml`, icon: 'none', duration: 900 })
  },

  undoLast() {
    const list = util.getWaterEventsForDate(this.data.date)
    if (!list.length) {
      wx.showToast({ title: '暂无可撤销记录', icon: 'none' })
      return
    }
    const next = list.slice(1)
    util.setWaterEventsForDate(this.data.date, next)
    this.refresh()
    wx.showToast({ title: '已撤销上一条', icon: 'none', duration: 900 })
  },

  async clearManual() {
    const today = util.formatDate(new Date())
    const msg =
      this.data.date === today
        ? '确定清空今天所有手动饮水记录吗？'
        : '确定清空该日所有手动饮水记录吗？'
    const ok = await util.showConfirm(msg, '清空记录')
    if (!ok) return
    util.clearWaterEventsForDate(this.data.date)
    util.setWaterManualMlForDate(this.data.date, 0)
    this.refresh()
    wx.showToast({ title: '已清空', icon: 'none', duration: 900 })
  },

  _formatTime(ts) {
    const d = new Date(ts)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }
})

