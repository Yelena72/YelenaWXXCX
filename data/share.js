/* data/share.js —— 转发给朋友 / 分享到朋友圈
 *
 * 用法（页面里两行）：
 *   const share = require('../../data/share.js').build('个人经历')
 *   Page({
 *     onShareAppMessage: share.app,
 *     onShareTimeline: share.timeline,
 *     ...
 *   })
 *
 * 标题里的名字用的是「关于我」里改过的昵称，不是写死的。
 */

const profileApi = require('./profile.js')

function build(subtitle) {
  function makeTitle() {
    const p = profileApi.getProfile()
    const name = p.name || 'Yelena'
    return name + ' · ' + subtitle
  }

  return {
    // 右上角「转发给朋友」
    app: function () {
      return {
        title: makeTitle(),
        path: '/pages/index/index'
      }
    },

    // 右上角「分享到朋友圈」
    timeline: function () {
      return {
        title: makeTitle()
      }
    }
  }
}

module.exports = {
  build: build
}
