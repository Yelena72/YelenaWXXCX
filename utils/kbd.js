// utils/kbd.js —— 弹窗里打字时，把弹窗往上顶，别被键盘挡住
//
// 用法：页面 onShow 里 kbd.bind(this)，onHide / onUnload 里 kbd.unbind(this)
// 页面 data 里要有 kbH，弹窗的 mask 写成 style="padding-bottom: {{kbH}}px;"

function bind(page) {
  if (page._kbHandler) return
  if (!wx.onKeyboardHeightChange) return

  const handler = function (res) {
    page.setData({ kbH: res.height || 0 })
  }

  wx.onKeyboardHeightChange(handler)
  page._kbHandler = handler
}

function unbind(page) {
  if (!page._kbHandler) return

  if (wx.offKeyboardHeightChange) wx.offKeyboardHeightChange(page._kbHandler)
  page._kbHandler = null

  if (page.data && page.data.kbH) page.setData({ kbH: 0 })
}

module.exports = {
  bind: bind,
  unbind: unbind
}
