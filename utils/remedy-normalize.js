/**
 * 统一后端返回的补救方案字段，保证列表「做法」与复制可用。
 * 兼容：recipe / description / recipes[] / steps / detailed_steps 等变体。
 */

function asArraySteps(raw) {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw.map(s => String(s).trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw.split(/\n|[；;]/)
      .map(s => s.trim())
      .filter(Boolean)
  }
  return []
}

function stepsFromRecipes(recipes) {
  if (!Array.isArray(recipes) || !recipes.length) return []
  return recipes.map((r, idx) => {
    const ing = Array.isArray(r.ingredients) ? r.ingredients.join('、') : (r.ingredients ? String(r.ingredients) : '')
    const n = r.name || `搭配${idx + 1}`
    if (ing) return `${n}：准备 ${ing}，清洗后按家常做法炖煮或冲泡即可。`
    return `${n}：按包装或医嘱适量准备。`
  })
}

function recipeFromRecipes(recipes) {
  if (!Array.isArray(recipes) || !recipes.length) return ''
  return recipes
    .map((r, idx) => {
      const n = r.name || `方案${idx + 1}`
      const ing = Array.isArray(r.ingredients) ? r.ingredients.join('、') : (r.ingredients || '')
      const extra = r.steps || r.note || r.cook_tip || ''
      const cal = r.calories != null ? `（约${r.calories}kcal）` : ''
      if (ing) return `${n}：${ing}${extra ? '。' + extra : '；按比例炖煮或冲泡即可。'}${cal}`
      return `${n}：按说明适量准备。${cal}`
    })
    .join('\n')
}

function normalizeRemedyItem(raw) {
  if (!raw || typeof raw !== 'object') return null

  const out = { ...raw }
  out.id = out.id != null ? String(out.id) : `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  out.name = (out.name || out.title || '食疗补救方案').trim()
  out.desc = (out.desc || out.description || out.summary || '').trim()
  out.icon = out.icon || out.emoji || '🥗'

  let recipe = (out.recipe || out.how_to || out.method || out.instructions || out.cook_method || '').trim()
  let steps = asArraySteps(out.detailedSteps || out.detailed_steps || out.steps || out.procedure)

  if (!recipe && Array.isArray(out.recipes) && out.recipes.length) {
    recipe = recipeFromRecipes(out.recipes)
    if (!steps.length) steps = stepsFromRecipes(out.recipes)
  }

  if (!recipe && steps.length) {
    recipe = steps.map((s, i) => `${i + 1}. ${s}`).join(' ')
  }

  if (!recipe && Array.isArray(out.tips) && out.tips.length) {
    recipe = '建议：' + out.tips.join('；')
  }

  if (!recipe && out.desc) {
    recipe = out.desc
  }

  if (!recipe) {
    recipe = '具体冲泡或烹饪步骤可点击「查看详情」；若数据来自服务端且字段不全，我们会尝试用本地说明补全。'
  }

  out.recipe = recipe

  if (!steps.length && typeof recipe === 'string' && recipe.length > 0) {
    const split = recipe.split(/[。\n;；]+/).map(s => s.trim()).filter(s => s.length > 4)
    if (split.length > 1) steps = split
  }
  out.detailedSteps = steps.length ? steps : (Array.isArray(out.detailedSteps) ? out.detailedSteps : [])

  const calFirst = out.recipes && out.recipes[0] && out.recipes[0].calories
  if (out.calories == null && calFirst != null) out.calories = Number(calFirst)
  if (out.calories != null) out.calories = Number(out.calories)

  return out
}

function normalizeRemedyList(list) {
  if (!Array.isArray(list)) return []
  return list.map(normalizeRemedyItem).filter(Boolean)
}

function buildRemedyCopyText(remedy) {
  if (!remedy) return ''
  const name = remedy.name || ''
  const desc = remedy.desc || remedy.description || ''
  let body = (remedy.recipe || '').trim()
  if (!body && remedy.detailedSteps && remedy.detailedSteps.length) {
    body = remedy.detailedSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')
  }
  if (!body) body = desc
  return [name, desc && `简介：${desc}`, body && `做法：\n${body}`].filter(Boolean).join('\n')
}

module.exports = {
  normalizeRemedyItem,
  normalizeRemedyList,
  buildRemedyCopyText
}
