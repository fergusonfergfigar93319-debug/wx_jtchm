// pages/group-order/group-order.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

/** 路由参数中的店名常为 encodeURIComponent，需解码后再展示 */
function decodeRouteParam(str) {
  if (str == null || str === '') return ''
  try {
    return decodeURIComponent(str)
  } catch (e) {
    return str
  }
}

Page({
  data: {
    restaurantId: '',
    restaurantName: '',
    dishes: [], // 已选菜品列表
    members: [], // 拼单成员列表
    availableDishes: [],
    distributionMode: 'per_person', // 分配模式：per_person(按人头), per_dish(按菜品)
    totalCalories: 0, // 总热量
    totalPrice: 0, // 总价格
    avgCaloriesPerPerson: 0, // 人均热量（WXML 不支持 Math，需在 JS 中计算）
    showAddDishModal: false,
    showAddMemberModal: false,
    newMemberName: '',
    selectedDish: null,
    dishQuantity: 1
  },

  onLoad(options) {
    const nameFromQuery = decodeRouteParam(options.restaurantName)
    if (options.restaurantId) {
      this.setData({
        restaurantId: options.restaurantId,
        restaurantName: nameFromQuery || '商家'
      })
      this.loadRestaurantDishes()
    } else {
      this.setData({
        restaurantName: nameFromQuery || '外卖拼单'
      })
    }

    // 初始化：添加当前用户
    this.addMember('我')
  },

  stopPropagation() {},

  // 加载商家菜品
  async loadRestaurantDishes() {
    try {
      const restaurant = await api.getRestaurantDetail(this.data.restaurantId)
      const dishes = restaurant.recommended_dishes || restaurant.menu || []
      this.setData({ availableDishes: dishes })
    } catch (error) {
      console.error('加载菜品失败', error)
      this.setData({ availableDishes: [] })
    }
  },

  // 添加成员
  addMember(name) {
    if (!name || name.trim() === '') {
      util.showToast('请输入成员名称')
      return
    }
    
    const members = [...this.data.members]
    if (members.some(m => m.name === name)) {
      util.showToast('该成员已存在')
      return
    }
    
    members.push({
      id: Date.now(),
      name: name.trim(),
      calories: 0,
      dishes: []
    })
    
    this.setData({ 
      members,
      newMemberName: '',
      showAddMemberModal: false
    })
    this.calculateDistribution()
  },

  // 显示添加成员弹窗
  showAddMember() {
    this.setData({ showAddMemberModal: true })
  },

  // 关闭添加成员弹窗
  closeAddMemberModal() {
    this.setData({ showAddMemberModal: false, newMemberName: '' })
  },

  // 输入成员名称
  onMemberNameInput(e) {
    this.setData({ newMemberName: e.detail.value })
  },

  // 确认添加成员
  confirmAddMember() {
    if (this.data.newMemberName.trim()) {
      this.addMember(this.data.newMemberName)
    }
  },

  // 删除成员
  deleteMember(e) {
    const id = e.currentTarget.dataset.id
    const members = this.data.members.filter(m => m.id !== id)
    this.setData({ members })
    this.calculateDistribution()
  },

  // 添加菜品
  addDish(dish) {
    const dishes = [...this.data.dishes]
    const existingIndex = dishes.findIndex(d => d.id === dish.id)
    
    if (existingIndex > -1) {
      // 如果已存在，增加数量
      dishes[existingIndex].quantity = (dishes[existingIndex].quantity || 1) + 1
    } else {
      // 新增菜品
      dishes.push({
        ...dish,
        quantity: 1
      })
    }
    
    this.setData({ 
      dishes,
      showAddDishModal: false,
      selectedDish: null
    })
    this.calculateDistribution()
  },

  // 显示添加菜品弹窗
  showAddDish() {
    this.setData({ showAddDishModal: true })
  },

  // 关闭添加菜品弹窗
  closeAddDishModal() {
    this.setData({ showAddDishModal: false, selectedDish: null })
  },

  // 选择菜品
  selectDish(e) {
    const dish = e.currentTarget.dataset.dish
    this.setData({ selectedDish: dish })
  },

  // 确认添加菜品
  confirmAddDish() {
    if (this.data.selectedDish) {
      this.addDish(this.data.selectedDish)
    }
  },

  // 调整菜品数量
  adjustDishQuantity(e) {
    const id = e.currentTarget.dataset.id
    const type = e.currentTarget.dataset.type // 'add' or 'minus'
    const dishes = this.data.dishes.map(dish => {
      if (dish.id === id) {
        const newQuantity = type === 'add' 
          ? (dish.quantity || 1) + 1 
          : Math.max(1, (dish.quantity || 1) - 1)
        return { ...dish, quantity: newQuantity }
      }
      return dish
    })
    this.setData({ dishes })
    this.calculateDistribution()
  },

  // 删除菜品
  deleteDish(e) {
    const id = e.currentTarget.dataset.id
    const dishes = this.data.dishes.filter(d => d.id !== id)
    this.setData({ dishes })
    this.calculateDistribution()
  },

  // 切换分配模式
  switchDistributionMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ distributionMode: mode })
    this.calculateDistribution()
  },

  // 计算分配
  calculateDistribution() {
    const dishes = this.data.dishes
    const members = this.data.members
    const mode = this.data.distributionMode
    
    if (dishes.length === 0 || members.length === 0) {
      this.setData({
        totalCalories: 0,
        totalPrice: 0,
        avgCaloriesPerPerson: 0,
        members: members.map(m => ({ ...m, calories: 0, dishes: [] }))
      })
      return
    }
    
    // 计算总热量和总价格
    let totalCalories = 0
    let totalPrice = 0
    dishes.forEach(dish => {
      const calories = (dish.calories || dish.estimated_calories || 0) * (dish.quantity || 1)
      const price = (dish.price || 0) * (dish.quantity || 1)
      totalCalories += calories
      totalPrice += price
    })
    
    // 根据分配模式计算每人分配
    const updatedMembers = members.map(member => ({
      ...member,
      calories: 0,
      dishes: [],
      price: 0
    }))
    
    if (mode === 'per_person') {
      // 按人头平均分配
      const caloriesPerPerson = Math.round(totalCalories / members.length)
      const pricePerPerson = Math.round((totalPrice / members.length) * 100) / 100
      
      updatedMembers.forEach(member => {
        member.calories = caloriesPerPerson
        member.price = pricePerPerson
        member.dishes = dishes.map(dish => ({
          ...dish,
          portion: Math.round((dish.quantity || 1) / members.length * 100) / 100
        }))
      })
    } else {
      // 按菜品分配（每人选择自己的菜品）
      // 这里简化处理：平均分配所有菜品
      dishes.forEach(dish => {
        const caloriesPerDish = (dish.calories || dish.estimated_calories || 0) * (dish.quantity || 1)
        const pricePerDish = (dish.price || 0) * (dish.quantity || 1)
        const caloriesPerPerson = Math.round(caloriesPerDish / members.length)
        const pricePerPerson = Math.round((pricePerDish / members.length) * 100) / 100
        
        updatedMembers.forEach(member => {
          member.calories += caloriesPerPerson
          member.price += pricePerPerson
          member.dishes.push({
            ...dish,
            portion: Math.round((dish.quantity || 1) / members.length * 100) / 100
          })
        })
      })
    }
    
    const avgCaloriesPerPerson =
      members.length > 0 ? Math.round(totalCalories / members.length) : 0

    this.setData({
      totalCalories,
      totalPrice,
      avgCaloriesPerPerson,
      members: updatedMembers
    })
  },

  // 记录拼单
  async recordGroupOrder() {
    if (this.data.members.length === 0) {
      util.showToast('请至少添加一个成员')
      return
    }
    
    if (this.data.dishes.length === 0) {
      util.showToast('请至少添加一个菜品')
      return
    }
    
    try {
      util.showLoading('记录中...')
      
      // 为每个成员记录热量
      const records = this.data.members.map(member => ({
        source_type: 2, // 外卖
        source_id: this.data.restaurantId,
        food_name: `${this.data.restaurantName} - 拼单`,
        calories: member.calories,
        portion: 1.0,
        note: `拼单分配：${member.name}`
      }))
      
      // 批量记录（这里简化处理，实际应该调用批量接口）
      for (const record of records) {
        await api.logIntake(record)
      }
      
      util.showSuccess('拼单记录已保存')
      
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('记录失败', error)
      util.showToast('记录失败，请重试')
    } finally {
      util.hideLoading()
    }
  }
})
