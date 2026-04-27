/**
 * 二十四节气名称（按公历典型交节日期近似，用于产品文案提示，非天文精确时刻）
 */
const TERM_NAMES = [
  '小寒', '大寒', '立春', '雨水', '惊蛰', '春分',
  '清明', '谷雨', '立夏', '小满', '芒种', '夏至',
  '小暑', '大暑', '立秋', '处暑', '白露', '秋分',
  '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'
]

/** 各节气典型起始月、日（平均近似） */
const TERM_STARTS = [
  [1, 5], [1, 20], [2, 4], [2, 19], [3, 5], [3, 20],
  [4, 4], [4, 20], [5, 5], [5, 21], [6, 6], [6, 21],
  [7, 7], [7, 23], [8, 7], [8, 23], [9, 8], [9, 23],
  [10, 8], [10, 23], [11, 7], [11, 22], [12, 7], [12, 21]
]

function mdKey(month, day) {
  return month * 32 + day
}

/**
 * @param {Date} date
 * @returns {string} 当前所处节气名称（交节当日算入新节气）
 */
function getSolarTermName(date) {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) {
    return ''
  }
  const m = date.getMonth() + 1
  const d = date.getDate()
  const key = mdKey(m, d)
  if (key < mdKey(1, 5)) {
    return '冬至'
  }
  let idx = 0
  for (let i = 0; i < TERM_STARTS.length; i++) {
    const [sm, sd] = TERM_STARTS[i]
    if (key >= mdKey(sm, sd)) {
      idx = i
    }
  }
  return TERM_NAMES[idx] || ''
}

module.exports = {
  getSolarTermName
}
