// pages/cook-detail/cook-detail.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    recipeId: '',
    recipe: {},
    ingredients: [],
    steps: [],
    isFavorite: false,
    showPortionModal: false,
    showDeductModal: false,
    selectedPortion: 1.0,
    portionOptions: [
      { value: 0.5, label: '0.5份', cal: 0 },
      { value: 1.0, label: '1份', cal: 0 },
      { value: 1.5, label: '1.5份', cal: 0 }
    ],
    fridgeIngredients: [],
    nutritionInfo: null,
    relatedRecipes: [],
    // 语音助手
    voiceAssistantEnabled: false,
    currentStepIndex: 0,
    isPlaying: false,
    audioContext: null,
    expandedStepIndex: -1,
    timerSeconds: 0,
    timerRunning: false,
    timerInterval: null,
    timerMinutes: '00',
    timerSecondsStr: '00',
    completedStepsCount: 0
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ recipeId: options.id })
      this.loadRecipeDetail()
    }
    
    // 初始化语音助手
    this.initVoiceAssistant()
  },

  onUnload() {
    const ctx = this.data.audioContext
    if (ctx) {
      // 仅停止播放，避免某些机型上 destroy 内部报错
      if (typeof ctx.stop === 'function') {
        ctx.stop()
      }
    }
    const tid = this.data.timerInterval
    if (tid) {
      clearInterval(tid)
    }
  },

  // 初始化语音助手
  initVoiceAssistant() {
    // 创建音频上下文（用于语音播报）
    const audioContext = wx.createInnerAudioContext()
    audioContext.onEnded(() => {
      this.setData({ isPlaying: false })
    })
    audioContext.onError((err) => {
      console.error('语音播放失败', err)
      this.setData({ isPlaying: false })
    })
    this.setData({ audioContext })
  },

  // 加载菜谱详情
  async loadRecipeDetail() {
    try {
      util.showLoading('加载中...')
      const recipeRaw = await api.getRecipeDetail(this.data.recipeId)
      const recipe = { ...recipeRaw, image: util.resolveRecipeCoverUrl(recipeRaw) }
      
      // 处理食材列表，检查哪些在冰箱里，并获取替代建议
      const ingredients = (recipe.ingredients || []).map(ing => {
        const ingredient = typeof ing === 'string' ? { name: ing } : ing
        const ingName = ingredient.name || ing
        const inFridge = ingredient.in_fridge !== undefined ? ingredient.in_fridge : false
        
        // 如果不在冰箱里，获取替代建议
        const substitutes = !inFridge ? util.getIngredientSubstitute(ingName) : null
        
        return {
          name: ingName,
          amount: ingredient.amount || '',
          in_fridge: inFridge,
          substitutes: substitutes
        }
      })
      
      // 计算匹配度（冰箱里有的食材占比）
      const totalIngredients = ingredients.length
      const inFridgeCount = ingredients.filter(ing => ing.in_fridge).length
      const matchScore = totalIngredients > 0 ? Math.round((inFridgeCount / totalIngredients) * 100) : 100
      const missingIngredients = ingredients.filter(ing => !ing.in_fridge)
      
      // 处理步骤（统一转为结构化格式）
      const rawSteps = recipe.steps || (recipe.detail && recipe.detail.steps) || []
      const steps = util.normalizeRecipeSteps(rawSteps)
      
      // 计算不同分量的卡路里
      const baseCal = recipe.calories || recipe.calories_per_100g || 0
      const portionOptions = this.data.portionOptions.map(opt => ({
        ...opt,
        cal: Math.round(baseCal * opt.value)
      }))
      
      // 处理营养信息
      const nutritionInfo = recipe.nutrition || recipe.nutrition_info || null
      
      // 加载相关推荐
      const relatedRecipes = await this.loadRelatedRecipes(recipe)
      
      // 计算菜谱成本
      const estimatedCost = util.estimateRecipeCost(ingredients)
      // 估算同款外卖价格（通常是自己做的2-3倍）
      const estimatedTakeoutPrice = estimatedCost > 0 ? Math.round(estimatedCost * 2.5 * 100) / 100 : 0
      const savedAmount = estimatedTakeoutPrice > 0 ? Math.round((estimatedTakeoutPrice - estimatedCost) * 100) / 100 : 0
      const savedPercent = estimatedTakeoutPrice > 0 ? Math.round((savedAmount / estimatedTakeoutPrice) * 100) : 0
      
      const completedStepsCount = steps.filter(s => typeof s === 'object' && s.completed).length
      this.setData({
        recipe,
        ingredients,
        steps,
        completedStepsCount,
        portionOptions,
        selectedPortion: 1.0,
        nutritionInfo,
        relatedRecipes,
        matchScore,
        missingIngredients,
        showShoppingListBtn: ingredients.length > 0, // 有食材即显示「加入购物清单」联动
        estimatedCost,
        estimatedTakeoutPrice,
        savedAmount,
        savedPercent,
        showCostComparison: estimatedCost > 0 // 如果成本可估算，显示对比
      })
      
      // 检查收藏状态
      this.checkFavorite()
      
      // 记录浏览历史
      this.recordViewHistory()
    } catch (error) {
      console.error('加载详情失败', error)
      util.showToast('加载失败')
    } finally {
      util.hideLoading()
    }
  },

  // 检查收藏状态
  async checkFavorite() {
    try {
      const favorites = wx.getStorageSync('favorites') || []
      const isFavorite = favorites.some(item => 
        String(item.id) === String(this.data.recipeId) && item.type === 'recipe'
      )
      this.setData({ isFavorite })
    } catch (error) {
      console.error('检查收藏状态失败', error)
    }
  },

  // 切换收藏
  async toggleFavorite() {
    try {
      const recipeId = this.data.recipeId
      const recipe = this.data.recipe
      const isFavorite = this.data.isFavorite
      
      // 获取当前收藏列表
      const favorites = wx.getStorageSync('favorites') || []
      const favoriteIndex = favorites.findIndex(item => 
        String(item.id) === String(recipeId) && item.type === 'recipe'
      )
      
      if (isFavorite) {
        // 取消收藏
        if (favoriteIndex > -1) {
          favorites.splice(favoriteIndex, 1)
          wx.setStorageSync('favorites', favorites)
          
          // 尝试调用后端API
          try {
            await api.unfavorite(recipeId, 'recipe')
          } catch (e) {
            console.log('后端取消收藏失败，使用本地存储', e)
          }
          
          this.setData({ isFavorite: false })
          util.showSuccess('已取消收藏')
        }
      } else {
        // 添加收藏
        const favoriteItem = {
          id: recipeId,
          type: 'recipe',
          name: recipe.name || '未知菜谱',
          image: recipe.image || '',
          calories: recipe.calories || recipe.calories_per_100g || 0,
          tags: recipe.tags || [],
          createdAt: new Date().toISOString()
        }
        
        favorites.push(favoriteItem)
        wx.setStorageSync('favorites', favorites)
        
        // 尝试调用后端API
        try {
          await api.favoriteRecipe(recipeId)
        } catch (e) {
          console.log('后端收藏失败，使用本地存储', e)
        }
        
        this.setData({ isFavorite: true })
        util.showSuccess('已收藏')
      }
    } catch (error) {
      console.error('切换收藏失败', error)
      util.showToast('操作失败，请重试')
    }
  },

  // 拉黑
  async blockRecipe() {
    const confirm = await util.showConfirm('确定要拉黑这道菜吗？')
    if (confirm) {
      try {
        await api.blockRecipe(this.data.recipeId)
        util.showToast('已加入黑名单')
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } catch (error) {
        util.showToast('操作失败')
      }
    }
  },

  // 确认开吃
  confirmEat() {
    this.setData({ showPortionModal: true })
  },

  // 选择分量
  selectPortion(e) {
    const value = e.currentTarget.dataset.value
    this.setData({ selectedPortion: value })
  },

  // 关闭分量弹窗
  closePortionModal() {
    this.setData({ showPortionModal: false })
  },

  // 确认分量
  confirmPortion() {
    this.setData({ showPortionModal: false })
    
    // 检查是否有冰箱食材需要扣除
    const fridgeIngredients = this.data.ingredients
      .filter(ing => ing.in_fridge)
      .map(ing => ing.name)
    
    if (fridgeIngredients.length > 0) {
      this.setData({ 
        showDeductModal: true,
        fridgeIngredients 
      })
    } else {
      this.submitIntake(false)
    }
  },

  // 跳过扣除
  skipDeduct() {
    this.setData({ showDeductModal: false })
    this.submitIntake(false)
  },

  // 确认扣除
  confirmDeduct() {
    this.setData({ showDeductModal: false })
    this.submitIntake(true)
  },

  // 提交摄入记录
  async submitIntake(deductFridge) {
    try {
      util.showLoading('记录中...')
      
      const portion = this.data.selectedPortion
      const calories = Math.round((this.data.recipe.calories || 0) * portion)
      
      await api.logIntake({
        source_type: 1, // 菜谱
        source_id: this.data.recipeId,
        portion: portion,
        deduct_fridge: deductFridge
      })
      
      util.showToast(`已记录 +${calories} kcal`)
      
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('记录失败', error)
      util.showToast('记录失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 阻止事件冒泡
  stopPropagation() {},

  onHeaderImageError() {
    const r = this.data.recipe
    if (!r) return
    const fallback = util.resolveRecipeCoverUrl({ ...r, image: '', photos: [] })
    this.setData({ 'recipe.image': fallback })
  },

  // 加载相关推荐
  async loadRelatedRecipes(currentRecipe) {
    try {
      // 根据标签和类型推荐相似菜谱
      const params = {
        mode: 'cook',
        filters: {
          tags: currentRecipe.tags ? currentRecipe.tags.slice(0, 2) : [],
          exclude_id: currentRecipe.id
        }
      }
      
      const result = await api.searchRecommend(params)
      const recipes = (result.recommendations || []).slice(0, 5).map(r => ({
        ...r,
        image: util.resolveRecipeCoverUrl(r)
      }))
      return recipes
    } catch (error) {
      console.error('加载相关推荐失败', error)
      return []
    }
  },

  // 记录浏览历史
  recordViewHistory() {
    try {
      let history = wx.getStorageSync('view_history') || []
      const recipeInfo = {
        id: this.data.recipeId,
        name: this.data.recipe.name,
        image: this.data.recipe.image,
        timestamp: Date.now()
      }
      
      // 移除重复项
      history = history.filter(h => h.id !== this.data.recipeId)
      // 添加到开头
      history.unshift(recipeInfo)
      // 只保留最近20条
      history = history.slice(0, 20)
      
      wx.setStorageSync('view_history', history)
    } catch (error) {
      console.error('记录浏览历史失败', error)
    }
  },

  // 一键加入购物清单（仅缺的食材，与「自己做」联动）
  addToShoppingList() {
    const missingIngredients = this.data.ingredients
      .filter(ing => !ing.in_fridge)
      .map(ing => ({
        name: ing.name,
        amount: ing.amount || '1',
        unit: ing.unit || '个'
      }))
    
    if (missingIngredients.length === 0) {
      util.showToast('食材已齐全，无需购买')
      return
    }
    
    this.navigateToShoppingListWithItems(missingIngredients)
  },

  // 加入全部食材到购物清单（方便按菜谱采买）
  addAllIngredientsToShoppingList() {
    const allIngredients = this.data.ingredients.map(ing => ({
      name: ing.name,
      amount: ing.amount || '1',
      unit: ing.unit || '个'
    }))
    if (allIngredients.length === 0) {
      util.showToast('暂无食材列表')
      return
    }
    this.navigateToShoppingListWithItems(allIngredients)
  },

  // 携带食材列表跳转购物清单页（购物与自己做联动）
  navigateToShoppingListWithItems(items) {
    const itemsStr = encodeURIComponent(JSON.stringify(items))
    wx.navigateTo({
      url: `/packageUser/shopping-list/shopping-list?items=${itemsStr}`
    })
  },

  // 猜测食材分类
  guessIngredientCategory(name) {
    const vegetableKeywords = ['西红柿', '土豆', '青椒', '洋葱', '胡萝卜', '白菜', '菠菜', '芹菜', '黄瓜', '茄子', '豆角', '蘑菇', '萝卜', '南瓜']
    const meatKeywords = ['鸡', '牛', '猪', '羊', '肉', '排骨']
    const seafoodKeywords = ['鱼', '虾', '蟹', '海鲜', '鱿鱼', '贝']
    const fruitKeywords = ['苹果', '香蕉', '橙子', '葡萄', '草莓', '水果']
    const dairyKeywords = ['牛奶', '酸奶', '蛋', '奶', '奶酪']
    const stapleKeywords = ['米', '面', '面包', '主食']
    const seasoningKeywords = ['油', '盐', '糖', '醋', '酱油', '料酒', '蒜', '姜', '葱']
    
    if (vegetableKeywords.some(k => name.includes(k))) return '蔬菜区'
    if (meatKeywords.some(k => name.includes(k))) return '肉区'
    if (seafoodKeywords.some(k => name.includes(k))) return '水产区'
    if (fruitKeywords.some(k => name.includes(k))) return '水果区'
    if (dairyKeywords.some(k => name.includes(k))) return '蛋奶区'
    if (stapleKeywords.some(k => name.includes(k))) return '主食区'
    if (seasoningKeywords.some(k => name.includes(k))) return '调料区'
    return '其他'
  },

  // 按超市分类排序
  categorizeShoppingList(list) {
    const categories = {
      '蔬菜区': [],
      '肉区': [],
      '水产区': [],
      '水果区': [],
      '蛋奶区': [],
      '主食区': [],
      '调料区': [],
      '其他': []
    }
    
    list.forEach(item => {
      const category = item.category || '其他'
      if (categories[category]) {
        categories[category].push(item)
      } else {
        categories['其他'].push(item)
      }
    })
    
    return Object.entries(categories)
      .filter(([_, items]) => items.length > 0)
      .map(([category, items]) => ({ category, items }))
  },

  // 显示购物清单预览
  showShoppingListPreview(categorizedList, totalCount) {
    let content = `已添加 ${totalCount} 个食材到购物清单：\n\n`
    categorizedList.forEach(({ category, items }) => {
      content += `【${category}】\n`
      items.forEach(item => {
        content += `  • ${item.name} ${item.amount}\n`
      })
      content += '\n'
    })
    content += '清单已保存，可在"我的"页面查看'
    
    wx.showModal({
      title: '智能补货清单',
      content: content,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  // 跳转到相关推荐详情
  goToRelatedDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.redirectTo({
      url: `/packageCook/cook-detail/cook-detail?id=${id}`
    })
  },

  // 开启/关闭语音助手
  toggleVoiceAssistant() {
    const enabled = !this.data.voiceAssistantEnabled
    this.setData({ voiceAssistantEnabled: enabled })
    
    if (enabled) {
      util.showToast('语音助手已开启', 'success')
      // 自动开始播报第一步
      this.playCurrentStep()
    } else {
      this.stopVoice()
      util.showToast('语音助手已关闭')
    }
  },

  // 播报当前步骤
  playCurrentStep() {
    const steps = this.data.steps || []
    if (steps.length === 0) {
      util.showToast('暂无步骤')
      return
    }
    
    const currentStep = steps[this.data.currentStepIndex]
    if (!currentStep) return
    const text = typeof currentStep === 'object' ? currentStep.text : currentStep
    
    const stepText = `第${this.data.currentStepIndex + 1}步，${text}`
    
    // 显示播报提示
    wx.showToast({
      title: stepText,
      icon: 'none',
      duration: 3000
    })
    
    // 实际应该调用TTS API
    // this.speakText(stepText)
    
    this.setData({ isPlaying: true })
  },

  // 下一步
  nextStep() {
    const steps = this.data.steps || []
    if (this.data.currentStepIndex < steps.length - 1) {
      this.setData({ currentStepIndex: this.data.currentStepIndex + 1 })
      if (this.data.voiceAssistantEnabled) {
        this.playCurrentStep()
      }
    } else {
      util.showToast('已经是最后一步了')
    }
  },

  // 上一步
  prevStep() {
    if (this.data.currentStepIndex > 0) {
      this.setData({ currentStepIndex: this.data.currentStepIndex - 1 })
      if (this.data.voiceAssistantEnabled) {
        this.playCurrentStep()
      }
    } else {
      util.showToast('已经是第一步了')
    }
  },

  // 重复当前步骤
  repeatStep() {
    if (this.data.voiceAssistantEnabled) {
      this.playCurrentStep()
    }
  },

  // 停止语音
  stopVoice() {
    if (this.data.audioContext) {
      this.data.audioContext.stop()
    }
    this.setData({ isPlaying: false })
  },

  // 跳转到指定步骤
  jumpToStep(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ currentStepIndex: parseInt(index, 10) })
    if (this.data.voiceAssistantEnabled) {
      this.playCurrentStep()
    }
  },

  // 切换步骤完成状态
  toggleStepComplete(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const steps = [...this.data.steps]
    if (!steps[index]) return
    const step = typeof steps[index] === 'object' ? { ...steps[index] } : { text: steps[index], detail: null, time: null, tips: null, completed: false }
    step.completed = !step.completed
    steps[index] = step
    const completedStepsCount = steps.filter(s => typeof s === 'object' && s.completed).length
    this.setData({ steps, completedStepsCount })
  },

  // 展开/收起步骤详情
  toggleStepExpand(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const expanded = this.data.expandedStepIndex === index ? -1 : index
    this.setData({ expandedStepIndex: expanded })
  },

  // 开始步骤倒计时
  startStepTimer(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10)
    const steps = this.data.steps || []
    const step = steps[index]
    if (!step) return
    const time = typeof step === 'object' && step.time ? step.time : util.parseStepTime(typeof step === 'object' ? step.text : step)
    if (!time || time <= 0) {
      util.showToast('该步骤无设定时间')
      return
    }
    if (this.data.timerRunning) {
      util.showToast('已有倒计时进行中')
      return
    }
    const seconds = time * 60
    const pad = n => (n < 10 ? '0' + n : '' + n)
    this.setData({
      timerSeconds: seconds,
      timerRunning: true,
      timerMinutes: pad(Math.floor(seconds / 60)),
      timerSecondsStr: pad(seconds % 60)
    })
    const interval = setInterval(() => {
      const s = this.data.timerSeconds - 1
      const m = Math.floor(s / 60)
      const sec = s % 60
      this.setData({
        timerSeconds: s,
        timerMinutes: pad(m),
        timerSecondsStr: pad(sec)
      })
      if (s <= 0) {
        clearInterval(this.data.timerInterval)
        this.setData({ timerRunning: false, timerInterval: null })
        wx.vibrateShort({ type: 'heavy' })
        util.showToast('时间到！', 'success')
      }
    }, 1000)
    this.setData({ timerInterval: interval })
  },

  // 停止倒计时
  stopTimer() {
    if (this.data.timerInterval) {
      clearInterval(this.data.timerInterval)
    }
    this.setData({ timerRunning: false, timerInterval: null, timerSeconds: 0 })
  },

  // 分享到社区
  shareToCommunity() {
    const { recipe } = this.data
    if (!recipe || !recipe.id) {
      util.showToast('菜谱信息不完整')
      return
    }
    
    wx.navigateTo({
      url: `/packageCommunity/community/community?share=true&type=recipe&id=${recipe.id}&name=${encodeURIComponent(recipe.name || '')}&image=${encodeURIComponent(recipe.image || '')}`
    })
  }
})
