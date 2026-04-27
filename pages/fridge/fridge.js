// pages/fridge/fridge.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')
const { getWindowMetricsSafe } = require('../../utils/platform.js')

Page({
  data: {
    // 顶部栏与问候（与首页统一）
    timeText: '',
    currentDate: '',
    fridgeGreeting: '看看冰箱里还能做啥菜',
    // 降级动效（弱机型/省电）
    reduceMotion: false,
    searchKeyword: '',
    showSuggestions: false,
    searchSuggestions: [],
    currentCategory: 'all',
    currentCategoryLabel: '全部', // 当前列表展示的分类标题
    categories: [
      { value: 'all', label: '全部', icon: '📦' },
      { value: 'vegetable', label: '蔬菜', icon: '🥬', subCategories: ['叶菜类', '根茎类', '瓜果类', '菌菇类', '豆类'] },
      { value: 'meat', label: '肉禽', icon: '🥩', subCategories: ['猪肉', '牛肉', '羊肉', '鸡肉', '鸭肉', '其他'] },
      { value: 'seafood', label: '水产', icon: '🐟', subCategories: ['鱼类', '虾类', '蟹类', '贝类', '其他'] },
      { value: 'staple', label: '主食', icon: '🍚', subCategories: ['米类', '面类', '杂粮', '其他'] },
      { value: 'dairy', label: '蛋奶', icon: '🥛', subCategories: ['鸡蛋', '牛奶', '酸奶', '奶酪', '其他'] },
      { value: 'fruit', label: '水果', icon: '🍎', subCategories: ['浆果类', '核果类', '柑橘类', '瓜类', '其他'] },
      { value: 'seasoning', label: '调料', icon: '🧂', subCategories: ['油类', '酱料', '香料', '其他'] },
      { value: 'frozen', label: '冷冻', icon: '🧊', subCategories: ['速冻食品', '冰淇淋', '其他'] },
      { value: 'other', label: '其他', icon: '📦' }
    ],
    quickItems: [
      { name: '鸡蛋', icon: '🥚', added: false },
      { name: '牛奶', icon: '🥛', added: false },
      { name: '西红柿', icon: '🍅', added: false },
      { name: '鸡胸肉', icon: '🍗', added: false },
      { name: '土豆', icon: '🥔', added: false },
      { name: '青椒', icon: '🫑', added: false },
      { name: '洋葱', icon: '🧅', added: false },
      { name: '胡萝卜', icon: '🥕', added: false },
      { name: '西兰花', icon: '🥦', added: false },
      { name: '苹果', icon: '🍎', added: false },
      { name: '香蕉', icon: '🍌', added: false },
      { name: '大米', icon: '🍚', added: false }
    ],
    items: [],
    filteredItems: [],
    sectionedItems: [], // 按状态分组后的列表（用于分组展示）
    totalCount: 0,
    freshCount: 0,
    expiringCount: 0,
    // 添加食材
    showAddModal: false,
    newItemName: '',
    newItemCategory: 'vegetable',
    newItemAmount: '',
    newItemUnit: '个',
    unitOptions: [
      // 重量单位
      { value: 'g', label: '克(g)', type: 'weight' },
      { value: 'kg', label: '千克(kg)', type: 'weight' },
      { value: '斤', label: '斤', type: 'weight' },
      { value: '两', label: '两', type: 'weight' },
      // 数量单位
      { value: '个', label: '个', type: 'count' },
      { value: '只', label: '只', type: 'count' },
      { value: '条', label: '条', type: 'count' },
      { value: '根', label: '根', type: 'count' },
      { value: '颗', label: '颗', type: 'count' },
      { value: '瓣', label: '瓣', type: 'count' },
      // 包装单位
      { value: '包', label: '包', type: 'package' },
      { value: '盒', label: '盒', type: 'package' },
      { value: '瓶', label: '瓶', type: 'package' },
      { value: '袋', label: '袋', type: 'package' },
      { value: '罐', label: '罐', type: 'package' },
      { value: '桶', label: '桶', type: 'package' },
      // 容量单位
      { value: 'ml', label: '毫升(ml)', type: 'volume' },
      { value: 'L', label: '升(L)', type: 'volume' },
      // 其他
      { value: '把', label: '把', type: 'other' },
      { value: '束', label: '束', type: 'other' },
      { value: '适量', label: '适量', type: 'other' }
    ],
    selectedUnitType: 'count', // 当前选中的单位类型
    newItemSubCategory: '', // 子分类
    currentSubCategories: [], // 当前分类的子分类列表
    showSubCategorySelector: false, // 是否显示子分类选择器
    /** 添加/编辑食材：用户自选照片（本地路径），空则列表用 emoji 默认图标 */
    newItemCoverImage: '',
    // 排序和筛选
    sortType: 'time_desc', // 排序类型：time_desc(入库时间降序), time_asc(入库时间升序), name_asc(名称升序), name_desc(名称降序), freshness(新鲜度优先)
    sortTypeLabel: '最新入库', // 当前排序方式展示文案
    showSortMenu: false, // 是否显示排序菜单
    currentFilterTag: '', // 额外过滤标签文案，如“仅查看新鲜食材”
    // 编辑模式
    editMode: false,
    selectedItems: [],
    // 左滑
    touchStartX: 0,
    currentSwipeIndex: -1,
    // FAB菜单
    fabMenuOpen: false,
    // 新增动画提示
    showAddSuccess: false,
    addSuccessIcon: '🥬',
    addSuccessText: '',
    // 冰箱食材详情弹窗
    showDetailModal: false,
    currentItem: null,
    // 应季食材详情弹窗
    showSeasonalDetail: false,
    seasonalDetailItem: null,
    // 编辑状态
    editingItemId: null,
    // 应季食材
    showSeasonal: false, // 是否显示应季食材（从首页跳转时传入）
    seasonalItems: [], // 当前月份的应季食材列表
    currentMonth: 1, // 当前月份（1-12）
    currentSeason: '', // 当前季节（冬/春/夏/秋）
    currentSeasonTip: '', // 本月时令小知识（纯文案，不含月/地区/季节前缀）
    seasonalPreviewText: '', // 折叠时展示的食材预览（前几项名称）
    userRegionName: '默认地区', // 用户所在地区名称（用于文案展示）
    locationStatus: 'unknown', // unknown / granted / denied / failed
    seasonalDislikedNames: [], // 用户本月不感兴趣的应季食材（按名称）
    navScrolled: false
  },
  
  onLoad(options) {
    // 简单设备能力探测：benchmarkLevel 越低设备越弱
    try {
      const info = getWindowMetricsSafe()
      const isLowEnd = typeof info.benchmarkLevel === 'number' && info.benchmarkLevel <= 20
      const memMb = info.totalMemory || info.memorySize
      const lowMem = typeof memMb === 'number' && memMb > 0 && memMb <= 2048
      if (isLowEnd || lowMem) {
        this.setData({ reduceMotion: true })
      }
    } catch (e) {
      // 兼容性兜底：不做处理
    }
    
    this.initPageHeader()
    this.initSeasonalLocation()
    this.loadFridgeItems()
    // 初始化防抖定时器
    this.searchDebounceTimer = null
    // 加载应季食材
    this.loadSeasonalItems()
  },

  onShow() {
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar && typeof tabBar.setSelected === 'function') tabBar.setSelected(1)
    this.initPageHeader()
    // 每次显示时刷新
    this.loadFridgeItems()
    // 刷新应季食材（月份可能变化）
    this.loadSeasonalItems()
    
    // 检查是否从首页跳转过来显示应季食材
    const app = getApp()
    if (app.globalData.showSeasonalInFridge) {
      this.setData({ showSeasonal: true })
      // 重置标志，避免下次进入时自动展开
      app.globalData.showSeasonalInFridge = false
    }
  },
  
  onUnload() {
    // 清理防抖定时器
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer)
      this.searchDebounceTimer = null
    }
  },

  onFridgeListScroll(e) {
    const top = (e.detail && e.detail.scrollTop) || 0
    const next = top > 20
    if (next !== this.data.navScrolled) {
      this.setData({ navScrolled: next })
    }
  },

  // 初始化顶部栏时间与日期（与首页一致）
  initPageHeader() {
    const now = new Date()
    const h = String(now.getHours()).padStart(2, '0')
    const m = String(now.getMinutes()).padStart(2, '0')
    const month = now.getMonth() + 1
    const day = now.getDate()
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    const weekday = weekdays[now.getDay()]
    this.setData({
      timeText: `${h}:${m}`,
      currentDate: `${month}月${day}日 周${weekday}`
    })
  },

  // 获取用户地理位置（用于应季食材个性化推荐）
  initSeasonalLocation() {
    const that = this
    // 先从本地缓存中读取，避免每次进入都弹授权
    try {
      const cachedRegion = wx.getStorageSync('seasonal_user_region_name')
      const cachedStatus = wx.getStorageSync('seasonal_location_status')
      if (cachedRegion) {
        this.setData({
          userRegionName: cachedRegion,
          locationStatus: cachedStatus || 'granted'
        })
      }
      const disliked = wx.getStorageSync('seasonal_disliked_names') || []
      if (Array.isArray(disliked) && disliked.length) {
        this.setData({ seasonalDislikedNames: disliked })
      }
    } catch (e) {
      // 读取失败时忽略，保持默认值
    }

    // 如果已经有定位状态且不是 unknown，则不重复请求
    if (this.data.locationStatus !== 'unknown') return

    wx.getSetting({
      success(res) {
        const scope = res.authSetting && res.authSetting['scope.userLocation']
        if (scope === false) {
          // 用户明确拒绝过
          that.setData({ locationStatus: 'denied' })
          wx.setStorageSync('seasonal_location_status', 'denied')
          return
        }
        wx.getLocation({
          type: 'wgs84',
          success(loc) {
            // 当前位置附近（后端可用经纬度解析城市，这里仅做文案展示与预留）
            that.setData({
              locationStatus: 'granted',
              userRegionName: '你所在地区'
            })
            try {
              wx.setStorageSync('seasonal_location_status', 'granted')
              wx.setStorageSync('seasonal_user_region_name', '你所在地区')
              // 预留：可在此调用后端季节接口，传递 loc.latitude / loc.longitude
            } catch (e) {
              // 缓存失败忽略
            }
          },
          fail() {
            that.setData({ locationStatus: 'failed' })
            try {
              wx.setStorageSync('seasonal_location_status', 'failed')
            } catch (e) {}
          }
        })
      },
      fail() {
        // 获取设置失败时，不再继续定位
        that.setData({ locationStatus: 'failed' })
      }
    })
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadFridgeItems().finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载冰箱清单
  async loadFridgeItems() {
    try {
      util.showLoading('加载中...')
      const result = await api.getFridgeItems()
      
      // 处理返回的数据格式（可能是 { items: [...] } 或直接是数组）
      let items = Array.isArray(result) ? result : (result.items || [])
      
      // 确保items是数组
      if (!Array.isArray(items)) {
        console.warn('返回的数据格式不正确，使用空数组', result)
        items = []
      }
      
      // 处理食材数据，添加新鲜度信息
      // 根据文档，后端返回 days_stored 字段，days_stored > 7 显示红色警告
      items = items.map(function(item) {
        // 数据验证：确保必要字段存在
        if (!item || !item.name) {
          console.warn('发现无效的食材数据，跳过', item)
          return null
        }
        
        // 如果没有days_stored，根据created_at计算
        let daysStored = item.days_stored
        if (daysStored === undefined || daysStored === null) {
          if (item.created_at) {
            try {
              const createdDate = new Date(item.created_at)
              const now = new Date()
              // 验证日期有效性
              if (isNaN(createdDate.getTime())) {
                daysStored = 0
              } else {
                daysStored = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24))
                // 防止负数
                daysStored = Math.max(0, daysStored)
              }
            } catch (e) {
              console.warn('日期解析失败', item.created_at, e)
              daysStored = 0
            }
          } else {
            daysStored = 0
          }
        }
        
        // 确保数量是有效数字
        let amount = item.amount
        if (amount === undefined || amount === null) {
          amount = item.unit === '适量' ? 0 : 1
        } else {
          amount = parseFloat(amount)
          if (isNaN(amount) || amount < 0) {
            amount = item.unit === '适量' ? 0 : 1
          }
        }
        
        const unit = item.unit || '个'
        
        // 根据 days_stored 判断新鲜度
        let freshness = 'fresh'
        if (daysStored > 7) {
          freshness = 'expired' // 红色警告
        } else if (daysStored > 5) {
          freshness = 'expiring' // 黄色警告
        }
        
        return {
          ...item,
          id: item.id || 'temp_' + Date.now() + '_' + Math.random(), // 确保有ID
          name: String(item.name).trim(), // 确保名称是字符串且去除空格
          freshness,
          daysInFridge: daysStored,
          amount: amount,
          unit: unit,
          swipeX: 0,
          category: item.category || 'other' // 确保有分类
        }
      }).filter(function(item) { return item !== null }) // 过滤掉无效数据
      
      // 计算统计信息
      const totalCount = items.length
      const freshCount = items.filter(function(i) { return i.freshness === 'fresh' }).length
      const expiringCount = items.filter(function(i) { return i.freshness === 'expiring' || i.freshness === 'expired' }).length
      
      // 更新快速添加状态
      const self = this
      const quickItems = this.data.quickItems.map(function(quick) {
        const added = items.some(function(item) {
          return util.normalizeIngredient(item.name) === util.normalizeIngredient(quick.name)
        })
        return { ...quick, added }
      })
      
      this.setData({ 
        items, 
        quickItems,
        totalCount,
        freshCount,
        expiringCount
      })
      this.filterItems()
    } catch (error) {
      console.error('加载冰箱清单失败', error)
      // 更友好的错误提示
      let errorMsg = '加载失败，请重试'
      if (error.message) {
        if (error.message.includes('网络') || error.message.includes('timeout')) {
          errorMsg = '网络连接失败，请检查网络后重试'
        } else if (error.message.includes('401') || error.message.includes('登录')) {
          errorMsg = '登录已过期，请重新登录'
        } else {
          errorMsg = error.message
        }
      }
      util.showToast(errorMsg)
      // 如果加载失败，至少保持空数组，避免页面崩溃
      this.setData({
        items: [],
        filteredItems: [],
        totalCount: 0,
        freshCount: 0,
        expiringCount: 0
      })
    } finally {
      util.hideLoading()
    }
  },

  // 搜索输入（添加防抖）
  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
    
    // 清除之前的防抖定时器
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer)
    }
    
    // 搜索联想（立即显示）
    if (keyword) {
      const suggestions = this.getSearchSuggestions(keyword)
      this.setData({ 
        searchSuggestions: suggestions,
        showSuggestions: suggestions.length > 0
      })
    } else {
      this.setData({ showSuggestions: false })
    }
    
    // 防抖：延迟执行筛选，避免频繁操作
    this.searchDebounceTimer = setTimeout(() => {
      this.filterItems()
    }, 300)
  },

  // 获取搜索联想（扩展同义词库）
  getSearchSuggestions(keyword) {
    // 扩展的食材库（包含更多常见食材和同义词）
    const allIngredients = [
      // 蔬菜类
      '西红柿', '番茄', '鸡蛋', '鸡胸肉', '土豆', '马铃薯', '青椒', '甜椒', '彩椒',
      '洋葱', '葱头', '胡萝卜', '红萝卜', '西兰花', '花椰菜', '白菜', '大白菜', '小白菜',
      '菠菜', '生菜', '青菜', '芹菜', '韭菜', '黄瓜', '丝瓜', '茄子', '豆角', '四季豆',
      '蘑菇', '香菇', '金针菇', '平菇', '玉米', '南瓜', '冬瓜', '萝卜', '白萝卜',
      '豆芽', '黄豆芽', '绿豆芽', '莲藕', '山药', '芋头', '红薯', '紫薯',
      // 肉禽类
      '牛肉', '牛排', '猪肉', '排骨', '里脊', '五花肉', '羊肉', '鸡肉', '鸡', '鸡腿',
      '鸡翅', '鸭肉', '鸭', '鹅肉', '培根', '火腿',
      // 水产类
      '鱼', '鱼肉', '草鱼', '鲫鱼', '带鱼', '三文鱼', '虾', '大虾', '小虾', '基围虾',
      '蟹', '螃蟹', '大闸蟹', '鱿鱼', '章鱼', '墨鱼', '贝类', '扇贝', '生蚝', '蛤蜊',
      // 主食类
      '大米', '米饭', '米', '面条', '面', '挂面', '方便面', '面包', '馒头', '花卷',
      '饺子', '包子', '馄饨', '汤圆', '年糕', '米粉', '河粉',
      // 蛋奶类
      '牛奶', '酸奶', '奶酪', '芝士', '黄油', '奶油', '蛋', '鸡蛋', '鸭蛋', '鹌鹑蛋',
      // 水果类
      '苹果', '香蕉', '橙子', '橘子', '葡萄', '草莓', '西瓜', '哈密瓜', '桃子', '梨',
      '樱桃', '芒果', '菠萝', '柠檬', '柚子', '火龙果', '猕猴桃', '蓝莓', '荔枝',
      // 调料类
      '油', '食用油', '盐', '糖', '醋', '酱油', '生抽', '老抽', '料酒', '蒜', '大蒜',
      '姜', '生姜', '葱', '大葱', '小葱', '香菜', '胡椒', '辣椒', '花椒', '八角', '桂皮'
    ]
    
    const keywordLower = keyword.toLowerCase().trim()
    if (!keywordLower) return []
    
    // 使用同义词映射进行更智能的匹配
    const normalizedKeyword = util.normalizeIngredient(keyword)
    
    return allIngredients
      .filter(item => {
        const itemLower = item.toLowerCase()
        const normalizedItem = util.normalizeIngredient(item)
        // 多种匹配方式：直接包含、同义词匹配、拼音匹配（简单版）
        return item.includes(keyword) || 
               itemLower.includes(keywordLower) ||
               normalizedItem.includes(normalizedKeyword) ||
               normalizedKeyword.includes(normalizedItem)
      })
      .slice(0, 5)
  },

  // 搜索聚焦
  onSearchFocus() {
    if (this.data.searchKeyword) {
      this.setData({ showSuggestions: true })
    }
  },

  // 搜索失焦
  onSearchBlur() {
    setTimeout(() => {
      this.setData({ showSuggestions: false })
    }, 200)
  },

  // 选择联想
  selectSuggestion(e) {
    const item = e.currentTarget.dataset.item
    this.setData({ 
      searchKeyword: item,
      showSuggestions: false
    })
    // 如果不在冰箱中，直接添加
    const exists = this.data.items.some(function(i) {
      return util.normalizeIngredient(i.name) === util.normalizeIngredient(item)
    })
    if (!exists) {
      this.addItem(item, this.guessCategory(item))
    } else {
      this.filterItems()
    }
  },

  // 猜测分类
  guessCategory(name) {
    const vegetableKeywords = ['西红柿', '番茄', '土豆', '青椒', '洋葱', '胡萝卜', '西兰花', '白菜', '菠菜', '芹菜', '黄瓜', '茄子', '豆角', '蘑菇', '萝卜', '南瓜', '冬瓜', '丝瓜', '苦瓜', '豆芽', '韭菜', '生菜', '青菜']
    const meatKeywords = ['鸡', '牛', '猪', '羊', '肉', '排骨', '里脊', '五花']
    const seafoodKeywords = ['鱼', '虾', '蟹', '海鲜', '鱿鱼', '章鱼', '贝', '扇贝', '生蚝']
    const fruitKeywords = ['苹果', '香蕉', '橙子', '葡萄', '草莓', '水果', '梨', '桃', '樱桃', '芒果', '菠萝', '西瓜', '哈密瓜']
    const dairyKeywords = ['牛奶', '酸奶', '蛋', '奶', '奶酪', '黄油']
    const stapleKeywords = ['米', '面', '面包', '主食', '馒头', '饺子', '包子', '馄饨']
    const seasoningKeywords = ['油', '盐', '糖', '醋', '酱油', '料酒', '蒜', '姜', '葱', '胡椒', '辣椒', '花椒', '八角', '桂皮', '香叶']
    const frozenKeywords = ['速冻', '冷冻', '冰淇淋', '雪糕']
    
    if (vegetableKeywords.some(function(k) { return name.includes(k) })) return 'vegetable'
    if (meatKeywords.some(function(k) { return name.includes(k) })) return 'meat'
    if (seafoodKeywords.some(function(k) { return name.includes(k) })) return 'seafood'
    if (fruitKeywords.some(function(k) { return name.includes(k) })) return 'fruit'
    if (dairyKeywords.some(function(k) { return name.includes(k) })) return 'dairy'
    if (stapleKeywords.some(function(k) { return name.includes(k) })) return 'staple'
    if (seasoningKeywords.some(function(k) { return name.includes(k) })) return 'seasoning'
    if (frozenKeywords.some(function(k) { return name.includes(k) })) return 'frozen'
    return 'other'
  },

  // 清除搜索
  clearSearch() {
    this.setData({ 
      searchKeyword: '',
      showSuggestions: false
    })
    this.filterItems()
  },

  // 搜索确认
  onSearch() {
    this.setData({ showSuggestions: false })
    this.filterItems()
  },


  // 切换分类
  switchCategory(e) {
    const category = e.currentTarget.dataset.category
    if (category === 'fresh') {
      // 显示新鲜食材
      this.setData({ 
        currentCategory: 'all',
        currentCategoryLabel: '全部',
        currentFilterTag: '仅查看新鲜食材'
      })
      this.filterItems()
      // 过滤出新鲜食材
      const freshItems = this.data.filteredItems.filter(function(item) { return item.freshness === 'fresh' })
      this.setData({ filteredItems: freshItems })
    } else {
      this.setData({ 
        currentCategory: category,
        currentCategoryLabel: this.getCategoryLabel(category),
        currentFilterTag: ''
      })
      this.filterItems()
    }
  },

  // 显示即将过期的食材
  showExpiringItems() {
    this.setData({ 
      currentCategory: 'all',
      currentCategoryLabel: '全部',
      currentFilterTag: '仅看临期/过期食材'
    })
    this.filterItems()
    const expiringItems = this.data.filteredItems.filter(function(item) {
      return item.freshness === 'expiring' || item.freshness === 'expired'
    })
    this.setData({ filteredItems: expiringItems })
    if (expiringItems.length === 0) {
      util.showToast('没有即将过期的食材')
    }
  },

  // 筛选物品（优化筛选逻辑）
  filterItems() {
    let filtered = [...this.data.items]
    
    // 数据验证：确保items是数组
    if (!Array.isArray(filtered)) {
      console.warn('items不是数组，使用空数组', this.data.items)
      filtered = []
    }
    
    // 分类筛选
    if (this.data.currentCategory !== 'all') {
      filtered = filtered.filter(function(item) {
        if (!item || !item.category) return false
        return item.category === this.data.currentCategory
      }.bind(this))
    }
    
    // 搜索筛选（支持更灵活的搜索）
    if (this.data.searchKeyword) {
      const keyword = this.data.searchKeyword.toLowerCase().trim()
      const self = this
      if (keyword) {
        filtered = filtered.filter(function(item) {
          if (!item || !item.name) return false
          const name = item.name.toLowerCase()
          const normalizedName = util.normalizeIngredient(item.name).toLowerCase()
          const subCategory = item.sub_category ? item.sub_category.toLowerCase() : ''
          
          // 多种匹配方式
          return name.includes(keyword) ||
                 normalizedName.includes(keyword) ||
                 subCategory.includes(keyword) ||
                 keyword.includes(normalizedName) // 反向匹配（如输入"番茄"能匹配"西红柿"）
        })
      }
    }
    
    // 排序
    filtered = this.sortItems(filtered)
    
    // 预计算视图字段，避免在 WXML 中频繁调用函数
    const self = this
    const computed = filtered.map(function(item, index) {
      if (!item) return item
      const name = item.name || ''
      const icon = self.getIngredientIcon(name)
      const coverImage = (item.cover_image || item.cover_url || '').trim()
      const categoryLabel = self.getCategoryLabel(item.category)
      const timeText = self.timeAgo(item.created_at) + ' · ' + (item.daysInFridge || 0) + '天'
      const freshnessTip = self.getFreshnessTip(item)
      return {
        ...item,
        icon: icon,
        coverImage: coverImage,
        categoryLabel: categoryLabel,
        timeText: timeText,
        freshnessTip: freshnessTip,
        flatIndex: index // 记录在扁平数组中的索引，供分组视图使用
      }
    })

    // 按新鲜度进行分组展示（保持原有排序的相对顺序）
    const sectionsMap = {
      expiring: { key: 'expiring', title: '即将过期', items: [] },
      expired: { key: 'expired', title: '已过期', items: [] },
      fresh: { key: 'fresh', title: '正常保鲜', items: [] }
    }

    computed.forEach(function(item) {
      if (!item) return
      const freshness = item.freshness || 'fresh'
      if (freshness === 'expired') {
        sectionsMap.expired.items.push(item)
      } else if (freshness === 'expiring') {
        sectionsMap.expiring.items.push(item)
      } else {
        sectionsMap.fresh.items.push(item)
      }
    })

    const sectionedItems = Object.values(sectionsMap).filter(function(section) {
      return section.items.length > 0
    })
    
    this.setData({ 
      filteredItems: computed,
      sectionedItems
    })
  },

  // 排序食材
  sortItems(items) {
    const sorted = [...items]
    const sortType = this.data.sortType
    
    switch (sortType) {
      case 'time_desc':
        // 入库时间降序（最新的在前）
        sorted.sort(function(a, b) {
          const timeA = new Date(a.created_at || 0).getTime()
          const timeB = new Date(b.created_at || 0).getTime()
          return timeB - timeA
        })
        break
      case 'time_asc':
        // 入库时间升序（最旧的在前）
        sorted.sort(function(a, b) {
          const timeA = new Date(a.created_at || 0).getTime()
          const timeB = new Date(b.created_at || 0).getTime()
          return timeA - timeB
        })
        break
      case 'name_asc':
        // 名称升序（A-Z）
        sorted.sort(function(a, b) {
          return a.name.localeCompare(b.name, 'zh-CN')
        })
        break
      case 'name_desc':
        // 名称降序（Z-A）
        sorted.sort(function(a, b) {
          return b.name.localeCompare(a.name, 'zh-CN')
        })
        break
      case 'freshness':
        // 新鲜度优先（新鲜 > 即将过期 > 已过期）
        sorted.sort(function(a, b) {
          const freshnessOrder = { 'fresh': 0, 'expiring': 1, 'expired': 2 }
          const orderA = freshnessOrder[a.freshness] || 3
          const orderB = freshnessOrder[b.freshness] || 3
          if (orderA !== orderB) {
            return orderA - orderB
          }
          // 相同新鲜度按时间排序
          const timeA = new Date(a.created_at || 0).getTime()
          const timeB = new Date(b.created_at || 0).getTime()
          return timeA - timeB
        })
        break
      default:
        break
    }
    
    return sorted
  },

  // 获取排序方式展示文案
  getSortTypeLabel(sortType) {
    const map = {
      time_desc: '最新入库',
      time_asc: '最早入库',
      name_asc: '名称 A-Z',
      name_desc: '名称 Z-A',
      freshness: '新鲜度优先'
    }
    return map[sortType] || '最新入库'
  },

  // 切换排序方式
  switchSortType(e) {
    const sortType = e.currentTarget.dataset.sort
    this.setData({ 
      sortType,
      sortTypeLabel: this.getSortTypeLabel(sortType),
      showSortMenu: false
    })
    this.filterItems()
  },

  // 显示/隐藏排序菜单
  toggleSortMenu() {
    this.setData({ showSortMenu: !this.data.showSortMenu })
  },

  // 切换快速添加项（优化错误处理和状态同步）
  async toggleQuickItem(e) {
    const item = e.currentTarget.dataset.item
    if (!item || !item.name) {
      util.showToast('食材信息不完整')
      return
    }
    
    try {
      if (item.added) {
        // 删除
        const fridgeItem = this.data.items.find(i => 
          i.id && util.normalizeIngredient(i.name) === util.normalizeIngredient(item.name)
        )
        if (fridgeItem && fridgeItem.id) {
          try {
            await api.deleteFridgeItem(fridgeItem.id)
            util.showToast('已移除')
          } catch (deleteError) {
            console.error('删除失败', deleteError)
            // 如果删除失败，不刷新列表，保持原状态
            util.showToast('删除失败，请重试')
            return
          }
        } else {
          // 兼容旧接口
          try {
            await api.syncFridge('remove', [item.name])
            util.showToast('已移除')
          } catch (e) {
            console.error('删除失败', e)
            util.showToast('删除失败，请重试')
            return
          }
        }
      } else {
        // 添加 - 使用完整的添加接口，包含数量和单位
        const category = item.category || this.guessCategory(item.name)
        const unitInfo = this.guessUnit(item.name, category)
        const itemData = {
          name: item.name.trim(),
          category: category,
          amount: unitInfo.unit === '适量' ? 0 : 1,
          unit: unitInfo.unit,
          created_at: new Date().toISOString()
        }
        
        try {
          await api.addFridgeItem(itemData)
          const amountText = itemData.unit === '适量' ? '适量' : `${itemData.amount}${itemData.unit}`
          this.triggerAddSuccessAnimation(item.name, item.icon, amountText)
        } catch (addError) {
          console.error('添加失败', addError)
          // 更友好的错误提示
          let errorMsg = '添加失败，请重试'
          if (addError.message) {
            if (addError.message.includes('已存在') || addError.message.includes('重复')) {
              errorMsg = '该食材已存在，请直接使用'
            } else if (addError.message.includes('网络')) {
              errorMsg = '网络连接失败，请检查网络后重试'
            } else {
              errorMsg = addError.message
            }
          }
          util.showToast(errorMsg)
          return
        }
      }
      
      // 刷新列表（确保状态同步）
      await this.loadFridgeItems()
    } catch (error) {
      console.error('操作失败', error)
      util.showToast(error.message || '操作失败，请重试')
    }
  },

  // 删除物品（优化错误处理）
  async deleteItem(e) {
    const id = e.currentTarget.dataset.id
    if (id === undefined || id === null || id === '') {
      util.showToast('食材ID不存在')
      return
    }
    
    const item = this.findItemById(id)
    
    if (!item) {
      util.showToast('食材不存在')
      return
    }
    
    // 关闭左滑状态
    const items = this.data.filteredItems.map(it => ({ ...it, swipeX: 0 }))
    const sectionedItems = this.patchSwipeFromFiltered(items)
    this.setData({
      filteredItems: items,
      sectionedItems,
      currentSwipeIndex: -1
    })
    
    // 显示确认对话框，包含详细信息
    const amountText = item.amount === 0 || item.unit === '适量' ? '适量' : `${item.amount}${item.unit}`
    const confirm = await util.showConfirm(
      `确定要删除「${item.name} ${amountText}」吗？\n\n删除后无法恢复。`,
      '确认删除'
    )
    
    if (confirm) {
      try {
        util.showLoading('删除中...')
        // 使用食材真实 id 调用删除接口（保证类型与后端一致）
        await api.deleteFridgeItem(item.id)
        util.showSuccess('已删除')
        // 刷新列表
        await this.loadFridgeItems()
      } catch (error) {
        console.error('删除失败', error)
        // 更友好的错误提示
        let errorMsg = '删除失败，请重试'
        if (error.message) {
          if (error.message.includes('网络') || error.message.includes('timeout')) {
            errorMsg = '网络连接失败，请检查网络后重试'
          } else if (error.message.includes('404') || error.message.includes('不存在')) {
            errorMsg = '食材已不存在，请刷新列表'
            // 如果食材不存在，直接刷新列表
            await this.loadFridgeItems()
            return
          } else {
            errorMsg = error.message
          }
        }
        util.showToast(errorMsg)
      } finally {
        util.hideLoading()
      }
    }
  },

  // 跳转到做饭页面（开启冰箱模式）
  goToCookWithFridge() {
    wx.navigateTo({
      url: '/packageCook/cook/cook?useFridge=true'
    })
  },

  // 时间差显示
  timeAgo(date) {
    return util.timeAgo(date)
  },

  // 获取分类图标
  getCategoryIcon(category) {
    const icons = {
      'all': '📦',
      'vegetable': '🥬',
      'meat': '🥩',
      'seafood': '🐟',
      'staple': '🍚',
      'dairy': '🥛',
      'fruit': '🍎',
      'seasoning': '🧂',
      'frozen': '🧊',
      'other': '📦'
    }
    return icons[category] || '📦'
  },

  // 获取食材具体图标
  getIngredientIcon(name) {
    const iconMap = {
      // 蛋奶类
      '鸡蛋': '🥚', '蛋': '🥚', '鸡蛋白': '🥚', '蛋黄': '🥚',
      '牛奶': '🥛', '酸奶': '🥛', '奶酪': '🧀', '黄油': '🧈',
      // 蔬菜类
      '西红柿': '🍅', '番茄': '🍅',
      '土豆': '🥔', '马铃薯': '🥔',
      '青椒': '🫑', '辣椒': '🫑', '甜椒': '🫑',
      '洋葱': '🧅',
      '胡萝卜': '🥕', '红萝卜': '🥕',
      '西兰花': '🥦', '花椰菜': '🥦',
      '白菜': '🥬', '大白菜': '🥬', '小白菜': '🥬',
      '菠菜': '🥬', '生菜': '🥬', '青菜': '🥬',
      '芹菜': '🥬', '韭菜': '🥬',
      '黄瓜': '🥒', '丝瓜': '🥒',
      '茄子': '🍆',
      '豆角': '🫛', '四季豆': '🫛',
      '蘑菇': '🍄', '香菇': '🍄',
      '玉米': '🌽',
      '南瓜': '🎃',
      '萝卜': '🥕', '白萝卜': '🥕',
      // 肉禽类
      '鸡胸肉': '🍗', '鸡肉': '🍗', '鸡': '🍗',
      '牛肉': '🥩', '牛排': '🥩',
      '猪肉': '🥩', '排骨': '🥩',
      '羊肉': '🥩',
      '鸭肉': '🦆', '鸭': '🦆',
      // 水产类
      '鱼': '🐟', '鱼肉': '🐟',
      '虾': '🦐', '大虾': '🦐', '小虾': '🦐',
      '蟹': '🦀', '螃蟹': '🦀',
      '鱿鱼': '🦑', '章鱼': '🦑',
      '贝类': '🐚', '扇贝': '🐚',
      // 主食类
      '大米': '🍚', '米饭': '🍚', '米': '🍚',
      '面条': '🍜', '面': '🍜',
      '面包': '🍞',
      '馒头': '🍞',
      '饺子': '🥟',
      '包子': '🥟',
      // 水果类
      '苹果': '🍎',
      '香蕉': '🍌',
      '橙子': '🍊', '橘子': '🍊',
      '葡萄': '🍇',
      '草莓': '🍓',
      '西瓜': '🍉',
      '桃子': '🍑',
      '梨': '🍐',
      '樱桃': '🍒',
      '芒果': '🥭',
      '菠萝': '🍍',
      '柠檬': '🍋',
      // 其他
      '大蒜': '🧄', '蒜': '🧄',
      '姜': '🫚', '生姜': '🫚',
      '葱': '🧅', '大葱': '🧅', '小葱': '🧅',
      '香菜': '🌿',
      '胡椒': '🌶️', '辣椒粉': '🌶️',
      '盐': '🧂', '糖': '🍬', '油': '🫒'
    }
    
    // 精确匹配
    if (iconMap[name]) {
      return iconMap[name]
    }
    
    // 模糊匹配
    const normalizedName = name.toLowerCase().trim()
    for (const [key, icon] of Object.entries(iconMap)) {
      if (normalizedName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedName)) {
        return icon
      }
    }
    
    // 如果找不到，返回分类图标
    return this.getCategoryIcon(this.guessCategory(name))
  },

  // 根据 id 查找食材（dataset 中的 id 为字符串，后端可能返回数字，需统一比较）
  findItemById(id) {
    if (id === undefined || id === null) return null
    return this.data.items.find(i => i.id == id) || null
  },

  // 获取分类标签
  getCategoryLabel(category) {
    const categoryMap = this.data.categories.find(c => c.value === category)
    return categoryMap ? categoryMap.label : '其他'
  },

  // 格式化日期
  formatDate(date) {
    return util.formatDate(date, 'YYYY-MM-DD HH:mm')
  },

  // 获取新鲜度提示
  getFreshnessTip(item) {
    if (item.freshness === 'expired') {
      return '建议尽快处理'
    } else if (item.freshness === 'expiring') {
      return '建议尽快使用'
    }
    return ''
  },

  // 与样式 .swipe-action 宽度一致：3 × 80rpx
  SWIPE_MAX_PX: -240,

  /** 将 filteredItems 上的 swipeX 同步到 sectionedItems（列表渲染用分组数据，否则左滑无视觉反馈） */
  patchSwipeFromFiltered(filteredItems) {
    const swipeById = {}
    filteredItems.forEach(it => {
      if (it && it.id != null) swipeById[it.id] = it.swipeX
    })
    return this.data.sectionedItems.map(sec => ({
      ...sec,
      items: sec.items.map(it => {
        const sx = swipeById[it.id]
        return sx !== undefined ? { ...it, swipeX: sx } : it
      })
    }))
  },

  // 左滑相关（优化滑动体验）
  onTouchStart(e) {
    // 如果正在编辑模式，禁用左滑
    if (this.data.editMode) return

    this.setData({
      touchStartX: e.touches[0].clientX,
      touchStartY: e.touches[0].clientY,
      touchStartTime: Date.now()
    })
  },

  onTouchMove(e) {
    // 如果正在编辑模式，禁用左滑
    if (this.data.editMode) return

    const maxSwipe = this.SWIPE_MAX_PX
    const deltaX = e.touches[0].clientX - this.data.touchStartX
    const deltaY = Math.abs(e.touches[0].clientY - this.data.touchStartY)
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index) || index < 0) return

    // 判断是水平滑动还是垂直滑动（垂直滑动时禁用左滑，避免与列表滚动冲突）
    if (deltaY > 30 && Math.abs(deltaX) < deltaY) {
      return
    }

    if (deltaX < 0) {
      const swipeX = Math.max(deltaX, maxSwipe)
      const items = this.data.filteredItems.map((item, i) => {
        if (i === index) {
          return { ...item, swipeX }
        }
        return { ...item, swipeX: 0 }
      })
      const sectionedItems = this.patchSwipeFromFiltered(items)
      this.setData({
        filteredItems: items,
        sectionedItems,
        currentSwipeIndex: index
      })
    } else if (deltaX > 0 && Number(this.data.currentSwipeIndex) === index) {
      const item = this.data.filteredItems[index]
      if (item && item.swipeX < 0) {
        const swipeX = Math.min(0, Math.max(item.swipeX + deltaX, maxSwipe))
        const items = this.data.filteredItems.map((it, i) => {
          if (i === index) {
            return { ...it, swipeX }
          }
          return it
        })
        const sectionedItems = this.patchSwipeFromFiltered(items)
        this.setData({ filteredItems: items, sectionedItems })
      }
    }
  },

  onTouchEnd(e) {
    // 如果正在编辑模式，禁用左滑
    if (this.data.editMode) return

    const maxSwipe = this.SWIPE_MAX_PX
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index) || index < 0) return
    const item = this.data.filteredItems[index]
    if (!item) return

    const swipeThreshold = 80

    if (item.swipeX < -swipeThreshold) {
      const items = this.data.filteredItems.map((it, i) => {
        if (i === index) {
          return { ...it, swipeX: maxSwipe }
        }
        return it
      })
      const sectionedItems = this.patchSwipeFromFiltered(items)
      this.setData({ filteredItems: items, sectionedItems })
    } else {
      const items = this.data.filteredItems.map((it, i) => {
        if (i === index) {
          return { ...it, swipeX: 0 }
        }
        return it
      })
      const sectionedItems = this.patchSwipeFromFiltered(items)
      this.setData({
        filteredItems: items,
        sectionedItems,
        currentSwipeIndex: -1
      })
    }
  },

  // 阻止事件冒泡
  stopPropagation() {},

  // 阻止触摸冒泡到父级（避免左滑逻辑拦截按钮点击）
  preventSwipe() {},

  // scroll-view 内 tap 可能不触发，用 touch 模拟点击
  onActionTouchStart(e) {
    const id = e.currentTarget.dataset.id
    const action = e.currentTarget.dataset.action
    if (id == null || !action) return
    this._actionTouch = {
      id,
      action,
      time: Date.now(),
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
  },
  onActionTouchEnd(e) {
    const t = this._actionTouch
    if (!t) return
    const duration = Date.now() - t.time
    const dx = Math.abs((e.changedTouches[0].clientX - t.x))
    const dy = Math.abs((e.changedTouches[0].clientY - t.y))
    this._actionTouch = null
    if (duration > 400 || dx > 30 || dy > 30) return
    const fakeEvent = { currentTarget: { dataset: { id: t.id } } }
    if (t.action === 'detail') this.viewItemDetail(fakeEvent)
    else if (t.action === 'edit') this.editItem(fakeEvent)
    else if (t.action === 'delete') this.deleteItem(fakeEvent)
  },

  // 将拍照/相册得到的临时文件转为持久路径（失败则沿用原路径，兼容已是持久路径的情况）
  persistCoverIfNeeded(localPath) {
    return new Promise(resolve => {
      if (!localPath || typeof localPath !== 'string') {
        resolve('')
        return
      }
      wx.getFileSystemManager().saveFile({
        tempFilePath: localPath,
        success: res => resolve(res.savedFilePath || localPath),
        fail: () => resolve(localPath)
      })
    })
  },

  chooseFridgeItemPhoto() {
    const done = p => {
      if (p) this.setData({ newItemCoverImage: p })
    }
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success: res => {
          const f = res.tempFiles && res.tempFiles[0]
          done(f && f.tempFilePath ? f.tempFilePath : '')
        },
        fail: () => {
          wx.chooseImage({
            count: 1,
            sourceType: ['album', 'camera'],
            success: r => done(r.tempFilePaths && r.tempFilePaths[0]),
            fail: () => util.showToast('未选择图片', 'none')
          })
        }
      })
    } else {
      wx.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        success: r => done(r.tempFilePaths && r.tempFilePaths[0]),
        fail: () => util.showToast('未选择图片', 'none')
      })
    }
  },

  clearFridgeItemPhoto() {
    this.setData({ newItemCoverImage: '' })
  },

  // 添加食材相关
  showAddModal() {
    this.setData({ 
      showAddModal: true,
      newItemName: '',
      newItemCategory: 'vegetable',
      newItemAmount: '1',
      newItemUnit: '个',
      newItemCoverImage: '',
      fabMenuOpen: false
    })
  },

  closeAddModal() {
    this.setData({ 
      showAddModal: false,
      editingItemId: null,
      newItemName: '',
      newItemCategory: 'vegetable',
      newItemAmount: '1',
      newItemUnit: '个',
      newItemSubCategory: '',
      newItemCoverImage: '',
      selectedUnitType: 'count',
      currentSubCategories: [],
      showSubCategorySelector: false
    })
  },

  onNewItemInput(e) {
    const name = e.detail.value
    this.setData({ newItemName: name })
    // 自动猜测分类和单位
    if (name) {
      const category = this.guessCategory(name)
      const unitInfo = this.guessUnit(name, category)
      const categoryItem = this.data.categories.find(c => c.value === category)
      const subCategories = categoryItem && categoryItem.subCategories ? categoryItem.subCategories : []
      
      this.setData({ 
        newItemCategory: category,
        newItemUnit: unitInfo.unit,
        selectedUnitType: unitInfo.type || 'count',
        currentSubCategories: subCategories,
        showSubCategorySelector: subCategories.length > 0
      })
    }
  },
  
  // 猜测单位（返回单位和类型）
  guessUnit(name, category) {
    // 根据食材名称和分类猜测单位
    if (category === 'meat' || category === 'seafood') {
      return { unit: 'kg', type: 'weight' }
    } else if (category === 'vegetable') {
      // 蔬菜类根据名称判断
      if (name.includes('白菜') || name.includes('菠菜') || name.includes('生菜')) {
        return { unit: '把', type: 'other' }
      } else if (name.includes('豆角') || name.includes('豆') || name.includes('茄子')) {
        return { unit: '根', type: 'count' }
      } else if (name.includes('蘑菇') || name.includes('香菇')) {
        return { unit: '个', type: 'count' }
      }
      return { unit: '斤', type: 'weight' }
    } else if (category === 'fruit') {
      if (name.includes('葡萄') || name.includes('草莓') || name.includes('樱桃')) {
        return { unit: '斤', type: 'weight' }
      }
      return { unit: '个', type: 'count' }
    } else if (category === 'dairy') {
      if (name.includes('牛奶') || name.includes('酸奶')) {
        return { unit: '盒', type: 'package' }
      } else if (name.includes('蛋')) {
        return { unit: '个', type: 'count' }
      }
      return { unit: '个', type: 'count' }
    } else if (category === 'staple') {
      return { unit: 'kg', type: 'weight' }
    } else if (category === 'seasoning') {
      if (name.includes('油')) {
        return { unit: '瓶', type: 'package' }
      } else if (name.includes('蒜') || name.includes('姜') || name.includes('葱')) {
        return { unit: '个', type: 'count' }
      }
      return { unit: '适量', type: 'other' }
    }
    return { unit: '个', type: 'count' }
  },
  
  // 数量输入
  onAmountInput(e) {
    const value = e.detail.value
    // 如果选择的是"适量"，清空数量
    if (this.data.newItemUnit === '适量') {
      this.setData({ newItemAmount: '' })
      return
    }
    this.setData({ newItemAmount: value })
  },
  
  // 选择单位类型
  selectUnitType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ selectedUnitType: type })
    // 自动选择该类型下的第一个单位
    const firstUnit = this.data.unitOptions.find(opt => opt.type === type)
    if (firstUnit) {
      this.setData({ newItemUnit: firstUnit.value })
    }
  },

  // 选择单位
  selectUnit(e) {
    const unit = e.currentTarget.dataset.unit
    const unitOption = this.data.unitOptions.find(opt => opt.value === unit)
    this.setData({ 
      newItemUnit: unit,
      selectedUnitType: unitOption ? unitOption.type : 'count'
    })
    // 如果选择"适量"，清空数量输入
    if (unit === '适量') {
      this.setData({ newItemAmount: '' })
    } else if (!this.data.newItemAmount || this.data.newItemAmount === '0') {
      // 如果数量为空或为0，设置默认值1
      this.setData({ newItemAmount: '1' })
    }
  },

  selectCategory(e) {
    const category = e.currentTarget.dataset.category
    const categoryItem = this.data.categories.find(c => c.value === category)
    const subCategories = categoryItem && categoryItem.subCategories ? categoryItem.subCategories : []
    
    this.setData({ 
      newItemCategory: category,
      newItemSubCategory: '', // 切换分类时清空子分类
      currentSubCategories: subCategories,
      showSubCategorySelector: subCategories.length > 0
    })
    // 根据新分类自动调整单位
    if (this.data.newItemName) {
      const unitInfo = this.guessUnit(this.data.newItemName, category)
      this.setData({
        newItemUnit: unitInfo.unit,
        selectedUnitType: unitInfo.type || 'count'
      })
    }
  },

  // 选择子分类
  selectSubCategory(e) {
    const subCategory = e.currentTarget.dataset.subcategory
    this.setData({ newItemSubCategory: subCategory })
  },

  async confirmAddItem() {
    // 验证食材名称
    const itemName = this.data.newItemName.trim()
    if (!itemName) {
      util.showToast('请输入食材名称')
      return
    }
    
    // 验证名称长度
    if (itemName.length > 20) {
      util.showToast('食材名称不能超过20个字符')
      return
    }
    
    // 验证名称格式（不能全是空格或特殊字符）
    if (!/[\u4e00-\u9fa5a-zA-Z]/.test(itemName)) {
      util.showToast('食材名称格式不正确')
      return
    }
    
    // 验证数量（适量单位除外）
    let amount = 0
    if (this.data.newItemUnit !== '适量') {
      if (!this.data.newItemAmount || this.data.newItemAmount.trim() === '') {
        util.showToast('请输入有效数量（大于0）')
        return
      }
      amount = parseFloat(this.data.newItemAmount)
      if (isNaN(amount) || amount <= 0) {
        util.showToast('请输入有效数量（大于0）')
        return
      }
      // 验证数量范围（防止输入过大）
      if (amount > 10000) {
        util.showToast('数量过大，请检查单位是否正确')
        return
      }
      // 保留合理的小数位数（最多2位）
      amount = Math.round(amount * 100) / 100
    }
    
    if (!this.data.newItemUnit) {
      util.showToast('请选择单位')
      return
    }
    
    if (!this.data.newItemCategory) {
      util.showToast('请选择分类')
      return
    }
    
    try {
      util.showLoading(this.data.editingItemId ? '更新中...' : '保存中...')

      const coverRaw = (this.data.newItemCoverImage || '').trim()
      let coverPersisted = ''
      if (coverRaw) {
        try {
          coverPersisted = await this.persistCoverIfNeeded(coverRaw)
        } catch (e) {
          util.hideLoading()
          util.showToast('图片保存失败，请重试')
          return
        }
      }
      
      // 构建完整的食材数据，包含时间戳
      const itemData = {
        name: itemName,
        category: this.data.newItemCategory,
        amount: amount,
        unit: this.data.newItemUnit,
        created_at: this.data.editingItemId 
          ? this.data.currentItem?.created_at || new Date().toISOString() // 编辑时保持原时间
          : new Date().toISOString() // 新增时使用当前时间
      }
      
      // 如果有子分类，添加到备注或扩展字段
      if (this.data.newItemSubCategory) {
        itemData.sub_category = this.data.newItemSubCategory
      }

      if (coverPersisted) {
        itemData.cover_image = coverPersisted
      } else if (this.data.editingItemId) {
        itemData.cover_image = ''
      }
      
      let displayName = itemData.name

      if (this.data.editingItemId) {
        // 编辑模式：使用更新接口
        try {
          await api.updateFridgeItem(this.data.editingItemId, itemData)
          util.showSuccess('更新成功')
        } catch (updateError) {
          console.error('更新失败', updateError)
          // 更友好的错误提示
          let errorMsg = '更新失败，请重试'
          if (updateError.message) {
            if (updateError.message.includes('不存在') || updateError.message.includes('404')) {
              errorMsg = '食材已不存在，请刷新列表'
            } else if (updateError.message.includes('网络')) {
              errorMsg = '网络连接失败，请检查网络后重试'
            } else {
              errorMsg = updateError.message
            }
          }
          throw new Error(errorMsg)
        }
      } else {
        // 检查是否已存在相同食材（可选，根据需求决定是否启用）
        const exists = this.data.items.some(item => 
          util.normalizeIngredient(item.name) === util.normalizeIngredient(itemName)
        )
        if (exists) {
          const confirm = await util.showConfirm(
            `「${itemName}」已存在，是否继续添加？`,
            '提示'
          )
          if (!confirm) {
            util.hideLoading()
            return
          }
        }
        
        await api.addFridgeItem(itemData)
        util.showSuccess('添加成功')
      }

      // 添加成功动画提示，显示详细信息
      const amountText = itemData.unit === '适量' ? '适量' : `${itemData.amount}${itemData.unit}`
      this.triggerAddSuccessAnimation(displayName, this.getIngredientIcon(displayName), amountText)

      this.closeAddModal()
      await this.loadFridgeItems()
    } catch (error) {
      console.error('操作失败', error)
      util.showToast(error.message || (this.data.editingItemId ? '更新失败，请重试' : '添加失败，请重试'))
    } finally {
      util.hideLoading()
    }
  },

  async addItem(name, category) {
    try {
      // 根据文档，需要支持 amount 和 unit 字段
      const unitInfo = this.guessUnit(name, category || 'other')
      const itemData = {
        name: name,
        category: category || this.guessCategory(name),
        amount: unitInfo.unit === '适量' ? 0 : 1, // 默认数量
        unit: unitInfo.unit, // 根据食材类型自动判断
        created_at: new Date().toISOString() // 记录添加时间
      }
      
      await api.addFridgeItem(itemData)
      const amountText = itemData.unit === '适量' ? '适量' : `${itemData.amount}${itemData.unit}`
      this.triggerAddSuccessAnimation(name, this.getIngredientIcon(name), amountText)
      await this.loadFridgeItems()
    } catch (error) {
      console.error('添加食材失败', error)
      util.showToast(error.message || '添加失败，请重试')
    }
  },

  // 触发新增成功动画
  triggerAddSuccessAnimation(name, icon, amountText = '') {
    const text = amountText ? `已将「${name} ${amountText}」放入冰箱` : `已将「${name}」放入冰箱`
    this.setData({
      showAddSuccess: true,
      addSuccessIcon: icon || '🥬',
      addSuccessText: text
    })
    setTimeout(() => {
      this.setData({ showAddSuccess: false })
    }, 1500)
  },

  // 查看食材详情
  viewItemDetail(e) {
    const id = e.currentTarget.dataset.id
    const item = this.findItemById(id)
    if (item) {
      const currentItem = {
        ...item,
        categoryLabel: this.getCategoryLabel(item.category),
        formattedDate: this.formatDate(item.created_at),
        daysInFridge: item.daysInFridge ?? item.days_stored ?? 0
      }
      this.setData({
        currentItem,
        showDetailModal: true,
        currentSwipeIndex: -1
      })
      // 重置所有左滑状态
      const items = this.data.filteredItems.map(it => ({ ...it, swipeX: 0 }))
      const sectionedItems = this.patchSwipeFromFiltered(items)
      this.setData({ filteredItems: items, sectionedItems })
    }
  },

  // 关闭详情弹窗
  closeDetailModal() {
    this.setData({ showDetailModal: false, currentItem: null })
  },

  // 从详情页编辑
  editFromDetail() {
    if (this.data.currentItem) {
      const item = this.data.currentItem
      const unitOption = this.data.unitOptions.find(opt => opt.value === (item.unit || '个'))
      const categoryItem = this.data.categories.find(c => c.value === (item.category || 'vegetable'))
      const subCategories = categoryItem && categoryItem.subCategories ? categoryItem.subCategories : []
      
      this.setData({
        showDetailModal: false,
        editingItemId: item.id,
        newItemName: item.name,
        newItemCategory: item.category || 'vegetable',
        newItemAmount: String(item.amount || 1),
        newItemUnit: item.unit || '个',
        newItemSubCategory: item.sub_category || '',
        newItemCoverImage: item.cover_image || '',
        selectedUnitType: unitOption ? unitOption.type : 'count',
        currentSubCategories: subCategories,
        showSubCategorySelector: subCategories.length > 0,
        showAddModal: true
      })
    }
  },


  // 编辑食材
  editItem(e) {
    const id = e.currentTarget.dataset.id
    const item = this.findItemById(id)
    if (item) {
      const unitOption = this.data.unitOptions.find(opt => opt.value === (item.unit || '个'))
      const categoryItem = this.data.categories.find(c => c.value === (item.category || 'vegetable'))
      const subCategories = categoryItem && categoryItem.subCategories ? categoryItem.subCategories : []
      
      this.setData({
        editingItemId: item.id,
        newItemName: item.name,
        newItemCategory: item.category || 'vegetable',
        newItemAmount: String(item.amount || 1),
        newItemUnit: item.unit || '个',
        newItemSubCategory: item.sub_category || '',
        newItemCoverImage: item.cover_image || '',
        selectedUnitType: unitOption ? unitOption.type : 'count',
        currentSubCategories: subCategories,
        showSubCategorySelector: subCategories.length > 0,
        showAddModal: true,
        currentSwipeIndex: -1
      })
      // 重置所有左滑状态
      const items = this.data.filteredItems.map(it => ({ ...it, swipeX: 0 }))
      const sectionedItems = this.patchSwipeFromFiltered(items)
      this.setData({ filteredItems: items, sectionedItems })
    }
  },

  // 批量操作
  enterEditMode() {
    this.setData({ 
      editMode: true,
      selectedItems: [],
      fabMenuOpen: false,
      currentSwipeIndex: -1
    })
    // 重置所有左滑状态
    const items = this.data.filteredItems.map(it => ({ ...it, swipeX: 0 }))
    const sectionedItems = this.patchSwipeFromFiltered(items)
    this.setData({ filteredItems: items, sectionedItems })
  },

  cancelBatch() {
    this.setData({ 
      editMode: false,
      selectedItems: []
    })
  },

  // 切换选择状态（dataset.id 为字符串，与 item.id 统一用宽松比较）
  toggleSelectItem(e) {
    if (!this.data.editMode) return
    
    const id = e.currentTarget.dataset.id
    const item = this.findItemById(id)
    if (!item) return
    const selectedItems = [...this.data.selectedItems]
    const index = selectedItems.findIndex(sid => sid == item.id)
    
    if (index > -1) {
      selectedItems.splice(index, 1)
    } else {
      selectedItems.push(item.id)
    }
    
    this.setData({ selectedItems })
  },

  // 全选/取消全选
  toggleSelectAll() {
    if (this.data.selectedItems.length === this.data.filteredItems.length) {
      this.setData({ selectedItems: [] })
    } else {
      const allIds = this.data.filteredItems.map(it => it.id)
      this.setData({ selectedItems: allIds })
    }
  },

  // 批量删除过期食材（优化错误处理）
  async batchDeleteExpired() {
    const expiredItems = this.data.items.filter(item => 
      item && item.id && (item.freshness === 'expired' || item.freshness === 'expiring')
    )
    
    if (expiredItems.length === 0) {
      util.showToast('没有过期食材')
      return
    }
    
    const expiredCount = expiredItems.filter(item => item.freshness === 'expired').length
    const expiringCount = expiredItems.filter(item => item.freshness === 'expiring').length
    
    let confirmText = `发现 ${expiredItems.length} 个过期/即将过期的食材：\n`
    if (expiredCount > 0) {
      confirmText += `• 已过期：${expiredCount} 个\n`
    }
    if (expiringCount > 0) {
      confirmText += `• 即将过期：${expiringCount} 个\n`
    }
    confirmText += `\n确定要全部删除吗？删除后无法恢复。`
    
    const confirm = await util.showConfirm(confirmText, '确认删除过期食材')
    if (confirm) {
      try {
        util.showLoading(`正在删除 ${expiredItems.length} 个食材...`)
        // 批量删除，使用Promise.allSettled以处理部分失败的情况
        const deletePromises = expiredItems.map(item => {
          if (!item.id) {
            return Promise.resolve({ error: new Error('食材ID不存在'), item: item.name })
          }
          return api.deleteFridgeItem(item.id).catch(err => {
            console.error(`删除食材 ${item.name} 失败:`, err)
            return { error: err, item: item.name }
          })
        })
        const results = await Promise.all(deletePromises)
        const failed = results.filter(r => r && r.error)
        const successCount = expiredItems.length - failed.length
        
        if (failed.length > 0) {
          util.showToast(`已删除 ${successCount} 个，${failed.length} 个删除失败`)
        } else {
          util.showSuccess(`已删除 ${successCount} 个过期食材`)
        }
        this.cancelBatch()
        await this.loadFridgeItems()
      } catch (error) {
        console.error('批量删除失败', error)
        util.showToast(error.message || '删除失败，请重试')
      } finally {
        util.hideLoading()
      }
    }
  },

  async batchDelete() {
    if (this.data.selectedItems.length === 0) {
      util.showToast('请选择要删除的食材')
      return
    }
    
    // 获取选中食材的名称列表（id 可能为数字或字符串，统一用宽松比较）
    const selectedNames = this.data.selectedItems
      .map(id => {
        const item = this.data.items.find(i => i.id == id)
        return item ? item.name : null
      })
      .filter(Boolean)
    
    if (selectedNames.length === 0) {
      util.showToast('选中的食材无效')
      return
    }
    
    // 显示确认对话框，包含前几个食材名称
    const previewNames = selectedNames.slice(0, 3).join('、')
    const moreText = selectedNames.length > 3 ? `等${this.data.selectedItems.length}个` : ''
    const confirm = await util.showConfirm(
      `确定要删除「${previewNames}${moreText}」吗？\n\n删除后无法恢复。`,
      `确认删除 ${this.data.selectedItems.length} 个食材`
    )
    
    if (confirm) {
      try {
        util.showLoading(`正在删除 ${this.data.selectedItems.length} 个食材...`)
        // 使用新的删除接口，使用Promise.allSettled以处理部分失败的情况
        const deletePromises = this.data.selectedItems.map(id => {
          if (id === undefined || id === null) {
            return Promise.resolve({ error: new Error('食材ID不存在'), itemId: id })
          }
          return api.deleteFridgeItem(id).catch(err => {
            const item = this.data.items.find(i => i.id == id)
            console.error(`删除食材 ${item ? item.name : id} 失败:`, err)
            return { error: err, itemId: id }
          })
        })
        const results = await Promise.all(deletePromises)
        const failed = results.filter(r => r && r.error)
        const successCount = this.data.selectedItems.length - failed.length
        
        if (failed.length > 0) {
          util.showToast(`已删除 ${successCount} 个，${failed.length} 个删除失败`)
        } else {
          util.showSuccess(`已删除 ${successCount} 个食材`)
        }
        this.cancelBatch()
        await this.loadFridgeItems()
      } catch (error) {
        console.error('批量删除失败', error)
        util.showToast(error.message || '删除失败，请重试')
      } finally {
        util.hideLoading()
      }
    }
  },

  // FAB菜单
  toggleFabMenu() {
    this.setData({ fabMenuOpen: !this.data.fabMenuOpen })
  },

  /** 整合「添加食材」与「拍照识别」：先选方式再执行 */
  openIntegratedAddFlow() {
    this.setData({ fabMenuOpen: false })
    wx.showActionSheet({
      itemList: ['手动填写', '拍照识别'],
      success: res => {
        if (res.tapIndex === 0) {
          this.showAddModal()
        } else if (res.tapIndex === 1) {
          this.recognizeIngredient()
        }
      }
    })
  },

  // 进入大扫除模式
  enterCleanupMode() {
    // 筛选3天内过期的食材（days_stored >= 5）
    const expiringItems = this.data.items.filter(item => {
      const daysStored = item.daysInFridge || item.days_stored || 0
      // 3天内过期，即 days_stored >= 5（假设7天为过期阈值）
      return daysStored >= 5
    })
    
    if (expiringItems.length === 0) {
      util.showToast('没有需要处理的临期食材')
      return
    }
    
    // 将临期食材名称列表传递给做饭页面
    const expiringNames = expiringItems.map(item => item.name).join(',')
    
    // 跳转到做饭页面，开启大扫除模式
    wx.navigateTo({
      url: `/packageCook/cook/cook?cleanupMode=true&expiringItems=${encodeURIComponent(expiringNames)}`
    })
  },

  // 加载应季食材
  loadSeasonalItems() {
    const now = new Date()
    const month = now.getMonth() + 1 // 1-12

    // 食材详情（描述 + 标签，用于应季展示）
    const ingredientDetails = {
      '白菜': { desc: '清甜多汁，润燥养胃', tags: ['润燥', '维C'] },
      '萝卜': { desc: '通气助消化，冬季煲汤佳品', tags: ['助消化', '低卡'] },
      '胡萝卜': { desc: '护眼明目，富含胡萝卜素', tags: ['护眼', '维A'] },
      '土豆': { desc: '饱腹感强，适合做主食', tags: ['饱腹', '钾'] },
      '红薯': { desc: '香甜软糯，膳食纤维丰富', tags: ['润肠', '暖胃'] },
      '橙子': { desc: '维C丰富，增强抵抗力', tags: ['维C', '润燥'] },
      '苹果': { desc: '生津润肺，一天一苹果', tags: ['润肺', '抗氧化'] },
      '草莓': { desc: '酸甜可口，维C含量高', tags: ['维C', '美容'] },
      '韭菜': { desc: '温阳散寒，春季养肝', tags: ['养肝', '温阳'] },
      '菠菜': { desc: '补铁补血，叶酸丰富', tags: ['补铁', '叶酸'] },
      '春笋': { desc: '鲜嫩爽脆，清热化痰', tags: ['清热', '高纤'] },
      '豌豆': { desc: '嫩甜可口，优质蛋白', tags: ['蛋白', '维B'] },
      '莴笋': { desc: '清脆解腻，利水消肿', tags: ['利水', '低卡'] },
      '黄瓜': { desc: '清爽补水，热量极低', tags: ['补水', '低卡'] },
      '西红柿': { desc: '番茄红素丰富，熟吃更营养', tags: ['抗氧化', '维C'] },
      '茄子': { desc: '紫皮花青素，保护血管', tags: ['花青素', '护血管'] },
      '豆角': { desc: '健脾化湿，夏季时令', tags: ['健脾', '高纤'] },
      '西瓜': { desc: '消暑解渴，水分充足', tags: ['消暑', '补水'] },
      '桃子': { desc: '养颜润肤，补益气血', tags: ['养颜', '润燥'] },
      '荔枝': { desc: '甘甜多汁，补脾益血', tags: ['补血', '甘甜'] },
      '葡萄': { desc: '抗氧化强，护心养颜', tags: ['抗氧化', '护心'] },
      '樱桃': { desc: '补铁佳品，美容养颜', tags: ['补铁', '美容'] },
      '枇杷': { desc: '润肺止咳，春季润燥', tags: ['润肺', '止咳'] },
      '梨': { desc: '润肺止咳，秋燥首选', tags: ['润肺', '止咳'] },
      '南瓜': { desc: '暖胃健脾，β-胡萝卜素丰富', tags: ['健脾', '护眼'] },
      '莲藕': { desc: '生津止渴，凉血止血', tags: ['生津', '补铁'] },
      '柿子': { desc: '润肺化痰，维生素丰富', tags: ['润肺', '维C'] },
      '柚子': { desc: '清火润燥，维C含量高', tags: ['润燥', '维C'] }
    }

    // 月份对应季节 + 本月时令小知识
    const seasonByMonth = { 1: '冬季', 2: '冬季', 3: '春季', 4: '春季', 5: '春季', 6: '夏季', 7: '夏季', 8: '夏季', 9: '秋季', 10: '秋季', 11: '秋季', 12: '冬季' }
    const monthlyTips = {
      1: '冬季根茎类与柑橘当令，适合煲汤暖身、增强体质。',
      2: '冬春之交，草莓上市，搭配萝卜白菜润燥又开胃。',
      3: '春季绿叶菜与春笋正鲜，养肝护肝好时节。',
      4: '春暖花开，樱桃草莓陆续上市，补铁养颜。',
      5: '春夏之交，瓜茄豆角渐多，清爽低卡。',
      6: '盛夏西瓜荔枝桃子当令，消暑补水又甜润。',
      7: '三伏天瓜果丰盛，多吃番茄黄瓜防暑。',
      8: '夏末葡萄梨子上市，润燥又抗氧化。',
      9: '秋藕南瓜苹果梨，润肺防秋燥正当时。',
      10: '深秋萝卜柿子甜，煲汤炖菜最养人。',
      11: '秋冬交替柚子橙子苹果，维C润燥两不误。',
      12: '寒冬白菜萝卜土豆当家，暖胃又实惠。'
    }

    // 应季食材数据（根据月份）
    const seasonalData = {
      1: [ // 1月（冬季）
        { name: '白菜', icon: '🥬', category: 'vegetable' },
        { name: '萝卜', icon: '🥕', category: 'vegetable' },
        { name: '胡萝卜', icon: '🥕', category: 'vegetable' },
        { name: '土豆', icon: '🥔', category: 'vegetable' },
        { name: '红薯', icon: '🍠', category: 'vegetable' },
        { name: '橙子', icon: '🍊', category: 'fruit' },
        { name: '苹果', icon: '🍎', category: 'fruit' }
      ],
      2: [ // 2月（冬季）
        { name: '白菜', icon: '🥬', category: 'vegetable' },
        { name: '萝卜', icon: '🥕', category: 'vegetable' },
        { name: '胡萝卜', icon: '🥕', category: 'vegetable' },
        { name: '土豆', icon: '🥔', category: 'vegetable' },
        { name: '橙子', icon: '🍊', category: 'fruit' },
        { name: '苹果', icon: '🍎', category: 'fruit' },
        { name: '草莓', icon: '🍓', category: 'fruit' }
      ],
      3: [ // 3月（春季）
        { name: '韭菜', icon: '🥬', category: 'vegetable' },
        { name: '菠菜', icon: '🥬', category: 'vegetable' },
        { name: '春笋', icon: '🎋', category: 'vegetable' },
        { name: '豌豆', icon: '🫛', category: 'vegetable' },
        { name: '草莓', icon: '🍓', category: 'fruit' },
        { name: '樱桃', icon: '🍒', category: 'fruit' }
      ],
      4: [ // 4月（春季）
        { name: '韭菜', icon: '🥬', category: 'vegetable' },
        { name: '菠菜', icon: '🥬', category: 'vegetable' },
        { name: '春笋', icon: '🎋', category: 'vegetable' },
        { name: '豌豆', icon: '🫛', category: 'vegetable' },
        { name: '莴笋', icon: '🥬', category: 'vegetable' },
        { name: '草莓', icon: '🍓', category: 'fruit' },
        { name: '樱桃', icon: '🍒', category: 'fruit' }
      ],
      5: [ // 5月（春季）
        { name: '黄瓜', icon: '🥒', category: 'vegetable' },
        { name: '西红柿', icon: '🍅', category: 'vegetable' },
        { name: '茄子', icon: '🍆', category: 'vegetable' },
        { name: '豆角', icon: '🫛', category: 'vegetable' },
        { name: '樱桃', icon: '🍒', category: 'fruit' },
        { name: '枇杷', icon: '🍊', category: 'fruit' }
      ],
      6: [ // 6月（夏季）
        { name: '黄瓜', icon: '🥒', category: 'vegetable' },
        { name: '西红柿', icon: '🍅', category: 'vegetable' },
        { name: '茄子', icon: '🍆', category: 'vegetable' },
        { name: '豆角', icon: '🫛', category: 'vegetable' },
        { name: '西瓜', icon: '🍉', category: 'fruit' },
        { name: '桃子', icon: '🍑', category: 'fruit' },
        { name: '荔枝', icon: '🍇', category: 'fruit' }
      ],
      7: [ // 7月（夏季）
        { name: '黄瓜', icon: '🥒', category: 'vegetable' },
        { name: '西红柿', icon: '🍅', category: 'vegetable' },
        { name: '茄子', icon: '🍆', category: 'vegetable' },
        { name: '豆角', icon: '🫛', category: 'vegetable' },
        { name: '西瓜', icon: '🍉', category: 'fruit' },
        { name: '桃子', icon: '🍑', category: 'fruit' },
        { name: '葡萄', icon: '🍇', category: 'fruit' }
      ],
      8: [ // 8月（夏季）
        { name: '黄瓜', icon: '🥒', category: 'vegetable' },
        { name: '西红柿', icon: '🍅', category: 'vegetable' },
        { name: '茄子', icon: '🍆', category: 'vegetable' },
        { name: '豆角', icon: '🫛', category: 'vegetable' },
        { name: '西瓜', icon: '🍉', category: 'fruit' },
        { name: '葡萄', icon: '🍇', category: 'fruit' },
        { name: '梨', icon: '🍐', category: 'fruit' }
      ],
      9: [ // 9月（秋季）
        { name: '白菜', icon: '🥬', category: 'vegetable' },
        { name: '萝卜', icon: '🥕', category: 'vegetable' },
        { name: '南瓜', icon: '🎃', category: 'vegetable' },
        { name: '莲藕', icon: '🥬', category: 'vegetable' },
        { name: '苹果', icon: '🍎', category: 'fruit' },
        { name: '梨', icon: '🍐', category: 'fruit' },
        { name: '葡萄', icon: '🍇', category: 'fruit' }
      ],
      10: [ // 10月（秋季）
        { name: '白菜', icon: '🥬', category: 'vegetable' },
        { name: '萝卜', icon: '🥕', category: 'vegetable' },
        { name: '胡萝卜', icon: '🥕', category: 'vegetable' },
        { name: '南瓜', icon: '🎃', category: 'vegetable' },
        { name: '苹果', icon: '🍎', category: 'fruit' },
        { name: '梨', icon: '🍐', category: 'fruit' },
        { name: '柿子', icon: '🍅', category: 'fruit' }
      ],
      11: [ // 11月（秋季）
        { name: '白菜', icon: '🥬', category: 'vegetable' },
        { name: '萝卜', icon: '🥕', category: 'vegetable' },
        { name: '胡萝卜', icon: '🥕', category: 'vegetable' },
        { name: '土豆', icon: '🥔', category: 'vegetable' },
        { name: '苹果', icon: '🍎', category: 'fruit' },
        { name: '橙子', icon: '🍊', category: 'fruit' },
        { name: '柚子', icon: '🍊', category: 'fruit' }
      ],
      12: [ // 12月（冬季）
        { name: '白菜', icon: '🥬', category: 'vegetable' },
        { name: '萝卜', icon: '🥕', category: 'vegetable' },
        { name: '胡萝卜', icon: '🥕', category: 'vegetable' },
        { name: '土豆', icon: '🥔', category: 'vegetable' },
        { name: '橙子', icon: '🍊', category: 'fruit' },
        { name: '苹果', icon: '🍎', category: 'fruit' },
        { name: '柚子', icon: '🍊', category: 'fruit' }
      ]
    }
    
    const items = seasonalData[month] || []
    const getDetail = name => ingredientDetails[name] || { desc: '', tags: [] }

    const dislikedNames = Array.isArray(this.data.seasonalDislikedNames) ? this.data.seasonalDislikedNames : []

    // 检查哪些已经在冰箱中，并合并描述与标签，同时剔除不感兴趣的项
    const itemsWithStatus = items.map(item => {
      if (dislikedNames.includes(item.name)) {
        return null
      }
      const exists = this.data.items.some(fridgeItem =>
        util.normalizeIngredient(fridgeItem.name) === util.normalizeIngredient(item.name)
      )
      const { desc, tags } = getDetail(item.name)
      return {
        ...item,
        desc: desc || '应季新鲜，营养实惠',
        tags: Array.isArray(tags) ? tags : [],
        added: exists,
        amount_in_fridge: exists ? (this.data.items.find(fridgeItem =>
          util.normalizeIngredient(fridgeItem.name) === util.normalizeIngredient(item.name)
        )?.amount || 1) : 0
      }
    }).filter(Boolean)

    const previewNames = itemsWithStatus.slice(0, 4).map(i => i.name)
    const seasonalPreviewText = previewNames.length ? previewNames.join('、') + (itemsWithStatus.length > 4 ? '…' : '') : ''

    const regionName = this.data.userRegionName || '默认地区'
    // 时令小知识单独展示；「月·地区·季节」由应季页顶部一行展示，避免重复
    const seasonTipOnly = monthlyTips[month] || ''

    this.setData({
      seasonalItems: itemsWithStatus,
      currentMonth: month,
      currentSeason: seasonByMonth[month] || '',
      currentSeasonTip: seasonTipOnly,
      seasonalPreviewText
    })

    // 将数据缓存在全局，供应季详情页直接复用
    try {
      const app = getApp()
      if (app && app.globalData) {
        app.globalData.fridgeSeasonalCache = {
          items: itemsWithStatus,
          month,
          currentSeason: seasonByMonth[month] || '',
          currentSeasonTip: seasonTipOnly,
          userRegionName: regionName
        }
      }
    } catch (e) {
      // 全局缓存失败不影响页面
    }
  },

  // 快速添加应季食材
  async addSeasonalItem(e) {
    const item = e.currentTarget.dataset.item
    if (!item || !item.name) {
      util.showToast('食材信息不完整')
      return
    }
    
    if (item.added) {
      util.showToast('该食材已在冰箱中')
      return
    }
    
    try {
      const category = item.category || this.guessCategory(item.name)
      const unitInfo = this.guessUnit(item.name, category)
      const itemData = {
        name: item.name.trim(),
        category: category,
        amount: unitInfo.unit === '适量' ? 0 : 1,
        unit: unitInfo.unit,
        created_at: new Date().toISOString()
      }
      
      await api.addFridgeItem(itemData)
      const amountText = itemData.unit === '适量' ? '适量' : `${itemData.amount}${itemData.unit}`
      this.triggerAddSuccessAnimation(item.name, item.icon, amountText)
      
      // 刷新列表和应季食材状态
      await this.loadFridgeItems()
      this.loadSeasonalItems()
    } catch (error) {
      console.error('添加应季食材失败', error)
      util.showToast(error.message || '添加失败，请重试')
    }
  },

  // 从列表快速「用它做菜」
  cookSeasonalFromList(e) {
    const item = e.currentTarget.dataset.item
    if (!item || !item.name) return
    wx.navigateTo({
      url: `/packageCook/smart-choice/smart-choice?ingredient=${encodeURIComponent(item.name)}&fromSeasonal=true`,
      fail(err) {
        console.error('跳转智能搜餐失败', err)
        util.showToast('跳转失败，请稍后再试')
      }
    })
  },

  // 切换显示应季食材
  toggleSeasonal() {
    this.setData({ showSeasonal: !this.data.showSeasonal })
  },

  // 点击应季食材卡片：打开详情弹窗
  onSeasonalItemTap(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    this.setData({
      showSeasonalDetail: true,
      seasonalDetailItem: item
    })
  },

  // 关闭应季详情
  closeSeasonalDetail() {
    this.setData({
      showSeasonalDetail: false,
      seasonalDetailItem: null
    })
  },

  // 标记某个应季食材「本月不感兴趣」
  async dislikeSeasonalItem(e) {
    const item = e.currentTarget.dataset.item
    if (!item || !item.name) return
    const confirm = await util.showConfirm(
      `本月将不再推荐「${item.name}」的应季提醒，你可以稍后在设置中重新开启。`,
      '不感兴趣'
    )
    if (!confirm) return
    const name = item.name
    const disliked = Array.isArray(this.data.seasonalDislikedNames) ? [...this.data.seasonalDislikedNames] : []
    if (!disliked.includes(name)) {
      disliked.push(name)
    }
    this.setData({ seasonalDislikedNames: disliked })
    try {
      wx.setStorageSync('seasonal_disliked_names', disliked)
    } catch (e) {}
    // 重新加载应季数据以更新列表与预览
    this.loadSeasonalItems()
  },

  // 从详情弹窗中一键加入冰箱
  async addSeasonalFromDetail() {
    const item = this.data.seasonalDetailItem
    if (!item || !item.name) return

    if (item.added) {
      util.showToast('该食材已在冰箱中')
      return
    }

    try {
      const category = item.category || this.guessCategory(item.name)
      const unitInfo = this.guessUnit(item.name, category)
      const itemData = {
        name: item.name.trim(),
        category: category,
        amount: unitInfo.unit === '适量' ? 0 : 1,
        unit: unitInfo.unit,
        created_at: new Date().toISOString()
      }

      await api.addFridgeItem(itemData)
      const amountText = itemData.unit === '适量' ? '适量' : `${itemData.amount}${itemData.unit}`
      this.triggerAddSuccessAnimation(item.name, item.icon, amountText)

      // 刷新列表和应季食材状态
      await this.loadFridgeItems()
      this.loadSeasonalItems()

      // 更新当前详情为已添加状态
      this.setData({
        'seasonalDetailItem.added': true
      })
    } catch (error) {
      console.error('添加应季食材失败', error)
      util.showToast(error.message || '添加失败，请重试')
    }
  },

  // 打开应季食材专页
  openSeasonalPage() {
    wx.navigateTo({
      url: '/packageCook/seasonal/seasonal'
    })
  },

  // 用应季食材来搜菜（跳转智能搜餐页）
  cookSeasonalItem() {
    const item = this.data.seasonalDetailItem
    if (!item || !item.name) return

    wx.navigateTo({
      url: `/packageCook/smart-choice/smart-choice?ingredient=${encodeURIComponent(item.name)}`,
      fail(err) {
        console.error('跳转智能搜餐失败', err)
        util.showToast('跳转失败，请稍后再试')
      }
    })
  },

  // 拍照识别食材
  recognizeIngredient() {
    const that = this
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success(res) {
        const tempFilePath = res.tempFilePaths[0]
        // 由于图片路径可能包含特殊字符，使用encodeURIComponent处理
        // 但注意：小程序中临时文件路径通常不需要URL编码，直接传递即可
        wx.navigateTo({
          url: `/packageCook/ingredient-recognize/ingredient-recognize?imagePath=${encodeURIComponent(tempFilePath)}`,
          fail(err) {
            console.error('跳转失败', err)
            util.showToast('页面跳转失败')
          }
        })
      },
      fail(err) {
        console.error('选择图片失败', err)
        util.showToast('选择图片失败')
      }
    })
  }
})
