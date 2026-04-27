// pages/report/report.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')
const { isDevChannelToken } = require('../../utils/config.js')
const { getWindowMetricsSafe } = require('../../utils/platform.js')
const { getCustomNavBarMetrics } = require('../../utils/custom-nav.js')

Page({
  data: {
    selectedDate: '',
    calendarDays: [],
    viewMode: 'day', // day, week, month
    scrollLeft: 0,
    dailyData: {
      consumed: 0,
      target: 2000,
      carb: 0,
      protein: 0,
      fat: 0
    },
    timeline: [],
    progressPercent: 0,
    remainingCalories: 2000,
    carbPercent: 0,
    proteinPercent: 0,
    fatPercent: 0,
    // 营养素口径（本日/近7天/近30天）与交互态
    nutrientScope: 'day', // day | 7d | 30d
    nutrientDisplay: { carb: 0, protein: 0, fat: 0 },
    nutrientPercents: { carb: 0, protein: 0, fat: 0 },
    selectedNutrientType: '',
    nutrientHighlight: '', // '碳水' | '蛋白质' | '脂肪'
    showNutrientDetail: false,
    nutrientDetail: {
      title: '',
      scopeLabel: '',
      grams: 0,
      percent: 0,
      kcal: 0,
      rangeText: '',
      levelLabel: '',
      tip: ''
    },
    // 今日运动 / 碳足迹简要统计，用于「健康管理」总览卡片
    todayWorkoutStats: {
      totalDistance: 0,
      totalDuration: 0,
      totalCalories: 0,
      workoutCount: 0,
      carbonOffset: 0
    },
    todayCarbonBrief: {
      total: 0
    },
    // 饮水（与首页联动，按日期读取；单位 ml；含食物水分）
    todayWater: 0,
    waterGoal: 2000,
    waterDateToday: '', // 当天日期 YYYY-MM-DD，用于判断是否显示「去首页记录」
    mealTypeLabels: {
      breakfast: '早餐',
      lunch: '午餐',
      afternoon_tea: '下午茶',
      dinner: '晚餐',
      snack: '夜宵'
    },
    // 餐次时间段配置（可自定义）
    mealTimeRanges: {
      breakfast: { start: 6, end: 11 },
      lunch: { start: 11, end: 14 },
      afternoon_tea: { start: 14, end: 17 },
      dinner: { start: 17, end: 20 },
      snack: { start: 20, end: 6 } // 跨天处理
    },
    // 分组后的时间轴数据
    groupedTimeline: [],
    // 周报数据
    weeklyData: {
      total_consumed: 0,
      avg_daily_consumed: 0,
      max_calorie_item: null,
      min_calorie_item: null,
      weekStart: '',
      weekEnd: ''
    },
    // 历史趋势数据
    historyData: [],
    // 周报时间段
    weekStartDate: '',
    weekEndDate: '',
    // Canvas 显式尺寸（px），不设置则图表不显示
    canvasWidth: 600,
    canvasHeight: 300,
    canvasNutrientWidth: 400,
    canvasNutrientHeight: 200,
    // AI 营养师
    aiSummary: null,
    healthWarnings: [],
    // 周报/月报 Bento + CSS 柱状图
    reportDateRangeLabel: '',
    barChartDays: [],
    reportTargetLineBottom: 70,
    reportAvgDailyKcal: 0,
    reportTrendTagClass: 'neutral',
    reportTrendTagText: '',
    bentoPerfectDays: 0,
    bentoSecondaryValue: 0,
    bentoSecondaryUnit: '条',
    bentoSecondaryLabel: '饮食记录',
    macroWeekModel: {
      proteinAvg: 0,
      carbAvg: 0,
      fatAvg: 0,
      proteinPct: 0,
      carbPct: 0,
      fatPct: 0
    },
    weekInsightSpans: [],
    reportDailyTarget: 2000,
    /** 后端 LLM 返回的洞察动作（buttonText / aiPrompt），无则走默认文案 */
    reportInsightAction: null,
    reportInsightButtonLabel: '定制下周食谱 ›',
    navScrolled: false,
    navTopPx: 0
  },

  onPageScroll(e) {
    const top = (e && e.scrollTop) || 0
    const next = top > 20
    if (next !== this.data.navScrolled) {
      this.setData({ navScrolled: next })
    }
  },

  onLoad() {
    const m = getCustomNavBarMetrics()
    const today = new Date()
    const selectedDate = util.formatDate(today)
    this.setData({ selectedDate, waterDateToday: selectedDate, navTopPx: m.total })
    // 避免 onLoad 与紧随其后的 onShow 各拉一次报表导致 showLoading 不配对
    this._skipReportShowOnce = true
    this.initCalendar()
    this.loadReportData()
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar && typeof tabBar.setSelected === 'function') tabBar.setSelected(2)
    if (this._skipReportShowOnce) {
      this._skipReportShowOnce = false
      return
    }
    // 每次显示时刷新，根据当前视图模式加载数据
    if (this.data.viewMode === 'day') {
      this.loadReportData()
    } else if (this.data.viewMode === 'week') {
      this.loadWeeklyReport()
    } else if (this.data.viewMode === 'month') {
      this.loadMonthlyReport()
    }
  },

  // 初始化日历（月报日历）
  async initCalendar() {
    const app = getApp()
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    const selectedDate = util.formatDate(today)

    if (isDevChannelToken(app.globalData.accessToken)) {
      const days = this.generateMonthCalendar(year, month, null)
      this.setData({
        calendarDays: days,
        selectedDate,
        currentYear: year,
        currentMonth: month
      })
      return
    }

    // 调用后端接口获取月报日历数据
    try {
      const calendarData = await api.getMonthlyCalendar(year, month)
      
      // 生成当月日历
      const days = this.generateMonthCalendar(year, month, calendarData)
      
      this.setData({
        calendarDays: days,
        selectedDate,
        currentYear: year,
        currentMonth: month
      })
    } catch (error) {
      console.error('加载日历失败', error)
      // 如果接口失败，使用默认日历
      const days = this.generateMonthCalendar(year, month, null)
      this.setData({
        calendarDays: days,
        selectedDate,
        currentYear: year,
        currentMonth: month
      })
    }
  },
  
  // 生成月报日历
  generateMonthCalendar(year, month, calendarData) {
    const days = []
    const today = new Date()
    const todayStr = util.formatDate(today)
    
    // 获取当月第一天和最后一天
    const firstDay = new Date(year, month - 1, 1)
    const lastDay = new Date(year, month, 0)
    const firstDayWeek = firstDay.getDay() // 0-6，0是周日
    const daysInMonth = lastDay.getDate()
    
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    
    // 填充上个月的日期（空白）
    for (let i = 0; i < firstDayWeek; i++) {
      days.push({
        date: '',
        day: '',
        week: weekDays[i],
        isToday: false,
        status: 'none',
        isEmpty: true
      })
    }
    
    // 填充当月的日期
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day)
      const dateStr = util.formatDate(date)
      const isToday = dateStr === todayStr
      
      // 从后端数据中获取状态
      let status = 'none'
      if (calendarData && calendarData.days) {
        const dayData = calendarData.days.find(d => d.date === dateStr)
        if (dayData) {
          // 根据文档：perfect=绿, exceeded=红, insufficient=黄, none=灰
          status = dayData.status || 'none'
        }
      }
      
      days.push({
        date: dateStr,
        day: day,
        week: weekDays[date.getDay()],
        isToday: isToday,
        status: status,
        isEmpty: false,
        weekend: date.getDay() === 0 || date.getDay() === 6
      })
    }
    
    return days
  },

  // 选择日期
  selectDate(e) {
    const date = e.currentTarget.dataset.date
    this.setData({ selectedDate: date })
    this.loadReportData()
  },

  // 切换视图模式
  switchView(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ viewMode: mode })
    
    // 根据模式加载不同数据
    if (mode === 'day') {
      this.loadReportData()
    } else if (mode === 'week') {
      this.loadWeeklyReport()
    } else if (mode === 'month') {
      this.initCalendar()
      this.loadMonthlyReport()
    }
  },

  /** 携带后端/默认 aiPrompt 跳转 AI 对话并自动发送 */
  openReportInsightPlan() {
    const a = this.data.reportInsightAction
    const q =
      (a && a.aiPrompt && String(a.aiPrompt).trim()) ||
      '帮我根据当前健康报告（周报/月报）制定下一阶段的饮食计划，并给出可执行清单。'
    wx.navigateTo({
      url: `/packageAI/ai-chat/ai-chat?from=report&prompt=${encodeURIComponent(q)}`
    })
  },

  _pad2(n) {
    return String(n).padStart(2, '0')
  },

  _macrosFromKcal(dailyKcal, goalType) {
    const kcal = Number(dailyKcal) || 2000
    let carbP = 0.5
    let proteinP = 0.25
    let fatP = 0.25
    if (goalType === 'lose') {
      carbP = 0.4
      proteinP = 0.35
      fatP = 0.25
    } else if (goalType === 'gain') {
      carbP = 0.5
      proteinP = 0.3
      fatP = 0.2
    }
    return {
      carb: Math.round((kcal * carbP) / 4),
      protein: Math.round((kcal * proteinP) / 4),
      fat: Math.round((kcal * fatP) / 9)
    }
  },

  _formatCnRange(startStr, endStr) {
    try {
      const a = new Date(startStr)
      const b = new Date(endStr)
      return `${a.getMonth() + 1}月${a.getDate()}日 - ${b.getMonth() + 1}月${b.getDate()}日`
    } catch (e) {
      return ''
    }
  },

  /**
   * 由时间轴聚合柱状图数据；mode=week 为每日 7 根；mode=month 为约 4 段
   */
  _buildBarChartDays(mode, rangeStart, rangeEnd, timeline, dailyTarget) {
    const target = Math.max(1, Number(dailyTarget) || 2000)
    const todayStr = util.formatDate(new Date())
    const kcalByDate = {}
    ;(timeline || []).forEach((r) => {
      const d = r.date || r.log_date || ''
      if (!d) return
      const k = Number(r.calories != null ? r.calories : r.kcal) || 0
      kcalByDate[d] = (kcalByDate[d] || 0) + k
    })

    const labelsWeek = ['一', '二', '三', '四', '五', '六', '日']
    const result = []

    if (mode === 'week') {
      const start = new Date(rangeStart)
      for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        const ds = util.formatDate(d)
        const kcal = kcalByDate[ds] || 0
        result.push({
          day: labelsWeek[i],
          date: ds,
          kcal,
          rawPct: 0,
          percent: 0,
          isOver: kcal > target * 1.05,
          isToday: ds === todayStr
        })
      }
    } else {
      const start = new Date(rangeStart)
      const end = new Date(rangeEnd)
      const totalDays =
        Math.max(1, Math.round((end - start) / (86400000)) + 1)
      const bucketCount = Math.min(4, Math.max(1, Math.ceil(totalDays / 7)))
      const daysPer = Math.ceil(totalDays / bucketCount)
      for (let b = 0; b < bucketCount; b++) {
        let sum = 0
        for (let j = 0; j < daysPer; j++) {
          const idx = b * daysPer + j
          if (idx >= totalDays) break
          const d = new Date(start)
          d.setDate(start.getDate() + idx)
          const ds = util.formatDate(d)
          sum += kcalByDate[ds] || 0
        }
        const label = bucketCount === 4 ? `${b + 1} 段` : `${b + 1}`
        result.push({
          day: label,
          date: '',
          kcal: sum,
          rawPct: 0,
          percent: 0,
          isOver: sum > target * daysPer * 1.05,
          isToday: false
        })
      }
    }

    const maxKcal = Math.max(target, ...result.map((x) => x.kcal), 1)
    result.forEach((row) => {
      row.rawPct = Math.round((row.kcal / maxKcal) * 100)
      row.percent = Math.min(118, Math.max(4, row.rawPct))
    })
    const linePct = Math.round((target / maxKcal) * 100)
    return { rows: result, targetLineBottom: Math.min(92, Math.max(18, linePct)) }
  },

  _macroModelFromTimeline(timeline, daysInPeriod, macroTargets) {
    let carb = 0
    let protein = 0
    let fat = 0
    ;(timeline || []).forEach((r) => {
      carb += parseFloat(r.carbs != null ? r.carbs : r.carb) || 0
      protein += parseFloat(r.protein) || 0
      fat += parseFloat(r.fat) || 0
    })
    const div = Math.max(1, Number(daysInPeriod) || 7)
    const carbAvg = Math.round((carb / div) * 10) / 10
    const proteinAvg = Math.round((protein / div) * 10) / 10
    const fatAvg = Math.round((fat / div) * 10) / 10
    const mt = macroTargets || { carb: 1, protein: 1, fat: 1 }
    const pct = (avg, g) => (g > 0 ? Math.min(100, Math.round((avg / g) * 100)) : 0)
    return {
      proteinAvg,
      carbAvg,
      fatAvg,
      proteinPct: pct(proteinAvg, mt.protein),
      carbPct: pct(carbAvg, mt.carb),
      fatPct: pct(fatAvg, mt.fat)
    }
  },

  _buildWeekInsightSpans(mode, barRows, macroModel, avgKcal, target, recordCount) {
    const spans = []
    const H = 'highlight-report'
    const W = 'warning-report'
    const t = Math.round(target) || 2000
    const a = Math.round(avgKcal) || 0
    if (mode === 'week') {
      spans.push({ t: '本周日均摄入约 ', spanClass: '' })
      spans.push({ t: `${a}`, spanClass: H })
      spans.push({ t: ` kcal，目标约 ${t} kcal。`, spanClass: '' })
    } else {
      spans.push({ t: '本月统计周期内，日均摄入约 ', spanClass: '' })
      spans.push({ t: `${a}`, spanClass: H })
      spans.push({ t: ` kcal。`, spanClass: '' })
    }

    const overDays = (barRows || []).filter((x) => x.isOver)
    if (overDays.length > 0) {
      spans.push({
        t: ` 其中 ${overDays.map((d) => d.day).join('、')} 热量偏高，可适当控制晚餐与加餐。`,
        spanClass: W
      })
    }

    const { proteinPct, carbPct, fatPct } = macroModel || {}
    let best = '蛋白质'
    let bestV = proteinPct || 0
    if ((carbPct || 0) >= bestV) {
      best = '碳水'
      bestV = carbPct
    }
    if ((fatPct || 0) >= bestV) {
      best = '脂肪'
      bestV = fatPct
    }
    if (bestV >= 75) {
      spans.push({ t: `${best}摄入相对充足`, spanClass: H })
      spans.push({ t: '，结构整体可接受。', spanClass: '' })
    } else if (bestV <= 50) {
      spans.push({ t: `建议关注${best}是否偏低，`, spanClass: '' })
      spans.push({ t: '优先天然食材补齐。', spanClass: H })
    } else {
      spans.push({ t: '营养素达标率尚可，', spanClass: '' })
      spans.push({ t: '建议保持多样化搭配。', spanClass: H })
    }

    if (recordCount > 0) {
      spans.push({ t: ` 已记录 ${recordCount} 条饮食，数据越全洞察越准。`, spanClass: '' })
    }
    return spans
  },

  /**
   * 解析 POST /diet/ai-nutritionist/analyze/ 在周/月模式下可能返回的 LLM 结构化洞察
   * 约定：insightSpans[].text | type: normal|highlight|warning；action.buttonText | aiPrompt
   */
  _normalizeAnalyzeInsight(raw) {
    if (!raw || typeof raw !== 'object') return null
    const payload = raw.data && typeof raw.data === 'object' ? raw.data : raw
    let list = payload.insightSpans
    if (!Array.isArray(list)) return null
    const spans = list
      .map((s) => {
        const text = s.text != null ? String(s.text) : s.t != null ? String(s.t) : ''
        const typ = String(s.type || 'normal').toLowerCase()
        let spanClass = ''
        if (typ === 'highlight') spanClass = 'highlight-report'
        else if (typ === 'warning') spanClass = 'warning-report'
        return { t: text, spanClass }
      })
      .filter((x) => x.t)
    if (!spans.length) return null
    const action = payload.action || null
    return {
      spans,
      action:
        action && (action.buttonText || action.aiPrompt)
          ? {
              buttonText: action.buttonText || '定制食谱',
              aiPrompt: action.aiPrompt || ''
            }
          : null
    }
  },

  async _syncReportBento(mode, monthTimelineArg) {
    const app = getApp()
    if (isDevChannelToken(app.globalData.accessToken)) {
      const weekRange = this.getWeekRange(this.data.selectedDate || util.formatDate(new Date()))
      const today = new Date()
      const y = today.getFullYear()
      const m = today.getMonth() + 1
      const monthStart = `${y}-${this._pad2(m)}-01`
      const monthEnd = util.formatDate(new Date(y, m, 0))
      const mockBars =
        mode === 'week'
          ? [
              { day: '一', percent: 60, isOver: false, isToday: false, kcal: 0 },
              { day: '二', percent: 85, isOver: false, isToday: false, kcal: 0 },
              { day: '三', percent: 100, isOver: true, isToday: false, kcal: 0 },
              { day: '四', percent: 75, isOver: false, isToday: false, kcal: 0 },
              { day: '五', percent: 105, isOver: true, isToday: false, kcal: 0 },
              { day: '六', percent: 90, isOver: false, isToday: false, kcal: 0 },
              { day: '日', percent: 45, isOver: false, isToday: true, kcal: 0 }
            ]
          : [
              { day: '1 段', percent: 72, isOver: false, isToday: false, kcal: 0 },
              { day: '2 段', percent: 88, isOver: false, isToday: false, kcal: 0 },
              { day: '3 段', percent: 95, isOver: true, isToday: false, kcal: 0 },
              { day: '4 段', percent: 68, isOver: false, isToday: false, kcal: 0 }
            ]
      this.setData({
        reportDateRangeLabel:
          mode === 'week'
            ? this._formatCnRange(weekRange.start, weekRange.end)
            : this._formatCnRange(monthStart, monthEnd),
        barChartDays: mockBars,
        reportTargetLineBottom: 70,
        reportAvgDailyKcal: 1850,
        reportTrendTagClass: 'positive',
        reportTrendTagText: '↓ 12% 较上周',
        bentoPerfectDays: 5,
        bentoSecondaryValue: 12,
        bentoSecondaryUnit: '条',
        bentoSecondaryLabel: '饮食记录',
        macroWeekModel: {
          proteinAvg: 85,
          carbAvg: 150,
          fatAvg: 45,
          proteinPct: 85,
          carbPct: 60,
          fatPct: 40
        },
        weekInsightSpans: [
          { t: '本周你的饮食结构整体健康，', spanClass: '' },
          { t: '蛋白质摄入充足', spanClass: 'highlight-report' },
          {
            t: '。注意热量偏高的日期，建议晚餐减少精制碳水。点击底部可继续向 AI 营养师提问。',
            spanClass: ''
          }
        ],
        reportInsightAction: null,
        reportInsightButtonLabel: '定制下周食谱 ›'
      })
      return
    }

    let profile = {}
    try {
      profile = await api.getUserProfile()
    } catch (e) {
      profile = {}
    }
    const dailyTarget = profile.daily_kcal_limit || 2000
    const goalType = profile.goal_type || 'maintain'
    const macroTargets = this._macrosFromKcal(dailyTarget, goalType)

    let rangeStart = this.data.weekStartDate
    let rangeEnd = this.data.weekEndDate
    let timeline = this.data.timeline || []
    let daysForAvg = 7

    if (mode === 'month') {
      const today = new Date()
      const y = today.getFullYear()
      const m = today.getMonth() + 1
      rangeStart = `${y}-${this._pad2(m)}-01`
      const last = new Date(y, m, 0)
      rangeEnd = util.formatDate(last)
      daysForAvg = last.getDate()
      if (Array.isArray(monthTimelineArg)) {
        timeline = monthTimelineArg
      } else {
        try {
          const res = await api.getReportData(rangeStart, rangeEnd)
          timeline = (res && res.timeline) ? res.timeline : []
        } catch (e) {
          timeline = []
        }
      }
    }

    const { rows, targetLineBottom } = this._buildBarChartDays(
      mode === 'month' ? 'month' : 'week',
      rangeStart,
      rangeEnd,
      timeline,
      dailyTarget
    )

    const totalKcal = rows.reduce((s, x) => s + (x.kcal || 0), 0)
    const denom = mode === 'month' ? Math.max(1, daysForAvg) : 7
    const avgKcal = Math.round(totalKcal / denom)

    let prevAvg = null
    try {
      const hist = await api.getHistoryTrend()
      const trend = hist.trend || hist || []
      if (Array.isArray(trend) && trend.length >= 14) {
        const prevSlice = trend.slice(-14, -7)
        const sum = prevSlice.reduce(
          (s, x) => s + (Number(x.consumed || x.value) || 0),
          0
        )
        if (prevSlice.length) prevAvg = sum / prevSlice.length
      }
    } catch (e) {
      prevAvg = null
    }

    let reportTrendTagClass = 'neutral'
    let reportTrendTagText = '与上期基本持平'
    if (prevAvg != null && prevAvg > 0) {
      const diff = Math.round(((avgKcal - prevAvg) / prevAvg) * 100)
      if (diff <= -3) {
        reportTrendTagClass = 'positive'
        reportTrendTagText = `↓ ${Math.abs(diff)}% 较上期`
      } else if (diff >= 3) {
        reportTrendTagClass = 'warn'
        reportTrendTagText = `↑ ${diff}% 较上期`
      }
    } else {
      reportTrendTagText = '热量趋势'
    }

    const kcalByDate = {}
    ;(timeline || []).forEach((r) => {
      const d = r.date || r.log_date || ''
      if (!d) return
      const k = Number(r.calories != null ? r.calories : r.kcal) || 0
      kcalByDate[d] = (kcalByDate[d] || 0) + k
    })
    let perfect = 0
    const lo = dailyTarget * 0.88
    const hi = dailyTarget * 1.08
    const scan = new Date(rangeStart)
    const endScan = new Date(rangeEnd)
    while (scan.getTime() <= endScan.getTime()) {
      const ds = util.formatDate(scan)
      const k = kcalByDate[ds] || 0
      if (k >= lo && k <= hi && k > 0) perfect++
      scan.setDate(scan.getDate() + 1)
    }

    const macroWeekModel = this._macroModelFromTimeline(
      timeline,
      mode === 'month' ? daysForAvg : 7,
      macroTargets
    )

    const localSpans = this._buildWeekInsightSpans(
      mode,
      rows,
      macroWeekModel,
      avgKcal,
      dailyTarget,
      (timeline || []).length
    )

    let weekInsightSpans = localSpans
    let reportInsightAction = null
    try {
      const analyzeRes = await api.getNutritionAnalysis({
        period: mode,
        range_start: rangeStart,
        range_end: rangeEnd,
        summary: {
          avg_kcal: avgKcal,
          target_kcal: dailyTarget,
          perfect_days: perfect,
          record_count: (timeline || []).length,
          macro: macroWeekModel,
          over_day_labels: rows.filter((r) => r.isOver).map((r) => r.day)
        }
      })
      const remote = this._normalizeAnalyzeInsight(analyzeRes)
      if (remote && remote.spans.length) {
        weekInsightSpans = remote.spans
        reportInsightAction = remote.action
      }
    } catch (e) {
      console.log('报告洞察：接口未返回结构化 insightSpans，已使用本地规则', e)
    }

    this.setData({
      reportDateRangeLabel: this._formatCnRange(rangeStart, rangeEnd),
      barChartDays: rows,
      reportTargetLineBottom: targetLineBottom,
      reportAvgDailyKcal: avgKcal,
      reportTrendTagClass,
      reportTrendTagText,
      bentoPerfectDays: perfect,
      bentoSecondaryValue: (timeline || []).length,
      bentoSecondaryUnit: '条',
      bentoSecondaryLabel: mode === 'week' ? '本周记录' : '本月记录',
      macroWeekModel,
      weekInsightSpans,
      reportDailyTarget: dailyTarget,
      reportInsightAction,
      reportInsightButtonLabel:
        (reportInsightAction && reportInsightAction.buttonText) ||
        '定制下周食谱 ›'
    })
  },

  // 跳转首页记录饮水（与今日饮水联动）
  goToWaterRecord() {
    const d = this.data.selectedDate || ''
    const q =
      d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `?date=${encodeURIComponent(d)}` : ''
    wx.navigateTo({ url: `/packageHealth/water/water${q}` })
  },

  // 获取本周的开始和结束日期
  getWeekRange(dateStr) {
    const d = new Date(dateStr)
    const day = d.getDay()
    // 计算到本周一的差值（0=周日，1=周一，...）
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

  // 跳转到添加记录
  goToAdd() {
    wx.navigateTo({
      url: '/packageCook/cook/cook'
    })
  },

  // 根据时间自动归类餐次
  classifyMealType(mealTime) {
    if (!mealTime) return 'snack'
    
    // 解析时间字符串 (格式: "HH:mm" 或 "HH:mm:ss")
    const timeStr = mealTime.split(':')
    const hour = parseInt(timeStr[0]) || 0
    
    const ranges = this.data.mealTimeRanges
    
    // 早餐: 6-11
    if (hour >= ranges.breakfast.start && hour < ranges.breakfast.end) {
      return 'breakfast'
    }
    
    // 午餐: 11-14
    if (hour >= ranges.lunch.start && hour < ranges.lunch.end) {
      return 'lunch'
    }
    
    // 下午茶: 14-17
    if (hour >= ranges.afternoon_tea.start && hour < ranges.afternoon_tea.end) {
      return 'afternoon_tea'
    }
    
    // 晚餐: 17-20
    if (hour >= ranges.dinner.start && hour < ranges.dinner.end) {
      return 'dinner'
    }
    
    // 夜宵: 20:00-06:00 (跨天处理)
    if (hour >= ranges.snack.start || hour < ranges.snack.end) {
      return 'snack'
    }
    
    // 默认归类为夜宵
    return 'snack'
  },

  // 按餐次分组时间轴数据
  groupTimelineByMeal(timeline) {
    const grouped = {}
    const mealOrder = ['breakfast', 'lunch', 'afternoon_tea', 'dinner', 'snack']
    
    // 初始化分组
    mealOrder.forEach(mealType => {
      grouped[mealType] = {
        mealType: mealType,
        label: this.data.mealTypeLabels[mealType] || mealType,
        items: [],
        totalCalories: 0
      }
    })
    
    // 遍历时间轴数据，归类到对应餐次
    timeline.forEach(item => {
      // 如果已有meal_type，使用原有的；否则根据时间自动归类
      const mealType = item.meal_type || this.classifyMealType(item.meal_time)
      
      if (grouped[mealType]) {
        grouped[mealType].items.push({
          ...item,
          meal_type: mealType // 确保meal_type被设置
        })
        grouped[mealType].totalCalories += item.calories || 0
      }
    })
    
    // 转换为数组，只保留有记录的餐次
    const result = mealOrder
      .map(mealType => grouped[mealType])
      .filter(group => group.items.length > 0)
    
    return result
  },

  // 开发者通道：无后端时使用占位数据，避免请求失败与 Loading 异常
  applyDevReportMock() {
    const systemInfo = getWindowMetricsSafe()
    const pixelRatio = systemInfo.pixelRatio || 2
    const windowWidth = systemInfo.windowWidth
    const rpxToPx = windowWidth / 750
    const canvasWidth = Math.round(windowWidth - 40)
    const canvasHeight = Math.round(300 * rpxToPx)
    const canvasNutrientWidth = Math.round(420 * rpxToPx * pixelRatio)
    const canvasNutrientHeight = Math.round(200 * rpxToPx * pixelRatio)
    const canvasSize = Math.min((windowWidth - 80) * pixelRatio, 600 * pixelRatio)
    const summary = { consumed: 0, target: 2000, carb: 0, protein: 0, fat: 0 }
    this.setData({
      dailyData: summary,
      timeline: [],
      groupedTimeline: [],
      historyData: [],
      progressPercent: 0,
      remainingCalories: 2000,
      carbPercent: 0,
      proteinPercent: 0,
      fatPercent: 0,
      nutrientScope: 'day',
      nutrientDisplay: { carb: 0, protein: 0, fat: 0 },
      nutrientPercents: { carb: 0, protein: 0, fat: 0 },
      selectedNutrientType: '',
      nutrientHighlight: '',
      showNutrientDetail: false,
      chartData: null,
      aiSummary: null,
      healthWarnings: [],
      todayWorkoutStats: {
        totalDistance: 0,
        totalDuration: 0,
        totalCalories: 0,
        workoutCount: 0,
        carbonOffset: 0
      },
      todayCarbonBrief: { total: 0 },
      todayWater: 0,
      waterGoal: util.getWaterGoalMl(),
      waterDateToday: util.formatDate(new Date()),
      canvasWidth,
      canvasHeight,
      canvasNutrientWidth,
      canvasNutrientHeight,
      canvasSize,
      pixelRatio
    })
    setTimeout(() => {
      if (typeof this.drawCharts === 'function') this.drawCharts()
    }, 300)
  },

  // 加载报表数据
  async loadReportData() {
    const app = getApp()
    if (isDevChannelToken(app.globalData.accessToken)) {
      this.applyDevReportMock()
      return
    }

    try {
      util.showLoading('加载中...')
      const date = this.data.selectedDate

      // 并行拉取互不依赖的接口，避免串行累加延迟；AI 营养分析较慢，单独延后不阻塞「加载中」
      const [
        summary,
        chartDataRaw,
        historyResult,
        reportData,
        workoutRes,
        carbonRes,
        healthWarnings
      ] = await Promise.all([
        api.getDailySummary(date),
        api.getDailyChartData(date).catch((e) => {
          console.log('获取图表数据失败，使用摘要数据计算', e)
          return null
        }),
        api.getHistoryTrend().catch((e) => {
          console.log('获取历史趋势失败', e)
          return {}
        }),
        api.getReportData(date, date).catch((e) => {
          console.log('获取时间轴数据失败', e)
          return {}
        }),
        api.getTodayWorkoutStats().catch((e) => {
          console.log('获取今日运动统计失败', e)
          return null
        }),
        api.getCarbonFootprint(date).catch((e) => {
          console.log('获取今日碳足迹失败', e)
          return null
        }),
        api.getHealthWarnings().catch((e) => {
          console.log('获取健康预警失败', e)
          return []
        })
      ])

      let chartData = chartDataRaw
      let historyData = []
      if (historyResult && typeof historyResult === 'object') {
        const rawTrend =
          historyResult.trend != null ? historyResult.trend : historyResult
        historyData = Array.isArray(rawTrend) ? rawTrend : []
        if (historyResult.chart_data && historyResult.chart_data.trend_chart) {
          chartData = chartData || {}
          chartData.trend_chart = historyResult.chart_data.trend_chart
        }
      }

      const timeline = (reportData && reportData.timeline) ? reportData.timeline : []
      const groupedTimeline = this.groupTimelineByMeal(timeline)

      this._nutritionAnalysisSeq = (this._nutritionAnalysisSeq || 0) + 1
      const nutritionSeq = this._nutritionAnalysisSeq
      api
        .getNutritionAnalysis(date)
        .then((result) => {
          if (nutritionSeq !== this._nutritionAnalysisSeq) return
          this.setData({ aiSummary: result })
        })
        .catch((e) => {
          console.log('获取营养分析失败', e)
        })

      let todayWorkoutStats = {
        totalDistance: 0,
        totalDuration: 0,
        totalCalories: 0,
        workoutCount: 0,
        carbonOffset: 0
      }
      let todayCarbonBrief = { total: 0 }
      if (workoutRes) {
        todayWorkoutStats = {
          totalDistance: workoutRes.totalDistance || workoutRes.total_distance || 0,
          totalDuration: workoutRes.totalDuration || workoutRes.total_duration || 0,
          totalCalories: workoutRes.totalCalories || workoutRes.total_calories || 0,
          workoutCount: workoutRes.workoutCount || workoutRes.workout_count || 0,
          carbonOffset: workoutRes.carbonOffset || workoutRes.carbon_offset || 0
        }
      }
      if (carbonRes) {
        todayCarbonBrief = {
          total: typeof carbonRes.total === 'number' ? carbonRes.total : (carbonRes.today_total || 0)
        }
      }

      const warningsList = Array.isArray(healthWarnings) ? healthWarnings : []

      // ⚠️ 优化：如果后端提供了图表数据，直接使用；否则使用摘要数据计算（兼容模式）
      let progressPercent, remainingCalories, carbPercent, proteinPercent, fatPercent
      
      if (chartData && chartData.calorie_chart) {
        // 使用后端提供的图表数据
        const calorieChart = chartData.calorie_chart
        progressPercent = calorieChart.percent || 0
        remainingCalories = calorieChart.remaining || 0
      } else {
        // 兼容模式：使用摘要数据计算
        progressPercent = summary.target > 0 
          ? Math.min((summary.consumed / summary.target) * 100, 100) 
          : 0
        remainingCalories = Math.max(0, summary.target - summary.consumed)
      }
      
      if (chartData && chartData.nutrient_chart) {
        // 使用后端提供的营养素数据
        const nutrientChart = chartData.nutrient_chart
        const carbItem = nutrientChart.data.find(d => d.name === '碳水')
        const proteinItem = nutrientChart.data.find(d => d.name === '蛋白质')
        const fatItem = nutrientChart.data.find(d => d.name === '脂肪')
        
        // 修复：当后端存在对应项但未提供 percent 字段时，回退为 0，避免设置为 undefined
        carbPercent = (carbItem && carbItem.percent !== undefined) ? carbItem.percent : 0
        proteinPercent = (proteinItem && proteinItem.percent !== undefined) ? proteinItem.percent : 0
        fatPercent = (fatItem && fatItem.percent !== undefined) ? fatItem.percent : 0
      } else {
        // 兼容模式：计算营养素百分比
        const totalNutrients = (summary.carb || 0) + (summary.protein || 0) + (summary.fat || 0)
        carbPercent = totalNutrients > 0 
          ? Math.round(((summary.carb || 0) / totalNutrients) * 100) 
          : 0
        proteinPercent = totalNutrients > 0 
          ? Math.round(((summary.protein || 0) / totalNutrients) * 100) 
          : 0
        fatPercent = totalNutrients > 0 
          ? Math.round(((summary.fat || 0) / totalNutrients) * 100) 
          : 0
      }

      // 默认：本日口径展示（其余口径在 switchNutrientScope 中单独加载）
      const baseDisplay = {
        carb: summary.carb || 0,
        protein: summary.protein || 0,
        fat: summary.fat || 0
      }
      const basePercents = { carb: carbPercent, protein: proteinPercent, fat: fatPercent }
      
      // 计算 Canvas 显式尺寸：卡路里图用逻辑 px，营养素图用物理 px（与营养素图已显示一致）
      const systemInfo = getWindowMetricsSafe()
      const pixelRatio = systemInfo.pixelRatio || 2
      const windowWidth = systemInfo.windowWidth
      const rpxToPx = windowWidth / 750
      const canvasWidth = Math.round(windowWidth - 40)
      const canvasHeight = Math.round(300 * rpxToPx)
      const canvasNutrientWidth = Math.round(420 * rpxToPx * pixelRatio)
      const canvasNutrientHeight = Math.round(200 * rpxToPx * pixelRatio)
      const canvasSize = Math.min((windowWidth - 80) * pixelRatio, 600 * pixelRatio)
      
      const selectedDate = this.data.selectedDate || util.formatDate(new Date())
      const manualMl = util.getWaterManualMlForDate(selectedDate)
      const foodMl = util.estimateFoodWaterMlFromTimeline(timeline)
      const todayWater = Math.min(manualMl + foodMl, util.getWaterGoalMl() * 2)
      const waterGoal = util.getWaterGoalMl()
      const waterDateToday = util.formatDate(new Date())
      this.setData({
        dailyData: summary,
        timeline,
        groupedTimeline,
        progressPercent: Math.round(progressPercent),
        remainingCalories,
        carbPercent,
        proteinPercent,
        fatPercent,
        nutrientScope: 'day',
        nutrientDisplay: baseDisplay,
        nutrientPercents: basePercents,
        selectedNutrientType: '',
        nutrientHighlight: '',
        showNutrientDetail: false,
        canvasWidth,
        canvasHeight,
        canvasNutrientWidth,
        canvasNutrientHeight,
        canvasSize,
        pixelRatio,
        chartData: chartData || null,
        aiSummary: null,
        healthWarnings: warningsList,
        historyData,
        todayWorkoutStats,
        todayCarbonBrief,
        todayWater,
        waterGoal,
        waterDateToday
      })
      
      // 绘制图表 - 延迟确保DOM渲染完成
      setTimeout(() => {
        this.drawCharts()
      }, 300)
    } catch (error) {
      console.error('加载报表失败', error)
      util.showToast('加载失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // ===== 营养素口径切换（本日/近7天/近30天） =====
  async switchNutrientScope(e) {
    const scope = e.currentTarget.dataset.scope
    if (!scope || scope === this.data.nutrientScope) return
    this.setData({
      nutrientScope: scope,
      selectedNutrientType: '',
      nutrientHighlight: '',
      showNutrientDetail: false
    })

    if (scope === 'day') {
      // 直接回到本日摘要
      const d = this.data.dailyData || {}
      const total = (d.carb || 0) + (d.protein || 0) + (d.fat || 0)
      const carbP = total > 0 ? Math.round(((d.carb || 0) / total) * 100) : 0
      const proteinP = total > 0 ? Math.round(((d.protein || 0) / total) * 100) : 0
      const fatP = total > 0 ? Math.round(((d.fat || 0) / total) * 100) : 0
      this.setData({
        nutrientDisplay: { carb: d.carb || 0, protein: d.protein || 0, fat: d.fat || 0 },
        nutrientPercents: { carb: carbP, protein: proteinP, fat: fatP }
      })
      this.drawCharts()
      return
    }

    // 近7天/近30天：从时间轴汇总三大营养素（兼容后端未提供汇总接口）
    const end = this.data.selectedDate || util.formatDate(new Date())
    const endDate = new Date(end)
    const days = scope === '7d' ? 7 : 30
    const startDate = new Date(endDate)
    startDate.setDate(endDate.getDate() - (days - 1))
    const start = util.formatDate(startDate)

    try {
      util.showLoading('汇总中...')
      const res = await api.getReportData(start, end)
      const timeline = (res && res.timeline) ? res.timeline : []
      let carb = 0, protein = 0, fat = 0
      timeline.forEach(r => {
        const c = parseFloat(r.carbs != null ? r.carbs : r.carb) || 0
        const p = parseFloat(r.protein) || 0
        const f = parseFloat(r.fat) || 0
        carb += c
        protein += p
        fat += f
      })
      carb = Math.round(carb * 10) / 10
      protein = Math.round(protein * 10) / 10
      fat = Math.round(fat * 10) / 10
      const total = carb + protein + fat
      const carbP = total > 0 ? Math.round((carb / total) * 100) : 0
      const proteinP = total > 0 ? Math.round((protein / total) * 100) : 0
      const fatP = total > 0 ? Math.round((fat / total) * 100) : 0
      this.setData({
        nutrientDisplay: { carb, protein, fat },
        nutrientPercents: { carb: carbP, protein: proteinP, fat: fatP }
      })
      this.drawCharts()
    } catch (err) {
      console.error('切换营养素口径失败', err)
      util.showToast('汇总失败，已保持本日数据')
      this.setData({ nutrientScope: 'day' })
    } finally {
      util.hideLoading()
    }
  },

  _getScopeLabel() {
    const map = { day: '本日', '7d': '近7天', '30d': '近30天' }
    return map[this.data.nutrientScope] || '本日'
  },

  _getNutrientValuesForChart() {
    // 若非本日口径，使用汇总后的展示数据画图（不依赖 chartData）
    if (this.data.nutrientScope && this.data.nutrientScope !== 'day') {
      const nd = this.data.nutrientDisplay || {}
      const carb = nd.carb || 0
      const protein = nd.protein || 0
      const fat = nd.fat || 0
      return { carb, protein, fat }
    }
    // 本日口径：优先使用后端 chartData，否则 fallback 到摘要
    if (this.data.chartData && this.data.chartData.nutrient_chart) {
      const nc = this.data.chartData.nutrient_chart
      const carb = (nc.data.find(d => d.name === '碳水') || {}).value || 0
      const protein = (nc.data.find(d => d.name === '蛋白质') || {}).value || 0
      const fat = (nc.data.find(d => d.name === '脂肪') || {}).value || 0
      return { carb, protein, fat }
    }
    const d = this.data.dailyData || {}
    return { carb: d.carb || 0, protein: d.protein || 0, fat: d.fat || 0 }
  },

  // 绘制图表（带入场动效）
  drawCharts() {
    this._runCalorieChartAnimation()
  },

  // 卡路里进度条：从左到右填充动效（约 400ms）
  _runCalorieChartAnimation() {
    const width = this.data.canvasWidth || 335
    const height = this.data.canvasHeight || 150
    let consumed, consumedPercent
    if (this.data.chartData && this.data.chartData.calorie_chart) {
      const c = this.data.chartData.calorie_chart
      consumed = c.consumed || 0
      consumedPercent = c.percent || 0
    } else {
      const d = this.data.dailyData
      consumed = d.consumed || 0
      const target = d.target || 2000
      consumedPercent = target > 0 ? Math.min((consumed / target) * 100, 100) : 0
    }
    const barHeight = Math.max(24, Math.min(48, height * 0.35))
    const barY = height / 2 - barHeight / 2
    const finalBarWidth = Math.max(0, width * (consumedPercent / 100))
    const radius = Math.min(12, barHeight / 2)
    const steps = 12
    const stepMs = 36
    let step = 0
    const tick = () => {
      step++
      const t = Math.min(step / steps, 1)
      const easeOut = 1 - Math.pow(1 - t, 2)
      const currentBarWidth = finalBarWidth * easeOut
      const ctx = wx.createCanvasContext('calorieChart', this)
      this._drawCalorieChartContent(ctx, width, height, barHeight, barY, currentBarWidth, radius, consumed, step === steps)
      ctx.draw(false, () => {})
      if (step < steps) {
        setTimeout(tick, stepMs)
      } else {
        this._runNutrientChartAnimation()
      }
    }
    setTimeout(tick, 50)
  },

  // 营养素半圆图：扇区逐渐绘制动效（约 500ms）
  _runNutrientChartAnimation() {
    const { carb, protein, fat } = this._getNutrientValuesForChart()
    const steps = 14
    const stepMs = 40
    let step = 0
    const tick = () => {
      step++
      const t = Math.min(step / steps, 1)
      const easeOut = 1 - Math.pow(1 - t, 2)
      const ctx = wx.createCanvasContext('nutrientChart', this)
      const total = carb + protein + fat
      this._drawNutrientChartContent(
        ctx,
        this.data.canvasNutrientWidth || 400,
        this.data.canvasNutrientHeight || 200,
        carb,
        protein,
        fat,
        total,
        this.data.pixelRatio || 2,
        easeOut,
        this.data.nutrientHighlight || ''
      )
      ctx.draw(false, () => {})
      if (step < steps) setTimeout(tick, stepMs)
    }
    setTimeout(tick, 80)
  },

  // 绘制卡路里对比图（支持动画当前宽度，showNumber 为 true 时绘制数字）
  drawCalorieChart() {
    const ctx = wx.createCanvasContext('calorieChart', this)
    const width = this.data.canvasWidth || 335
    const height = this.data.canvasHeight || 150
    let consumed, consumedPercent
    if (this.data.chartData && this.data.chartData.calorie_chart) {
      const c = this.data.chartData.calorie_chart
      consumed = c.consumed || 0
      consumedPercent = c.percent || 0
    } else {
      const d = this.data.dailyData
      consumed = d.consumed || 0
      const target = d.target || 2000
      consumedPercent = target > 0 ? Math.min((consumed / target) * 100, 100) : 0
    }
    const barHeight = Math.max(24, Math.min(48, height * 0.35))
    const barY = height / 2 - barHeight / 2
    const barWidth = Math.max(0, width * (consumedPercent / 100))
    const radius = Math.min(12, barHeight / 2)
    this._drawCalorieChartContent(ctx, width, height, barHeight, barY, barWidth, radius, consumed, true)
    ctx.draw(false, () => {})
  },

  _drawCalorieChartContent(ctx, width, height, barHeight, barY, barWidth, radius, consumed, showNumber) {
    const chartData = this.data.chartData
    const calorieChart = chartData && chartData.calorie_chart
    // 防御性读取 config 与 colors，避免后端缺失字段导致 undefined 报错
    const config = (calorieChart && calorieChart.config) ? calorieChart.config : {}
    const colors = (config && config.colors) ? config.colors : {}
    const maxBarWidth = Math.min(barWidth, Math.max(0, width - radius * 2))
    const actualBarWidth = Math.max(radius * 2, maxBarWidth)

    // 背景轨道（浅灰 + 轻微内阴影感）
    ctx.beginPath()
    ctx.moveTo(radius, barY)
    ctx.lineTo(width - radius, barY)
    ctx.arc(width - radius, barY + radius, radius, -Math.PI / 2, 0)
    ctx.lineTo(width, barY + barHeight - radius)
    ctx.arc(width - radius, barY + barHeight - radius, radius, 0, Math.PI / 2)
    ctx.lineTo(radius, barY + barHeight)
    ctx.arc(radius, barY + barHeight - radius, radius, Math.PI / 2, Math.PI)
    ctx.lineTo(0, barY + radius)
    ctx.arc(radius, barY + radius, radius, Math.PI, -Math.PI / 2)
    ctx.closePath()
    ctx.setFillStyle(colors.target || '#EEEEEE')
    ctx.fill()

    if (actualBarWidth > radius * 2) {
      const consumedColor = colors.consumed || '#4CAF50'
      const gradient = ctx.createLinearGradient(0, 0, actualBarWidth, 0)
      gradient.addColorStop(0, '#2E7D32')
      gradient.addColorStop(0.35, '#4CAF50')
      gradient.addColorStop(0.7, '#66BB6A')
      gradient.addColorStop(1, '#81C784')

      // 已摄入条：底部轻微阴影（深色条）
      ctx.beginPath()
      ctx.moveTo(radius, barY + barHeight)
      ctx.lineTo(actualBarWidth - radius, barY + barHeight)
      ctx.arc(actualBarWidth - radius, barY + barHeight - radius, radius, Math.PI / 2, 0)
      ctx.lineTo(actualBarWidth, barY + radius)
      ctx.arc(actualBarWidth - radius, barY + radius, radius, 0, -Math.PI / 2)
      ctx.lineTo(radius, barY + radius)
      ctx.arc(radius, barY + radius, radius, -Math.PI / 2, Math.PI / 2)
      ctx.closePath()
      ctx.setFillStyle('rgba(0,0,0,0.12)')
      ctx.fill()

      ctx.beginPath()
      ctx.moveTo(radius, barY)
      ctx.lineTo(actualBarWidth - radius, barY)
      ctx.arc(actualBarWidth - radius, barY + radius, radius, -Math.PI / 2, 0)
      ctx.lineTo(actualBarWidth, barY + barHeight - radius)
      ctx.arc(actualBarWidth - radius, barY + barHeight - radius, radius, 0, Math.PI / 2)
      ctx.lineTo(radius, barY + barHeight)
      ctx.arc(radius, barY + barHeight - radius, radius, Math.PI / 2, Math.PI)
      ctx.lineTo(0, barY + radius)
      ctx.arc(radius, barY + radius, radius, Math.PI, -Math.PI / 2)
      ctx.closePath()
      ctx.setFillStyle(gradient)
      ctx.fill()

      // 顶部高光
      ctx.beginPath()
      ctx.moveTo(radius, barY)
      ctx.lineTo(actualBarWidth - radius, barY)
      ctx.arc(actualBarWidth - radius, barY + radius, radius, -Math.PI / 2, 0)
      ctx.lineTo(actualBarWidth, barY + barHeight / 2)
      ctx.lineTo(radius, barY + barHeight / 2)
      ctx.closePath()
      ctx.setFillStyle('rgba(255, 255, 255, 0.35)')
      ctx.fill()
    } else if (actualBarWidth > 0) {
      ctx.beginPath()
      ctx.moveTo(radius, barY)
      ctx.lineTo(actualBarWidth, barY)
      ctx.lineTo(actualBarWidth, barY + barHeight)
      ctx.lineTo(radius, barY + barHeight)
      ctx.arc(radius, barY + radius, radius, Math.PI / 2, Math.PI)
      ctx.lineTo(0, barY + radius)
      ctx.arc(radius, barY + radius, radius, Math.PI, -Math.PI / 2)
      ctx.closePath()
      ctx.setFillStyle(colors.consumed || '#4CAF50')
      ctx.fill()
    }

    if (showNumber) {
      ctx.setFontSize(14)
      ctx.setTextAlign('center')
      ctx.setTextBaseline('middle')
      const midY = barY + barHeight / 2
      ctx.setFillStyle('rgba(0,0,0,0.25)')
      ctx.fillText(`${consumed}`, width / 2 + 1, midY + 1)
      ctx.setFillStyle(actualBarWidth > width / 2 ? '#fff' : '#333')
      ctx.fillText(`${consumed}`, width / 2, midY)
    }
  },

  // 绘制营养素饼图（半圆形，使用 data 中已设置的 canvas 尺寸）
  drawNutrientChart() {
    const ctx = wx.createCanvasContext('nutrientChart', this)
    const canvasWidth = this.data.canvasNutrientWidth || 400
    const canvasHeight = this.data.canvasNutrientHeight || 200
    const pixelRatio = this.data.pixelRatio || 2
    const { carb, protein, fat } = this._getNutrientValuesForChart()
    const total = carb + protein + fat
    this._drawNutrientChartContent(ctx, canvasWidth, canvasHeight, carb, protein, fat, total, pixelRatio, 1, this.data.nutrientHighlight || '')
    ctx.draw(false, () => {})
  },

  _drawNutrientChartContent(ctx, canvasWidth, canvasHeight, carb, protein, fat, total, pixelRatio, progress, highlightName) {
    if (progress === undefined) progress = 1
    // 半圆形图表；progress 用于动效（0~1 时扇区按比例绘制）
    // 半圆形图表，缩小半径并留边距，确保完整显示在容器内
    const centerX = canvasWidth / 2
    const padding = 12 * pixelRatio
    const usableW = canvasWidth - padding * 2
    const usableH = canvasHeight - padding * 2
    // 半径取可用区域的较小比例，避免被裁剪（略缩小，留出柔和阴影与指示线空间）
    const maxRadius = Math.min(usableW * 0.42, usableH * 0.7)
    const radius = maxRadius
    const innerRadius = radius * 0.5 // 内半径略小，形成更「厚」的彩色环，接近设计稿效果
    const centerY = canvasHeight - padding - radius * 0.02 // 稍微上移，整体更居中
    let startAngle = Math.PI // 从左边开始（180度）
    
    if (total === 0) {
      // 绘制空状态（半圆）
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, Math.PI, 0, false)
      ctx.lineTo(centerX - radius, centerY)
      ctx.closePath()
      ctx.setFillStyle('#F5F5F5')
      ctx.fill()
      ctx.beginPath()
      ctx.arc(centerX, centerY, innerRadius, Math.PI, 0, false)
      ctx.lineTo(centerX - innerRadius, centerY)
      ctx.closePath()
      ctx.setFillStyle('#fff')
      ctx.fill()
      ctx.setFillStyle('#999')
      ctx.setFontSize(24 * pixelRatio)
      ctx.setTextAlign('center')
      ctx.fillText('暂无数据', centerX, centerY - radius * 0.25)
      return
    }
    
    // 绘制背景半圆环（带一点柔和阴影，让图形浮在卡片上）
    ctx.save()
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, Math.PI, 0, false) // 下半圆
    ctx.lineTo(centerX - radius, centerY)
    ctx.closePath()
    ctx.setShadow(0, 8 * pixelRatio, 18 * pixelRatio, 'rgba(15, 23, 42, 0.12)')
    ctx.setFillStyle('#E8E8E8')
    ctx.fill()
    ctx.restore()
    
    // 绘制内半圆（形成环形）
    ctx.beginPath()
    ctx.arc(centerX, centerY, innerRadius, Math.PI, 0, false)
    ctx.lineTo(centerX - innerRadius, centerY)
    ctx.closePath()
    ctx.setFillStyle('#fff')
    ctx.fill()
    
    // ⚠️ 优化：使用后端提供的颜色配置
    const chartData = this.data.chartData
    const nutrientChart = chartData && chartData.nutrient_chart
    const config = nutrientChart ? nutrientChart.config : {}
    
    // 获取营养素颜色（从后端数据或使用默认值）
    const getNutrientColor = (name) => {
      if (nutrientChart && nutrientChart.data) {
        const item = nutrientChart.data.find(d => d.name === name)
        if (item && item.color) return item.color
      }
      // 默认颜色
      const defaultColors = {
        '碳水': '#2196F3',
        '蛋白质': '#FF9800',
        '脂肪': '#9C27B0'
      }
      return defaultColors[name] || '#999'
    }

    const isHighlighted = (name) => highlightName && name === highlightName
    const alphaFor = (name) => {
      if (!highlightName) return 1
      return isHighlighted(name) ? 1 : 0.28
    }
    
    // 碳水（蓝色）- 从左边开始；progress 动效时只绘制比例角度
    const carbAngleFull = (carb / total) * Math.PI
    const carbAngle = carbAngleFull * progress
    if (carbAngle > 0) {
      const endAngle = startAngle + carbAngle
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, endAngle, false)
      ctx.lineTo(centerX, centerY)
      ctx.closePath()
      const carbColor = getNutrientColor('碳水')
      const carbGradient = ctx.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY)
      carbGradient.addColorStop(0, carbColor)
      carbGradient.addColorStop(1, this._lightenColor(carbColor, 0.2))
      ctx.setGlobalAlpha(alphaFor('碳水'))
      ctx.setFillStyle(carbGradient)
      ctx.fill()
      ctx.setGlobalAlpha(1)
      
      // 绘制内圆部分
      ctx.beginPath()
      ctx.arc(centerX, centerY, innerRadius, startAngle, endAngle, false)
      ctx.lineTo(centerX, centerY)
      ctx.closePath()
      ctx.setFillStyle('#fff')
      ctx.fill()
    }
    startAngle += carbAngleFull

    // 蛋白质（橙色）
    const proteinAngleFull = (protein / total) * Math.PI
    const proteinAngle = proteinAngleFull * progress
    if (proteinAngle > 0) {
      const endAngle = startAngle + proteinAngle
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, endAngle, false)
      ctx.lineTo(centerX, centerY)
      ctx.closePath()
      const proteinColor = getNutrientColor('蛋白质')
      const proteinGradient = ctx.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY)
      proteinGradient.addColorStop(0, proteinColor)
      proteinGradient.addColorStop(1, this._lightenColor(proteinColor, 0.2))
      ctx.setGlobalAlpha(alphaFor('蛋白质'))
      ctx.setFillStyle(proteinGradient)
      ctx.fill()
      ctx.setGlobalAlpha(1)
      
      ctx.beginPath()
      ctx.arc(centerX, centerY, innerRadius, startAngle, endAngle, false)
      ctx.lineTo(centerX, centerY)
      ctx.closePath()
      ctx.setFillStyle('#fff')
      ctx.fill()
    }
    startAngle += proteinAngleFull

    // 脂肪（紫色）
    const fatAngleFull = (fat / total) * Math.PI
    const fatAngle = fatAngleFull * progress
    if (fatAngle > 0) {
      const endAngle = startAngle + fatAngle
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.arc(centerX, centerY, radius, startAngle, endAngle, false)
      ctx.lineTo(centerX, centerY)
      ctx.closePath()
      const fatColor = getNutrientColor('脂肪')
      const fatGradient = ctx.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY)
      fatGradient.addColorStop(0, fatColor)
      fatGradient.addColorStop(1, this._lightenColor(fatColor, 0.2))
      ctx.setGlobalAlpha(alphaFor('脂肪'))
      ctx.setFillStyle(fatGradient)
      ctx.fill()
      ctx.setGlobalAlpha(1)
      
      ctx.beginPath()
      ctx.arc(centerX, centerY, innerRadius, startAngle, endAngle, false)
      ctx.lineTo(centerX, centerY)
      ctx.closePath()
      ctx.setFillStyle('#fff')
      ctx.fill()
    }
    
    // 细节优化：在扇区上方加入一条浅色虚线指示（参考设计稿中虚线分隔），提升读数感
    const guideRadius = innerRadius + (radius - innerRadius) * 0.4
    const guideStartX = centerX - guideRadius * 0.92
    const guideEndX = centerX + guideRadius * 0.92
    const guideY = centerY - guideRadius * 0.2
    ctx.save()
    ctx.setStrokeStyle('rgba(255,255,255,0.9)')
    ctx.setLineWidth(2 * pixelRatio)
    ctx.setLineDash([8 * pixelRatio, 8 * pixelRatio])
    ctx.beginPath()
    ctx.moveTo(guideStartX, guideY)
    ctx.lineTo(guideEndX, guideY)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
    
    // 绘制中心白色半圆（不再绘制中心大字，避免字迹过大；颜色含义见下方图例）
    ctx.beginPath()
    ctx.arc(centerX, centerY, innerRadius, Math.PI, 0, false)
    ctx.lineTo(centerX - innerRadius, centerY)
    ctx.closePath()
    ctx.setFillStyle('#fff')
    ctx.fill()
  },

  // ===== 健康管理入口导航 =====
  goToWorkoutPage() {
    wx.navigateTo({
      url: '/packageHealth/carbon-tracker/carbon-tracker'
    })
  },

  goToCarbonTracker() {
    wx.navigateTo({
      url: '/packageHealth/carbon-tracker/carbon-tracker'
    })
  },

  goToRemedyPage() {
    wx.navigateTo({
      url: '/packageHealth/remedy/remedy'
    })
  },

  goToChallengePage() {
    wx.navigateTo({
      url: '/packageUser/challenge/challenge'
    })
  },

  goToAchievementsPage() {
    wx.navigateTo({
      url: '/packageUser/achievements/achievements'
    })
  },

  // 编辑摄入记录：跳转编辑页
  editIntake(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/packageHealth/intake-edit/index?id=${id}`
    })
  },

  // 修改餐次标签（长按）
  async changeMealType(e) {
    const itemId = e.currentTarget.dataset.id
    const currentMealType = e.currentTarget.dataset.mealType
    
    const mealTypes = [
      { value: 'breakfast', label: '早餐' },
      { value: 'lunch', label: '午餐' },
      { value: 'afternoon_tea', label: '下午茶' },
      { value: 'dinner', label: '晚餐' },
      { value: 'snack', label: '夜宵' }
    ]
    
    const itemNames = mealTypes.map(m => m.label)
    
    wx.showActionSheet({
      itemList: itemNames,
      success: async (res) => {
        const newMealType = mealTypes[res.tapIndex].value
        if (newMealType === currentMealType) return
        
        try {
          util.showLoading('更新中...')
          await api.updateIntake(itemId, { meal_type: newMealType })
          util.hideLoading()
          util.showSuccess('已更新餐次')
          await this.loadReportData()
        } catch (err) {
          util.hideLoading()
          util.showToast(err.message || '更新失败')
          // 请求失败时仍更新本地展示
          const timeline = this.data.timeline.map(item => {
            if (item.id === itemId) return { ...item, meal_type: newMealType }
            return item
          })
          this.setData({
            timeline,
            groupedTimeline: this.groupTimelineByMeal(timeline)
          })
        }
      }
    })
  },

  // 加载周报数据
  async loadWeeklyReport() {
    const app = getApp()
    if (isDevChannelToken(app.globalData.accessToken)) {
      const today = this.data.selectedDate || util.formatDate(new Date())
      const weekRange = this.getWeekRange(today)
      this.setData({
        weeklyData: {
          total_consumed: 0,
          avg_daily_consumed: 0,
          max_calorie_item: null,
          min_calorie_item: null,
          weekStart: weekRange.start,
          weekEnd: weekRange.end
        },
        weekStartDate: weekRange.start,
        weekEndDate: weekRange.end,
        historyData: [],
        timeline: [],
        groupedTimeline: [],
        chartData: null
      })
      await this._syncReportBento('week')
      return
    }

    try {
      util.showLoading('加载中...')
      
      const today = this.data.selectedDate || util.formatDate(new Date())
      const weekRange = this.getWeekRange(today)
      
      // 获取周报数据
      const weeklyData = await api.getWeeklyReport(weekRange.start, weekRange.end)
      
      // ⚠️ 优化：从后端获取周报图表数据
      let weeklyChartData = null
      try {
        weeklyChartData = await api.getWeeklyChartData(weekRange.start, weekRange.end)
      } catch (e) {
        console.log('获取周报图表数据失败，使用历史趋势数据', e)
      }
      
      // 获取历史趋势数据
      let historyData = []
      try {
        const trendResult = await api.getHistoryTrend()
        historyData = trendResult.trend || trendResult || []
        // 如果后端返回了图表数据，优先使用
        if (trendResult.chart_data && trendResult.chart_data.trend_chart) {
          weeklyChartData = weeklyChartData || {}
          weeklyChartData.trend_chart = trendResult.chart_data.trend_chart
        }
      } catch (e) {
        console.log('获取历史趋势失败', e)
      }
      
      // 按餐次分组周报时间轴数据
      const weeklyTimeline = weeklyData.timeline || []
      const groupedWeeklyTimeline = this.groupTimelineByMeal(weeklyTimeline)
      
      this.setData({
        weeklyData: {
          total_consumed: weeklyData.total_consumed || 0,
          avg_daily_consumed: weeklyData.avg_daily_consumed || 0,
          max_calorie_item: weeklyData.max_calorie_item || null,
          min_calorie_item: weeklyData.min_calorie_item || null,
          weekStart: weekRange.start,
          weekEnd: weekRange.end
        },
        weekStartDate: weekRange.start,
        weekEndDate: weekRange.end,
        historyData: historyData,
        timeline: weeklyTimeline,
        groupedTimeline: groupedWeeklyTimeline,
        chartData: weeklyChartData || null  // ⚠️ 保存周报图表数据
      })

      await this._syncReportBento('week')
      
    } catch (error) {
      console.error('加载周报失败', error)
      util.showToast('加载失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 加载月报数据
  async loadMonthlyReport() {
    const app = getApp()
    if (isDevChannelToken(app.globalData.accessToken)) {
      this.setData({ historyData: [], timeline: [], groupedTimeline: [] })
      await this._syncReportBento('month', [])
      return
    }

    try {
      util.showLoading('加载中...')
      
      const today = new Date()
      const year = today.getFullYear()
      const month = today.getMonth() + 1
      const rangeStart = `${year}-${this._pad2(month)}-01`
      const rangeEnd = util.formatDate(new Date(year, month, 0))

      let monthTimeline = []
      try {
        const rd = await api.getReportData(rangeStart, rangeEnd)
        monthTimeline = (rd && rd.timeline) ? rd.timeline : []
      } catch (e) {
        console.log('获取月报时间轴失败', e)
      }
      
      let historyData = []
      try {
        const trendResult = await api.getHistoryTrend()
        historyData = trendResult.trend || []
      } catch (e) {
        console.log('获取历史趋势失败', e)
      }
      
      this.setData({
        historyData,
        timeline: monthTimeline,
        groupedTimeline: this.groupTimelineByMeal(monthTimeline),
        weekStartDate: rangeStart,
        weekEndDate: rangeEnd
      })

      await this._syncReportBento('month', monthTimeline)
      
    } catch (error) {
      console.error('加载月报失败', error)
      util.showToast('加载失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 绘制历史趋势折线图
  drawTrendChart() {
    // ⚠️ 优化：优先使用后端提供的图表数据
    let data = []
    let chartConfig = {}
    
    if (this.data.chartData && this.data.chartData.trend_chart) {
      // 使用后端提供的趋势图表数据
      const trendChart = this.data.chartData.trend_chart
      data = trendChart.data || []
      chartConfig = trendChart.config || {}
    } else if (this.data.historyData && this.data.historyData.length > 0) {
      // 兼容模式：使用历史趋势数据
      data = this.data.historyData.map(item => ({
        date: item.date,
        consumed: item.consumed || item.value || 0,
        target: item.target || 2000
      }))
    } else {
      return  // 没有数据，不绘制
    }
    
    if (data.length === 0) {
      return
    }
    
    const ctx = wx.createCanvasContext('trendChart')
    const systemInfo = getWindowMetricsSafe()
    const pixelRatio = systemInfo.pixelRatio || 2
    
    const query = wx.createSelectorQuery().in(this)
    query.select('.trend-chart-container').boundingClientRect((rect) => {
      if (!rect) return
      
      const width = rect.width * pixelRatio
      const height = rect.height * pixelRatio
      const padding = 40 * pixelRatio
      const chartWidth = width - padding * 2
      const chartHeight = height - padding * 2
      
      // 计算数据范围
      const maxCalorie = Math.max(...data.map(d => d.consumed || 0), 2000)
      const minCalorie = Math.min(...data.map(d => d.consumed || 0), 0)
      const range = maxCalorie - minCalorie || 2000
      
      // 绘制网格线
      ctx.setStrokeStyle('#E0E0E0')
      ctx.setLineWidth(1)
      for (let i = 0; i <= 4; i++) {
        const y = padding + (chartHeight / 4) * i
        ctx.beginPath()
        ctx.moveTo(padding, y)
        ctx.lineTo(width - padding, y)
        ctx.stroke()
      }
      
      // 绘制数据点
      const points = data.map((item, index) => {
        const x = padding + (chartWidth / (data.length - 1)) * index
        const y = padding + chartHeight - ((item.consumed - minCalorie) / range) * chartHeight
        return { x, y, value: item.consumed }
      })
      
      // 绘制折线（使用后端配置的颜色）
      const lineColor = chartConfig.colors ? (chartConfig.colors.line || '#4CAF50') : '#4CAF50'
      ctx.setStrokeStyle(lineColor)
      ctx.setLineWidth(3 * pixelRatio)
      ctx.beginPath()
      points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y)
        } else {
          ctx.lineTo(point.x, point.y)
        }
      })
      ctx.stroke()
      
      // 绘制数据点（使用后端配置的颜色）
      const pointColor = chartConfig.colors ? (chartConfig.colors.point || lineColor) : lineColor
      points.forEach(point => {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 4 * pixelRatio, 0, Math.PI * 2)
        ctx.setFillStyle(pointColor)
        ctx.fill()
      })
      
      // 绘制目标线（如果配置允许）
      if (chartConfig.show_target_line !== false) {
        const targetValue = data[0] && data[0].target ? data[0].target : 2000
        const targetY = padding + chartHeight - ((targetValue - minCalorie) / range) * chartHeight
        const targetColor = chartConfig.colors ? (chartConfig.colors.target_line || '#FF9800') : '#FF9800'
        ctx.setStrokeStyle(targetColor)
        ctx.setLineWidth(1)
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(padding, targetY)
        ctx.lineTo(width - padding, targetY)
        ctx.stroke()
        ctx.setLineDash([])
      }
      
      // 绘制日期标签
      ctx.setFillStyle('#999')
      ctx.setFontSize(20 * pixelRatio)
      ctx.setTextAlign('center')
      data.forEach((item, index) => {
        const x = padding + (chartWidth / (data.length - 1)) * index
        const date = new Date(item.date)
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
        ctx.fillText(dateStr, x, height - 10 * pixelRatio)
      })
      
      ctx.draw(false, () => {
        console.log('趋势图表绘制完成')
      })
    }).exec()
  },

  // 点击营养素项显示简要提示（UX）
  onNutrientTap(e) {
    const type = e.currentTarget.dataset.type
    const map = {
      carb: { name: '碳水', title: '碳水', kcalPerG: 4, range: [45, 65] },
      protein: { name: '蛋白质', title: '蛋白质', kcalPerG: 4, range: [10, 35] },
      fat: { name: '脂肪', title: '脂肪', kcalPerG: 9, range: [20, 35] }
    }
    const item = map[type]
    if (!item) return

    const nd = this.data.nutrientDisplay || {}
    const grams = nd[type] || 0
    const percents = this.data.nutrientPercents || {}
    const percent = percents[type] || 0
    const kcal = Math.round((grams || 0) * item.kcalPerG)
    const [minP, maxP] = item.range
    const rangeText = `${minP}% ~ ${maxP}%`
    let levelLabel = '摄入建议'
    let tip = ''
    if (percent === 0 && grams === 0) {
      levelLabel = '暂无数据'
      tip = '这段时间内没有可用的营养素记录，先去记录饮食或补全每餐的三大营养素。'
    } else if (percent < minP) {
      levelLabel = '偏低'
      tip = `当前占比偏低（${percent}%）。可以优先选择更“优质”的来源：` +
        (type === 'carb'
          ? '全谷物、杂粮、薯类、燕麦。'
          : type === 'protein'
            ? '瘦肉、鱼虾、蛋奶、豆制品。'
            : '坚果、牛油果、深海鱼、橄榄油。')
    } else if (percent > maxP) {
      levelLabel = '偏高'
      tip = `当前占比偏高（${percent}%）。建议适当减少高密度来源，并把其它两类补齐，整体更均衡。`
    } else {
      levelLabel = '合理'
      tip = `当前占比在建议区间内（${percent}%）。保持这个结构，优先选择天然、少加工的食物来源。`
    }

    this.setData({
      selectedNutrientType: type,
      nutrientHighlight: item.name,
      showNutrientDetail: true,
      nutrientDetail: {
        title: item.title,
        scopeLabel: `口径：${this._getScopeLabel()}（截止 ${this.data.selectedDate}）`,
        grams: grams,
        percent: percent,
        kcal: kcal,
        rangeText,
        levelLabel,
        tip
      }
    })
    this.drawNutrientChart()
  },

  closeNutrientDetail() {
    this.setData({
      showNutrientDetail: false,
      nutrientHighlight: ''
    })
    this.drawNutrientChart()
  },
  
  goToAIChat() {
    wx.navigateTo({
      url: '/packageAI/ai-nutritionist/ai-nutritionist'
    })
  },

  // 工具函数：颜色变亮
  _lightenColor(color, amount) {
    // 简单的颜色变亮实现（如果后端未提供渐变，前端生成）
    if (color.startsWith('#')) {
      const num = parseInt(color.replace('#', ''), 16)
      const r = Math.min(255, ((num >> 16) & 0xFF) + Math.round(255 * amount))
      const g = Math.min(255, ((num >> 8) & 0xFF) + Math.round(255 * amount))
      const b = Math.min(255, (num & 0xFF) + Math.round(255 * amount))
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
    }
    return color
  }
})
