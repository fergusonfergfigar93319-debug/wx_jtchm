// pages/intake-edit/index.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

const MEAL_TYPES = [
  { value: 'breakfast', label: '早餐' },
  { value: 'lunch', label: '午餐' },
  { value: 'afternoon_tea', label: '下午茶' },
  { value: 'dinner', label: '晚餐' },
  { value: 'snack', label: '夜宵' }
]

Page({
  data: {
    id: null,
    mealTypeLabels: MEAL_TYPES,
    mealTypeIndex: 0,
    form: {
      food_name: '',
      meal_type: 'breakfast',
      meal_type_label: '早餐',
      calories: '',
      protein: '',
      fat: '',
      carbs: '',
      amount: '',
      amount_unit: '',
      note: ''
    }
  },

  onLoad(options) {
    const id = options.id ? parseInt(options.id, 10) : null
    if (!id) {
      util.showToast('缺少记录ID')
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }
    this.setData({ id })
    this.loadDetail(id)
  },

  async loadDetail(id) {
    try {
      util.showLoading('加载中...')
      const detail = await api.getIntakeDetail(id)
      util.hideLoading()
      if (!detail) {
        util.showToast('记录不存在')
        return
      }
      const mealTypeIndex = MEAL_TYPES.findIndex(m => m.value === (detail.meal_type || 'breakfast'))
      this.setData({
        mealTypeIndex: mealTypeIndex >= 0 ? mealTypeIndex : 0,
        form: {
          food_name: detail.food_name || '',
          meal_type: detail.meal_type || 'breakfast',
          meal_type_label: MEAL_TYPES[mealTypeIndex >= 0 ? mealTypeIndex : 0].label,
          calories: detail.calories != null ? String(detail.calories) : '',
          protein: detail.protein != null ? String(detail.protein) : '',
          fat: detail.fat != null ? String(detail.fat) : '',
          carbs: detail.carbs != null ? String(detail.carbs) : '',
          amount: detail.amount != null ? String(detail.amount) : '',
          amount_unit: detail.amount_unit || '',
          note: detail.note || ''
        }
      })
    } catch (e) {
      util.hideLoading()
      util.showToast(e.message || '加载失败')
    }
  },

  onFoodNameInput(e) {
    this.setData({ 'form.food_name': e.detail.value })
  },
  onMealTypeChange(e) {
    const idx = parseInt(e.detail.value, 10)
    const item = MEAL_TYPES[idx]
    this.setData({
      mealTypeIndex: idx,
      'form.meal_type': item.value,
      'form.meal_type_label': item.label
    })
  },
  onCaloriesInput(e) {
    this.setData({ 'form.calories': e.detail.value })
  },
  onAmountInput(e) {
    this.setData({ 'form.amount': e.detail.value })
  },
  onAmountUnitInput(e) {
    this.setData({ 'form.amount_unit': e.detail.value })
  },
  onProteinInput(e) {
    this.setData({ 'form.protein': e.detail.value })
  },
  onFatInput(e) {
    this.setData({ 'form.fat': e.detail.value })
  },
  onCarbsInput(e) {
    this.setData({ 'form.carbs': e.detail.value })
  },
  onNoteInput(e) {
    this.setData({ 'form.note': e.detail.value })
  },

  async onSave() {
    const { id, form } = this.data
    const calories = form.calories ? parseInt(form.calories, 10) : null
    const protein = form.protein ? parseInt(form.protein, 10) : null
    const fat = form.fat ? parseInt(form.fat, 10) : null
    const carbs = form.carbs ? parseInt(form.carbs, 10) : null
    const amount = form.amount ? parseFloat(form.amount) : null
    const payload = {
      food_name: form.food_name || undefined,
      meal_type: form.meal_type,
      calories: calories,
      protein: protein,
      fat: fat,
      carbs: carbs,
      amount: amount,
      amount_unit: form.amount_unit || undefined,
      note: form.note || undefined
    }
    try {
      util.showLoading('保存中...')
      await api.updateIntake(id, payload)
      util.hideLoading()
      util.showSuccess('已保存')
      wx.navigateBack()
    } catch (e) {
      util.hideLoading()
      util.showToast(e.message || '保存失败')
    }
  },

  async onDelete() {
    const that = this
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定删除此条记录吗？',
      success: async (res) => {
        if (!res.confirm) return
        try {
          util.showLoading('删除中...')
          await api.deleteIntake(that.data.id)
          util.hideLoading()
          util.showSuccess('已删除')
          wx.navigateBack()
        } catch (e) {
          util.hideLoading()
          util.showToast(e.message || '删除失败')
        }
      }
    })
  }
})
