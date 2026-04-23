// pages/ai-nutritionist/ai-nutritionist.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')
const notifications = require('../../utils/notifications.js')

const CONVERSATIONS_KEY = 'aiNutritionistConversations'
const CURRENT_CONVERSATION_ID_KEY = 'aiNutritionistCurrentId'
const CONVERSATION_LIMIT = 20

Page({
  data: {
    messages: [],
    inputText: '',
    isTyping: false,
    scrollIntoView: '',
    dailySummary: null,
    userProfile: null,
    caloriePercent: 0,
    proteinPercent: 0,
    carbPercent: 0,
    fatPercent: 0,
    proteinG: 0,
    carbG: 0,
    fatG: 0,
    proteinTargetG: 0,
    carbTargetG: 0,
    fatTargetG: 0,
    macroHint: '',
    remainingLabel: '剩余',
    remainingValue: 0,
    remainingClass: 'positive',
    quickQuestions: [
      '今天还能吃什么？',
      '如何增加蛋白质摄入？',
      '减脂期应该怎么吃？',
      '晚上饿了可以吃什么？',
      '增肌需要多少蛋白质？',
      '运动后应该吃什么？'
    ],
    msgId: 0,
    pendingAttachments: [], // 待发送附件列表
    unreadCount: 0,
    isStatusCompact: false,
    statusCompactThreshold: 140,

    // 对话历史（本地存储）
    conversations: [],
    currentConversationId: null,
    currentConversationTitle: '新对话',
    showConversationList: false
  },

  onLoad() {
    this.initConversations()
    this.loadUserData()
    this.refreshUnread()
  },

  onShow() {
    this.loadUserData()
    this.refreshUnread()
  },

  onUnload() {
    if (this._streamTask && typeof this._streamTask.abort === 'function') {
      try {
        this._streamTask.abort()
      } catch (e) {}
      this._streamTask = null
    }
    if (this._typewriterTimer) {
      clearInterval(this._typewriterTimer)
      this._typewriterTimer = null
    }
    if (this._scrollThrottleTimer) {
      clearTimeout(this._scrollThrottleTimer)
      this._scrollThrottleTimer = null
    }
    this.saveCurrentConversation()
  },

  onChatScroll(e) {
    const scrollTop = e && e.detail ? (e.detail.scrollTop || 0) : 0
    // 滞回：仅在「向下越过上限」时收合、在「向上越过下限」时展开，避免在阈值附近抖动反复 setData 导致概览卡闪烁
    const enter = this.data.statusCompactThreshold || 140
    const leave = Math.max(0, enter - 72)
    const compact = this.data.isStatusCompact
    if (!compact && scrollTop >= enter) {
      this.setData({ isStatusCompact: true })
    } else if (compact && scrollTop <= leave) {
      this.setData({ isStatusCompact: false })
    }
  },

  async loadUserData() {
    try {
      const [profile, summary] = await Promise.all([
        api.getUserProfile().catch(() => null),
        api.getDailySummary().catch(() => null)
      ])

      const consumed = summary ? (summary.consumed ?? summary.intake_actual ?? 0) : 0
      const target = summary ? (summary.target ?? summary.daily_limit ?? 2000) : 2000
      let caloriePercent = 0
      let proteinPercent = 0
      let carbPercent = 0
      let fatPercent = 0
      let proteinG = 0
      let carbG = 0
      let fatG = 0
      let proteinTargetG = 0
      let carbTargetG = 0
      let fatTargetG = 0
      let macroHint = ''

      if (summary) {
        caloriePercent = Math.round((consumed / target) * 100)

        if (summary.macros) {
          const macros = summary.macros

          // 兼容两种结构：
          // 1) { protein: { consumed, target }, carb: { consumed, target }, fat: { consumed, target } }
          // 2) { proteing, carbg, fatg }（模拟数据）
          proteinG = Math.round((macros.protein && (macros.protein.consumed ?? macros.protein.g)) ?? macros.proteing ?? macros.protein_g ?? 0)
          carbG = Math.round((macros.carb && (macros.carb.consumed ?? macros.carb.g)) ?? macros.carbg ?? macros.carb_g ?? 0)
          fatG = Math.round((macros.fat && (macros.fat.consumed ?? macros.fat.g)) ?? macros.fatg ?? macros.fat_g ?? 0)

          proteinTargetG = Math.round((macros.protein && (macros.protein.target ?? macros.protein.goal)) ?? 100)
          carbTargetG = Math.round((macros.carb && (macros.carb.target ?? macros.carb.goal)) ?? 250)
          fatTargetG = Math.round((macros.fat && (macros.fat.target ?? macros.fat.goal)) ?? 60)

          proteinPercent = proteinTargetG > 0 ? Math.min(100, Math.round((proteinG / proteinTargetG) * 100)) : 0
          carbPercent = carbTargetG > 0 ? Math.min(100, Math.round((carbG / carbTargetG) * 100)) : 0
          fatPercent = fatTargetG > 0 ? Math.min(100, Math.round((fatG / fatTargetG) * 100)) : 0

          const lack = []
          if (proteinTargetG > 0 && proteinG < Math.round(proteinTargetG * 0.75)) lack.push('蛋白偏低')
          if (carbTargetG > 0 && carbG < Math.round(carbTargetG * 0.6)) lack.push('碳水偏低')
          if (fatTargetG > 0 && fatG < Math.round(fatTargetG * 0.6)) lack.push('脂肪偏低')
          if (lack.length === 0) {
            macroHint = '三大营养素进度不错，继续保持均衡'
          } else {
            macroHint = `今日重点：${lack.slice(0, 2).join('、')}`
          }
        }
      }

      const dailySummary = summary ? { consumed, target } : null
      const remaining = target - consumed
      this.setData({
        dailySummary,
        userProfile: profile,
        caloriePercent: Math.min(caloriePercent, 100),
        proteinPercent,
        carbPercent,
        fatPercent,
        proteinG,
        carbG,
        fatG,
        proteinTargetG,
        carbTargetG,
        fatTargetG,
        macroHint,
        remainingLabel: remaining >= 0 ? '剩余' : '超出',
        remainingValue: Math.abs(remaining),
        remainingClass: remaining >= 0 ? 'positive' : 'exceed'
      })
    } catch (e) {
      console.error('加载用户数据失败', e)
    }
  },

  initConversations() {
    const conversations = wx.getStorageSync(CONVERSATIONS_KEY) || []
    // 按更新时间倒序
    conversations.sort((a, b) => new Date(b.updateTime || b.update_time || 0) - new Date(a.updateTime || a.update_time || 0))
    const limited = conversations.slice(0, CONVERSATION_LIMIT)

    const currentId = wx.getStorageSync(CURRENT_CONVERSATION_ID_KEY)
    const current = limited.find(c => c.id === currentId)

    if (!current) {
      this.setData({ conversations: limited, currentConversationId: null, messages: [], msgId: 0 }, () => {
        this.createNewConversation({ silent: true })
      })
      return
    }

    const currentMessages = current.messages || []
    const maxId = currentMessages.reduce((acc, m) => Math.max(acc, m && m.id ? m.id : 0), 0)

    this.setData({
      conversations: limited,
      currentConversationId: current.id,
      currentConversationTitle: current.title || '新对话',
      messages: currentMessages,
      msgId: maxId
    }, () => {
      this.scrollToBottom()
    })
  },

  formatConversationTime(d) {
    const date = d instanceof Date ? d : new Date(d)
    const pad = (n) => String(n).padStart(2, '0')
    return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  },

  buildConversationTitle(messages) {
    const firstUser = (messages || []).find(m => m && m.role === 'user' && m.content)
    const content = firstUser ? String(firstUser.content) : ''
    const t = content.replace(/\s+/g, ' ').trim()
    if (!t) return '新对话'
    // 标题控制长度：尽量保持“卡片宽度友好”
    return t.length > 10 ? `${t.slice(0, 10)}…` : t
  },

  createNewConversation(options = {}) {
    if (this._streamTask && typeof this._streamTask.abort === 'function') {
      try {
        this._streamTask.abort()
      } catch (e) {}
      this._streamTask = null
    }
    if (this._typewriterTimer) {
      clearInterval(this._typewriterTimer)
      this._typewriterTimer = null
    }

    const newId = `conv_${Date.now()}`
    const now = new Date()

    const newConversation = {
      id: newId,
      title: '新对话',
      messages: [],
      createTime: now.toISOString(),
      updateTime: this.formatConversationTime(now)
    }

    const conversations = [newConversation, ...(this.data.conversations || [])]
    const limited = conversations.slice(0, CONVERSATION_LIMIT)

    wx.setStorageSync(CONVERSATIONS_KEY, limited)
    wx.setStorageSync(CURRENT_CONVERSATION_ID_KEY, newId)

    this.setData({
      conversations: limited,
      currentConversationId: newId,
      currentConversationTitle: '新对话',
      messages: [],
      msgId: 0,
      inputText: '',
      isTyping: false,
      pendingAttachments: [],
      showConversationList: false,
      scrollIntoView: 'scroll-anchor'
    })

    if (!options.silent) {
      util.showToast && util.showToast('已创建新对话', 'success')
    }
  },

  openConversationList() {
    this.setData({ showConversationList: true })
  },

  hideConversationList() {
    this.setData({ showConversationList: false })
  },

  stopPropagation() {},

  saveCurrentConversation(messagesOverride) {
    const id = this.data.currentConversationId
    if (!id) return

    const conversations = this.data.conversations || []
    const idx = conversations.findIndex(c => c && c.id === id)
    if (idx === -1) return

    const messages = messagesOverride || this.data.messages || []
    const now = new Date()

    const updated = {
      ...conversations[idx],
      title: this.buildConversationTitle(messages),
      messages,
      updateTime: this.formatConversationTime(now)
    }

    const nextConversations = conversations.map((c, i) => (i === idx ? updated : c)).slice(0, CONVERSATION_LIMIT)
    wx.setStorageSync(CONVERSATIONS_KEY, nextConversations)
    this.setData({ conversations: nextConversations })
  },

  switchConversation(e) {
    const id = e && e.currentTarget ? e.currentTarget.dataset.id : null
    if (!id) return

    const conversation = (this.data.conversations || []).find(c => c.id === id)
    if (!conversation) return

    if (this._streamTask && typeof this._streamTask.abort === 'function') {
      try {
        this._streamTask.abort()
      } catch (e) {}
      this._streamTask = null
    }
    if (this._typewriterTimer) {
      clearInterval(this._typewriterTimer)
      this._typewriterTimer = null
    }

    // 先保存当前对话
    this.saveCurrentConversation()

    const nextMessages = conversation.messages || []
    const maxId = nextMessages.reduce((acc, m) => Math.max(acc, m && m.id ? m.id : 0), 0)

    this.setData({
      currentConversationId: id,
      currentConversationTitle: conversation.title || '新对话',
      messages: nextMessages,
      msgId: maxId,
      showConversationList: false
    }, () => {
      this.scrollToBottom()
      wx.setStorageSync(CURRENT_CONVERSATION_ID_KEY, id)
    })
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  refreshUnread() {
    const count = notifications.getUnreadCount()
    this.setData({ unreadCount: count })
  },

  openNotifications() {
    wx.navigateTo({
      url: '/packageCommunity/notifications/notifications'
    })
  },

  goSnapScan() {
    wx.navigateTo({
      url: '/packageCook/snap-scan/snap-scan'
    })
  },

  goLogIntake() {
    wx.navigateTo({
      url: '/packageHealth/intake-edit/index'
    })
  },

  goSmartChoice() {
    wx.navigateTo({
      url: '/packageCook/smart-choice/smart-choice'
    })
  },

  goReport() {
    wx.switchTab({
      url: '/pages/report/report'
    })
  },

  askQuestion(e) {
    const question = e.currentTarget.dataset.question
    if (question) {
      this.setData({ inputText: question })
      this.sendMessage()
    }
  },

  chooseAttachment() {
    wx.showActionSheet({
      itemList: ['上传图片', '上传文档'],
      success: (res) => {
        if (res.tapIndex === 0) this.chooseImages()
        if (res.tapIndex === 1) this.chooseDocs()
      }
    })
  },

  chooseImages() {
    const remain = Math.max(0, 6 - (this.data.pendingAttachments?.length || 0))
    if (remain <= 0) {
      wx.showToast({ title: '最多添加6个附件', icon: 'none' })
      return
    }
    const choose = wx.chooseMedia || null
    if (choose) {
      wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: (res) => {
          const files = (res.tempFiles || []).map(f => ({
            localPath: f.tempFilePath,
            name: (f.tempFilePath || '').split('/').pop() || 'image',
            size: f.size
          }))
          this.addPendingAttachments(files.map(f => ({
            kind: 'image',
            localPath: f.localPath,
            name: f.name,
            size: f.size
          })))
        }
      })
      return
    }
    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = res.tempFilePaths || []
        this.addPendingAttachments(paths.map(p => ({
          kind: 'image',
          localPath: p,
          name: (p || '').split('/').pop() || 'image'
        })))
      }
    })
  },

  chooseDocs() {
    const remain = Math.max(0, 6 - (this.data.pendingAttachments?.length || 0))
    if (remain <= 0) {
      wx.showToast({ title: '最多添加6个附件', icon: 'none' })
      return
    }
    if (!wx.chooseMessageFile) {
      wx.showToast({ title: '当前基础库不支持选择文件', icon: 'none' })
      return
    }
    wx.chooseMessageFile({
      count: remain,
      type: 'file',
      success: (res) => {
        const files = res.tempFiles || []
        this.addPendingAttachments(files.map(f => ({
          kind: 'file',
          localPath: f.path,
          name: f.name || (f.path || '').split('/').pop() || 'file',
          size: f.size,
          mimeType: f.type || ''
        })))
      }
    })
  },

  addPendingAttachments(items) {
    const now = Date.now()
    const list = [...(this.data.pendingAttachments || [])]
    items.forEach((it, idx) => {
      list.push({
        id: `att_${now}_${idx}_${Math.floor(Math.random() * 1000)}`,
        kind: it.kind,
        localPath: it.localPath,
        name: it.name,
        size: it.size,
        mimeType: it.mimeType,
        status: 'local', // local | uploading | uploaded | failed
        url: ''
      })
    })
    this.setData({ pendingAttachments: list })
  },

  removePendingAttachment(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const list = (this.data.pendingAttachments || []).filter(x => x.id !== id)
    this.setData({ pendingAttachments: list })
  },

  previewAttachment(e) {
    const id = e.currentTarget.dataset.id
    const item = (this.data.pendingAttachments || []).find(x => x.id === id)
    if (!item || item.kind !== 'image') return
    wx.previewImage({
      current: item.localPath,
      urls: (this.data.pendingAttachments || []).filter(x => x.kind === 'image').map(x => x.localPath)
    })
  },

  openAttachment(e) {
    const id = e.currentTarget.dataset.id
    const item = (this.data.pendingAttachments || []).find(x => x.id === id)
    if (!item || item.kind !== 'file') return
    wx.openDocument({
      filePath: item.localPath,
      showMenu: true,
      fail: () => wx.showToast({ title: '无法打开该文件', icon: 'none' })
    })
  },

  scrollToBottom() {
    const msgs = this.data.messages
    if (msgs && msgs.length > 0) {
      const lastId = msgs[msgs.length - 1].id
      this.setData({ scrollIntoView: `msg-${lastId}` })
    } else {
      this.setData({ scrollIntoView: 'scroll-anchor' })
    }
  },

  scrollToBottomThrottled() {
    if (this._scrollThrottleTimer) return
    this._scrollThrottleTimer = setTimeout(() => {
      this._scrollThrottleTimer = null
      this.scrollToBottom()
    }, 100)
  },

  /**
   * 非流式接口回退：整段文本逐字显现（打字机），结束时写入 suggestions。
   */
  typewriterReveal(aiMsgId, fullText, suggestions) {
    return new Promise((resolve) => {
      if (this._typewriterTimer) {
        clearInterval(this._typewriterTimer)
        this._typewriterTimer = null
      }
      const text = fullText == null ? '' : String(fullText)
      const charsPerTick = 4
      const intervalMs = 26
      let i = 0
      const len = text.length
      const sug = suggestions || []

      const step = () => {
        i = Math.min(len, i + charsPerTick)
        const partial = text.slice(0, i)
        const streaming = i < len
        if (!streaming && this._typewriterTimer) {
          clearInterval(this._typewriterTimer)
          this._typewriterTimer = null
        }
        const msgs = this.data.messages.map((m) =>
          m.id === aiMsgId
            ? { ...m, content: partial, streaming, suggestions: streaming ? [] : sug }
            : m
        )
        this.setData({ messages: msgs, isTyping: streaming }, () => {
          this.scrollToBottomThrottled()
          if (!streaming) {
            this.saveCurrentConversation(msgs)
            resolve()
          }
        })
      }

      if (len === 0) {
        const msgs = this.data.messages.map((m) =>
          m.id === aiMsgId ? { ...m, content: '', streaming: false, suggestions: sug } : m
        )
        this.setData({ messages: msgs, isTyping: false }, () => {
          this.saveCurrentConversation(msgs)
          resolve()
        })
        return
      }

      step()
      if (i < len) {
        this._typewriterTimer = setInterval(step, intervalMs)
      }
    })
  },

  async sendMessage() {
    const text = this.data.inputText.trim()
    const hasAttachments = (this.data.pendingAttachments || []).length > 0
    if ((!text && !hasAttachments) || this.data.isTyping) {
      return
    }

    const msgId = this.data.msgId + 1
    const aiMsgId = msgId + 1
    const now = new Date()
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`

    const pending = this.data.pendingAttachments || []
    const userMsg = {
      id: msgId,
      role: 'user',
      content: text,
      time: timeStr,
      attachments: pending.map(a => ({
        kind: a.kind,
        name: a.name,
        localPath: a.localPath,
        url: a.url || ''
      }))
    }

    const aiPlaceholder = {
      id: aiMsgId,
      role: 'ai',
      content: '',
      streaming: true,
      time: timeStr,
      suggestions: []
    }

    const nextMessages = [...this.data.messages, userMsg, aiPlaceholder]
    this.setData({
      messages: nextMessages,
      inputText: '',
      isTyping: true,
      msgId: aiMsgId,
      scrollIntoView: `msg-${aiMsgId}`,
      pendingAttachments: []
    })
    this.saveCurrentConversation(nextMessages)
    this.scrollToBottom()

    try {
      let uploadedAttachments = []
      try {
        uploadedAttachments = await this.prepareAttachmentsForSend(pending)
      } catch (attErr) {
        console.warn('附件上传异常', attErr)
      }

      const ctx = {
        profile: this.data.userProfile,
        summary: this.data.dailySummary,
        attachments: uploadedAttachments
      }

      try {
        await api.askAIStream(text, ctx, {
          onRequestTask: (t) => {
            this._streamTask = t
          },
          onDelta: (delta) => {
            const msgs = this.data.messages.map((m) =>
              m.id === aiMsgId ? { ...m, content: (m.content || '') + delta } : m
            )
            this.setData({ messages: msgs }, () => this.scrollToBottomThrottled())
          },
          onDone: ({ suggestions: sug }) => {
            this._streamTask = null
            const suggestions = sug || []
            const msgs = this.data.messages.map((m) =>
              m.id === aiMsgId ? { ...m, streaming: false, suggestions } : m
            )
            this.setData({ messages: msgs, isTyping: false }, () => {
              this.saveCurrentConversation(msgs)
              this.scrollToBottom()
            })
          },
          onError: () => {}
        })
      } catch (streamErr) {
        this._streamTask = null
        let answer = ''
        let suggestions = []
        try {
          const result = await api.askAI(text, ctx)
          if (result && result.answer) {
            answer = result.answer
            suggestions = result.suggestions || []
          } else {
            throw new Error('API返回格式错误')
          }
        } catch (e) {
          console.warn('AI API调用失败，使用本地生成', e)
          const localResult = this.generateLocalAnswer(text)
          answer = localResult.answer
          suggestions = localResult.suggestions
        }
        await this.typewriterReveal(aiMsgId, answer, suggestions)
      }
    } catch (e) {
      console.error('发送消息失败', e)
      this._streamTask = null
      this.setData({ isTyping: false })
      const msgs = (this.data.messages || []).filter((m) => m.id !== aiMsgId)
      this.setData({ messages: msgs })
      wx.showToast({ title: '回复失败，请重试', icon: 'none' })
    }
  },

  async prepareAttachmentsForSend(list) {
    if (!list || list.length === 0) return []
    const results = []
    for (const att of list) {
      try {
        const uploaded = await api.uploadAttachment(att.localPath, att.name)
        const url = uploaded?.url || uploaded?.file_url || uploaded?.path || ''
        results.push({
          kind: att.kind,
          name: att.name,
          url: url || att.localPath,
          size: att.size,
          mimeType: att.mimeType
        })
      } catch (e) {
        // 后端未接入/上传失败时降级：仍携带本地路径（便于后续补接口）
        results.push({
          kind: att.kind,
          name: att.name,
          url: att.localPath,
          size: att.size,
          mimeType: att.mimeType,
          uploadFailed: true
        })
      }
    }
    return results
  },

  generateLocalAnswer(question) {
    const q = question.toLowerCase()
    const profile = this.data.userProfile
    const summary = this.data.dailySummary
    let answer = ''
    let suggestions = []

    if (q.includes('还能吃') || q.includes('剩余') || q.includes('今天')) {
      const remaining = summary ? (summary.target - summary.consumed) : 800
      if (remaining > 500) {
        answer = `您今天还有约 ${remaining} kcal 的热量额度，可以正常安排一餐。\n\n推荐搭配：\n• 主食：糙米饭/全麦面包 100g（约120kcal）\n• 蛋白质：鸡胸肉150g（约165kcal）\n• 蔬菜：西兰花/菠菜 200g（约50kcal）\n• 优质脂肪：橄榄油 5ml（约45kcal）\n\n这样搭配营养均衡，热量约380kcal，还有余量可以适当加餐。`
        suggestions = ['有什么低卡零食推荐？', '晚餐吃什么好？']
      } else if (remaining > 200) {
        answer = `您今天还剩 ${remaining} kcal，建议选择低卡高蛋白食物。\n\n推荐选择：\n• 希腊酸奶 150g（约90kcal）\n• 水煮蛋 2个（约140kcal）\n• 蔬菜沙拉（少油）\n• 清蒸鱼 100g（约100kcal）\n\n避免：油炸食品、甜点、含糖饮料`
        suggestions = ['可以吃水果吗？', '喝什么饮料好？']
      } else {
        answer = `您今天的热量已经${remaining < 0 ? '超出' + Math.abs(remaining) : '接近目标，仅剩' + remaining}kcal。\n\n建议：\n• 如果还饿，可以选择黄瓜、西红柿等几乎零热量的蔬菜\n• 喝水或无糖茶来增加饱腹感\n• 适当散步30分钟可以消耗约100kcal\n\n不用太担心，偶尔超标是正常的，明天继续保持就好！`
        suggestions = ['如何增加运动量？', '明天怎么调整饮食？']
      }
    } else if (q.includes('蛋白质') || q.includes('蛋白')) {
      const proteinNeed = profile ? Math.round(profile.weight * 1.5) : 75
      answer = `增加蛋白质摄入的方法：\n\n🥩 优质蛋白来源（每100g）：\n• 鸡胸肉：31g蛋白质\n• 瘦牛肉：26g蛋白质\n• 三文鱼：25g蛋白质\n• 虾仁：24g蛋白质\n• 鸡蛋：13g蛋白质（约2个）\n• 豆腐：8g蛋白质\n• 希腊酸奶：10g蛋白质\n\n💡 建议：\n• ${profile ? `您的体重${profile.weight}kg，建议每日摄入${proteinNeed}g蛋白质` : '建议每kg体重摄入1.2-1.6g蛋白质'}\n• 每餐都包含优质蛋白\n• 运动后30分钟内补充20-30g蛋白质`
      suggestions = ['运动后吃什么补充蛋白？', '植物蛋白有哪些？']
    } else if (q.includes('减脂') || q.includes('减肥') || q.includes('瘦')) {
      answer = `减脂期饮食建议：\n\n📊 热量控制：\n• 创造300-500kcal的热量缺口\n• ${summary ? `您当前目标${summary.target}kcal，建议控制在${summary.target - 300}kcal` : '根据您的基础代谢计算每日热量'}\n\n🍽️ 饮食原则：\n• 高蛋白：防止肌肉流失，每kg体重1.2-1.6g\n• 低碳水：减少精制碳水，选择全谷物\n• 多蔬菜：增加饱腹感，补充纤维\n• 适量脂肪：选择不饱和脂肪酸\n\n⏰ 进餐时间：\n• 规律三餐，避免饥饿导致暴食\n• 晚餐尽量在7点前完成\n• 睡前3小时不进食\n\n🏃 配合运动：\n• 每周3-5次有氧运动，每次30-45分钟\n• 配合力量训练，提高基础代谢`
      suggestions = ['减脂期可以吃主食吗？', '有什么低卡食谱推荐？']
    } else if (q.includes('晚上') || q.includes('夜宵') || q.includes('睡前')) {
      answer = `晚上饿了的健康选择：\n\n✅ 推荐食物：\n• 希腊酸奶（100g，约60kcal）\n• 小番茄 5-6个（约15kcal）\n• 黄瓜 1根（约15kcal）\n• 温牛奶 200ml（约120kcal，助眠）\n• 坚果 10g（约60kcal，不要多吃）\n\n❌ 避免：\n• 高糖食物：蛋糕、冰淇淋、饮料\n• 高脂食物：薯片、炸鸡、泡面\n• 咖啡因：咖啡、浓茶（影响睡眠）\n\n💡 小贴士：\n• 先喝一杯温水，可能只是口渴\n• 睡前2小时尽量不进食\n• 如果经常晚上饿，考虑调整三餐分配`
      suggestions = ['牛奶会长胖吗？', '可以吃水果吗？']
    } else if (q.includes('增肌') || q.includes('长肌肉')) {
      const proteinNeed = profile ? Math.round(profile.weight * 1.8) : 90
      answer = `增肌期饮食建议：\n\n📊 热量盈余：\n• 每日增加300-500kcal热量盈余\n• 配合力量训练，否则容易长脂肪\n\n🥩 蛋白质需求：\n• 每kg体重1.6-2.2g蛋白质\n• ${profile ? `您的体重${profile.weight}kg，建议每日${proteinNeed}g蛋白质` : '建议每日摄入体重×1.8g蛋白质'}\n• 分3-4餐摄入，每餐30-40g\n\n🍚 碳水化合物：\n• 训练前后补充碳水，提供能量\n• 选择复合碳水：燕麦、糙米、红薯\n\n⏰ 训练后营养：\n• 30-60分钟内补充\n• 蛋白质20-30g + 碳水40-60g\n• 推荐：香蕉+蛋白粉/鸡胸肉+米饭`
      suggestions = ['训练后喝蛋白粉好吗？', '增肌期可以吃零食吗？']
    } else if (q.includes('运动后') || q.includes('训练后') || q.includes('健身后')) {
      answer = `运动后营养补充指南：\n\n⏰ 黄金窗口：运动后30-60分钟\n\n🥤 补充内容：\n• 蛋白质：20-30g（修复肌肉）\n• 碳水：30-50g（恢复糖原）\n• 水分：体重每减少0.5kg补充500ml水\n\n🍽️ 推荐搭配：\n• 香蕉 + 蛋白粉（方便快捷）\n• 鸡胸肉 + 米饭（正餐首选）\n• 希腊酸奶 + 全麦面包\n• 鸡蛋 + 燕麦（早餐训练后）\n\n❌ 避免：\n• 高脂食物（影响吸收速度）\n• 酒精（影响恢复）\n• 空腹（错过恢复窗口）`
      suggestions = ['蛋白粉怎么选？', '不训练的日子怎么吃？']
    } else {
      answer = `感谢您的提问！\n\n根据您的情况，我的建议是保持均衡饮食：\n\n• 碳水化合物：40-50%（选择全谷物）\n• 蛋白质：20-30%（优质蛋白来源）\n• 脂肪：20-30%（不饱和脂肪为主）\n\n${summary ? `您今天已摄入${summary.consumed}kcal，还剩${summary.target - summary.consumed}kcal可用。` : ''}\n\n如果您有更具体的问题，比如减脂、增肌、某种食物的营养价值等，我可以给您更详细的建议。`
      suggestions = ['减脂期怎么吃？', '如何增加蛋白质？', '有什么健康零食？']
    }

    return { answer, suggestions }
  },

  goBack() {
    wx.navigateBack()
  }
})
