// pages/shopping-list/shopping-list.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    shoppingList: [],
    filteredList: [],      // 当前筛选+排序后的列表，用于展示
    emptyHintText: '从菜谱详情页添加食材吧~',
    totalPrice: 0,
    bestPlatform: null,
    showCompareModal: false,
    comparingItem: null,
    platforms: ['京东', '盒马', '美团', '饿了么'],
    sortType: 'category', // category: 按分类, price: 按价格, name: 按名称
    filterCategory: 'all', // all: 全部, vegetable: 蔬菜, meat: 肉类, etc.
    categories: [
      { value: 'all', label: '全部' },
      { value: 'vegetable', label: '蔬菜' },
      { value: 'meat', label: '肉类' },
      { value: 'seafood', label: '水产' },
      { value: 'staple', label: '主食' },
      { value: 'other', label: '其他' }
    ],
    unitOptions: [
      { value: '个', label: '个' },
      { value: '斤', label: '斤' },
      { value: '克', label: '克' },
      { value: '瓶', label: '瓶' },
      { value: '袋', label: '袋' },
      { value: '份', label: '份' }
    ],
    showAddModal: false,
    newItem: {
      name: '',
      category: 'vegetable',
      amount: '',
      unit: '个'
    }
  },

  onLoad(options) {
    // 恢复排序偏好
    try {
      const savedSort = wx.getStorageSync('shoppingListSortType')
      if (savedSort && ['category', 'price', 'name'].includes(savedSort)) {
        this.setData({ sortType: savedSort })
      }
    } catch (e) {}
    // 如果从菜谱详情页跳转，接收食材列表
    if (options.items) {
      try {
        const items = JSON.parse(decodeURIComponent(options.items))
        this.addItemsToShoppingList(items)
      } catch (e) {
        console.error('解析食材列表失败', e)
      }
    }
    this.loadShoppingList()
  },

  onPullDownRefresh() {
    this.loadShoppingList()
    wx.stopPullDownRefresh()
  },

  onShow() {
    // 每次显示页面时刷新列表
    this.loadShoppingList()
  },

  // 加载购物清单
  loadShoppingList() {
    try {
      let list = wx.getStorageSync('shoppingList') || []
      const sortType = this.data.sortType || wx.getStorageSync('shoppingListSortType') || 'category'
      list = this.applySort(list, sortType)

      const { totalPrice, bestPlatform } = this.calculateBestPrice(list)

      this.setData({
        shoppingList: list,
        totalPrice,
        bestPlatform
      })
      this.updateFilteredList()
    } catch (e) {
      console.error('加载购物清单失败', e)
      util.showToast('加载失败')
    }
  },

  // 根据当前筛选和排序更新 filteredList 与空状态文案
  updateFilteredList() {
    const { shoppingList, filterCategory, sortType } = this.data
    let filtered = filterCategory === 'all'
      ? [...shoppingList]
      : shoppingList.filter(item => item.category === filterCategory)
    filtered = this.applySort(filtered, sortType)
    const emptyHintText = shoppingList.length === 0
      ? '从菜谱详情页添加食材吧~'
      : '该分类下暂无商品'
    this.setData({
      filteredList: filtered,
      emptyHintText
    })
  },

  applySort(list, sortType) {
    const sorted = [...list]
    if (sortType === 'category') {
      const order = ['vegetable', 'meat', 'seafood', 'staple', 'other']
      sorted.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))
    } else if (sortType === 'price') {
      sorted.sort((a, b) => (b.estimatedPrice || 0) - (a.estimatedPrice || 0))
    } else if (sortType === 'name') {
      sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }
    return sorted
  },

  // 添加食材到购物清单
  addItemsToShoppingList(items) {
    try {
      const currentList = wx.getStorageSync('shoppingList') || []
      const newItems = items.map(item => ({
        id: Date.now() + Math.random(),
        name: item.name || item,
        category: this.guessCategory(item.name || item),
        amount: item.amount || '1',
        unit: item.unit || '个',
        estimatedPrice: this.estimatePrice(item.name || item, item.amount || '1'),
        platforms: this.generatePriceComparison(item.name || item, item.amount || '1'),
        addedAt: new Date().toISOString()
      }))
      
      // 去重：如果已存在相同名称的食材，合并数量
      const mergedList = [...currentList]
      newItems.forEach(newItem => {
        const existingIndex = mergedList.findIndex(item => item.name === newItem.name)
        if (existingIndex >= 0) {
          // 合并数量
          mergedList[existingIndex].amount = this.mergeAmount(
            mergedList[existingIndex].amount,
            newItem.amount
          )
        } else {
          mergedList.push(newItem)
        }
      })
      
      wx.setStorageSync('shoppingList', mergedList)
      this.loadShoppingList()
      util.showSuccess(`已添加${newItems.length}样食材`)
    } catch (e) {
      console.error('添加食材失败', e)
      util.showToast('添加失败')
    }
  },

  // 猜测食材分类
  guessCategory(name) {
    const vegetableKeywords = ['西红柿', '番茄', '黄瓜', '青椒', '白菜', '青菜', '菠菜', '芹菜', '萝卜', '土豆', '茄子', '豆角']
    const meatKeywords = ['猪肉', '牛肉', '鸡肉', '羊肉', '肉', '排骨', '五花肉']
    const seafoodKeywords = ['鱼', '虾', '蟹', '贝', '海鲜', '带鱼', '鲈鱼']
    const stapleKeywords = ['米', '面', '粉', '馒头', '包子', '饺子']
    
    if (vegetableKeywords.some(k => name.includes(k))) return 'vegetable'
    if (meatKeywords.some(k => name.includes(k))) return 'meat'
    if (seafoodKeywords.some(k => name.includes(k))) return 'seafood'
    if (stapleKeywords.some(k => name.includes(k))) return 'staple'
    return 'other'
  },

  // 估算价格
  estimatePrice(name, amount) {
    // 简单的价格估算（实际应该从数据库获取）
    const priceMap = {
      '西红柿': 8,
      '番茄': 8,
      '鸡蛋': 12,
      '猪肉': 25,
      '牛肉': 45,
      '鸡肉': 18,
      '青椒': 6,
      '白菜': 4,
      '土豆': 5,
      '萝卜': 3
    }
    
    const basePrice = priceMap[name] || 10
    const amountNum = parseFloat(amount) || 1
    return Math.round(basePrice * amountNum * 100) / 100
  },

  // 生成比价数据
  generatePriceComparison(name, amount) {
    const basePrice = this.estimatePrice(name, amount)
    const platforms = [
      { name: '京东', price: basePrice * 0.95, deliveryFee: 5, minOrder: 99 },
      { name: '盒马', price: basePrice * 1.05, deliveryFee: 0, minOrder: 0 },
      { name: '美团', price: basePrice * 0.98, deliveryFee: 3, minOrder: 20 },
      { name: '饿了么', price: basePrice * 1.02, deliveryFee: 4, minOrder: 30 }
    ]
    
    return platforms.map(p => ({
      ...p,
      total: Math.round((p.price + p.deliveryFee) * 100) / 100,
      isBest: false
    })).sort((a, b) => a.total - b.total).map((p, i) => ({
      ...p,
      isBest: i === 0
    }))
  },

  // 合并数量
  mergeAmount(amount1, amount2) {
    const num1 = parseFloat(amount1) || 0
    const num2 = parseFloat(amount2) || 0
    return (num1 + num2).toString()
  },

  // 计算最佳价格
  calculateBestPrice(list) {
    if (list.length === 0) {
      return { totalPrice: 0, bestPlatform: null }
    }
    
    // 按平台分组计算总价
    const platformTotals = {}
    list.forEach(item => {
      const platforms = item.platforms || []
      platforms.forEach(platform => {
        if (!platformTotals[platform.name]) {
          platformTotals[platform.name] = {
            name: platform.name,
            total: 0,
            items: []
          }
        }
        platformTotals[platform.name].total += platform.total
        platformTotals[platform.name].items.push(item.name)
      })
    })
    
    // 找出总价最低的平台
    const platforms = Object.values(platformTotals)
    if (platforms.length === 0) {
      const totalPrice = list.reduce((sum, it) => sum + (it.estimatedPrice || 0), 0)
      return { totalPrice: Math.round(totalPrice * 100) / 100, bestPlatform: null }
    }
    platforms.sort((a, b) => a.total - b.total)
    const bestPlatform = platforms[0]
    return {
      totalPrice: Math.round(bestPlatform.total * 100) / 100,
      bestPlatform: bestPlatform
    }
  },

  // 删除商品
  deleteItem(e) {
    const id = e.currentTarget.dataset.id
    const confirm = async () => {
      try {
        const list = wx.getStorageSync('shoppingList') || []
        const newList = list.filter(item => item.id !== id)
        wx.setStorageSync('shoppingList', newList)
        this.loadShoppingList()
        util.showSuccess('已删除')
      } catch (e) {
        util.showToast('删除失败')
      }
    }
    
    util.showConfirm('确定要删除这个商品吗？').then(confirm)
  },

  // 查看比价
  viewCompare(e) {
    const item = e.currentTarget.dataset.item
    this.setData({
      comparingItem: item,
      showCompareModal: true
    })
  },

  // 关闭比价弹窗
  closeCompareModal() {
    this.setData({
      showCompareModal: false,
      comparingItem: null
    })
  },

  // 跳转到购物平台（模拟）
  goToPlatform(e) {
    const platform = e.currentTarget.dataset.platform
    util.showToast(`跳转到${platform}（模拟）`)
    // 实际应该调用平台API或跳转到对应小程序
  },

  // 一键加入购物车（模拟）
  addToCart() {
    util.showToast('已加入购物车（模拟）')
    // 实际应该调用平台API
  },

  // 清空清单
  clearList() {
    util.showConfirm('确定要清空购物清单吗？').then(() => {
      wx.setStorageSync('shoppingList', [])
      this.loadShoppingList()
      util.showSuccess('已清空')
    })
  },

  // 筛选分类
  filterByCategory(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ filterCategory: category }, () => this.updateFilteredList())
  },

  // 排序
  changeSort(e) {
    const sortType = e.currentTarget.dataset.sort
    try {
      wx.setStorageSync('shoppingListSortType', sortType)
    } catch (e) {}
    this.setData({ sortType }, () => this.updateFilteredList())
  },

  // 显示添加弹窗
  showAddModal() {
    this.setData({ showAddModal: true })
  },

  // 关闭添加弹窗
  closeAddModal() {
    this.setData({
      showAddModal: false,
      newItem: {
        name: '',
        category: 'vegetable',
        amount: '',
        unit: '个'
      }
    })
  },

  // 选择单位
  selectUnit(e) {
    this.setData({
      'newItem.unit': e.currentTarget.dataset.unit
    })
  },

  // 添加新商品
  addNewItem() {
    const { newItem } = this.data
    if (!newItem.name || !String(newItem.name).trim()) {
      util.showToast('请输入商品名称')
      return
    }
    const items = [{
      name: String(newItem.name).trim(),
      amount: newItem.amount || '1',
      unit: newItem.unit || '个',
      category: newItem.category
    }]
    this.addItemsToShoppingList(items)
    this.closeAddModal()
  },

  // 输入商品名称
  inputItemName(e) {
    this.setData({
      'newItem.name': e.detail.value
    })
  },

  // 输入数量
  inputItemAmount(e) {
    this.setData({
      'newItem.amount': e.detail.value
    })
  },

  // 选择分类
  selectCategory(e) {
    this.setData({
      'newItem.category': e.currentTarget.dataset.category
    })
  },

  // 去选菜谱（联动「自己做」：从菜谱详情页可一键加食材）
  goToCookList() {
    wx.navigateTo({
      url: '/packageCook/cook/cook'
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  }
})