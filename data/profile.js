/* data/profile.js —— 个人资料的读写
 *
 * 规则：
 *   1. 小程序里改过的 → 存在本机缓存里，优先用这个
 *   2. 没改过（或者某个字段缺了）→ 用 data/content.js 里的默认值补上
 *
 * 这样「首页」和「关于我」读的是同一份数据，改一次两处都会变。
 */

const content = require('./content.js')

const PROFILE_KEY = 'yelena_profile'
const STATS_KEY = 'yelena_stats'

// 取个人资料（昵称 / 签名 / 城市 / 身份 / MBTI / 状态 / 自我介绍 / 标签）
function getProfile() {
  const base = content.profile || {}
  const out = {}
  let k

  for (k in base) out[k] = base[k]

  const saved = wx.getStorageSync(PROFILE_KEY)
  if (saved && typeof saved === 'object') {
    for (k in saved) out[k] = saved[k]
  }

  // 标签必须是数组，脏数据兜一下
  if (!(out.tags instanceof Array)) out.tags = []

  return out
}

function saveProfile(profile) {
  wx.setStorageSync(PROFILE_KEY, profile)
}

// 取属性面板（外向 / 好奇心 / 行动力 / 专注力）
function getStats() {
  const saved = wx.getStorageSync(STATS_KEY)
  if (saved && saved.length) return saved
  return content.stats || []
}

function saveStats(stats) {
  wx.setStorageSync(STATS_KEY, stats)
}

// 恢复成 content.js 里的原样（编辑弹窗里可能会用到）
function resetProfile() {
  wx.removeStorageSync(PROFILE_KEY)
  wx.removeStorageSync(STATS_KEY)
}

module.exports = {
  getProfile: getProfile,
  saveProfile: saveProfile,
  getStats: getStats,
  saveStats: saveStats,
  resetProfile: resetProfile
}
