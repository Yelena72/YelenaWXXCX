/* data/social.js —— 人际交往页的文案读写
 *
 * 和 data/profile.js 一个套路：
 *   改过的存本机缓存 → 优先用；没改过的 → 用 content.js 的默认值
 */

const content = require('./content.js')

const SOCIAL_KEY = 'yelena_social'

function getSocial() {
  const base = content.social || {}
  const out = {}
  let k

  for (k in base) out[k] = base[k]

  const saved = wx.getStorageSync(SOCIAL_KEY)
  if (saved && typeof saved === 'object') {
    for (k in saved) out[k] = saved[k]
  }

  if (!(out.tags instanceof Array)) out.tags = []

  return out
}

function saveSocial(social) {
  wx.setStorageSync(SOCIAL_KEY, social)
}

module.exports = {
  getSocial: getSocial,
  saveSocial: saveSocial
}
