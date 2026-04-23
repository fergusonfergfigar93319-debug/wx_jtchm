// pages/ai-chat/ai-chat.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    messages: [], // 消息列表
    inputText: '', // 输入框内容
    isThinking: false, // AI是否在思考
    scrollIntoView: '', // 滚动到指定消息
    isRecording: false, // 是否正在录音
    recordingTime: 0, // 录音时长
    recordingTimer: null, // 录音计时器
    deepThinkMode: false, // 深度思考模式
    showSkillPanel: false, // 是否显示技能面板
    showCustomModal: false, // 是否显示自定义栏目弹窗
    showConversationList: false, // 是否显示对话列表
    conversations: [], // 对话列表
    currentConversationId: null, // 当前对话ID
    currentConversationTitle: '', // 当前对话标题
    userProfile: null, // 用户档案
    dailySummary: null, // 今日摘要
    todayConsumed: 0,
    todayTarget: 2000,
    todayRemaining: 0,
    todayRemainingLabel: '剩余',
    todayRemainingClass: 'positive',
    todayProgressPct: 0,
    todayProgressOver: false,
    skills: [ // 技能列表
      {
        id: 'nutrition_analysis',
        name: '营养分析',
        desc: '分析今日营养摄入情况',
        icon: '📊'
      },
      {
        id: 'meal_planning',
        name: '餐食规划',
        desc: '根据目标制定餐食计划',
        icon: '🍽️'
      },
      {
        id: 'recipe_recommend',
        name: '菜谱推荐',
        desc: '推荐适合的菜谱',
        icon: '👨‍🍳'
      },
      {
        id: 'health_advice',
        name: '健康建议',
        desc: '提供个性化健康建议',
        icon: '💡'
      },
      {
        id: 'food_qa',
        name: '食物问答',
        desc: '解答食物相关问题',
        icon: '❓'
      }
    ],
    customOptions: [ // 自定义栏目选项
      { id: 'show_nutrition', label: '显示营养数据', enabled: true },
      { id: 'show_history', label: '显示历史记录', enabled: true },
      { id: 'show_quick_questions', label: '显示快捷问题', enabled: true }
    ],
    quickQuestions: [ // 快捷问题
      '减脂期应该怎么吃？',
      '如何增加蛋白质摄入？',
      '晚上可以吃东西吗？',
      '增肌需要多少蛋白质？',
      '运动后应该吃什么？',
      '碳水摄入过多怎么办？'
    ],
    pendingAttachments: [], // 待发送附件列表（图片/文档）

    // 兼容/性能：轻量模式（HarmonyOS/低性能设备默认开启）
    liteMode: false
  },

  onLoad() {
    try {
      const app = getApp()
      this.setData({ liteMode: !!(app && app.globalData && app.globalData.liteMode) })
    } catch (e) {}
    this.loadUserData()
    this.loadConversations()
    this.loadCurrentConversation()
  },

  onShow() {
    // 每次显示时刷新用户数据
    this.loadUserData()
  },

  onUnload() {
    // 清理定时器
    if (this.data.recordingTimer) {
      clearInterval(this.data.recordingTimer)
    }
  },

  // 加载用户数据
  async loadUserData() {
    try {
      const [profile, summary] = await Promise.all([
        api.getUserProfile().catch(() => null),
        api.getDailySummary().catch(() => null)
      ])
      const consumed = summary ? (summary.consumed ?? summary.intake_actual ?? 0) : 0
      const target = summary ? (summary.target ?? summary.daily_limit ?? 2000) : 2000
      const remaining = target - consumed
      const pct = target > 0 ? Math.min(100, Math.round(consumed / target * 100)) : 0
      this.setData({
        userProfile: profile,
        dailySummary: summary ? { ...summary, consumed, target } : null,
        todayConsumed: consumed,
        todayTarget: target,
        todayRemaining: remaining >= 0 ? remaining : -remaining,
        todayRemainingLabel: remaining >= 0 ? '剩余' : '超出',
        todayRemainingClass: remaining >= 0 ? 'positive' : 'negative',
        todayProgressPct: pct,
        todayProgressOver: remaining < 0
      })
    } catch (e) {
      console.warn('加载用户数据失败', e)
    }
  },

  // 加载对话列表
  loadConversations() {
    const conversations = wx.getStorageSync('aiChatConversations') || []
    // 按更新时间排序
    conversations.sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime))
    this.setData({ conversations })
  },

  // 加载当前对话
  loadCurrentConversation() {
    const currentId = wx.getStorageSync('aiChatCurrentId')
    if (currentId) {
      const conversations = this.data.conversations
      const current = conversations.find(c => c.id === currentId)
      if (current) {
        this.setData({
          currentConversationId: currentId,
          currentConversationTitle: current.title || '新对话',
          messages: current.messages || []
        })
        this.scrollToBottom()
        return
      }
    }
    // 如果没有当前对话，创建新对话
    this.createNewConversation()
  },

  // 创建新对话
  createNewConversation() {
    const newId = 'conv_' + Date.now()
    const newConversation = {
      id: newId,
      title: '新对话',
      messages: [],
      createTime: new Date().toISOString(),
      updateTime: this.formatConversationTime(new Date())
    }
    
    const conversations = [newConversation, ...this.data.conversations]
    // 最多保留20个对话
    const limitedConversations = conversations.slice(0, 20)
    
    this.setData({
      conversations: limitedConversations,
      currentConversationId: newId,
      currentConversationTitle: '新对话',
      messages: [],
      showConversationList: false
    })
    
    // 保存到本地
    wx.setStorageSync('aiChatConversations', limitedConversations)
    wx.setStorageSync('aiChatCurrentId', newId)
    
    util.showToast('已创建新对话', 'success')
  },

  // 切换对话
  switchConversation(e) {
    const id = e.currentTarget.dataset.id
    const conversation = this.data.conversations.find(c => c.id === id)
    if (!conversation) return
    
    // 保存当前对话
    this.saveCurrentConversation()
    
    // 切换到新对话
    this.setData({
      currentConversationId: id,
      currentConversationTitle: conversation.title || '新对话',
      messages: conversation.messages || [],
      showConversationList: false
    })
    
    // 保存当前对话ID
    wx.setStorageSync('aiChatCurrentId', id)
    
    // 滚动到底部
    this.scrollToBottom()
  },

  // 删除对话
  deleteConversation(e) {
    const id = e.currentTarget.dataset.id
    if (id === this.data.currentConversationId) {
      util.showToast('不能删除当前对话', 'none')
      return
    }
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个对话吗？',
      success: (res) => {
        if (res.confirm) {
          const conversations = this.data.conversations.filter(c => c.id !== id)
          this.setData({ conversations })
          wx.setStorageSync('aiChatConversations', conversations)
          util.showToast('已删除', 'success')
        }
      }
    })
  },

  // 保存当前对话
  saveCurrentConversation() {
    if (!this.data.currentConversationId) return
    
    const conversations = this.data.conversations.map(c => {
      if (c.id === this.data.currentConversationId) {
        // 更新对话标题（使用第一条用户消息）
        let title = c.title || '新对话'
        const firstUserMessage = this.data.messages.find(m => m.type === 'user')
        if (firstUserMessage && firstUserMessage.text) {
          title = firstUserMessage.text.length > 20 
            ? firstUserMessage.text.substring(0, 20) + '...' 
            : firstUserMessage.text
        }
        
        // 获取最后一条消息作为预览
        const lastMessage = this.data.messages[this.data.messages.length - 1]
        const lastMessageText = lastMessage ? (lastMessage.text.length > 30 
          ? lastMessage.text.substring(0, 30) + '...' 
          : lastMessage.text) : ''
        
        return {
          ...c,
          title,
          messages: this.data.messages,
          updateTime: this.formatConversationTime(new Date()),
          lastMessage: lastMessageText
        }
      }
      return c
    })
    
    this.setData({ 
      conversations,
      currentConversationTitle: conversations.find(c => c.id === this.data.currentConversationId)?.title || '新对话'
    })
    wx.setStorageSync('aiChatConversations', conversations)
  },

  // 格式化对话时间
  formatConversationTime(date) {
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}-${day}`
  },

  // 显示对话列表
  showConversationList() {
    // 保存当前对话
    this.saveCurrentConversation()
    this.setData({ showConversationList: true })
  },

  // 隐藏对话列表
  hideConversationList() {
    this.setData({ showConversationList: false })
  },

  // 输入框输入
  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  // 输入框聚焦
  onInputFocus() {
    // 延迟滚动到底部，确保输入框可见
    setTimeout(() => {
      this.scrollToBottom()
    }, 300)
  },

  // 输入框失焦
  onInputBlur() {
    // 可以在这里处理失焦逻辑
  },

  // 发送消息（支持纯文字、纯附件或文字+附件）
  async sendMessage() {
    const text = this.data.inputText.trim()
    const pending = this.data.pendingAttachments || []
    const hasAttachments = pending.length > 0
    if (!text && !hasAttachments) return
    if (this.data.isThinking) return

    const now = Date.now()
    const timeStr = this.formatTime(new Date())

    // 用户消息（含附件展示用）
    const userMessage = {
      id: now,
      type: 'user',
      text: text || (hasAttachments ? '[图片/附件]' : ''),
      time: timeStr,
      attachments: pending.map(a => ({
        kind: a.kind,
        name: a.name,
        localPath: a.localPath,
        url: a.url || ''
      }))
    }

    const messages = [...this.data.messages, userMessage]
    this.setData({
      messages,
      inputText: '',
      pendingAttachments: [],
      isThinking: true
    })
    this.saveCurrentConversation()
    this.scrollToBottom()

    try {
      const context = {
        profile: this.data.userProfile,
        summary: this.data.dailySummary,
        conversationHistory: messages.slice(-10).map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.text
        })),
        deepThink: this.data.deepThinkMode,
        context: this.getMealContext()
      }

      // 上传附件并带入上下文（后端可据此做识图/文档分析）
      const uploadedAttachments = await this.prepareAttachmentsForSend(pending)
      if (uploadedAttachments.length > 0) {
        context.attachments = uploadedAttachments
      }

      let result
      try {
        result = await api.askAI(text || '请根据我发送的图片/附件给出营养或饮食建议。', context)
      } catch (e) {
        console.warn('后端AI调用失败，使用本地生成', e)
        const answer = this.generateAnswer(text || '根据附件分析')
        result = {
          answer: answer,
          confidence: 0.85,
          sources: ['本地知识库', '用户饮食记录']
        }
      }

      const aiMessage = {
        id: now + 1,
        type: 'ai',
        text: result.answer || '抱歉，我暂时无法回答这个问题。',
        time: timeStr,
        confidence: result.confidence != null ? result.confidence : 0.9,
        sources: result.sources || []
      }

      const updatedMessages = [...messages, aiMessage]
      this.setData({
        messages: updatedMessages,
        isThinking: false
      })
      this.saveCurrentConversation()
      setTimeout(() => this.scrollToBottom(), 100)
    } catch (e) {
      console.error('发送消息失败', e)
      const errorMessage = {
        id: now + 1,
        type: 'ai',
        text: '抱歉，网络出现问题，请稍后重试。',
        time: timeStr,
        confidence: 0
      }
      this.setData({
        messages: [...messages, errorMessage],
        isThinking: false
      })
      util.showToast('发送失败，请稍后重试')
    }
  },

  // 上传附件列表，返回可传给后端的结构
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

  // 点击附件按钮：选择图片或文档
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
      util.showToast('最多添加6个附件', 'none')
      return
    }
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: (res) => {
          const files = (res.tempFiles || []).map(f => ({
            kind: 'image',
            localPath: f.tempFilePath,
            name: (f.tempFilePath || '').split('/').pop() || 'image',
            size: f.size
          }))
          this.addPendingAttachments(files)
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
      util.showToast('最多添加6个附件', 'none')
      return
    }
    if (!wx.chooseMessageFile) {
      util.showToast('当前基础库不支持选择文件', 'none')
      return
    }
    wx.chooseMessageFile({
      count: remain,
      type: 'file',
      success: (res) => {
        const files = (res.tempFiles || []).map(f => ({
          kind: 'file',
          localPath: f.path,
          name: f.name || (f.path || '').split('/').pop() || 'file',
          size: f.size,
          mimeType: f.type || ''
        }))
        this.addPendingAttachments(files)
      }
    })
  },

  addPendingAttachments(items) {
    const list = [...(this.data.pendingAttachments || [])]
    const now = Date.now()
    items.forEach((it, idx) => {
      list.push({
        id: `att_${now}_${idx}_${Math.floor(Math.random() * 1000)}`,
        kind: it.kind,
        localPath: it.localPath,
        name: it.name,
        size: it.size,
        mimeType: it.mimeType,
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
    const urls = (this.data.pendingAttachments || [])
      .filter(x => x.kind === 'image')
      .map(x => x.localPath)
    wx.previewImage({
      current: item.localPath,
      urls: urls.length ? urls : [item.localPath]
    })
  },

  openAttachment(e) {
    const id = e.currentTarget.dataset.id
    const item = (this.data.pendingAttachments || []).find(x => x.id === id)
    if (!item || item.kind !== 'file') return
    wx.openDocument({
      filePath: item.localPath,
      showMenu: true,
      fail: () => util.showToast('无法打开该文件', 'none')
    })
  },

  // 滚动到底部
  scrollToBottom() {
    const messages = this.data.messages
    if (messages.length > 0) {
      const lastId = messages[messages.length - 1].id
      this.setData({
        scrollIntoView: `msg-${lastId}`
      })
    }
  },

  // 格式化时间
  formatTime(date) {
    const hour = date.getHours()
    const minute = date.getMinutes()
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  },

  // 复制消息
  copyMessage(e) {
    const text = e.currentTarget.dataset.text
    wx.setClipboardData({
      data: text,
      success: () => {
        util.showToast('已复制到剪贴板', 'success')
      }
    })
  },

  // 点赞消息
  likeMessage(e) {
    const id = e.currentTarget.dataset.id
    const messages = this.data.messages.map(msg => {
      if (msg.id === id) {
        return { ...msg, liked: !msg.liked }
      }
      return msg
    })
    this.setData({ messages })
    this.saveCurrentConversation()
    util.showToast('已记录反馈', 'success')
  },

  // 切换深度思考模式
  toggleDeepThink() {
    this.setData({
      deepThinkMode: !this.data.deepThinkMode
    })
    util.showToast(
      this.data.deepThinkMode ? '已开启深度思考模式' : '已关闭深度思考模式',
      'success'
    )
  },

  // 显示技能面板
  showSkillPanel() {
    this.setData({ showSkillPanel: true })
  },

  // 隐藏技能面板
  hideSkillPanel() {
    this.setData({ showSkillPanel: false })
  },

  // 选择技能
  selectSkill(e) {
    const skill = e.currentTarget.dataset.skill
    this.setData({
      showSkillPanel: false,
      inputText: `@${skill.name} `
    })
    
    // 聚焦输入框
    setTimeout(() => {
      // 在小程序中无法直接聚焦，但可以提示用户
      util.showToast(`已选择技能：${skill.name}`, 'success')
    }, 100)
  },

  // 显示自定义栏目弹窗
  showCustomModal() {
    this.setData({ showCustomModal: true })
  },

  // 隐藏自定义栏目弹窗
  hideCustomModal() {
    this.setData({ showCustomModal: false })
  },

  // 切换自定义选项
  toggleCustomOption(e) {
    const id = e.currentTarget.dataset.id
    const customOptions = this.data.customOptions.map(opt => {
      if (opt.id === id) {
        return { ...opt, enabled: !opt.enabled }
      }
      return opt
    })
    this.setData({ customOptions })
    // 轻量模式：避免同步存储卡顿，改为异步写入
    try {
      wx.setStorage({
        key: 'aiChatCustomOptions',
        data: customOptions
      })
    } catch (e) {
      // fallback
      try {
        wx.setStorageSync('aiChatCustomOptions', customOptions)
      } catch (err) {}
    }
  },

  // 语音输入
  toggleVoiceInput() {
    if (this.data.isRecording) {
      this.stopRecording()
    } else {
      this.startRecording()
    }
  },

  // 开始录音
  startRecording() {
    const recorderManager = wx.getRecorderManager()
    
    recorderManager.onStart(() => {
      this.setData({ isRecording: true, recordingTime: 0 })
      
      // 开始计时
      const tickMs = this.data.liteMode ? 1200 : 1000
      const timer = setInterval(() => {
        this.setData({
          recordingTime: this.data.recordingTime + 1
        })
      }, tickMs)
      this.setData({ recordingTimer: timer })
    })

    recorderManager.onStop((res) => {
      if (this.data.recordingTimer) {
        clearInterval(this.data.recordingTimer)
        this.setData({ recordingTimer: null })
      }
      
      this.setData({ isRecording: false, recordingTime: 0 })
      
      if (res.tempFilePath) {
        // 识别语音（这里需要接入语音识别API）
        this.recognizeVoice(res.tempFilePath)
      }
    })

    recorderManager.onError((err) => {
      console.error('录音失败', err)
      util.showToast('录音失败，请重试')
      this.setData({ isRecording: false, recordingTime: 0 })
      if (this.data.recordingTimer) {
        clearInterval(this.data.recordingTimer)
        this.setData({ recordingTimer: null })
      }
    })

    // 开始录音
    recorderManager.start({
      duration: 60000, // 最长60秒
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 96000,
      format: 'mp3'
    })
  },

  // 停止录音
  stopRecording() {
    const recorderManager = wx.getRecorderManager()
    recorderManager.stop()
  },

  // 识别语音（需对接微信公众平台或第三方语音识别服务）
  async recognizeVoice(filePath) {
    try {
      util.showLoading('识别中...')
      void filePath
      await new Promise(resolve => setTimeout(resolve, 200))
      util.hideLoading()
      util.showToast('请对接语音识别服务后使用', 'none')
    } catch (e) {
      console.error('语音识别失败', e)
      util.hideLoading()
      util.showToast('识别失败，请重试')
    }
  },

  // 语音通话（占位）
  startVoiceCall() {
    util.showToast('语音通话功能开发中', 'none')
  },

  // 剪刀菜单（占位）
  showScissorsMenu() {
    util.showToast('更多功能开发中', 'none')
  },

  // 快捷问题
  sendQuickQuestion(e) {
    const question = e.currentTarget.dataset.question
    this.setData({ inputText: question })
    // 自动发送
    setTimeout(() => {
      this.sendMessage()
    }, 100)
  },

  // 获取用餐场景
  getMealContext() {
    const now = new Date()
    const hour = now.getHours()
    let mealContext = 'general'
    if (hour >= 6 && hour < 10) mealContext = 'breakfast'
    else if (hour >= 10 && hour < 14) mealContext = 'lunch'
    else if (hour >= 14 && hour < 18) mealContext = 'afternoon'
    else if (hour >= 18 && hour < 22) mealContext = 'dinner'
    else mealContext = 'night'
    
    return {
      mealContext,
      hour,
      timestamp: now.toISOString()
    }
  },

  // 生成回答（增强版AI回答生成，与ai-nutritionist保持一致）
  generateAnswer(question) {
    const profile = this.data.userProfile
    const summary = this.data.dailySummary
    const q = question.toLowerCase()
    
    // 蛋白质相关问题
    if (q.includes('蛋白质') || q.includes('蛋白') || q.includes('增肌吃什么')) {
      if (summary && summary.macros) {
        const proteinPercent = summary.macros.protein.consumed / summary.macros.protein.target
        const needProtein = summary.macros.protein.target - summary.macros.protein.consumed
        
        if (proteinPercent < 0.8) {
          return `根据您今日的摄入情况，蛋白质摄入不足（${summary.macros.protein.consumed}g / ${summary.macros.protein.target}g，仅${Math.round(proteinPercent * 100)}%）。\n\n建议补充约${Math.round(needProtein)}g蛋白质，推荐食物：\n• 鸡胸肉150g（约37g蛋白质）\n• 鸡蛋3个（约18g蛋白质）\n• 三文鱼200g（约40g蛋白质）\n• 豆腐300g（约24g蛋白质）\n• 希腊酸奶200g（约15g蛋白质）\n\n${profile && profile.goal_type === 'gain' ? '增肌期建议每kg体重摄入1.6-2.2g蛋白质，您当前目标体重' + (profile.target_weight || profile.weight) + 'kg，建议每日摄入' + Math.round((profile.target_weight || profile.weight) * 1.8) + 'g蛋白质。' : '减脂期建议每kg体重摄入1.2-1.6g蛋白质，充足蛋白质有助于防止肌肉流失。'}`
        } else if (proteinPercent > 1.1) {
          return `您今日蛋白质摄入充足（${summary.macros.protein.consumed}g / ${summary.macros.protein.target}g，${Math.round(proteinPercent * 100)}%），继续保持！\n\n优质蛋白质来源包括：\n• 动物蛋白：瘦肉、鱼类、蛋类、奶制品（吸收率高）\n• 植物蛋白：豆类、坚果、全谷物（富含纤维）\n\n建议：每餐都包含优质蛋白，有助于维持肌肉量和提高代谢。`
        }
      }
      return `蛋白质是身体重要的营养素，参与肌肉合成、免疫调节等功能。\n\n建议每日摄入量：\n• 增肌期：每kg体重1.6-2.2g\n• 减脂期：每kg体重1.2-1.6g\n• 维持期：每kg体重1.0-1.4g\n\n优质蛋白来源：\n• 动物蛋白：鸡胸肉、鱼类、瘦牛肉、鸡蛋、牛奶（吸收率90%+）\n• 植物蛋白：豆腐、豆类、坚果、全谷物（富含纤维和微量元素）\n\n${profile ? `根据您的目标（${profile.goal_type === 'lose' ? '减脂' : profile.goal_type === 'gain' ? '增肌' : '维持'}），建议每日摄入${Math.round(profile.weight * (profile.goal_type === 'gain' ? 1.8 : profile.goal_type === 'lose' ? 1.4 : 1.2))}g蛋白质。` : ''}`
    }
    
    // 减脂相关问题
    if (q.includes('减脂') || q.includes('减肥') || q.includes('瘦身') || q.includes('怎么瘦')) {
      const calPercent = summary ? summary.consumed / summary.target : 0
      const advice = profile && profile.goal_type === 'lose' 
        ? `根据您的减脂目标，建议：\n\n1. 创造热量缺口\n   • 当前目标：${profile.daily_kcal_limit || profile.daily_limit || 1800}kcal/天\n   • 建议缺口：300-500kcal（通过饮食+运动）\n   • 您今日摄入：${summary ? summary.consumed : '未知'}kcal（${summary ? Math.round(calPercent * 100) : 0}%）\n\n2. 增加蛋白质摄入（防止肌肉流失）\n   • 建议：每kg体重1.2-1.6g蛋白质\n   • 您的目标：${Math.round(profile.weight * 1.4)}g/天\n\n3. 适量有氧运动\n   • 建议：每周3-5次，每次30-60分钟\n   • 类型：快走、慢跑、游泳、骑行\n\n4. 保持充足睡眠\n   • 建议：7-9小时/天\n   • 睡眠不足会影响代谢和食欲调节\n\n5. 多喝水\n   • 建议：每日2-3L\n   • 餐前喝水可增加饱腹感\n\n⚠️ 重要提醒：健康减脂是长期过程，不要过度节食（低于基础代谢的80%），否则可能导致代谢下降、肌肉流失。建议每周减重0.5-1kg为宜。`
        : '减脂期建议：\n\n1. 创造热量缺口（每日减少300-500kcal）\n2. 增加蛋白质摄入（防止肌肉流失，每kg体重1.2-1.6g）\n3. 适量有氧运动（每周3-5次，每次30-60分钟）\n4. 保持充足睡眠（7-9小时）\n5. 多喝水（每日2-3L）\n\n记住：健康减脂是长期过程，不要过度节食。'
      return advice
    }
    
    // 增肌相关问题
    if (q.includes('增肌') || q.includes('长肌肉') || q.includes('增重')) {
      return `增肌期建议：\n\n1. 热量盈余\n   • 建议：每日增加300-500kcal\n   • 您的目标：${profile ? (profile.daily_kcal_limit || profile.daily_limit || 1800) + 400 : 2400}kcal/天\n   • 注意：不要过度增重，避免脂肪堆积过多\n\n2. 高蛋白摄入\n   • 建议：每kg体重1.6-2.2g蛋白质\n   • 您的目标：${profile ? Math.round(profile.weight * 1.8) : 120}g/天\n   • 训练后30-60分钟内补充蛋白质+碳水\n\n3. 适量碳水（提供训练能量）\n   • 建议：每kg体重4-6g碳水\n   • 训练前后补充快速碳水（香蕉、白米饭）\n   • 其他时间选择复合碳水（燕麦、红薯）\n\n4. 力量训练\n   • 建议：每周3-4次，每次60-90分钟\n   • 重点：复合动作（深蹲、硬拉、卧推）\n   • 渐进超负荷：逐步增加重量或次数\n\n5. 充足休息\n   • 建议：每天7-9小时睡眠\n   • 肌肉在休息时生长，不要过度训练\n\n💡 增肌是缓慢过程，每月增重1-2kg为宜（其中肌肉约0.5-1kg）。`
    }
    
    // 碳水相关问题
    if (q.includes('碳水') || q.includes('碳水化合物') || q.includes('主食')) {
      const carbPercent = summary && summary.macros ? summary.macros.carb.consumed / summary.macros.carb.target : 0
      return `碳水化合物是身体主要能量来源，对大脑功能和运动表现很重要。\n\n${summary && summary.macros ? `您今日碳水摄入：${summary.macros.carb.consumed}g / ${summary.macros.carb.target}g（${Math.round(carbPercent * 100)}%）\n\n` : ''}建议选择：\n• 复合碳水：全谷物（燕麦、糙米、全麦面包）、薯类（红薯、土豆）、豆类\n• 优点：升糖慢、饱腹感强、富含纤维和维生素\n\n避免：\n• 精制碳水：白米饭、白面包、糖、含糖饮料\n• 缺点：升糖快、易导致血糖波动和脂肪堆积\n\n${profile && profile.goal_type === 'lose' ? '减脂期建议：\n• 适量减少碳水（占总热量40-45%），但不要完全断碳\n• 训练前后可以适量增加，其他时间减少\n• 优先选择复合碳水和高纤维食物' : profile && profile.goal_type === 'gain' ? '增肌期建议：\n• 增加碳水摄入（占总热量45-50%），提供训练能量\n• 训练前后补充快速碳水，其他时间选择复合碳水\n• 每kg体重摄入4-6g碳水' : ''}`
    }
    
    // 晚上/夜宵相关问题
    if (q.includes('晚上') || q.includes('夜宵') || q.includes('睡前') || q.includes('晚上吃')) {
      return `晚上或夜宵饮食建议：\n\n✅ 可以吃：\n• 低卡高蛋白：希腊酸奶、鸡蛋、少量坚果（10-15g）\n• 蔬菜：黄瓜、西红柿、生菜（几乎无热量）\n• 温牛奶：有助于睡眠（200ml约130kcal）\n\n❌ 避免：\n• 高糖高脂：蛋糕、薯片、油炸食品\n• 咖啡因：咖啡、浓茶（影响睡眠）\n• 大量进食：睡前2-3小时避免大量进食\n\n💡 如果确实饿：\n• 可以喝温水或淡茶\n• 少量坚果（10-15g）或一小杯酸奶\n• 避免高热量食物，影响睡眠和代谢\n\n⚠️ 注意：如果经常晚上饿，可能是白天热量摄入不足，建议调整三餐分配。`
    }
    
    // 运动后相关问题
    if (q.includes('运动后') || q.includes('训练后') || q.includes('锻炼后')) {
      return `运动后营养补充（黄金窗口：运动后30-60分钟）：\n\n✅ 建议补充：\n• 蛋白质：20-30g（修复肌肉）\n  - 鸡胸肉150g、蛋白粉1勺、鸡蛋4个、希腊酸奶200g\n• 碳水：30-50g（恢复糖原）\n  - 香蕉1-2根、白米饭100g、全麦面包2片\n\n💡 推荐搭配：\n• 鸡胸肉+米饭（经典搭配）\n• 蛋白粉+香蕉（快速补充）\n• 希腊酸奶+全麦面包（方便）\n• 三文鱼+红薯（营养全面）\n\n❌ 避免：\n• 高脂食物（影响吸收速度）\n• 大量进食（增加消化负担）\n• 完全不吃（影响恢复）\n\n⏰ 时间建议：\n• 运动后30-60分钟内补充效果最佳\n• 如果2小时内会正常用餐，可以等到正餐时补充`
    }
    
    // 默认回答（更智能）
    return `根据您的个人信息${profile ? `（目标：${profile.goal_type === 'lose' ? '减脂' : profile.goal_type === 'gain' ? '增肌' : '维持'}，体重：${profile.weight}kg）` : ''}和${summary ? `今日饮食记录（摄入：${summary.consumed}kcal，${Math.round(summary.consumed / summary.target * 100)}%）` : '饮食记录'}，建议您：\n\n1. 保持均衡饮食\n   • 三大营养素合理分配：碳水40-50%、蛋白质20-30%、脂肪20-30%\n   • 每餐包含：优质蛋白+复合碳水+蔬菜\n\n2. 适量运动\n   • 每周3-5次，每次30-60分钟\n   • 结合有氧和力量训练\n\n3. 充足睡眠\n   • 每日7-9小时\n   • 规律作息\n\n4. 多喝水\n   • 每日2-3L\n   • 餐前喝水增加饱腹感\n\n💡 如有具体问题，可以详细描述（如："减脂期晚上可以吃什么？"），我会给出更精准的个性化建议。`
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  }
})
