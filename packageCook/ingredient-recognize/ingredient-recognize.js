// pages/ingredient-recognize/ingredient-recognize.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    imagePath: '',
    recognizedIngredient: null,
    loading: false,
    scanning: false,
    hasResult: false,
    // 添加食材时的参数
    amount: '1',
    unit: '个',
    showAddModal: false
  },

  onLoad(options) {
    let imagePath = options.imagePath || ''
    // 解码路径（如果需要）
    try {
      imagePath = decodeURIComponent(imagePath)
    } catch (e) {
      // 如果解码失败，使用原始路径
      console.warn('路径解码失败，使用原始路径', e)
    }
    
    if (imagePath) {
      this.setData({ imagePath })
      this.recognizeIngredient(imagePath)
    } else {
      // 如果没有传入图片路径，允许用户选择图片
      this.reTakePhoto()
    }
  },

  // 识别食材
  async recognizeIngredient(imagePath) {
    this.setData({ loading: true, scanning: true })
    
    try {
      const result = await api.recognizeIngredient(imagePath)
      
      // 设置建议的单位和数量
      this.setData({
        recognizedIngredient: result,
        hasResult: true,
        loading: false,
        scanning: false,
        amount: String(result.suggested_amount || 1),
        unit: result.suggested_unit || '个'
      })
      
      wx.vibrateShort()
      util.showToast('识别成功', 'success')
    } catch (error) {
      console.error('识别失败', error)
      this.setData({
        loading: false,
        scanning: false
      })
      util.showToast(error.message || '识别失败，请重试')
    }
  },

  // 重新拍照
  reTakePhoto() {
    const that = this
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success(res) {
        const tempFilePath = res.tempFilePaths[0]
        that.setData({
          imagePath: tempFilePath,
          recognizedIngredient: null,
          hasResult: false
        })
        that.recognizeIngredient(tempFilePath)
      },
      fail(err) {
        console.error('选择图片失败', err)
        util.showToast('选择图片失败')
      }
    })
  },

  // 显示添加食材弹窗
  showAddToFridge() {
    this.setData({ showAddModal: true })
  },

  // 关闭添加弹窗
  closeAddModal() {
    this.setData({ showAddModal: false })
  },

  // 数量输入
  onAmountInput(e) {
    const value = e.detail.value
    this.setData({ amount: value })
  },

  // 选择单位
  selectUnit(e) {
    const unit = e.currentTarget.dataset.unit
    this.setData({ unit })
    // 如果选择"适量"，清空数量
    if (unit === '适量') {
      this.setData({ amount: '' })
    } else if (!this.data.amount || this.data.amount === '0') {
      // 如果数量为空或为0，设置默认值1
      this.setData({ amount: '1' })
    }
  },

  // 确认添加到冰箱
  async confirmAddToFridge() {
    const ingredient = this.data.recognizedIngredient
    if (!ingredient) return

    // 验证数量
    let amount = 0
    if (this.data.unit !== '适量') {
      if (!this.data.amount || this.data.amount.trim() === '') {
        util.showToast('请输入有效数量（大于0）')
        return
      }
      amount = parseFloat(this.data.amount)
      if (isNaN(amount) || amount <= 0) {
        util.showToast('请输入有效数量（大于0）')
        return
      }
      amount = Math.round(amount * 100) / 100
    }

    try {
      util.showLoading('添加中...')
      
      const itemData = {
        name: ingredient.name,
        category: ingredient.category,
        sub_category: ingredient.sub_category || '',
        amount: amount,
        unit: this.data.unit,
        created_at: new Date().toISOString()
      }

      await api.addFridgeItem(itemData)
      util.showSuccess('已加入冰箱')
      
      // 延迟返回，让用户看到成功提示
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('添加失败', error)
      util.showToast(error.message || '添加失败，请重试')
    } finally {
      util.hideLoading()
    }
  }
})
