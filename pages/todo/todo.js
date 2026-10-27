// pages/todo/todo.js —— 待办事项
// 数据存在手机本地缓存里，不用服务器

const KEY = 'yelena_todos'

// 轻微震动反馈（真机上才有感觉，开发者工具里没反应是正常的）
function buzz() {
  if (wx.vibrateShort) {
    wx.vibrateShort({ type: 'light' })
  }
}

Page({
  data: {
    input: '',
    pending: [],   // 未完成
    done: [],      // 已完成
    total: 0,
    doneCount: 0,
    percent: 0,
    note: '',

    editingId: '', // 正在修改哪一条；空字符串表示「新增」
    focusInput: false, // 进入修改状态时把光标放进输入框

    undoShow: false,
    undoText: ''
  },

  onLoad() {
    const list = wx.getStorageSync(KEY) || []
    this.render(list)
  },

  // 输入框失焦了，下次点「改」才能重新聚焦
  onBlur() {
    this.setData({ focusInput: false })
  },

  // 把原始数据分组，并算好进度
  render(list) {
    const pending = []
    const done = []

    for (let i = 0; i < list.length; i++) {
      if (list[i].done) {
        done.push(list[i])
      } else {
        pending.push(list[i])
      }
    }

    const total = list.length
    const doneCount = done.length
    const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0

    let note = '还没有待办，先加一条吧'
    if (total > 0) {
      if (doneCount === total) {
        note = '全部完成，辛苦啦！'
      } else {
        note = '还剩 ' + (total - doneCount) + ' 件没做'
      }
    }

    this.setData({
      pending: pending,
      done: done,
      total: total,
      doneCount: doneCount,
      percent: percent,
      note: note
    })
  },

  onInput(e) {
    this.setData({ input: e.detail.value })
  },

  // 保存：没在修改就新增，正在修改就覆盖原来那条
  add() {
    const text = this.data.input.trim()

    if (!text) {
      wx.showToast({ title: '先写点什么吧', icon: 'none' })
      return
    }

    const list = wx.getStorageSync(KEY) || []
    const editingId = this.data.editingId

    if (editingId) {
      for (let i = 0; i < list.length; i++) {
        if (String(list[i].id) === String(editingId)) {
          list[i].text = text
        }
      }
      wx.showToast({ title: '已修改', icon: 'none' })
    } else {
      list.unshift({ id: Date.now(), text: text, done: false })
    }

    wx.setStorageSync(KEY, list)

    this.setData({ input: '', editingId: '' })
    this.render(list)
    buzz()
  },

  // 点「改」：把这一条的文字填回输入框，按钮变成「保存」
  edit(e) {
    const id = e.currentTarget.dataset.id
    const list = wx.getStorageSync(KEY) || []

    for (let i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) {
        this.setData({
          editingId: list[i].id,
          input: list[i].text,
          focusInput: true
        })
      }
    }

    // 输入框在页面顶部，滚上去方便改
    wx.pageScrollTo({ scrollTop: 0, duration: 200 })
  },

  cancelEdit() {
    this.setData({ editingId: '', input: '' })
  },

  toggle(e) {
    const id = e.currentTarget.dataset.id
    const list = wx.getStorageSync(KEY) || []

    for (let i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) {
        list[i].done = !list[i].done
      }
    }

    wx.setStorageSync(KEY, list)
    this.render(list)
    buzz()
  },

  // 删除：不再弹确认框，改成删完给 5 秒撤销
  remove(e) {
    const id = e.currentTarget.dataset.id
    const list = wx.getStorageSync(KEY) || []

    let target = null
    const keep = []

    for (let i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) {
        target = list[i]
      } else {
        keep.push(list[i])
      }
    }
    if (!target) return

    this.undoSnapshot = list

    wx.setStorageSync(KEY, keep)

    if (String(this.data.editingId) === String(id)) {
      this.setData({ editingId: '', input: '', focusInput: false })
    }

    this.render(keep)
    this.setData({ undoSeq: (this.data.undoSeq || 0) + 1,
      undoShow: true, undoText: '已删除「' + target.text + '」' })
  },

  onUndo() {
    if (this.undoSnapshot) {
      wx.setStorageSync(KEY, this.undoSnapshot)
      this.render(this.undoSnapshot)
      this.undoSnapshot = null
    }
    this.setData({ undoShow: false })
  },

  onUndoClose() {
    this.undoSnapshot = null
    this.setData({ undoShow: false })
  }
})
