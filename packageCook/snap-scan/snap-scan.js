// pages/snap-scan/snap-scan.js
const util = require('../../utils/util.js')
const api = require('../../utils/api.js')
const app = getApp()

Page({
  data: {
    imageUrl: '',
    recognizedFood: null,
    loading: false,
    scanning: false,
    hasResult: false,
    error: null,
    retryCount: 0,
    maxRetries: 3,
    // 分量调整
    portion: 1.0, // 默认1份
    portionOptions: [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
    // 调整后的数据
    adjustedCalories: 0,
    adjustedNutrition: null,
    remainingAfter: null,
    // 今日摄入信息
    dailySummary: null,
    // 识别置信度
    confidence: null,
    // 多食物识别
    multipleFoods: [],
    showMultipleFoods: false,
    // 识别建议
    recognitionTips: [
      '📸 确保食物清晰可见，避免模糊',
      '💡 尽量在光线充足的环境下拍摄',
      '📐 将食物放在画面中央，占据主要区域',
      '🎯 避免反光和阴影，保持画面清晰',
      '🍽️ 可以识别常见中餐、西餐、快餐等',
      '⚖️ 识别结果仅供参考，实际热量可能有偏差'
    ]
  },

  onLoad() {
    // 页面加载时获取今日摄入信息
    this.loadDailySummary()
  },

  // 加载今日摘要
  async loadDailySummary() {
    try {
      const today = util.formatDate(new Date())
      const summary = await api.getDailySummary(today)
      this.setData({
        dailySummary: summary
      })
    } catch (error) {
      console.log('获取今日摘要失败', error)
      // 不影响主流程，继续执行
    }
  },

  // 选择图片
  chooseImage() {
    const that = this
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success(res) {
        const tempFilePath = res.tempFilePaths[0]
        that.setData({
          imageUrl: tempFilePath,
          hasResult: false,
          recognizedFood: null,
          error: null,
          retryCount: 0,
          portion: 1.0,
          multipleFoods: [],
          showMultipleFoods: false
        })
        // 自动识别
        that.recognizeFood(tempFilePath)
      },
      fail(err) {
        console.error('选择图片失败', err)
        util.showToast('选择图片失败')
      }
    })
  },

  // 识别食物（调用真实API）
  async recognizeFood(imagePath) {
    this.setData({ 
      loading: true, 
      scanning: true,
      error: null
    })
    
    try {
      // 调用后端API识别食物
      const result = await api.recognizeFood(imagePath)
      
      // 处理识别结果
      // 如果返回的是数组，说明识别到多个食物
      if (Array.isArray(result)) {
        // 预处理多个食物数据，添加格式化后的置信度文本
        const processedFoods = result.map(food => ({
          ...food,
          confidenceText: food.confidence ? Math.round(food.confidence * 100) + '%' : null
        }))
        
        this.setData({
          multipleFoods: processedFoods,
          showMultipleFoods: result.length > 1,
          recognizedFood: processedFoods[0], // 默认显示第一个
          hasResult: true,
          loading: false,
          scanning: false,
          confidence: result[0].confidence || null
        })
      } else {
        // 单个食物识别结果
        const confidence = result.confidence || result.confidence_score || null
        const foodData = {
          name: result.name || '未知食物',
          calories: result.calories || 0,
          weight: result.weight || result.estimated_weight || '未知',
          nutrition: result.nutrition || {
            carb: result.carb || 0,
            protein: result.protein || 0,
            fat: result.fat || 0
          },
          healthLevel: this.calculateHealthLevel(result.calories || 0),
          healthTip: this.generateHealthTip(result),
          confidence: confidence,
          confidenceText: confidence ? Math.round(confidence * 100) + '%' : null,
          // 原始数据
          rawData: result
        }
        
        this.setData({
          recognizedFood: foodData,
          hasResult: true,
          loading: false,
          scanning: false,
          confidence: foodData.confidence
        })
        
        // 初始化调整后的数据
        this.updateAdjustedData(1.0)
      }
      
      wx.vibrateShort()
      util.showToast('识别成功', 'success')
      
      // 保存识别历史
      this.saveRecognitionHistory()
      
    } catch (error) {
      console.error('识别失败', error)

      // 错误处理
      const retryCount = this.data.retryCount + 1
      if (retryCount < this.data.maxRetries) {
        this.setData({
          error: `识别失败，正在重试 (${retryCount}/${this.data.maxRetries})...`,
          retryCount: retryCount
        })
        // 延迟重试
        setTimeout(() => {
          this.recognizeFood(imagePath)
        }, 1000)
      } else {
        this.setData({
          loading: false,
          scanning: false,
          error: '识别失败，请检查网络连接或稍后重试',
          retryCount: 0
        })
        util.showToast('识别失败，请重试', 'none')
      }
    }
  },

  // 计算健康等级
  calculateHealthLevel(calories) {
    if (!this.data.dailySummary) return 'good'
    
    const remaining = this.data.dailySummary.remaining || this.data.dailySummary.daily_limit
    const ratio = calories / remaining
    
    if (ratio < 0.3) return 'excellent'
    if (ratio < 0.5) return 'good'
    if (ratio < 0.7) return 'warning'
    return 'danger'
  },

  // 生成健康建议
  generateHealthTip(result) {
    const calories = result.calories || 0
    const summary = this.data.dailySummary
    
    if (!summary) {
      if (calories < 200) return '低热量食物，可以放心食用'
      if (calories < 400) return '中等热量，适量食用'
      return '热量较高，建议减少分量'
    }
    
    const remaining = summary.remaining || summary.daily_limit
    const ratio = calories / remaining
    
    if (ratio < 0.3) {
      return '低热量食物，可以放心食用，还有充足的热量预算'
    } else if (ratio < 0.5) {
      return '中等热量，适量食用，注意控制其他餐食'
    } else if (ratio < 0.7) {
      return '热量较高，建议减少分量或搭配低热量食物'
    } else {
      return '⚠️ 热量很高，会占用大部分热量预算，建议谨慎选择'
    }
  },

  // 调整分量
  adjustPortion(e) {
    const portion = parseFloat(e.currentTarget.dataset.portion)
    this.updateAdjustedData(portion)
  },

  // 更新调整后的数据
  updateAdjustedData(portion) {
    const food = this.data.recognizedFood
    if (!food) {
      this.setData({ portion })
      return
    }

    const adjustedCalories = Math.round(food.calories * portion)
    const adjustedNutrition = {
      carb: Math.round(food.nutrition.carb * portion * 10) / 10,
      protein: Math.round(food.nutrition.protein * portion * 10) / 10,
      fat: Math.round(food.nutrition.fat * portion * 10) / 10
    }

    const summary = this.data.dailySummary
    let remainingAfter = null
    if (summary) {
      const remaining = summary.remaining || (summary.daily_limit - (summary.consumed || summary.intake_actual || 0))
      remainingAfter = remaining - adjustedCalories
    }

    this.setData({
      portion,
      adjustedCalories,
      adjustedNutrition,
      remainingAfter
    })
  },

  // 获取调整后的热量（用于方法调用）
  getAdjustedCalories() {
    return this.data.adjustedCalories || 0
  },

  // 获取调整后的营养（用于方法调用）
  getAdjustedNutrition() {
    return this.data.adjustedNutrition || { carb: 0, protein: 0, fat: 0 }
  },

  // 获取剩余热量（用于方法调用）
  getRemainingCalories() {
    return this.data.remainingAfter
  },

  // 确认记录
  async confirmRecord() {
    const food = this.data.recognizedFood
    if (!food) return

    const adjustedCalories = this.getAdjustedCalories()
    const adjustedNutrition = this.getAdjustedNutrition()
    const remaining = this.getRemainingCalories()
    
    // 检查是否会超标
    let warningMessage = ''
    if (remaining !== null && remaining < 0) {
      warningMessage = `\n⚠️ 注意：记录后今日热量将超出目标 ${Math.abs(remaining)} kcal`
    }

    wx.showModal({
      title: '确认记录',
      content: `确定要将"${food.name}"(${adjustedCalories}kcal)记录到今日饮食吗？${warningMessage}`,
      confirmText: '确认记录',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
      // 调用后端API记录摄入
      const adjustedCalories = this.getAdjustedCalories()
      const adjustedNutrition = this.getAdjustedNutrition()
      
      await api.logIntake({
        source_type: 3, // 3表示拍图识别
        name: food.name,
        calories: adjustedCalories,
        carb: adjustedNutrition.carb,
        protein: adjustedNutrition.protein,
        fat: adjustedNutrition.fat,
        portion: this.data.portion,
        image_url: this.data.imageUrl, // 可选：保存识别图片
        recognition_data: food.rawData || food // 保存原始识别数据
      })
            
            util.showToast('记录成功', 'success')
            
            // 刷新今日摘要
            await this.loadDailySummary()
            
            setTimeout(() => {
              wx.navigateBack()
            }, 1500)
          } catch (error) {
            console.error('记录失败', error)
            util.showToast('记录失败，请重试')
          }
        }
      }
    })
  },

  // 重新识别
  reScan() {
    this.setData({
      imageUrl: '',
      recognizedFood: null,
      hasResult: false,
      error: null,
      retryCount: 0,
      portion: 1.0,
      multipleFoods: [],
      showMultipleFoods: false
    })
    this.chooseImage()
  },

  // 选择多个食物中的某一个
  selectFood(e) {
    const index = e.currentTarget.dataset.index
    const food = this.data.multipleFoods[index]
    
    const confidence = food.confidence || food.confidence_score || null
    const foodData = {
      ...food,
      healthLevel: this.calculateHealthLevel(food.calories || 0),
      healthTip: this.generateHealthTip(food),
      confidence: confidence,
      confidenceText: confidence ? Math.round(confidence * 100) + '%' : null
    }
    
    this.setData({
      recognizedFood: foodData,
      showMultipleFoods: false,
      confidence: foodData.confidence
    })
        
        // 初始化调整后的数据
        this.updateAdjustedData(1.0)
  },

  // 保存识别历史
  saveRecognitionHistory() {
    try {
      const history = wx.getStorageSync('recognition_history') || []
      const newRecord = {
        name: this.data.recognizedFood.name,
        calories: this.data.recognizedFood.calories,
        imageUrl: this.data.imageUrl,
        timestamp: new Date().toISOString(),
        confidence: this.data.confidence
      }
      
      // 添加到开头，最多保存20条
      history.unshift(newRecord)
      if (history.length > 20) {
        history.pop()
      }
      
      wx.setStorageSync('recognition_history', history)
    } catch (error) {
      console.log('保存识别历史失败', error)
    }
  }
})
