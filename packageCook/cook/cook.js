// pages/cook/cook.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')
const app = getApp()

Page({
  data: {
    searchKeyword: '',
    searchFocused: false,
    useFridge: false,
    sortType: 'match', // match, calories, time
    sortText: '匹配度',
    tags: [
      { value: 'quick', label: '快手菜', icon: '⚡', active: false },
      { value: 'low_fat', label: '减脂', icon: '🥗', active: false },
      { value: 'high_protein', label: '高蛋白', icon: '💪', active: false },
      { value: 'soup', label: '汤羹', icon: '🍲', active: false },
      { value: 'low_gi', label: '低GI', icon: '📉', active: false },
      { value: 'spicy', label: '辣', icon: '🌶️', active: false },
      { value: 'vegetarian', label: '素食', icon: '🥬', active: false },
      { value: 'no_spicy', label: '无辣', icon: '🌿', active: false },
      { value: 'low_salt', label: '低盐', icon: '🧂', active: false },
      { value: 'meal_prep', label: '备餐', icon: '📦', active: false }
    ],
    mealPrepMode: false, // 备餐模式
    recipes: [],
    loading: false,
    refreshing: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    showSortModal: false,
    showAdvancedFilters: false,
    cleanupMode: false, // 大扫除模式
    expiringItems: [], // 临期食材列表
    cleanupModeTip: '', // 大扫除模式提示
    availableTools: [], // 可用厨具列表
    toolOptions: [
      { value: 'microwave', label: '微波炉', icon: '📻' },
      { value: 'rice_cooker', label: '电饭煲', icon: '🍚' },
      { value: 'oven', label: '烤箱', icon: '🔥' },
      { value: 'pan', label: '平底锅', icon: '🍳' },
      { value: 'wok', label: '炒锅', icon: '🥘' },
      { value: 'steamer', label: '蒸锅', icon: '♨️' },
      { value: 'pressure_cooker', label: '高压锅', icon: '⚡' },
      { value: 'blender', label: '搅拌机', icon: '🌀' }
    ],
    showToolSelector: false, // 显示厨具选择器
    timeFilter: '',
    timeFilters: [
      { value: '', label: '全部' },
      { value: '15', label: '15分钟内' },
      { value: '30', label: '30分钟内' },
      { value: '60', label: '1小时内' }
    ],
    remainingTime: '', // 剩余时间（分钟）
    showTimeInput: false, // 显示时间输入
    difficultyFilter: '',
    difficultyFilters: [
      { value: '', label: '全部' },
      { value: 'simple', label: '简单' },
      { value: 'medium', label: '中等' },
      { value: 'hard', label: '困难' }
    ],
    calorieMin: '',
    calorieMax: '',
    showPreviewModal: false,
    previewRecipe: {}
  },

  onLoad(options) {
    // 如果从冰箱页面跳转过来，自动开启冰箱模式
    if (options.useFridge === 'true') {
      this.setData({ useFridge: true })
    }
    
    // 大扫除模式：强制使用临期食材
    if (options.cleanupMode === 'true') {
      const expiringItems = options.expiringItems ? decodeURIComponent(options.expiringItems).split(',') : []
      this.setData({ 
        useFridge: true,
        cleanupMode: true,
        expiringItems: expiringItems,
        cleanupModeTip: `大扫除模式：优先使用 ${expiringItems.length} 个临期食材`
      })
      
      // 显示大扫除模式提示
      util.showToast(`大扫除模式：发现 ${expiringItems.length} 个临期食材`, 'none', 3000)
    }
    
    this.loadRecipes()
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  onSearchFocus() { this.setData({ searchFocused: true }) },
  onSearchBlur()  { this.setData({ searchFocused: false }) },

  // 搜索
  onSearch() {
    this.loadRecipes(true)
  },

  // 清除搜索
  clearSearch() {
    this.setData({ searchKeyword: '' })
    this.loadRecipes(true)
  },

  /** 外链图失效时降级为本地语义封面 */
  onRecipeCardImageError(e) {
    const id = e.currentTarget.dataset.id
    if (id == null) return
    const recipes = this.data.recipes.map((r) => {
      if (String(r.id) !== String(id)) return r
      return { ...r, image: util.resolveRecipeCoverUrl({ ...r, image: '', photos: [] }) }
    })
    this.setData({ recipes })
  },

  onPreviewImageError() {
    const pr = this.data.previewRecipe
    if (!pr || !pr.id) return
    const fallback = util.resolveRecipeCoverUrl({ ...pr, image: '', photos: [] })
    this.setData({ previewRecipe: { ...pr, image: fallback } })
  },

  // 显示排序弹窗
  showSortModal() {
    this.setData({ showSortModal: true })
  },

  // 选择排序
  selectSort(e) {
    const type = e.currentTarget.dataset.type
    const sortTexts = {
      match: '匹配度',
      calories: '卡路里',
      time: '时间'
    }
    this.setData({
      sortType: type,
      sortText: sortTexts[type],
      showSortModal: false
    })
    this.loadRecipes(true)
  },

  // 加载菜谱列表
  async loadRecipes(reset = false) {
    if (this.data.loading) return
    
    this.setData({ loading: true })
    
    try {
      const activeTags = this.data.tags
        .filter(tag => tag.active)
        .map(tag => tag.value)
      
      // 备餐模式：自动添加备餐标签
      if (this.data.mealPrepMode && !activeTags.includes('meal_prep')) {
        activeTags.push('meal_prep')
      }
      
      const location = app.globalData.location
      const params = {
        mode: 'cook',
        use_fridge: this.data.useFridge,
        filters: {
          tags: activeTags,
          sort_by: this.data.sortType,
          keyword: this.data.searchKeyword,
          cooking_time: this.data.timeFilter,
          difficulty: this.data.difficultyFilter,
          calorie_min: this.data.calorieMin || undefined,
          calorie_max: this.data.calorieMax || undefined,
          available_tools: this.data.availableTools.length > 0 ? this.data.availableTools : undefined,
          meal_prep: this.data.mealPrepMode || undefined
        }
      }
      
      if (location) {
        params.lat = location.latitude
        params.lng = location.longitude
      }

      const result = await api.searchRecommend(params)
      
      let recipes = result.recommendations || []
      
      // 大扫除模式：提高临期食材的权重
      if (this.data.cleanupMode && this.data.expiringItems.length > 0) {
        recipes = recipes.map(recipe => {
          // 计算使用临期食材的数量
          const expiringCount = (recipe.ingredients || []).filter(ing => {
            const ingName = ing.name || ''
            return this.data.expiringItems.some(expiring => 
              ingName.includes(expiring) || expiring.includes(ingName)
            )
          }).length
          
          // 如果使用了临期食材，大幅提高匹配度
          if (expiringCount > 0) {
            recipe.match_score = (recipe.match_score || 0) + expiringCount * 30
            recipe.cleanup_boost = true // 标记为大扫除推荐
          }
          
          return recipe
        })
        
        // 按匹配度重新排序，优先显示使用临期食材的菜谱
        recipes.sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
      }
      
      // 备餐模式：筛选适合备餐的菜谱
      if (this.data.mealPrepMode) {
        recipes = recipes.filter(recipe => {
          // 适合备餐的菜谱特征：
          // 1. 标签包含"备餐"、"炖"、"煮"等
          // 2. 耐储存（炖菜、咖喱、汤类等）
          // 3. 烹饪时间较长（适合一次做多份）
          const tags = (recipe.tags || []).join(' ').toLowerCase()
          const name = (recipe.name || '').toLowerCase()
          const cookingTime = recipe.cooking_time || 0
          
          const isMealPrepSuitable = 
            tags.includes('备餐') || tags.includes('meal_prep') ||
            tags.includes('炖') || tags.includes('煮') || tags.includes('汤') ||
            name.includes('炖') || name.includes('咖喱') || name.includes('汤') ||
            (cookingTime >= 30 && cookingTime <= 120) // 30分钟-2小时适合备餐
          
          return isMealPrepSuitable
        })
        
        // 为备餐菜谱添加存储天数信息
        recipes = recipes.map(recipe => {
          // 根据菜谱类型估算可储存天数
          const tags = (recipe.tags || []).join(' ').toLowerCase()
          const name = (recipe.name || '').toLowerCase()
          
          let storageDays = 3 // 默认3天
          if (tags.includes('炖') || name.includes('炖')) {
            storageDays = 4 // 炖菜可存4天
          } else if (tags.includes('咖喱') || name.includes('咖喱')) {
            storageDays = 5 // 咖喱可存5天
          } else if (tags.includes('汤') || name.includes('汤')) {
            storageDays = 3 // 汤类可存3天
          }
          
          return {
            ...recipe,
            meal_prep_suitable: true,
            storage_days: storageDays,
            meal_prep_tip: `可储存${storageDays}天，适合一次做多份`
          }
        })
      }
      
      // 处理数据，添加额外信息
      recipes = recipes.map(recipe => {
        recipe.image = util.resolveRecipeCoverUrl(recipe)
        // 检查是否最近做过（从本地存储读取）
        const recentCooked = wx.getStorageSync('recent_cooked') || []
        recipe.recently_cooked = recentCooked.includes(recipe.id)
        
        // 检查是否收藏（与 favorite_recipes 及 favorites 联动）
        const favoriteIds = wx.getStorageSync('favorite_recipes') || []
        recipe.is_favorite = favoriteIds.some(fid => String(fid) === String(recipe.id))
        
        // 设置难度等级
        if (recipe.difficulty === '简单') {
          recipe.difficulty_level = 'simple'
        } else if (recipe.difficulty === '中等') {
          recipe.difficulty_level = 'medium'
        } else {
          recipe.difficulty_level = 'hard'
        }
        
        return recipe
      })
      
      // 客户端筛选 - 烹饪时间动态调整
      if (this.data.remainingTime) {
        // 如果设置了剩余时间，优先使用剩余时间筛选
        const remainingMinutes = parseInt(this.data.remainingTime)
        recipes = recipes.filter(r => {
          const cookingTime = r.cooking_time || 0
          // 考虑腌制、炖煮等额外时间（如果有标注）
          const prepTime = r.prep_time || 0
          const totalTime = cookingTime + prepTime
          return totalTime <= remainingMinutes
        })
      } else if (this.data.timeFilter) {
        // 否则使用时间筛选器
        recipes = recipes.filter(r => {
          const time = r.cooking_time || 0
          const filterTime = parseInt(this.data.timeFilter)
          return time <= filterTime
        })
      }
      
      if (this.data.difficultyFilter) {
        recipes = recipes.filter(r => r.difficulty_level === this.data.difficultyFilter)
      }
      
      if (this.data.calorieMin) {
        recipes = recipes.filter(r => r.calories >= parseInt(this.data.calorieMin))
      }
      
      if (this.data.calorieMax) {
        recipes = recipes.filter(r => r.calories <= parseInt(this.data.calorieMax))
      }
      
      // 厨具条件筛选
      if (this.data.availableTools.length > 0) {
        recipes = recipes.filter(r => {
          const requiredTools = r.required_tools || []
          // 如果菜谱需要厨具，检查是否都在可用厨具列表中
          if (requiredTools.length === 0) {
            return true // 不需要特殊厨具的菜谱都可以做
          }
          // 检查所需厨具是否都在可用厨具中
          return requiredTools.every(tool => this.data.availableTools.includes(tool))
        })
      }
      
      // 客户端排序
      if (this.data.sortType === 'calories') {
        recipes = recipes.sort((a, b) => a.calories - b.calories)
      } else if (this.data.sortType === 'match') {
        recipes = recipes.sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
      }
      
      if (reset) {
        this.setData({
          recipes: recipes,
          page: 1,
          hasMore: recipes.length >= this.data.pageSize
        })
      } else {
        this.setData({
          recipes: [...this.data.recipes, ...recipes],
          page: this.data.page + 1,
          hasMore: recipes.length >= this.data.pageSize
        })
      }
    } catch (error) {
      console.error('加载菜谱失败', error)
      util.showToast('加载失败，请重试')
    } finally {
      this.setData({ loading: false, refreshing: false })
    }
  },

  // 冰箱开关切换
  onFridgeToggle(e) {
    this.setData({ useFridge: e.detail.value })
    this.loadRecipes(true)
  },

  // 标签点击
  onTagTap(e) {
    const tag = e.currentTarget.dataset.tag
    tag.active = !tag.active
    
    const tags = this.data.tags.map(t => 
      t.value === tag.value ? tag : t
    )
    
    this.setData({ tags })
    this.loadRecipes(true)
  },

  // 下拉刷新
  onRefresh() {
    this.setData({ refreshing: true })
    this.loadRecipes(true)
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadRecipes()
    }
  },

  // 跳转到详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/packageCook/cook-detail/cook-detail?id=${id}`
    })
  },

  // 跳转到冰箱
  goToFridge() {
    wx.switchTab({
      url: '/pages/fridge/fridge'
    })
  },

  // 阻止事件冒泡
  stopPropagation() {},

  // 切换高级筛选
  toggleAdvancedFilters() {
    this.setData({ showAdvancedFilters: !this.data.showAdvancedFilters })
  },

  // 选择时间筛选
  selectTimeFilter(e) {
    const value = e.currentTarget.dataset.value
    this.setData({ timeFilter: value })
    this.loadRecipes(true)
  },

  // 选择难度筛选
  selectDifficultyFilter(e) {
    const value = e.currentTarget.dataset.value
    this.setData({ difficultyFilter: value })
    this.loadRecipes(true)
  },

  // 卡路里最小值输入
  onCalorieMinInput(e) {
    this.setData({ calorieMin: e.detail.value })
  },

  // 卡路里最大值输入
  onCalorieMaxInput(e) {
    this.setData({ calorieMax: e.detail.value })
  },

  // 长按卡片预览
  onCardLongPress(e) {
    const item = e.currentTarget.dataset.item
    wx.vibrateShort()
    this.setData({
      showPreviewModal: true,
      previewRecipe: item
    })
  },

  // 关闭预览弹窗
  closePreviewModal() {
    this.setData({ showPreviewModal: false })
  },

  // 从预览跳转到详情
  goToPreviewDetail() {
    this.setData({ showPreviewModal: false })
    wx.navigateTo({
      url: `/packageCook/cook-detail/cook-detail?id=${this.data.previewRecipe.id}`
    })
  },

  // 快速收藏（同步写入 favorites 存储，与「我的收藏」页联动）
  async quickFavorite(e) {
    const id = e.currentTarget.dataset.id
    const isFavorite = e.currentTarget.dataset.favorite
    
    wx.vibrateShort()
    
    try {
      let favoriteIds = wx.getStorageSync('favorite_recipes') || []
      let fullFavorites = wx.getStorageSync('favorites') || []
      
      if (isFavorite) {
        favoriteIds = favoriteIds.filter(fid => String(fid) !== String(id))
        fullFavorites = fullFavorites.filter(item => String(item.id) !== String(id) || item.type !== 'recipe')
        util.showToast('已取消收藏')
      } else {
        const recipe = this.data.recipes.find(r => String(r.id) === String(id))
        favoriteIds.push(id)
        fullFavorites.push({
          id,
          type: 'recipe',
          name: (recipe && recipe.name) || '未知菜谱',
          image: (recipe && recipe.image) || '',
          calories: (recipe && (recipe.calories || recipe.calories_per_100g)) || 0,
          tags: (recipe && recipe.tags) || [],
          createdAt: new Date().toISOString()
        })
        try {
          await api.favoriteRecipe(id)
        } catch (err) {
          console.warn('收藏 API 失败，已更新本地', err)
        }
        util.showToast('已收藏')
      }
      
      wx.setStorageSync('favorite_recipes', favoriteIds)
      wx.setStorageSync('favorites', fullFavorites)
      
      const recipes = this.data.recipes.map(r => {
        if (String(r.id) === String(id)) r.is_favorite = !isFavorite
        return r
      })
      this.setData({ recipes })
    } catch (error) {
      util.showToast('操作失败')
    }
  },

  // 快速分享
  quickShare(e) {
    const item = e.currentTarget.dataset.item
    wx.vibrateShort()
    
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
    
    // 记录分享
    const shareData = {
      title: `推荐一道菜：${item.name}`,
      path: `/packageCook/cook-detail/cook-detail?id=${item.id}`,
      imageUrl: item.image
    }
    
    // 这里可以调用分享API记录分享行为
    util.showToast('分享功能已打开')
  },

  // 显示/隐藏厨具选择器
  toggleToolSelector() {
    this.setData({ showToolSelector: !this.data.showToolSelector })
  },

  // 切换厨具选择
  toggleTool(e) {
    const tool = e.currentTarget.dataset.tool
    const availableTools = [...this.data.availableTools]
    const index = availableTools.indexOf(tool)
    
    if (index > -1) {
      availableTools.splice(index, 1)
    } else {
      availableTools.push(tool)
    }
    
    this.setData({ availableTools })
    this.loadRecipes(true) // 重新加载菜谱
  },

  // 显示/隐藏时间输入
  toggleTimeInput() {
    this.setData({ showTimeInput: !this.data.showTimeInput })
  },

  // 输入剩余时间
  onRemainingTimeInput(e) {
    const value = e.detail.value
    // 只允许数字
    if (/^\d*$/.test(value)) {
      this.setData({ remainingTime: value })
    }
  },

  // 确认剩余时间
  confirmRemainingTime() {
    if (this.data.remainingTime) {
      this.setData({ showTimeInput: false })
      this.loadRecipes(true) // 重新加载菜谱
      util.showToast(`已设置剩余时间：${this.data.remainingTime}分钟`)
    }
  },

  // 清除剩余时间
  clearRemainingTime() {
    this.setData({ remainingTime: '', showTimeInput: false })
    this.loadRecipes(true)
  },

  // 备餐模式切换
  onMealPrepToggle(e) {
    this.setData({ mealPrepMode: e.detail.value })
    this.loadRecipes(true)
    
    if (e.detail.value) {
      util.showToast('已开启备餐模式，推荐耐储存菜谱', 'none', 2000)
    }
  },

})
