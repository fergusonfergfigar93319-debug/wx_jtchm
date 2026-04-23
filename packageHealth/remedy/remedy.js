// pages/remedy/remedy.js
const util = require('../../utils/util.js')
const api = require('../../utils/api.js')
const { normalizeRemedyList, buildRemedyCopyText } = require('../../utils/remedy-normalize.js')
Page({
  data: {
    symptoms: [
      {
        id: 'hangover',
        icon: '🍺',
        name: '宿醉',
        desc: '肝脏加班中——先补水，再谈原谅',
        color: '#FF6B6B',
        category: '饮酒'
      },
      {
        id: 'stayup',
        icon: '🌙',
        name: '熬夜',
        desc: '月亮不睡我不睡，白天靠咖啡续命',
        color: '#4ECDC4',
        category: '作息'
      },
      {
        id: 'overeat',
        icon: '🍕',
        name: '暴食',
        desc: '嘴和胃刚刚经历了一场马拉松',
        color: '#FFE66D',
        category: '饮食'
      },
      {
        id: 'stomachache',
        icon: '😰',
        name: '胃痛',
        desc: '胃不舒服',
        color: '#95E1D3',
        category: '消化'
      },
      {
        id: 'stress',
        icon: '😫',
        name: '压力',
        desc: '压力大焦虑',
        color: '#A8E6CF',
        category: '情绪'
      },
      {
        id: 'fatigue',
        icon: '😴',
        name: '疲劳',
        desc: '身体疲惫',
        color: '#FFD3A5',
        category: '体力'
      },
      {
        id: 'insomnia',
        icon: '🌃',
        name: '失眠',
        desc: '睡眠不好',
        color: '#CAB8FF',
        category: '睡眠'
      },
      {
        id: 'indigestion',
        icon: '🤢',
        name: '消化不良',
        desc: '消化不好',
        color: '#FFA8B6',
        category: '消化'
      },
      {
        id: 'cold',
        icon: '🤧',
        name: '感冒',
        desc: '感冒不适',
        color: '#FFB74D',
        category: '疾病'
      },
      {
        id: 'constipation',
        icon: '😣',
        name: '便秘',
        desc: '排便困难',
        color: '#81C784',
        category: '消化'
      },
      {
        id: 'skin',
        icon: '✨',
        name: '皮肤问题',
        desc: '皮肤状态差',
        color: '#F48FB1',
        category: '美容'
      },
      {
        id: 'menstrual',
        icon: '🌸',
        name: '经期不适',
        desc: '经期不舒服',
        color: '#FF8A80',
        category: '女性'
      },
      {
        id: 'headache',
        icon: '😵',
        name: '头痛',
        desc: '头部不适',
        color: '#90CAF9',
        category: '疾病'
      },
      {
        id: 'sorethroat',
        icon: '😷',
        name: '喉咙痛',
        desc: '喉咙不适',
        color: '#CE93D8',
        category: '疾病'
      },
      {
        id: 'lowimmunity',
        icon: '🛡️',
        name: '免疫力低',
        desc: '容易生病',
        color: '#64B5F6',
        category: '健康'
      },
      {
        id: 'heat',
        icon: '🔥',
        name: '上火',
        desc: '口干舌燥、咽喉不适',
        color: '#FF7043',
        category: '饮食'
      },
      {
        id: 'ulcer',
        icon: '🫦',
        name: '口腔溃疡',
        desc: '口腔黏膜破损',
        color: '#FFAB91',
        category: '消化'
      },
      {
        id: 'edema',
        icon: '💧',
        name: '水肿',
        desc: '身体浮肿、水分滞留',
        color: '#80DEEA',
        category: '作息'
      }
    ],
    selectedSymptom: null,
    remedies: [],
    loading: false,
    showDetail: false,
    selectedRemedy: null,
    searchKeyword: '',  // 搜索关键词
    filteredSymptoms: [],  // 过滤后的症状列表
    // 分类标签：在 onLoad 时根据症状自动生成
    categoryTabs: [],
    activeCategory: 'all',
    showHistory: false,  // 是否显示历史记录
    usageHistory: []  // 使用历史
  },

  onLoad(options) {
    // 初始化分类标签与过滤后的症状列表
    const allSymptoms = this.data.symptoms || []
    // 固定分类顺序：全部、饮酒、作息、饮食、消化、情绪，其余按数据顺序
    const order = ['饮酒', '作息', '饮食', '消化', '情绪']
    const categorySet = Array.from(new Set(allSymptoms.map(s => s.category))).filter(Boolean)
    const sorted = [...order.filter(c => categorySet.includes(c)), ...categorySet.filter(c => !order.includes(c))]
    const categoryTabs = [
      { id: 'all', label: '全部' },
      ...sorted.map(c => ({ id: c, label: c }))
    ]
    this.setData({
      filteredSymptoms: allSymptoms,
      categoryTabs,
      activeCategory: 'all'
    })
    
    // 页面加载，支持从其他页面传入症状参数
    if (options.symptom) {
      const symptom = this.data.symptoms.find(s => s.name === options.symptom || s.id === options.symptom)
      if (symptom) {
        this.setData({ selectedSymptom: symptom })
        this.loadRemedies(symptom.id)
      }
    }
    
    // 加载使用历史
    this.loadUsageHistory()
  },

  goToTriage() {
    wx.vibrateShort()
    wx.navigateTo({ url: '/packageHealth/triage/triage' })
  },

  // 选择症状：跳转至专门分析建议页
  selectSymptom(e) {
    const symptom = e.currentTarget.dataset.symptom
    wx.vibrateShort()
    wx.navigateTo({
      url: `/packageHealth/remedy-symptom/remedy-symptom?id=${symptom.id}&name=${encodeURIComponent(symptom.name)}&desc=${encodeURIComponent(symptom.desc || '')}`
    })
  },

  // 加载补救方案
  async loadRemedies(symptomId) {
    this.setData({ loading: true })
    
    try {
      // 尝试调用后端API
      let remedies = []
      try {
        const response = await api.getRemedySolutions(symptomId)
        remedies = response.solutions || []
      } catch (apiError) {
        // 如果API调用失败，使用本地数据
        console.log('使用本地补救方案数据')
        remedies = this.getLocalRemedyData(symptomId)
      }
      
      this.setData({
        remedies: normalizeRemedyList(remedies),
        loading: false
      })
      
    } catch (error) {
      console.error('加载补救方案失败', error)
      this.setData({ loading: false })
      util.showToast('加载失败，请重试')
    }
  },

  getLocalRemedyData(symptomId) {
    const remedyData = {
      hangover: [
        {
          id: 'hangover_1',
          name: '蜂蜜柠檬水',
          desc: '解酒护肝，补充维C，促进酒精代谢',
          icon: '🍋',
          recipe: '蜂蜜1勺 + 柠檬片2-3片 + 温水300ml',
          detailedSteps: [
            '准备新鲜柠檬1个，切片',
            '取1勺纯蜂蜜（约15ml）',
            '将柠檬片和蜂蜜放入杯中',
            '倒入300ml温水（40-50°C）',
            '搅拌均匀，趁热饮用'
          ],
          calories: 50,
          nutrition: {
            carbs: 12,
            protein: 0.5,
            fat: 0,
            fiber: 0.5,
            vitaminC: 30
          },
          tags: ['解酒', '护肝', '补水', '维C'],
          benefits: ['促进酒精代谢', '保护肝脏', '补充维生素C', '缓解头痛'],
          tips: ['酒后立即饮用效果最佳', '可加入少量生姜片增强效果', '避免用开水，会破坏维C'],
          science: '蜂蜜中的果糖可以加速酒精分解，柠檬中的维C有助于肝脏解毒',
          timing: '酒后立即或第二天早上',
          duration: '持续2-3天，每天2-3次'
        },
        {
          id: 'hangover_2',
          name: '小米粥',
          desc: '养胃护肝，易消化，补充能量',
          icon: '🥣',
          recipe: '小米100g + 水500ml + 少量糖',
          detailedSteps: [
            '小米洗净，浸泡30分钟',
            '锅中加水，大火煮沸',
            '转小火，慢煮30-40分钟',
            '煮至粘稠，加入少量糖调味',
            '趁热食用，可配咸菜'
          ],
          calories: 120,
          nutrition: {
            carbs: 25,
            protein: 3,
            fat: 1,
            fiber: 1.5
          },
          tags: ['养胃', '护肝', '易消化', '补充能量'],
          benefits: ['保护胃黏膜', '易消化吸收', '补充碳水化合物', '缓解胃部不适'],
          tips: ['煮得越烂越好消化', '可加入红枣、枸杞增强效果', '避免过咸过油'],
          science: '小米富含B族维生素，有助于肝脏代谢，粥类食物温和不刺激胃',
          timing: '第二天早餐或午餐',
          duration: '持续1-2天'
        },
        {
          id: 'hangover_3',
          name: '绿豆汤',
          desc: '清热解毒，利尿排毒',
          icon: '🫘',
          recipe: '绿豆50g + 水500ml + 冰糖适量',
          detailedSteps: [
            '绿豆洗净，浸泡2小时',
            '锅中加水，大火煮沸',
            '转小火，煮30分钟至绿豆开花',
            '加入冰糖调味',
            '放凉后饮用'
          ],
          calories: 80,
          nutrition: {
            carbs: 15,
            protein: 4,
            fat: 0.5,
            fiber: 2
          },
          tags: ['解酒', '排毒', '利尿', '清热'],
          benefits: ['促进酒精排出', '清热解毒', '利尿消肿', '缓解口干'],
          tips: ['可加入少量薄荷叶', '放凉后饮用更解渴', '避免过甜'],
          science: '绿豆具有清热解毒、利尿的作用，有助于加速酒精代谢和排出',
          timing: '酒后或第二天',
          duration: '当天饮用2-3次'
        }
      ],
      stayup: [
        {
          id: 'stayup_1',
          name: '枸杞菊花茶',
          desc: '护眼明目，缓解疲劳，改善视力',
          icon: '🌼',
          recipe: '枸杞10g + 菊花5g + 热水500ml',
          detailedSteps: [
            '准备枸杞和菊花',
            '用热水冲洗一遍',
            '放入杯中，倒入500ml热水',
            '浸泡5-10分钟',
            '可反复冲泡2-3次'
          ],
          calories: 30,
          nutrition: {
            carbs: 5,
            protein: 1,
            fat: 0,
            fiber: 1,
            vitaminA: 200
          },
          tags: ['护眼', '明目', '提神', '抗氧化'],
          benefits: ['缓解眼疲劳', '改善视力', '抗氧化', '提升免疫力'],
          tips: ['可加入少量蜂蜜调味', '睡前2小时避免饮用', '可长期饮用'],
          science: '枸杞富含β-胡萝卜素和叶黄素，菊花含有黄酮类化合物，都有护眼作用',
          timing: '熬夜后第二天上午',
          duration: '持续3-5天，每天2-3次'
        },
        {
          id: 'stayup_2',
          name: '猪肝菠菜汤',
          desc: '补血补铁，恢复体力，改善气色',
          icon: '🍲',
          recipe: '猪肝100g + 菠菜200g + 姜片 + 水500ml',
          detailedSteps: [
            '猪肝切片，用盐水浸泡30分钟去腥',
            '菠菜洗净切段',
            '锅中加水，放入姜片煮沸',
            '加入猪肝，煮3-5分钟',
            '加入菠菜，再煮2分钟',
            '调味即可'
          ],
          calories: 180,
          nutrition: {
            carbs: 5,
            protein: 20,
            fat: 8,
            fiber: 2,
            iron: 25,
            vitaminA: 5000
          },
          tags: ['补血', '补铁', '恢复', '高蛋白'],
          benefits: ['补充铁质', '改善贫血', '恢复体力', '提升免疫力'],
          tips: ['猪肝要彻底煮熟', '可加入少量枸杞', '每周1-2次即可'],
          science: '猪肝富含铁和维生素A，菠菜也含铁，两者搭配补血效果更好',
          timing: '熬夜后第二天午餐',
          duration: '每周1-2次'
        },
        {
          id: 'stayup_3',
          name: '银耳莲子汤',
          desc: '滋阴润燥，安神助眠，美容养颜',
          icon: '🍨',
          recipe: '银耳20g + 莲子30g + 红枣5颗 + 冰糖适量',
          detailedSteps: [
            '银耳提前泡发，撕成小朵',
            '莲子去芯，红枣去核',
            '所有材料放入锅中，加水1000ml',
            '大火煮沸，转小火慢炖1小时',
            '加入冰糖调味即可'
          ],
          calories: 150,
          nutrition: {
            carbs: 30,
            protein: 3,
            fat: 0.5,
            fiber: 3
          },
          tags: ['滋阴', '润燥', '安神', '美容'],
          benefits: ['改善睡眠', '润燥养颜', '补充胶原蛋白', '缓解疲劳'],
          tips: ['可加入百合增强效果', '睡前1小时饮用', '可长期食用'],
          science: '银耳富含胶质和多种氨基酸，莲子有安神作用，适合熬夜后恢复',
          timing: '熬夜后晚上或第二天',
          duration: '持续3-5天'
        }
      ],
      overeat: [
        {
          id: 'overeat_1',
          name: '普洱茶',
          desc: '刮油解腻，助消化，降脂减肥',
          icon: '🍵',
          recipe: '普洱茶5g + 热水300ml',
          detailedSteps: [
            '用热水冲洗茶叶',
            '第一泡倒掉（洗茶）',
            '第二泡开始饮用',
            '可反复冲泡5-7次',
            '饭后30分钟饮用最佳'
          ],
          calories: 10,
          nutrition: {
            carbs: 0,
            protein: 0,
            fat: 0,
            fiber: 0,
            caffeine: 30
          },
          tags: ['刮油', '解腻', '助消化', '降脂'],
          benefits: ['促进脂肪分解', '降低胆固醇', '助消化', '解腻'],
          tips: ['饭后30分钟饮用', '避免空腹饮用', '可长期饮用'],
          science: '普洱茶中的茶多酚和咖啡因可以促进脂肪分解，降低血脂',
          timing: '暴食后30分钟',
          duration: '当天饮用2-3次'
        },
        {
          id: 'overeat_2',
          name: '山楂水',
          desc: '促进消化，降脂，健胃消食',
          icon: '🍒',
          recipe: '干山楂10g + 热水500ml + 蜂蜜适量',
          detailedSteps: [
            '干山楂洗净',
            '放入杯中，倒入热水',
            '浸泡10-15分钟',
            '可加入少量蜂蜜调味',
            '趁热饮用'
          ],
          calories: 40,
          nutrition: {
            carbs: 8,
            protein: 0.5,
            fat: 0.2,
            fiber: 2
          },
          tags: ['助消化', '降脂', '健胃', '消食'],
          benefits: ['促进胃酸分泌', '助消化', '降低血脂', '健胃'],
          tips: ['胃酸过多者慎用', '可加入陈皮增强效果', '饭后饮用'],
          science: '山楂含有有机酸，可以促进胃酸分泌，帮助消化，同时有降脂作用',
          timing: '暴食后1小时',
          duration: '当天饮用2-3次'
        },
        {
          id: 'overeat_3',
          name: '轻食沙拉',
          desc: '低卡高纤，清理肠胃，补充维生素',
          icon: '🥗',
          recipe: '生菜100g + 黄瓜50g + 番茄50g + 鸡胸肉80g + 橄榄油5ml',
          detailedSteps: [
            '生菜、黄瓜、番茄洗净切块',
            '鸡胸肉煮熟或烤熟，切块',
            '所有食材混合',
            '用橄榄油、柠檬汁、盐调味',
            '拌匀即可食用'
          ],
          calories: 150,
          nutrition: {
            carbs: 8,
            protein: 20,
            fat: 6,
            fiber: 3,
            vitaminC: 30
          },
          tags: ['低卡', '高纤', '轻食', '高蛋白'],
          benefits: ['低热量', '高纤维', '清理肠胃', '补充维生素'],
          tips: ['下一餐可替换为轻食', '避免高热量酱料', '可长期食用'],
          science: '高纤维食物可以促进肠道蠕动，帮助清理肠胃，低热量有助于控制体重',
          timing: '暴食后下一餐',
          duration: '持续1-2天'
        },
        {
          id: 'overeat_4',
          name: '苹果醋',
          desc: '促进消化，调节血糖，助减肥',
          icon: '🍎',
          recipe: '苹果醋10ml + 温水200ml + 蜂蜜5ml',
          detailedSteps: [
            '取10ml苹果醋',
            '加入200ml温水',
            '可加入少量蜂蜜调味',
            '搅拌均匀',
            '饭后30分钟饮用'
          ],
          calories: 25,
          nutrition: {
            carbs: 5,
            protein: 0,
            fat: 0,
            fiber: 0
          },
          tags: ['助消化', '调节血糖', '减肥', '排毒'],
          benefits: ['促进消化', '调节血糖', '降低食欲', '排毒'],
          tips: ['避免空腹饮用', '稀释后饮用', '每天1-2次'],
          science: '苹果醋中的醋酸可以促进消化，调节血糖，有助于控制体重',
          timing: '暴食后30分钟',
          duration: '当天饮用1-2次'
        }
      ],
      stomachache: [
        {
          id: 'stomachache_1',
          name: '白粥',
          desc: '温和养胃，易消化，不刺激',
          icon: '🍚',
          recipe: '大米100g + 水800ml',
          detailedSteps: [
            '大米洗净',
            '锅中加水，大火煮沸',
            '转小火，慢煮40-60分钟',
            '煮至米粒开花，粥粘稠',
            '趁热食用，可配咸菜'
          ],
          calories: 100,
          nutrition: {
            carbs: 25,
            protein: 2,
            fat: 0.5,
            fiber: 0.5
          },
          tags: ['养胃', '易消化', '温和', '清淡'],
          benefits: ['保护胃黏膜', '易消化', '不刺激', '补充能量'],
          tips: ['煮得越烂越好', '避免过咸过油', '可加入少量盐'],
          science: '白粥温和不刺激，易于消化，可以保护胃黏膜，适合胃痛时食用',
          timing: '胃痛时或胃痛后',
          duration: '持续1-2天'
        },
        {
          id: 'stomachache_2',
          name: '生姜红糖水',
          desc: '暖胃止痛，驱寒，缓解胃痛',
          icon: '🍯',
          recipe: '生姜3-5片 + 红糖20g + 热水300ml',
          detailedSteps: [
            '生姜切片',
            '锅中加水，放入姜片',
            '大火煮沸，转小火煮5分钟',
            '加入红糖，搅拌至溶解',
            '趁热饮用'
          ],
          calories: 60,
          nutrition: {
            carbs: 15,
            protein: 0.5,
            fat: 0,
            fiber: 0
          },
          tags: ['暖胃', '止痛', '驱寒', '温中'],
          benefits: ['缓解胃痛', '驱寒暖胃', '促进血液循环', '缓解恶心'],
          tips: ['趁热饮用效果最佳', '可加入红枣', '避免过甜'],
          science: '生姜中的姜辣素可以促进血液循环，暖胃止痛，红糖可以补充能量',
          timing: '胃痛时立即饮用',
          duration: '当天饮用2-3次'
        },
        {
          id: 'stomachache_3',
          name: '小米南瓜粥',
          desc: '养胃护胃，易消化，营养丰富',
          icon: '🎃',
          recipe: '小米80g + 南瓜100g + 水600ml',
          detailedSteps: [
            '小米洗净，南瓜切块',
            '锅中加水，放入小米和南瓜',
            '大火煮沸，转小火慢煮30分钟',
            '煮至粘稠，南瓜软烂',
            '可加入少量盐调味'
          ],
          calories: 130,
          nutrition: {
            carbs: 28,
            protein: 3,
            fat: 1,
            fiber: 2,
            vitaminA: 500
          },
          tags: ['养胃', '易消化', '营养', '温和'],
          benefits: ['保护胃黏膜', '易消化', '补充维生素', '缓解胃痛'],
          tips: ['南瓜要煮烂', '可加入少量枸杞', '适合长期食用'],
          science: '小米和南瓜都易于消化，富含营养，可以保护胃黏膜，适合胃痛时食用',
          timing: '胃痛时或胃痛后',
          duration: '持续2-3天'
        }
      ],
      stress: [
        {
          id: 'stress_1',
          name: '玫瑰花茶',
          desc: '疏肝解郁，缓解压力，改善情绪',
          icon: '🌹',
          recipe: '干玫瑰花5g + 热水300ml + 蜂蜜适量',
          detailedSteps: [
            '准备干玫瑰花',
            '用热水冲洗一遍',
            '放入杯中，倒入热水',
            '浸泡5-10分钟',
            '可加入蜂蜜调味'
          ],
          calories: 20,
          nutrition: {
            carbs: 3,
            protein: 0.5,
            fat: 0,
            fiber: 1
          },
          tags: ['解郁', '缓解压力', '改善情绪', '安神'],
          benefits: ['缓解压力', '改善情绪', '疏肝解郁', '安神'],
          tips: ['可加入少量柠檬', '睡前2小时避免饮用', '可长期饮用'],
          science: '玫瑰花含有挥发油，可以舒缓情绪，缓解压力，改善睡眠',
          timing: '压力大时随时饮用',
          duration: '持续3-5天'
        },
        {
          id: 'stress_2',
          name: '香蕉',
          desc: '补充镁元素，缓解压力，改善情绪',
          icon: '🍌',
          recipe: '香蕉1-2根',
          detailedSteps: [
            '选择成熟的香蕉',
            '直接食用',
            '可搭配酸奶或燕麦'
          ],
          calories: 90,
          nutrition: {
            carbs: 22,
            protein: 1,
            fat: 0.3,
            fiber: 2,
            magnesium: 30,
            potassium: 400
          },
          tags: ['缓解压力', '改善情绪', '补充镁', '高钾'],
          benefits: ['补充镁元素', '缓解压力', '改善情绪', '稳定血糖'],
          tips: ['选择成熟香蕉', '可搭配坚果', '每天1-2根'],
          science: '香蕉富含镁和钾，可以缓解压力，改善情绪，稳定血糖',
          timing: '压力大时随时食用',
          duration: '持续3-5天'
        },
        {
          id: 'stress_3',
          name: '黑巧克力',
          desc: '提升血清素，改善情绪，缓解压力',
          icon: '🍫',
          recipe: '黑巧克力（70%以上可可）20-30g',
          detailedSteps: [
            '选择70%以上可可含量的黑巧克力',
            '每次20-30g',
            '慢慢品味，不要一次吃完'
          ],
          calories: 150,
          nutrition: {
            carbs: 12,
            protein: 3,
            fat: 10,
            fiber: 3,
            magnesium: 60
          },
          tags: ['改善情绪', '缓解压力', '抗氧化', '提神'],
          benefits: ['提升血清素', '改善情绪', '缓解压力', '抗氧化'],
          tips: ['选择高可可含量', '适量食用', '避免过量'],
          science: '黑巧克力中的可可碱和苯乙胺可以提升血清素，改善情绪，缓解压力',
          timing: '压力大时适量食用',
          duration: '每天20-30g'
        }
      ],
      fatigue: [
        {
          id: 'fatigue_1',
          name: '红枣桂圆茶',
          desc: '补气养血，恢复体力，改善疲劳',
          icon: '🍵',
          recipe: '红枣5颗 + 桂圆10g + 热水500ml',
          detailedSteps: [
            '红枣去核，桂圆去壳',
            '放入杯中，倒入热水',
            '浸泡10-15分钟',
            '可加入少量红糖',
            '趁热饮用'
          ],
          calories: 60,
          nutrition: {
            carbs: 15,
            protein: 1,
            fat: 0.3,
            fiber: 1,
            iron: 2
          },
          tags: ['补气', '养血', '恢复体力', '改善疲劳'],
          benefits: ['补气养血', '恢复体力', '改善疲劳', '提升免疫力'],
          tips: ['可加入枸杞', '长期饮用效果更好', '避免过量'],
          science: '红枣和桂圆都富含铁和糖分，可以补气养血，恢复体力',
          timing: '疲劳时随时饮用',
          duration: '持续3-5天'
        },
        {
          id: 'fatigue_2',
          name: '鸡蛋',
          desc: '补充蛋白质，恢复体力，提升能量',
          icon: '🥚',
          recipe: '鸡蛋1-2个，水煮或蒸',
          detailedSteps: [
            '鸡蛋洗净',
            '水煮8-10分钟（全熟）',
            '或蒸10-12分钟',
            '去壳食用',
            '可配少量盐'
          ],
          calories: 140,
          nutrition: {
            carbs: 1,
            protein: 13,
            fat: 10,
            fiber: 0,
            vitaminB12: 1.1
          },
          tags: ['高蛋白', '恢复体力', '补充能量', '营养'],
          benefits: ['补充蛋白质', '恢复体力', '提升能量', '补充维生素'],
          tips: ['水煮或蒸最佳', '避免油炸', '每天1-2个'],
          science: '鸡蛋是优质蛋白质来源，可以快速补充体力，恢复能量',
          timing: '疲劳时或疲劳后',
          duration: '每天1-2个'
        },
        {
          id: 'fatigue_3',
          name: '坚果',
          desc: '补充能量，恢复体力，提供健康脂肪',
          icon: '🥜',
          recipe: '混合坚果（核桃、杏仁、腰果）30g',
          detailedSteps: [
            '选择无盐无糖的坚果',
            '每次30g（约一小把）',
            '慢慢咀嚼',
            '可搭配酸奶或水果'
          ],
          calories: 180,
          nutrition: {
            carbs: 6,
            protein: 6,
            fat: 16,
            fiber: 3,
            magnesium: 80
          },
          tags: ['补充能量', '恢复体力', '健康脂肪', '高营养'],
          benefits: ['快速补充能量', '恢复体力', '提供健康脂肪', '补充镁'],
          tips: ['选择原味坚果', '适量食用', '避免过量'],
          science: '坚果富含健康脂肪和蛋白质，可以快速补充能量，恢复体力',
          timing: '疲劳时随时食用',
          duration: '每天30g'
        }
      ],
      insomnia: [
        {
          id: 'insomnia_1',
          name: '热牛奶',
          desc: '促进睡眠，安神助眠，补充钙质',
          icon: '🥛',
          recipe: '牛奶200ml，加热至40-50°C',
          detailedSteps: [
            '准备200ml牛奶',
            '加热至40-50°C（温热）',
            '可加入少量蜂蜜',
            '睡前1小时饮用',
            '慢慢饮用'
          ],
          calories: 130,
          nutrition: {
            carbs: 10,
            protein: 6,
            fat: 5,
            fiber: 0,
            calcium: 240,
            tryptophan: 200
          },
          tags: ['助眠', '安神', '补钙', '促进睡眠'],
          benefits: ['促进睡眠', '安神助眠', '补充钙质', '缓解焦虑'],
          tips: ['睡前1小时饮用', '温热效果更好', '可加入少量蜂蜜'],
          science: '牛奶中的色氨酸可以促进血清素和褪黑素生成，有助于睡眠',
          timing: '睡前1小时',
          duration: '持续3-5天'
        },
        {
          id: 'insomnia_2',
          name: '香蕉',
          desc: '促进睡眠，补充镁，改善睡眠质量',
          icon: '🍌',
          recipe: '香蕉1根，睡前1小时食用',
          detailedSteps: [
            '选择成熟的香蕉',
            '睡前1小时食用',
            '可搭配热牛奶',
            '慢慢咀嚼'
          ],
          calories: 90,
          nutrition: {
            carbs: 22,
            protein: 1,
            fat: 0.3,
            fiber: 2,
            magnesium: 30,
            tryptophan: 10
          },
          tags: ['助眠', '改善睡眠', '补充镁', '促进睡眠'],
          benefits: ['促进睡眠', '补充镁', '改善睡眠质量', '缓解焦虑'],
          tips: ['睡前1小时食用', '可搭配热牛奶', '避免过量'],
          science: '香蕉富含镁和色氨酸，可以促进睡眠，改善睡眠质量',
          timing: '睡前1小时',
          duration: '持续3-5天'
        },
        {
          id: 'insomnia_3',
          name: '酸枣仁茶',
          desc: '安神助眠，改善失眠，缓解焦虑',
          icon: '🌿',
          recipe: '酸枣仁10g + 热水300ml',
          detailedSteps: [
            '准备酸枣仁',
            '用热水冲洗一遍',
            '放入杯中，倒入热水',
            '浸泡10-15分钟',
            '睡前1小时饮用'
          ],
          calories: 15,
          nutrition: {
            carbs: 2,
            protein: 0.5,
            fat: 0.2,
            fiber: 1
          },
          tags: ['助眠', '安神', '改善失眠', '缓解焦虑'],
          benefits: ['安神助眠', '改善失眠', '缓解焦虑', '提升睡眠质量'],
          tips: ['睡前1小时饮用', '可长期饮用', '避免过量'],
          science: '酸枣仁是传统助眠中药，可以安神助眠，改善失眠',
          timing: '睡前1小时',
          duration: '持续5-7天'
        }
      ],
      indigestion: [
        {
          id: 'indigestion_1',
          name: '白萝卜汤',
          desc: '促进消化，消食化积，缓解腹胀',
          icon: '🥕',
          recipe: '白萝卜200g + 水500ml + 少量盐',
          detailedSteps: [
            '白萝卜洗净切块',
            '锅中加水，放入白萝卜',
            '大火煮沸，转小火煮20分钟',
            '加入少量盐调味',
            '趁热食用'
          ],
          calories: 40,
          nutrition: {
            carbs: 8,
            protein: 1,
            fat: 0.2,
            fiber: 2
          },
          tags: ['助消化', '消食', '缓解腹胀', '通气'],
          benefits: ['促进消化', '消食化积', '缓解腹胀', '通气'],
          tips: ['可加入少量生姜', '趁热食用', '避免过咸'],
          science: '白萝卜含有消化酶，可以促进消化，缓解腹胀',
          timing: '消化不良时立即食用',
          duration: '当天食用1-2次'
        },
        {
          id: 'indigestion_2',
          name: '酸奶',
          desc: '补充益生菌，促进消化，改善肠道',
          icon: '🥛',
          recipe: '原味酸奶200ml',
          detailedSteps: [
            '选择原味酸奶',
            '避免过冷或过热',
            '饭后30分钟饮用',
            '慢慢饮用'
          ],
          calories: 120,
          nutrition: {
            carbs: 15,
            protein: 6,
            fat: 4,
            fiber: 0,
            probiotics: 1000000000
          },
          tags: ['助消化', '益生菌', '改善肠道', '促进消化'],
          benefits: ['补充益生菌', '促进消化', '改善肠道', '缓解腹胀'],
          tips: ['选择原味酸奶', '饭后30分钟饮用', '可长期食用'],
          science: '酸奶中的益生菌可以改善肠道菌群，促进消化',
          timing: '饭后30分钟',
          duration: '每天1-2次'
        },
        {
          id: 'indigestion_3',
          name: '陈皮茶',
          desc: '理气消食，促进消化，缓解腹胀',
          icon: '🍊',
          recipe: '陈皮5g + 热水300ml',
          detailedSteps: [
            '准备陈皮',
            '用热水冲洗一遍',
            '放入杯中，倒入热水',
            '浸泡10-15分钟',
            '可加入少量蜂蜜'
          ],
          calories: 10,
          nutrition: {
            carbs: 2,
            protein: 0.3,
            fat: 0.1,
            fiber: 1
          },
          tags: ['助消化', '理气', '消食', '缓解腹胀'],
          benefits: ['理气消食', '促进消化', '缓解腹胀', '改善食欲'],
          tips: ['饭后30分钟饮用', '可长期饮用', '避免过量'],
          science: '陈皮含有挥发油，可以促进胃酸分泌，帮助消化',
          timing: '饭后30分钟',
          duration: '持续3-5天'
        }
      ],
      cold: [
        {
          id: 'cold_1',
          name: '姜茶',
          desc: '驱寒暖身，缓解感冒症状',
          icon: '☕',
          recipe: '生姜5片 + 红糖20g + 热水300ml',
          detailedSteps: [
            '生姜切片',
            '锅中加水，放入姜片',
            '大火煮沸，转小火煮5分钟',
            '加入红糖，搅拌至溶解',
            '趁热饮用，可加入柠檬'
          ],
          calories: 60,
          nutrition: {
            carbs: 15,
            protein: 0.5,
            fat: 0,
            fiber: 0,
            vitaminC: 5
          },
          tags: ['驱寒', '暖身', '缓解感冒', '发汗'],
          benefits: ['驱寒暖身', '缓解鼻塞', '促进发汗', '提升免疫力'],
          tips: ['趁热饮用效果最佳', '可加入柠檬增强维C', '避免过甜'],
          science: '生姜中的姜辣素可以促进血液循环，发汗解表，红糖可以补充能量',
          timing: '感冒初期或感觉发冷时',
          duration: '持续2-3天，每天2-3次'
        },
        {
          id: 'cold_2',
          name: '柠檬蜂蜜水',
          desc: '补充维C，增强免疫力，缓解喉咙不适',
          icon: '🍋',
          recipe: '柠檬1个 + 蜂蜜2勺 + 温水500ml',
          detailedSteps: [
            '柠檬切片',
            '取2勺蜂蜜',
            '将柠檬片和蜂蜜放入杯中',
            '倒入温水（40-50°C）',
            '搅拌均匀，趁热饮用'
          ],
          calories: 80,
          nutrition: {
            carbs: 20,
            protein: 0.5,
            fat: 0,
            fiber: 1,
            vitaminC: 50
          },
          tags: ['维C', '增强免疫', '缓解喉咙', '补水'],
          benefits: ['补充维生素C', '增强免疫力', '缓解喉咙不适', '促进恢复'],
          tips: ['避免用开水，会破坏维C', '可加入少量盐', '每天2-3次'],
          science: '柠檬富含维生素C，可以增强免疫力，蜂蜜有润喉作用',
          timing: '感冒期间随时饮用',
          duration: '持续3-5天'
        },
        {
          id: 'cold_3',
          name: '白萝卜汤',
          desc: '清热解毒，化痰止咳，缓解感冒',
          icon: '🥕',
          recipe: '白萝卜200g + 水500ml + 少量盐',
          detailedSteps: [
            '白萝卜洗净切块',
            '锅中加水，放入白萝卜',
            '大火煮沸，转小火煮30分钟',
            '加入少量盐调味',
            '趁热食用，可配香菜'
          ],
          calories: 40,
          nutrition: {
            carbs: 8,
            protein: 1,
            fat: 0.2,
            fiber: 2,
            vitaminC: 20
          },
          tags: ['清热解毒', '化痰', '止咳', '缓解感冒'],
          benefits: ['清热解毒', '化痰止咳', '缓解鼻塞', '促进恢复'],
          tips: ['可加入少量生姜', '趁热食用', '避免过咸'],
          science: '白萝卜含有多种维生素和矿物质，可以清热解毒，化痰止咳',
          timing: '感冒期间随时食用',
          duration: '持续3-5天'
        },
        {
          id: 'cold_4',
          name: '鸡汤',
          desc: '补充营养，增强体力，促进恢复',
          icon: '🍲',
          recipe: '鸡肉200g + 水1000ml + 姜片 + 盐',
          detailedSteps: [
            '鸡肉洗净切块',
            '锅中加水，放入鸡肉和姜片',
            '大火煮沸，撇去浮沫',
            '转小火慢炖1小时',
            '加入盐调味即可'
          ],
          calories: 250,
          nutrition: {
            carbs: 2,
            protein: 30,
            fat: 12,
            fiber: 0,
            zinc: 3
          },
          tags: ['补充营养', '增强体力', '高蛋白', '促进恢复'],
          benefits: ['补充蛋白质', '增强体力', '促进恢复', '提升免疫力'],
          tips: ['可加入红枣、枸杞', '趁热食用', '避免过油'],
          science: '鸡汤富含蛋白质和氨基酸，可以补充营养，增强体力，促进恢复',
          timing: '感冒期间午餐或晚餐',
          duration: '持续2-3天'
        }
      ],
      constipation: [
        {
          id: 'constipation_1',
          name: '香蕉',
          desc: '润肠通便，补充纤维，促进排便',
          icon: '🍌',
          recipe: '香蕉1-2根',
          detailedSteps: [
            '选择成熟的香蕉',
            '直接食用',
            '可搭配温水',
            '每天1-2次'
          ],
          calories: 90,
          nutrition: {
            carbs: 22,
            protein: 1,
            fat: 0.3,
            fiber: 2,
            potassium: 400
          },
          tags: ['润肠', '通便', '高纤维', '促进排便'],
          benefits: ['润肠通便', '补充纤维', '促进肠道蠕动', '缓解便秘'],
          tips: ['选择成熟香蕉', '可搭配温水', '每天1-2根'],
          science: '香蕉富含纤维和果胶，可以促进肠道蠕动，润肠通便',
          timing: '早晨空腹或饭后1小时',
          duration: '持续3-5天'
        },
        {
          id: 'constipation_2',
          name: '火龙果',
          desc: '高纤维，促进排便，改善便秘',
          icon: '🐉',
          recipe: '火龙果1个（约300g）',
          detailedSteps: [
            '选择新鲜火龙果',
            '去皮切块',
            '直接食用',
            '可搭配酸奶'
          ],
          calories: 150,
          nutrition: {
            carbs: 30,
            protein: 2,
            fat: 0.5,
            fiber: 5,
            vitaminC: 60
          },
          tags: ['高纤维', '促进排便', '改善便秘', '润肠'],
          benefits: ['高纤维促进排便', '改善便秘', '润肠通便', '补充维C'],
          tips: ['选择新鲜火龙果', '可搭配酸奶', '每天1个'],
          science: '火龙果富含膳食纤维，可以促进肠道蠕动，改善便秘',
          timing: '早晨空腹或饭后1小时',
          duration: '持续3-5天'
        },
        {
          id: 'constipation_3',
          name: '蜂蜜水',
          desc: '润肠通便，软化大便，促进排便',
          icon: '🍯',
          recipe: '蜂蜜2勺 + 温水300ml',
          detailedSteps: [
            '取2勺纯蜂蜜（约30ml）',
            '加入300ml温水（40-50°C）',
            '搅拌均匀',
            '早晨空腹饮用'
          ],
          calories: 90,
          nutrition: {
            carbs: 22,
            protein: 0.3,
            fat: 0,
            fiber: 0
          },
          tags: ['润肠', '通便', '软化大便', '促进排便'],
          benefits: ['润肠通便', '软化大便', '促进排便', '缓解便秘'],
          tips: ['早晨空腹饮用', '避免用开水', '每天1次'],
          science: '蜂蜜有润肠通便的作用，可以软化大便，促进排便',
          timing: '早晨空腹',
          duration: '持续3-5天'
        },
        {
          id: 'constipation_4',
          name: '燕麦粥',
          desc: '高纤维，促进肠道蠕动，改善便秘',
          icon: '🥣',
          recipe: '燕麦50g + 水300ml + 少量蜂蜜',
          detailedSteps: [
            '燕麦洗净',
            '锅中加水，放入燕麦',
            '大火煮沸，转小火煮10分钟',
            '加入少量蜂蜜调味',
            '趁热食用'
          ],
          calories: 180,
          nutrition: {
            carbs: 35,
            protein: 6,
            fat: 3,
            fiber: 5
          },
          tags: ['高纤维', '促进蠕动', '改善便秘', '营养'],
          benefits: ['高纤维促进蠕动', '改善便秘', '补充营养', '饱腹感强'],
          tips: ['可加入水果', '趁热食用', '每天1-2次'],
          science: '燕麦富含膳食纤维，可以促进肠道蠕动，改善便秘',
          timing: '早晨或午餐',
          duration: '持续3-5天'
        },
        {
          id: 'constipation_5',
          name: '西梅',
          desc: '天然通便，促进排便，改善便秘',
          icon: '🟣',
          recipe: '西梅5-8颗',
          detailedSteps: [
            '选择新鲜或干西梅',
            '直接食用',
            '可搭配温水',
            '每天1-2次'
          ],
          calories: 120,
          nutrition: {
            carbs: 28,
            protein: 1,
            fat: 0.3,
            fiber: 4,
            sorbitol: 5
          },
          tags: ['天然通便', '促进排便', '改善便秘', '高纤维'],
          benefits: ['天然通便', '促进排便', '改善便秘', '补充纤维'],
          tips: ['选择新鲜或干西梅', '可搭配温水', '每天5-8颗'],
          science: '西梅含有天然的山梨糖醇和纤维，可以促进肠道蠕动，改善便秘',
          timing: '早晨空腹或饭后1小时',
          duration: '持续3-5天'
        }
      ],
      skin: [
        {
          id: 'skin_1',
          name: '银耳莲子汤',
          desc: '滋阴润燥，美容养颜，改善皮肤',
          icon: '🍨',
          recipe: '银耳20g + 莲子30g + 红枣5颗 + 冰糖适量',
          detailedSteps: [
            '银耳提前泡发，撕成小朵',
            '莲子去芯，红枣去核',
            '所有材料放入锅中，加水1000ml',
            '大火煮沸，转小火慢炖1小时',
            '加入冰糖调味即可'
          ],
          calories: 150,
          nutrition: {
            carbs: 30,
            protein: 3,
            fat: 0.5,
            fiber: 3,
            collagen: 2
          },
          tags: ['美容', '养颜', '润燥', '改善皮肤'],
          benefits: ['美容养颜', '滋阴润燥', '补充胶原蛋白', '改善皮肤'],
          tips: ['可加入百合增强效果', '可长期食用', '避免过甜'],
          science: '银耳富含胶质和多种氨基酸，可以补充胶原蛋白，改善皮肤',
          timing: '每天1-2次',
          duration: '持续1-2周'
        },
        {
          id: 'skin_2',
          name: '番茄',
          desc: '抗氧化，美白，改善皮肤',
          icon: '🍅',
          recipe: '番茄1-2个，生吃或做汤',
          detailedSteps: [
            '选择新鲜番茄',
            '洗净后直接食用',
            '或做成番茄汤',
            '每天1-2个'
          ],
          calories: 30,
          nutrition: {
            carbs: 6,
            protein: 1,
            fat: 0.2,
            fiber: 1,
            lycopene: 5,
            vitaminC: 20
          },
          tags: ['抗氧化', '美白', '改善皮肤', '维C'],
          benefits: ['抗氧化', '美白', '改善皮肤', '补充维C'],
          tips: ['生吃或做汤', '可搭配橄榄油', '每天1-2个'],
          science: '番茄富含番茄红素和维生素C，可以抗氧化，美白，改善皮肤',
          timing: '随时食用',
          duration: '持续1-2周'
        },
        {
          id: 'skin_3',
          name: '柠檬蜂蜜水',
          desc: '美白，抗氧化，改善皮肤',
          icon: '🍋',
          recipe: '柠檬1个 + 蜂蜜2勺 + 温水500ml',
          detailedSteps: [
            '柠檬切片',
            '取2勺蜂蜜',
            '将柠檬片和蜂蜜放入杯中',
            '倒入温水（40-50°C）',
            '搅拌均匀，每天1-2次'
          ],
          calories: 80,
          nutrition: {
            carbs: 20,
            protein: 0.5,
            fat: 0,
            fiber: 1,
            vitaminC: 50
          },
          tags: ['美白', '抗氧化', '改善皮肤', '维C'],
          benefits: ['美白', '抗氧化', '改善皮肤', '补充维C'],
          tips: ['避免用开水', '可长期饮用', '每天1-2次'],
          science: '柠檬富含维生素C，可以美白，抗氧化，改善皮肤',
          timing: '早晨空腹或饭后',
          duration: '持续1-2周'
        },
        {
          id: 'skin_4',
          name: '坚果',
          desc: '补充维生素E，抗氧化，改善皮肤',
          icon: '🥜',
          recipe: '混合坚果（核桃、杏仁、腰果）30g',
          detailedSteps: [
            '选择无盐无糖的坚果',
            '每次30g（约一小把）',
            '慢慢咀嚼',
            '每天1次'
          ],
          calories: 180,
          nutrition: {
            carbs: 6,
            protein: 6,
            fat: 16,
            fiber: 3,
            vitaminE: 8
          },
          tags: ['维E', '抗氧化', '改善皮肤', '健康脂肪'],
          benefits: ['补充维生素E', '抗氧化', '改善皮肤', '提供健康脂肪'],
          tips: ['选择原味坚果', '适量食用', '每天30g'],
          science: '坚果富含维生素E和健康脂肪，可以抗氧化，改善皮肤',
          timing: '随时食用',
          duration: '持续1-2周'
        }
      ],
      menstrual: [
        {
          id: 'menstrual_1',
          name: '红糖姜茶',
          desc: '暖宫止痛，缓解痛经，改善经期不适',
          icon: '☕',
          recipe: '生姜5片 + 红糖30g + 热水300ml',
          detailedSteps: [
            '生姜切片',
            '锅中加水，放入姜片',
            '大火煮沸，转小火煮5分钟',
            '加入红糖，搅拌至溶解',
            '趁热饮用'
          ],
          calories: 90,
          nutrition: {
            carbs: 22,
            protein: 0.5,
            fat: 0,
            fiber: 0,
            iron: 2
          },
          tags: ['暖宫', '止痛', '缓解痛经', '补血'],
          benefits: ['暖宫止痛', '缓解痛经', '改善经期不适', '补充铁质'],
          tips: ['趁热饮用效果最佳', '可加入红枣', '经期每天2-3次'],
          science: '生姜可以促进血液循环，红糖可以补充铁质，缓解痛经',
          timing: '经期感觉不适时',
          duration: '经期持续饮用'
        },
        {
          id: 'menstrual_2',
          name: '红枣桂圆茶',
          desc: '补血养气，缓解疲劳，改善经期不适',
          icon: '🍵',
          recipe: '红枣5颗 + 桂圆10g + 热水500ml',
          detailedSteps: [
            '红枣去核，桂圆去壳',
            '放入杯中，倒入热水',
            '浸泡10-15分钟',
            '可加入少量红糖',
            '趁热饮用'
          ],
          calories: 60,
          nutrition: {
            carbs: 15,
            protein: 1,
            fat: 0.3,
            fiber: 1,
            iron: 2
          },
          tags: ['补血', '养气', '缓解疲劳', '改善不适'],
          benefits: ['补血养气', '缓解疲劳', '改善经期不适', '补充铁质'],
          tips: ['可加入枸杞', '可长期饮用', '经期每天2-3次'],
          science: '红枣和桂圆都富含铁和糖分，可以补血养气，缓解疲劳',
          timing: '经期随时饮用',
          duration: '经期持续饮用'
        },
        {
          id: 'menstrual_3',
          name: '黑芝麻',
          desc: '补血补铁，改善经期不适',
          icon: '⚫',
          recipe: '黑芝麻20g，可直接食用或做成糊',
          detailedSteps: [
            '选择炒熟的黑芝麻',
            '可直接食用',
            '或磨成粉做成糊',
            '每天1-2次'
          ],
          calories: 120,
          nutrition: {
            carbs: 4,
            protein: 4,
            fat: 10,
            fiber: 2,
            iron: 5,
            calcium: 200
          },
          tags: ['补血', '补铁', '改善不适', '高钙'],
          benefits: ['补血补铁', '改善经期不适', '补充钙质', '提供营养'],
          tips: ['可做成芝麻糊', '可长期食用', '每天20g'],
          science: '黑芝麻富含铁和钙，可以补血补铁，改善经期不适',
          timing: '经期随时食用',
          duration: '经期持续食用'
        },
        {
          id: 'menstrual_4',
          name: '猪肝汤',
          desc: '补血补铁，改善贫血，缓解经期不适',
          icon: '🍲',
          recipe: '猪肝100g + 菠菜200g + 姜片 + 水500ml',
          detailedSteps: [
            '猪肝切片，用盐水浸泡30分钟去腥',
            '菠菜洗净切段',
            '锅中加水，放入姜片煮沸',
            '加入猪肝，煮3-5分钟',
            '加入菠菜，再煮2分钟，调味即可'
          ],
          calories: 180,
          nutrition: {
            carbs: 5,
            protein: 20,
            fat: 8,
            fiber: 2,
            iron: 25,
            vitaminA: 5000
          },
          tags: ['补血', '补铁', '改善贫血', '高蛋白'],
          benefits: ['补血补铁', '改善贫血', '缓解经期不适', '提升免疫力'],
          tips: ['猪肝要彻底煮熟', '可加入少量枸杞', '每周1-2次'],
          science: '猪肝富含铁和维生素A，菠菜也含铁，两者搭配补血效果更好',
          timing: '经期午餐或晚餐',
          duration: '经期每周1-2次'
        }
      ],
      headache: [
        {
          id: 'headache_1',
          name: '薄荷茶',
          desc: '缓解头痛，提神醒脑，舒缓神经',
          icon: '🌿',
          recipe: '薄荷叶5g + 热水300ml',
          detailedSteps: [
            '准备新鲜或干薄荷叶',
            '用热水冲洗一遍',
            '放入杯中，倒入热水',
            '浸泡5-10分钟',
            '可加入少量蜂蜜'
          ],
          calories: 5,
          nutrition: {
            carbs: 1,
            protein: 0.2,
            fat: 0,
            fiber: 0.5,
            menthol: 0.1
          },
          tags: ['缓解头痛', '提神', '醒脑', '舒缓'],
          benefits: ['缓解头痛', '提神醒脑', '舒缓神经', '改善不适'],
          tips: ['可加入柠檬', '可长期饮用', '头痛时随时饮用'],
          science: '薄荷中的薄荷醇可以舒缓神经，缓解头痛',
          timing: '头痛时立即饮用',
          duration: '持续2-3天'
        },
        {
          id: 'headache_2',
          name: '热敷',
          desc: '缓解紧张性头痛，放松肌肉',
          icon: '🔥',
          recipe: '热毛巾或热水袋',
          detailedSteps: [
            '准备热毛巾或热水袋',
            '温度40-50°C',
            '敷在额头或后颈',
            '每次15-20分钟',
            '可重复2-3次'
          ],
          calories: 0,
          nutrition: {},
          tags: ['缓解头痛', '放松', '舒缓', '物理治疗'],
          benefits: ['缓解紧张性头痛', '放松肌肉', '舒缓神经', '改善不适'],
          tips: ['温度不要过高', '可配合按摩', '每天2-3次'],
          science: '热敷可以促进血液循环，放松肌肉，缓解紧张性头痛',
          timing: '头痛时立即使用',
          duration: '持续2-3天'
        },
        {
          id: 'headache_3',
          name: '充足水分',
          desc: '补充水分，缓解脱水性头痛',
          icon: '💧',
          recipe: '温水500ml，慢慢饮用',
          detailedSteps: [
            '准备温水',
            '慢慢饮用',
            '每次200-300ml',
            '每天至少8杯水'
          ],
          calories: 0,
          nutrition: {},
          tags: ['补水', '缓解头痛', '健康', '必需'],
          benefits: ['补充水分', '缓解脱水性头痛', '促进新陈代谢', '改善不适'],
          tips: ['慢慢饮用', '避免一次性大量饮水', '每天至少8杯'],
          science: '脱水是头痛的常见原因，补充充足水分可以缓解头痛',
          timing: '随时饮用',
          duration: '长期坚持'
        }
      ],
      sorethroat: [
        {
          id: 'sorethroat_1',
          name: '蜂蜜柠檬水',
          desc: '润喉止咳，缓解喉咙痛，增强免疫力',
          icon: '🍋',
          recipe: '柠檬1个 + 蜂蜜2勺 + 温水500ml',
          detailedSteps: [
            '柠檬切片',
            '取2勺蜂蜜',
            '将柠檬片和蜂蜜放入杯中',
            '倒入温水（40-50°C）',
            '搅拌均匀，慢慢饮用'
          ],
          calories: 80,
          nutrition: {
            carbs: 20,
            protein: 0.5,
            fat: 0,
            fiber: 1,
            vitaminC: 50
          },
          tags: ['润喉', '止咳', '缓解疼痛', '维C'],
          benefits: ['润喉止咳', '缓解喉咙痛', '增强免疫力', '促进恢复'],
          tips: ['避免用开水', '慢慢饮用', '每天3-4次'],
          science: '蜂蜜有润喉作用，柠檬富含维C，可以缓解喉咙痛，增强免疫力',
          timing: '喉咙痛时随时饮用',
          duration: '持续3-5天'
        },
        {
          id: 'sorethroat_2',
          name: '盐水漱口',
          desc: '消炎杀菌，缓解喉咙痛',
          icon: '🧂',
          recipe: '盐5g + 温水200ml',
          detailedSteps: [
            '准备温水和盐',
            '将5g盐加入200ml温水',
            '搅拌均匀',
            '含在口中漱口30秒',
            '每天3-4次'
          ],
          calories: 0,
          nutrition: {},
          tags: ['消炎', '杀菌', '缓解疼痛', '物理治疗'],
          benefits: ['消炎杀菌', '缓解喉咙痛', '清洁口腔', '促进恢复'],
          tips: ['温度不要过高', '每次30秒', '每天3-4次'],
          science: '盐水可以消炎杀菌，缓解喉咙痛，促进恢复',
          timing: '喉咙痛时随时使用',
          duration: '持续3-5天'
        },
        {
          id: 'sorethroat_3',
          name: '梨汤',
          desc: '润肺止咳，缓解喉咙痛，改善不适',
          icon: '🍐',
          recipe: '梨1个 + 冰糖20g + 水500ml',
          detailedSteps: [
            '梨洗净切块',
            '锅中加水，放入梨块',
            '大火煮沸，转小火煮20分钟',
            '加入冰糖调味',
            '趁热食用'
          ],
          calories: 100,
          nutrition: {
            carbs: 25,
            protein: 0.5,
            fat: 0.2,
            fiber: 3,
            vitaminC: 10
          },
          tags: ['润肺', '止咳', '缓解疼痛', '改善不适'],
          benefits: ['润肺止咳', '缓解喉咙痛', '改善不适', '促进恢复'],
          tips: ['可加入少量川贝', '趁热食用', '每天1-2次'],
          science: '梨有润肺止咳的作用，可以缓解喉咙痛，改善不适',
          timing: '喉咙痛时随时食用',
          duration: '持续3-5天'
        }
      ],
      lowimmunity: [
        {
          id: 'lowimmunity_1',
          name: '鸡汤',
          desc: '补充营养，增强免疫力，提升抵抗力',
          icon: '🍲',
          recipe: '鸡肉200g + 水1000ml + 姜片 + 盐',
          detailedSteps: [
            '鸡肉洗净切块',
            '锅中加水，放入鸡肉和姜片',
            '大火煮沸，撇去浮沫',
            '转小火慢炖1小时',
            '加入盐调味即可'
          ],
          calories: 250,
          nutrition: {
            carbs: 2,
            protein: 30,
            fat: 12,
            fiber: 0,
            zinc: 3
          },
          tags: ['增强免疫', '补充营养', '高蛋白', '提升抵抗力'],
          benefits: ['补充蛋白质', '增强免疫力', '提升抵抗力', '促进恢复'],
          tips: ['可加入红枣、枸杞', '趁热食用', '每周2-3次'],
          science: '鸡汤富含蛋白质和氨基酸，可以增强免疫力，提升抵抗力',
          timing: '每周2-3次',
          duration: '长期坚持'
        },
        {
          id: 'lowimmunity_2',
          name: '维生素C食物',
          desc: '增强免疫力，抗氧化，提升抵抗力',
          icon: '🍊',
          recipe: '橙子、猕猴桃、草莓等富含维C的水果',
          detailedSteps: [
            '选择新鲜水果',
            '直接食用',
            '每天200-300g',
            '可搭配其他食物'
          ],
          calories: 60,
          nutrition: {
            carbs: 15,
            protein: 1,
            fat: 0.2,
            fiber: 2,
            vitaminC: 80
          },
          tags: ['增强免疫', '抗氧化', '维C', '提升抵抗力'],
          benefits: ['增强免疫力', '抗氧化', '提升抵抗力', '促进恢复'],
          tips: ['选择新鲜水果', '每天200-300g', '可长期食用'],
          science: '维生素C可以增强免疫力，抗氧化，提升抵抗力',
          timing: '每天食用',
          duration: '长期坚持'
        },
        {
          id: 'lowimmunity_3',
          name: '大蒜',
          desc: '抗菌消炎，增强免疫力，提升抵抗力',
          icon: '🧄',
          recipe: '大蒜2-3瓣，生吃或做菜',
          detailedSteps: [
            '选择新鲜大蒜',
            '可生吃或做菜',
            '每天2-3瓣',
            '可搭配其他食物'
          ],
          calories: 10,
          nutrition: {
            carbs: 2,
            protein: 0.5,
            fat: 0,
            fiber: 0.3,
            allicin: 0.1
          },
          tags: ['抗菌', '消炎', '增强免疫', '提升抵抗力'],
          benefits: ['抗菌消炎', '增强免疫力', '提升抵抗力', '预防疾病'],
          tips: ['可生吃或做菜', '每天2-3瓣', '可长期食用'],
          science: '大蒜中的大蒜素可以抗菌消炎，增强免疫力，提升抵抗力',
          timing: '每天食用',
          duration: '长期坚持'
        },
        {
          id: 'lowimmunity_4',
          name: '酸奶',
          desc: '补充益生菌，改善肠道，增强免疫力',
          icon: '🥛',
          recipe: '原味酸奶200ml',
          detailedSteps: [
            '选择原味酸奶',
            '避免过冷或过热',
            '每天1-2次',
            '可搭配水果'
          ],
          calories: 120,
          nutrition: {
            carbs: 15,
            protein: 6,
            fat: 4,
            fiber: 0,
            probiotics: 1000000000
          },
          tags: ['益生菌', '改善肠道', '增强免疫', '提升抵抗力'],
          benefits: ['补充益生菌', '改善肠道', '增强免疫力', '提升抵抗力'],
          tips: ['选择原味酸奶', '每天1-2次', '可长期食用'],
          science: '酸奶中的益生菌可以改善肠道菌群，增强免疫力，提升抵抗力',
          timing: '每天1-2次',
          duration: '长期坚持'
        }
      ],
      heat: [
        {
          id: 'heat_1',
          name: '绿豆汤',
          desc: '清热解暑，降火润燥',
          icon: '🫘',
          recipe: '绿豆50g + 水600ml + 冰糖适量',
          detailedSteps: ['绿豆洗净浸泡2小时', '加水煮至开花', '加冰糖调味', '放凉饮用'],
          calories: 80,
          nutrition: { carbs: 15, protein: 4, fat: 0.5, fiber: 2 },
          tags: ['清热', '降火', '解暑'],
          benefits: ['清热降火', '解暑润燥', '利尿'],
          tips: ['可加百合、莲子', '放凉后更解暑'],
          science: '绿豆性凉，能清热解暑、利尿',
          timing: '上火时每日1-2次',
          duration: '连用2-3天'
        },
        {
          id: 'heat_2',
          name: '蜂蜜雪梨水',
          desc: '润燥止咳，缓解咽喉不适',
          icon: '🍐',
          recipe: '雪梨1个 + 蜂蜜1勺 + 水适量',
          detailedSteps: ['雪梨切块', '加水煮15分钟', '放温后加蜂蜜'],
          calories: 60,
          nutrition: { carbs: 15, protein: 0.5, fat: 0, fiber: 2 },
          tags: ['润燥', '止咳', '降火'],
          benefits: ['润肺止咳', '缓解口干', '降火'],
          tips: ['蜂蜜不宜高温', '可加少量枸杞'],
          science: '梨润肺、蜂蜜润燥，适合上火咽喉不适',
          timing: '每日1-2次',
          duration: '2-3天'
        }
      ],
      ulcer: [
        {
          id: 'ulcer_1',
          name: '维生素B2食物',
          desc: '促进黏膜修复，缓解口腔溃疡',
          icon: '🥬',
          recipe: '深色蔬菜、蛋奶、动物肝脏等',
          detailedSteps: ['多吃菠菜、西兰花', '适量蛋奶', '可补充B2片剂'],
          calories: 0,
          nutrition: { carbs: 0, protein: 0, fat: 0, fiber: 0 },
          tags: ['维B2', '黏膜修复', '促愈合'],
          benefits: ['促进溃疡愈合', '预防复发'],
          tips: ['避免辛辣刺激', '少吃过烫食物'],
          science: '维生素B2参与黏膜修复',
          timing: '溃疡期间注意饮食',
          duration: '至愈合'
        },
        {
          id: 'ulcer_2',
          name: '淡盐水漱口',
          desc: '消炎杀菌，保持口腔清洁',
          icon: '🧂',
          recipe: '温水200ml + 盐约2g',
          detailedSteps: ['温水加盐溶解', '饭后漱口30秒', '每日3-4次'],
          calories: 0,
          nutrition: { carbs: 0, protein: 0, fat: 0, fiber: 0 },
          tags: ['消炎', '清洁', '促愈合'],
          benefits: ['减轻疼痛', '加速愈合'],
          tips: ['浓度不宜过高', '避免吞咽'],
          science: '盐水有轻微消炎作用',
          timing: '饭后及早晚',
          duration: '至愈合'
        }
      ],
      edema: [
        {
          id: 'edema_1',
          name: '红豆薏米水',
          desc: '利水消肿，健脾祛湿',
          icon: '🫘',
          recipe: '红豆30g + 薏米30g + 水800ml',
          detailedSteps: ['红豆薏米洗净浸泡', '加水煮至软烂', '可加少量冰糖'],
          calories: 120,
          nutrition: { carbs: 22, protein: 5, fat: 1, fiber: 2 },
          tags: ['利水', '消肿', '祛湿'],
          benefits: ['利水消肿', '祛湿健脾'],
          tips: ['少盐饮食', '避免久坐'],
          science: '红豆薏米有利水祛湿之效',
          timing: '每日1次，早晨或下午',
          duration: '连用5-7天'
        },
        {
          id: 'edema_2',
          name: '冬瓜汤',
          desc: '清热利水，消肿',
          icon: '🥒',
          recipe: '冬瓜300g + 姜片 + 水500ml',
          detailedSteps: ['冬瓜去皮切块', '加水与姜同煮', '少盐调味'],
          calories: 30,
          nutrition: { carbs: 5, protein: 1, fat: 0, fiber: 1 },
          tags: ['利水', '清热', '低卡'],
          benefits: ['利水消肿', '低热量'],
          tips: ['少盐', '可加虾皮提鲜'],
          science: '冬瓜利水消肿',
          timing: '午餐或晚餐',
          duration: '连用数日'
        }
      ]
    }
    
    return remedyData[symptomId] || []
  },

  // 查看详情
  viewDetail(e) {
    const remedy = e.currentTarget.dataset.remedy
    this.setData({
      selectedRemedy: remedy,
      showDetail: true
    })
    wx.vibrateShort()
  },

  // 关闭详情
  closeDetail() {
    this.setData({
      showDetail: false,
      selectedRemedy: null
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 添加到计划
  async addToPlan(e) {
    const remedy = e.currentTarget.dataset.remedy
    wx.showModal({
      title: '确认添加',
      content: `确定要将"${remedy.name}"添加到下一餐计划吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            // 尝试调用后端API
            await api.addRemedyToPlan(remedy.id)
            util.showToast('已添加到计划', 'success')
            // 记录使用历史
            this.recordRemedyUsage(remedy)
          } catch (error) {
            // 如果API失败，使用本地处理
            console.log('使用本地处理', error)
            util.showToast('已添加到计划', 'success')
            this.recordRemedyUsage(remedy)
          }
        }
      }
    })
  },

  // 记录补救方案使用历史
  recordRemedyUsage(remedy) {
    const usageHistory = wx.getStorageSync('remedy_usage_history') || []
    const usage = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      remedyId: remedy.id,
      remedyName: remedy.name,
      symptom: this.data.selectedSymptom ? this.data.selectedSymptom.name : '',
      timestamp: new Date().toISOString()
    }
    usageHistory.unshift(usage)
    // 只保留最近50条记录
    if (usageHistory.length > 50) {
      usageHistory.pop()
    }
    wx.setStorageSync('remedy_usage_history', usageHistory)
  },

  // 收藏/取消收藏
  async toggleFavorite(e) {
    const remedy = e.currentTarget.dataset.remedy
    try {
      await api.toggleRemedyFavorite(remedy.id)
      // 更新本地数据
      const remedies = this.data.remedies.map(r => {
        if (r.id === remedy.id) {
          return { ...r, isFavorited: !r.isFavorited }
        }
        return r
      })
      this.setData({ remedies })
      util.showToast(remedy.isFavorited ? '已取消收藏' : '已收藏', 'success')
    } catch (error) {
      console.log('使用本地处理', error)
      // 本地处理
      const remedies = this.data.remedies.map(r => {
        if (r.id === remedy.id) {
          return { ...r, isFavorited: !r.isFavorited }
        }
        return r
      })
      this.setData({ remedies })
      util.showToast(remedy.isFavorited ? '已取消收藏' : '已收藏', 'success')
    }
    wx.vibrateShort()
  },

  // 搜索症状
  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword })
    this.filterSymptoms(keyword)
  },

  // 过滤症状
  filterSymptoms(keyword) {
    const kw = (keyword || '').trim()
    const activeCategory = this.data.activeCategory || 'all'
    const allSymptoms = this.data.symptoms || []

    const filtered = allSymptoms.filter(symptom => {
      const matchCategory = activeCategory === 'all' ? true : symptom.category === activeCategory
      if (!kw) {
        return matchCategory
      }
      const matchKeyword =
        (symptom.name && symptom.name.includes(kw)) ||
        (symptom.desc && symptom.desc.includes(kw)) ||
        (symptom.category && symptom.category.includes(kw))
      return matchCategory && matchKeyword
    })

    this.setData({ filteredSymptoms: filtered })
  },

  // 清除搜索
  clearSearch() {
    this.setData({ 
      searchKeyword: '',
    })
    this.filterSymptoms('')
  },

  // 点击分类标签
  onCategoryTabTap(e) {
    const id = e.currentTarget.dataset.id
    if (!id || id === this.data.activeCategory) return
    this.setData({ activeCategory: id })
    this.filterSymptoms(this.data.searchKeyword)
  },

  // 加载使用历史（保证每条有 id，便于 wx:key 与展示）
  async loadUsageHistory() {
    try {
      const history = await api.getRemedyUsageHistory(1, 20)
      const raw = history.items || history.list || []
      const items = raw.map((item, idx) => {
        const ts = item.timestamp || item.used_at || item.created_at || ''
        return {
          id: item.id || `hist_${idx}_${Date.now()}`,
          remedyId: item.remedy_id || item.remedyId,
          remedyName: item.remedy_name || item.remedyName,
          symptom: item.symptom || item.symptom_name || '',
          timestamp: ts,
          displayTime: this.formatHistoryTime(ts)
        }
      })
      this.setData({ usageHistory: items })
    } catch (error) {
      const localHistory = wx.getStorageSync('remedy_usage_history') || []
      const items = localHistory.slice(0, 20).map((item, idx) => ({
        ...item,
        id: item.id || `hist_${idx}_${Date.now()}`,
        displayTime: this.formatHistoryTime(item.timestamp)
      }))
      this.setData({ usageHistory: items })
    }
  },

  formatHistoryTime(isoStr) {
    if (!isoStr) return ''
    const date = new Date(isoStr)
    const now = new Date()
    const diff = now - date
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
    const m = date.getMonth() + 1
    const d = date.getDate()
    return `${m}月${d}日`
  },

  // 显示/隐藏历史记录（打开时刷新列表，避免计数与内容不一致）
  toggleHistory() {
    const next = !this.data.showHistory
    this.setData({ showHistory: next })
    if (next) {
      this.loadUsageHistory()
    }
  },

  // 从历史记录选择：跳转至该症状的专门分析页
  selectFromHistory(e) {
    const historyItem = e.currentTarget.dataset.item
    if (!historyItem) return
    const symptomName = historyItem.symptom || historyItem.symptom_name || ''
    const symptom = this.data.symptoms.find(s => s.name === symptomName || s.id === symptomName)
    if (symptom) {
      this.setData({ showHistory: false })
      wx.vibrateShort()
      wx.navigateTo({
        url: `/packageHealth/remedy-symptom/remedy-symptom?id=${symptom.id}&name=${encodeURIComponent(symptom.name)}&desc=${encodeURIComponent(symptom.desc || '')}`
      })
    } else {
      util.showToast('未找到对应症状', 'none')
    }
  },

  // 一键复制做法
  copyRecipe(e) {
    const remedy = e.currentTarget.dataset.remedy
    const text = buildRemedyCopyText(remedy)
    if (!text || !String(text).trim()) {
      util.showToast('暂无可复制内容', 'none')
      return
    }
    wx.setClipboardData({
      data: text,
      success: () => util.showToast('已复制到剪贴板', 'success')
    })
    wx.vibrateShort()
  },

  // 分享
  onShareAppMessage() {
    const symptom = this.data.selectedSymptom
    return {
      title: `健康补救方案 - ${symptom ? symptom.name : '朋克养生急救包'}`,
      path: `/packageHealth/remedy/remedy${symptom ? `?symptom=${symptom.id}` : ''}`,
      imageUrl: '' // 可以设置分享图片
    }
  }
})
