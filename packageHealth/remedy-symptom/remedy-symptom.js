// pages/remedy-symptom/remedy-symptom.js - 症状专门分析与建议页
const util = require('../../utils/util.js')
const api = require('../../utils/api.js')
const { normalizeRemedyList, buildRemedyCopyText } = require('../../utils/remedy-normalize.js')

// 症状展示用图标（与 remedy 页一致）
const SYMPTOM_ICONS = {
  hangover: '🍺', stayup: '🌙', overeat: '🍕', stomachache: '😰', stress: '😫',
  fatigue: '😴', insomnia: '🌃', indigestion: '🤢', cold: '🤧', constipation: '😣',
  skin: '✨', menstrual: '🌸', headache: '😵', sorethroat: '😷', lowimmunity: '🛡️',
  heat: '🔥', ulcer: '🫦', edema: '💧'
}

// 各症状的简要分析与生活建议（用于专门分析页）
const SYMPTOM_ANALYSIS = {
  hangover: {
    summary:
      '酒精主要在肝脏代谢为乙醛，刺激胃肠并利尿，易脱水、低血糖与电解质紊乱，常见头痛、恶心、乏力、心慌。多数轻度不适可在24～48小时内随休息与补液缓解。',
    severityHint:
      '轻度：口渴头痛可先补液、清淡饮食观察。若反复呕吐、站起晕厥；或出现意识模糊、胸痛、呕血、剧烈腹痛，请立即就医。',
    advice: [
      '小口多次喝温水或按说明口服补液盐，避免一次性牛饮冰水',
      '优选温热易消化食物（粥、苏打饼、香蕉），暂缓烧烤油炸与辛辣',
      '至少24小时内不再饮酒；咖啡、浓茶过量可能加重心悸',
      '保证睡眠；次日可适量补充复合B族与优质蛋白，勿迷信「解酒神药」',
      '服用任何药物前请阅读说明书，慢性病患者建议咨询医师'
    ]
  },
  stayup: {
    summary:
      '熬夜会抑制褪黑素、打乱皮质醇节律，影响肝脏代谢与皮肤修复；短期表现为眼干、注意力下降、暗沉与胃口异常。',
    severityHint: '连续通宵或出现胸闷、心律失常时勿硬扛，需医学评估。',
    advice: [
      '次日补觉不超过2小时，以免夜间再次失眠',
      '多摄入叶黄素、花色苷（深色蔬果）与充足饮水，少空腹灌咖啡',
      '午后小睡20～30分钟，胜过长时间昏睡到傍晚',
      '次日避免高强度与高糖饮食「代偿」，逐步拉回固定起床时间'
    ]
  },
  overeat: {
    summary:
      '胃容量与消化酶分泌有限，暴饮暴食易致胃胀、反酸、胰岛素剧烈波动；心理上也易出现「破罐破摔」式连续高热量进食。',
    advice: [
      '下一餐可减半热量，以清蒸、炖煮为主，给胃肠留白',
      '温水、陈皮山楂类温和饮品优于冰镇甜饮',
      '餐后散步15～20分钟，避免立刻躺卧或剧烈运动',
      '记录进食速度，尝试每口咀嚼20次以上，打断「机械性吃撑」'
    ]
  },
  stomachache: {
    summary: '胃痛常见于饮食不当、受凉、压力或胃炎等，表现为上腹不适、胀气、反酸等。',
    advice: ['避免生冷、辛辣、过甜过酸', '少食多餐，细嚼慢咽', '注意腹部保暖', '若持续或加重请就医']
  },
  stress: {
    summary: '长期压力会影响睡眠、食欲与免疫力，并增加皮质醇，不利于体重与情绪稳定。',
    advice: ['保证睡眠与规律作息', '适量运动有助释放压力', '可适当补充镁、B 族等营养素', '必要时寻求心理或社交支持']
  },
  fatigue: {
    summary: '疲劳多与睡眠不足、营养不均衡、运动过量或贫血等有关，需从休息与饮食两方面调节。',
    advice: ['保证 7–8 小时睡眠', '均衡三餐，适当增加优质蛋白与复合碳水', '避免依赖咖啡因提神', '适度运动改善体能']
  },
  insomnia: {
    summary: '失眠与作息、压力、饮食（如睡前饱食、咖啡因）有关，影响日间精力与代谢。',
    advice: ['固定起床与就寝时间', '睡前避免屏幕、咖啡因与过饱', '可尝试热牛奶、酸枣仁等助眠食物', '营造安静、暗的睡眠环境']
  },
  indigestion: {
    summary: '消化不良多因进食过快、过饱或食物难消化，导致腹胀、嗳气、食欲下降。',
    advice: ['细嚼慢咽，少食多餐', '减少油腻与产气食物', '饭后可散步，不要马上躺下', '可适当食用助消化食物']
  },
  cold: {
    summary: '感冒时身体需要更多水分与营养支持免疫，同时消化能力会略下降，宜选温和、易吸收的食物。',
    advice: ['多喝温水，保证休息', '选择清淡、温热、易消化饮食', '适当补充维 C 与蛋白质', '严重或高热请就医']
  },
  constipation: {
    summary: '便秘与纤维摄入不足、饮水少、久坐、肠道蠕动慢等有关，需增加纤维与水分并养成排便习惯。',
    advice: ['增加蔬菜、水果、全谷物', '每日足量饮水', '养成定时排便习惯', '适量运动促进肠道蠕动']
  },
  heat: {
    summary: '“上火”常表现为口干、咽喉不适、口疮等，与饮食辛辣、熬夜、情绪紧张有关。',
    advice: ['多喝水，少吃辛辣油炸', '可选绿豆、雪梨等清热食物', '保证休息，避免熬夜', '症状重或反复请就医']
  },
  ulcer: {
    summary: '口腔溃疡与缺乏 B 族维生素、压力、局部刺激等有关，需避免刺激并促进黏膜修复。',
    advice: ['避免辛辣、过烫、过硬食物', '补充 B 族维生素与维 C', '淡盐水漱口保持清洁', '若反复发作或久不愈合请就医']
  },
  edema: {
    summary: '水肿与钠摄入过多、久坐、循环或代谢有关，需控盐、适量活动并配合利水食物。',
    advice: ['控制盐与加工食品', '适量运动，避免久坐久站', '可适当食用利水食物', '若持续或加重请就医']
  },
  headache: { summary: '头痛可能与脱水、疲劳、紧张、睡眠不足有关。', advice: ['保证饮水与休息', '避免强光与噪音', '可热敷或轻柔按摩', '反复或剧烈请就医'] },
  sorethroat: { summary: '喉咙痛常见于感冒或用嗓过度，需润喉、消炎与休息。', advice: ['多喝温水，少说话', '避免辛辣刺激', '可含润喉糖或淡盐水漱口', '加重或发热请就医'] },
  lowimmunity: { summary: '免疫力下降与睡眠、营养、压力、缺乏运动等有关。', advice: ['均衡饮食，足量蛋白与维 C', '保证睡眠与休息', '适度运动', '可适当补充益生菌'] },
  skin: { summary: '皮肤状态与饮食、睡眠、防晒、保湿等有关。', advice: ['均衡饮食，多蔬果', '足量饮水，少糖少油', '做好防晒与保湿', '保证睡眠'] },
  menstrual: { summary: '经期不适与激素波动、缺铁、受凉等有关。', advice: ['注意保暖，避免生冷', '适当补铁与优质蛋白', '减少咖啡因与高盐', '休息充足，避免剧烈运动'] }
}

function getDefaultAnalysis(id) {
  return {
    summary: '该症状与日常饮食、作息、情绪等密切相关，及时调整生活方式并配合饮食有助于改善。',
    advice: ['保持规律作息', '均衡饮食', '适量运动', '必要时就医检查']
  }
}

Page({
  data: {
    symptomId: '',
    symptomName: '',
    symptomIcon: '💊',
    symptomDesc: '',
    analysis: { summary: '', advice: [] },
    remedies: [],
    loading: true,
    showDetail: false,
    selectedRemedy: null
  },

  onLoad(options) {
    const id = options.id || options.symptom || ''
    const name = decodeURIComponent(options.name || '')
    const icon = SYMPTOM_ICONS[id] || '💊'
    const desc = decodeURIComponent(options.desc || '')
    const analysis = SYMPTOM_ANALYSIS[id] ? { ...SYMPTOM_ANALYSIS[id] } : getDefaultAnalysis(id)
    if (!analysis.advice || !analysis.advice.length) {
      analysis.advice = getDefaultAnalysis(id).advice
    }

    wx.setNavigationBarTitle({ title: name ? `${name} · 分析与建议` : '症状分析' })

    this.setData({
      symptomId: id,
      symptomName: name,
      symptomIcon: icon,
      symptomDesc: desc,
      analysis
    })

    this.loadRemedies(id)
  },

  async loadRemedies(symptomId) {
    this.setData({ loading: true })
    try {
      const res = await api.getRemedySolutions(symptomId)
      const raw = res.solutions || res.list || []
      const list = normalizeRemedyList(raw)
      this.setData({ remedies: list, loading: false })
    } catch (e) {
      const pages = getCurrentPages()
      const prev = pages.length >= 2 ? pages[pages.length - 2] : null
      const raw = (prev && typeof prev.getLocalRemedyData === 'function')
        ? prev.getLocalRemedyData(symptomId) : []
      const list = normalizeRemedyList(raw || [])
      this.setData({ remedies: list, loading: false })
    }
  },

  copyRecipe(e) {
    const remedy = e.currentTarget.dataset.remedy
    const text = buildRemedyCopyText(remedy)
    if (!text || !String(text).trim()) {
      util.showToast('暂无可复制内容', 'none')
      return
    }
    wx.setClipboardData({
      data: text,
      success: () => util.showToast('已复制到剪贴板', 'success')
    })
    wx.vibrateShort()
  },

  viewDetail(e) {
    const remedy = e.currentTarget.dataset.remedy
    this.setData({ selectedRemedy: remedy, showDetail: true })
    wx.vibrateShort()
  },

  closeDetail() {
    this.setData({ showDetail: false, selectedRemedy: null })
  },

  stopPropagation() {},

  recordRemedyUsage(remedy) {
    if (!remedy) return
    const usageHistory = wx.getStorageSync('remedy_usage_history') || []
    const usage = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      remedyId: remedy.id,
      remedyName: remedy.name,
      symptom: this.data.symptomName || '',
      timestamp: new Date().toISOString()
    }
    usageHistory.unshift(usage)
    if (usageHistory.length > 50) usageHistory.pop()
    wx.setStorageSync('remedy_usage_history', usageHistory)
  },

  async addToPlan(e) {
    const remedy = e.currentTarget.dataset.remedy
    if (!remedy) return
    wx.showModal({
      title: '确认添加',
      content: `确定将「${remedy.name}」加入下一餐计划吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.addRemedyToPlan(remedy.id)
            util.showToast('已添加到计划', 'success')
            this.recordRemedyUsage(remedy)
          } catch (err) {
            util.showToast('已添加到计划', 'success')
            this.recordRemedyUsage(remedy)
          }
        }
      }
    })
  }
})
