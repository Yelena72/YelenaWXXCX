// pages/experience/experience.js —— 个人经历（时间轴）
// 第一次打开会把 data/content.js 里的 experiences 搬进本地缓存，
// 之后在小程序里加 / 改 / 删就行，不用再改代码。

const content = require('../../data/content.js')
const kbd = require('../../utils/kbd.js')

const KEY = 'yelena_experience'

// 从年份里抓 4 位数字，用来做时间轴的排序
// "2024" -> 2024；"2024.03" -> 2024；"今年" -> Infinity（排在最后）
function yearNum(text) {
  const m = String(text || '').match(/\d{4}/)
  return m ? Number(m[0]) : Infinity
}

// 按年份从小到大排，年份一样就保持原来的先后顺序
function sortByYear(list) {
  const arr = []
  for (let i = 0; i < list.length; i++) {
    arr.push({ item: list[i], index: i })
  }

  arr.sort(function (a, b) {
    const na = yearNum(a.item.year)
    const nb = yearNum(b.item.year)
    if (na !== nb) return na - nb
    return a.index - b.index
  })

  const out = []
  for (let i = 0; i < arr.length; i++) out.push(arr[i].item)
  return out
}

// 转发 / 分享到朋友圈
const share = require('../../data/share.js').build('个人经历')

Page({
  onShareAppMessage: share.app,
  onShareTimeline: share.timeline,

  data: {
    list: [],

    editingId: '',
    formYear: '',
    formTitle: '',
    formDesc: '',
    focusField: '', // 进入修改状态时把光标放进第一个输入框

    // 修改弹窗
    editShow: false,
    kbH: 0,

    undoShow: false,
    undoText: ''
  },

  onLoad() {
    this.all = this.load()
    this.render()
  },

  onShow() {
    kbd.bind(this)
  },

  onHide() {
    kbd.unbind(this)
  },

  onUnload() {
    kbd.unbind(this)
  },

  noop() {},

  // 弹窗上的「取消」/ 点空白处
  closeEdit() {
    this.setData({ editShow: false, kbH: 0 })
    this.resetForm()
  },

  // 第一次进来：把 content.js 里的经历搬过来
  load() {
    const saved = wx.getStorageSync(KEY)
    if (saved && saved.length) return sortByYear(saved)

    const src = content.experiences || []
    const list = []

    for (let i = 0; i < src.length; i++) {
      list.push({
        id: Date.now() + i,
        year: src[i].year || '',
        title: src[i].title || '',
        desc: src[i].desc || ''
      })
    }

    wx.setStorageSync(KEY, list)
    return list
  },

  persist() {
    wx.setStorageSync(KEY, this.all)
  },

  render() {
    const list = []

    for (let i = 0; i < this.all.length; i++) {
      const e = this.all[i]
      list.push({
        id: e.id,
        year: e.year,
        title: e.title,
        desc: e.desc,
        empty: !e.desc
      })
    }

    this.setData({ list: list })
  },

  // ---------------- 表单 ----------------
  onYear(e) {
    this.setData({ formYear: e.detail.value })
  },

  onTitle(e) {
    this.setData({ formTitle: e.detail.value })
  },

  onDesc(e) {
    this.setData({ formDesc: e.detail.value })
  },

  // 输入框失焦了，下次点卡片才能重新聚焦
  onBlur() {
    this.setData({ focusField: '' })
  },

  resetForm() {
    this.setData({
      editingId: '',
      formYear: '',
      formTitle: '',
      formDesc: '',
      focusField: ''
    })
  },

  // 保存（新增或修改），存完自动按年份重新排序
  save() {
    const year = String(this.data.formYear).trim()
    const title = String(this.data.formTitle).trim()
    const desc = String(this.data.formDesc).trim()

    if (!year) {
      wx.showToast({ title: '先写个年份', icon: 'none' })
      return
    }
    if (!title) {
      wx.showToast({ title: '写一下发生了什么', icon: 'none' })
      return
    }

    if (this.data.editingId) {
      for (let i = 0; i < this.all.length; i++) {
        if (String(this.all[i].id) === String(this.data.editingId)) {
          this.all[i].year = year
          this.all[i].title = title
          this.all[i].desc = desc
        }
      }
    } else {
      this.all.push({
        id: Date.now(),
        year: year,
        title: title,
        desc: desc
      })
    }

    this.all = sortByYear(this.all)
    this.persist()
    this.resetForm()
    this.render()
    this.setData({ editShow: false, kbH: 0 })

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
    wx.showToast({ title: '已保存', icon: 'none' })
  },

  // 点任意一段经历：中间弹窗里改
  edit(e) {
    const id = e.currentTarget.dataset.id

    for (let i = 0; i < this.all.length; i++) {
      if (String(this.all[i].id) === String(id)) {
        this.setData({
          editingId: this.all[i].id,
          formYear: this.all[i].year,
          formTitle: this.all[i].title,
          formDesc: this.all[i].desc || '',
          focusField: '',
          editShow: true
        })
      }
    }
  },

  // 删除：删完给 5 秒撤销
  remove() {
    const id = this.data.editingId
    if (!id) return

    this.undoSnapshot = this.all.slice()

    this.all = this.all.filter(function (e) {
      return String(e.id) !== String(id)
    })

    this.persist()
    this.resetForm()
    this.render()
    this.setData({ editShow: false, kbH: 0,
      undoSeq: (this.data.undoSeq || 0) + 1,
      undoShow: true, undoText: '已删除这段经历' })
  },

  onUndo() {
    if (this.undoSnapshot) {
      this.all = this.undoSnapshot
      this.undoSnapshot = null
      this.persist()
      this.render()
    }
    this.setData({ undoShow: false })
  },

  onUndoClose() {
    this.undoSnapshot = null
    this.setData({ undoShow: false })
  }
})
