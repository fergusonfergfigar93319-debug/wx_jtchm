// packageHealth/triage/triage.js
const util = require('../../utils/util.js')

Page({
  data: {
    symptoms: [
      { id: 'hangover', icon: '🍺', name: '宿醉', desc: '昨晚喝多了', color: '#FF6B6B', category: '饮酒' },
      { id: 'stayup', icon: '🌙', name: '熬夜', desc: '昨晚熬夜了', color: '#4ECDC4', category: '作息' },
      { id: 'overeat', icon: '🍕', name: '暴食', desc: '吃多了', color: '#FFE66D', category: '饮食' },
      { id: 'stomachache', icon: '😰', name: '胃痛', desc: '胃不舒服', color: '#95E1D3', category: '消化' },
      { id: 'stress', icon: '😫', name: '压力', desc: '压力大焦虑', color: '#A8E6CF', category: '情绪' },
      { id: 'fatigue', icon: '😴', name: '疲劳', desc: '身体疲惫', color: '#FFD3A5', category: '体力' },
      { id: 'insomnia', icon: '🌃', name: '失眠', desc: '睡眠不好', color: '#CAB8FF', category: '睡眠' },
      { id: 'indigestion', icon: '🤢', name: '消化不良', desc: '消化不好', color: '#FFA8B6', category: '消化' },
      { id: 'cold', icon: '🤧', name: '感冒', desc: '感冒不适', color: '#FFB74D', category: '疾病' },
      { id: 'constipation', icon: '😣', name: '便秘', desc: '排便困难', color: '#81C784', category: '消化' },
      { id: 'skin', icon: '✨', name: '皮肤问题', desc: '皮肤状态差', color: '#F48FB1', category: '美容' },
      { id: 'menstrual', icon: '🌸', name: '经期不适', desc: '经期不舒服', color: '#FF8A80', category: '女性' },
      { id: 'headache', icon: '😵', name: '头痛', desc: '头部不适', color: '#90CAF9', category: '疾病' },
      { id: 'sorethroat', icon: '😷', name: '喉咙痛', desc: '喉咙不适', color: '#CE93D8', category: '疾病' },
      { id: 'lowimmunity', icon: '🛡️', name: '免疫力低', desc: '容易生病', color: '#64B5F6', category: '健康' },
      { id: 'heat', icon: '🔥', name: '上火', desc: '口干舌燥、咽喉不适', color: '#FF7043', category: '饮食' },
      { id: 'ulcer', icon: '🫦', name: '口腔溃疡', desc: '口腔黏膜破损', color: '#FFAB91', category: '消化' },
      { id: 'edema', icon: '💧', name: '水肿', desc: '身体浮肿、水分滞留', color: '#80DEEA', category: '作息' }
    ],

    actionText: '',
    actionLen: 0,
    customSymptoms: '',
    selectedIds: [],
    quickSymptoms: [],

    matchedSymptoms: [],
    hasRun: false,
    loading: false
  },

  onLoad() {
    const all = this.data.symptoms || []
    this.setData({ quickSymptoms: this.getQuickSymptoms(all) })
  },

  getQuickSymptoms(allSymptoms) {
    const preferred = ['stayup', 'overeat', 'hangover', 'stress', 'insomnia', 'stomachache', 'heat', 'constipation']
    const map = new Map((allSymptoms || []).map(s => [s.id, s]))
    const picked = preferred.map(id => map.get(id)).filter(Boolean)
    const rest = (allSymptoms || []).filter(s => !preferred.includes(s.id))
    return [...picked, ...rest].slice(0, 10)
  },

  onActionInput(e) {
    const v = e.detail.value || ''
    this.setData({ actionText: v, actionLen: v.length })
  },

  onCustomInput(e) {
    this.setData({ customSymptoms: e.detail.value || '' })
  },

  toggleSymptom(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const current = this.data.selectedIds || []
    const idx = current.indexOf(id)
    const next = current.slice()
    if (idx >= 0) {
      next.splice(idx, 1)
    } else {
      if (next.length >= 6) {
        util.showToast('最多选择6个症状', 'none')
        return
      }
      next.push(id)
    }
    this.setData({ selectedIds: next })
    wx.vibrateShort()
  },

  clearAll() {
    this.setData({
      actionText: '',
      actionLen: 0,
      customSymptoms: '',
      selectedIds: [],
      matchedSymptoms: [],
      hasRun: false,
      loading: false
    })
  },

  normalizeText(text) {
    return (text || '').toString().replace(/\s+/g, ' ').trim().toLowerCase()
  },

  getSymptomKeywordIndex(symptom) {
    const base = [symptom.id, symptom.name, symptom.desc, symptom.category].filter(Boolean)
    const synonyms = {
      hangover: ['宿醉', '喝多', '酒后', '头晕', '恶心', '吐', '反胃', '断片'],
      stayup: ['熬夜', '通宵', '加班', '晚睡', '失眠', '黑眼圈'],
      overeat: ['暴食', '吃撑', '吃太多', '大餐', '火锅', '烧烤', '油腻'],
      indigestion: ['消化不良', '腹胀', '嗳气', '打嗝', '胃胀'],
      stomachache: ['胃痛', '胃不舒服', '反酸', '胃酸', '胃痉挛'],
      stress: ['压力', '焦虑', '紧张', '烦躁', '情绪', '崩溃'],
      fatigue: ['疲劳', '没精神', '乏力', '困', '累'],
      insomnia: ['失眠', '睡不着', '睡不好', '多梦', '早醒'],
      constipation: ['便秘', '拉不出', '排便困难', '肚子胀'],
      heat: ['上火', '口干', '口臭', '咽痛', '喉咙痛', '口腔溃疡'],
      ulcer: ['口腔溃疡', '溃疡', '嘴破', '口破'],
      cold: ['感冒', '鼻塞', '流鼻涕', '咳嗽', '发烧'],
      sorethroat: ['喉咙痛', '咽痛', '嗓子疼', '咽喉不适'],
      headache: ['头痛', '偏头痛', '头晕', '太阳穴'],
      edema: ['水肿', '浮肿', '脸肿', '腿肿']
    }
    const extra = synonyms[symptom.id] || []
    return base.concat(extra).map(s => this.normalizeText(s))
  },

  computeScores(actionText, customSymptoms, selectedIds) {
    const text = this.normalizeText([actionText, customSymptoms].filter(Boolean).join(' '))
    const selected = new Set(selectedIds || [])
    const symptoms = this.data.symptoms || []

    const results = symptoms.map(symptom => {
      let score = 0
      let hits = 0

      if (selected.has(symptom.id)) score += 6

      const keywords = this.getSymptomKeywordIndex(symptom)
      if (text) {
        for (const kw of keywords) {
          if (!kw) continue
          if (text.includes(kw)) hits += 1
        }
      }
      score += Math.min(hits, 6) * 2

      if (text) {
        if ((text.includes('喝酒') || text.includes('酒')) && symptom.id === 'hangover') score += 3
        if ((text.includes('熬夜') || text.includes('通宵') || text.includes('加班')) && (symptom.id === 'stayup' || symptom.id === 'insomnia' || symptom.id === 'fatigue')) score += 2
        if ((text.includes('火锅') || text.includes('烧烤') || text.includes('辣') || text.includes('油腻')) && (symptom.id === 'heat' || symptom.id === 'stomachache' || symptom.id === 'indigestion')) score += 2
        if ((text.includes('吃撑') || text.includes('暴食') || text.includes('吃太多')) && (symptom.id === 'overeat' || symptom.id === 'indigestion')) score += 2
        if ((text.includes('压力') || text.includes('焦虑') || text.includes('紧张')) && (symptom.id === 'stress' || symptom.id === 'insomnia')) score += 2
      }

      return { ...symptom, score }
    })

    return results
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  },

  run() {
    if (this.data.loading) return
    const now = Date.now()
    if (this._lastRunAt && now - this._lastRunAt < 350) return
    this._lastRunAt = now

    const actionText = this.data.actionText || ''
    const customSymptoms = this.data.customSymptoms || ''
    const selectedIds = this.data.selectedIds || []

    if (!actionText.trim() && !customSymptoms.trim() && selectedIds.length === 0) {
      util.showToast('先输入一点信息或选择症状', 'none')
      return
    }

    this.setData({ loading: true, hasRun: true })
    try {
      const matched = this.computeScores(actionText, customSymptoms, selectedIds)
      this.setData({ matchedSymptoms: matched, loading: false })
      wx.vibrateShort()
    } catch (e) {
      console.error('triage run error', e)
      this.setData({ matchedSymptoms: [], loading: false })
      util.showToast('生成失败，请重试', 'none')
    }
  },

  goToSolutions(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.vibrateShort()
    wx.navigateTo({ url: `/packageHealth/remedy/remedy?symptom=${id}` })
  },

  goToAnalysis(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const symptom = (this.data.symptoms || []).find(s => s.id === id)
    const name = symptom ? encodeURIComponent(symptom.name) : ''
    const desc = symptom ? encodeURIComponent(symptom.desc || '') : ''
    wx.vibrateShort()
    wx.navigateTo({ url: `/packageHealth/remedy-symptom/remedy-symptom?id=${id}&name=${name}&desc=${desc}` })
  }
})

