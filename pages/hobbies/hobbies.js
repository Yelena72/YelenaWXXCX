// pages/hobbies/hobbies.js —— 兴趣爱好
// 第一次打开会把 data/content.js 里的 hobbies 搬进本地缓存，
// 之后在小程序里加 / 改 / 删就行。

const content = require('../../data/content.js')
const dragsort = require('../../utils/dragsort.js')
const kbd = require('../../utils/kbd.js')

const KEY = 'yelena_hobbies'

// 可选的图标（都在 styles/icons.wxss 里）
const ICONS = [
  'ico-music',   // 音乐
  'ico-book',    // 读书
  'ico-movie',   // 电影
  'ico-game',    // 游戏
  'ico-camera',  // 摄影
  'ico-pin',     // 打卡 / 地点
  'ico-travel',  // 旅行
  'ico-coffee',  // 咖啡
  'ico-cake',    // 甜品
  'ico-plant',   // 植物
  'ico-pet',     // 宠物
  'ico-draw',    // 画画
  'ico-guitar',  // 吉他 / 乐器
  'ico-code',    // 编程
  'ico-gym',     // 健身
  'ico-bike',    // 骑行
  'ico-star'     // 天文
]

// 转发 / 分享到朋友圈
const share = require('../../data/share.js').build('兴趣爱好')

Page({
  onShareAppMessage: share.app,
  onShareTimeline: share.timeline,

  data: {
    list: [],
    iconList: ICONS,

    // 拖动排序
    dragging: false,
    dragIndex: -1,
    scrollTo: '',

    editingId: '',
    formIcon: 'ico-music',
    formName: '',
    formDesc: '',
    focusField: '', // 进入修改状态时把光标放进名称输入框

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

  load() {
    const saved = wx.getStorageSync(KEY)
    if (saved && saved.length) return saved

    const src = content.hobbies || []
    const list = []

    for (let i = 0; i < src.length; i++) {
      list.push({
        id: Date.now() + i,
        icon: src[i].icon || 'ico-music',
        name: src[i].name,
        desc: src[i].desc || ''
      })
    }

    wx.setStorageSync(KEY, list)
    return list
  },

  persist() {
    wx.setStorageSync(KEY, this.all)
  },

  render(extra) {
    const list = []

    for (let i = 0; i < this.all.length; i++) {
      const h = this.all[i]
      let icon = h.icon
      if (ICONS.indexOf(icon) < 0) icon = ICONS[0]

      list.push({
        id: h.id,
        icon: icon,
        name: h.name,
        desc: h.desc,
        tx: 0,
        ty: 0
      })
    }

    const patch = { list: list }

    // 拖动结束时要和「新顺序」一起 setData，不然会闪一下
    if (extra) {
      for (const k in extra) patch[k] = extra[k]
    }

    this.setData(patch)
  },

  // ================= 长按拖动排序 =================
  // 卡片网格是两列，所以横向、纵向都跟着手指走

  indexOfId(id) {
    for (let i = 0; i < this.all.length; i++) {
      if (String(this.all[i].id) === String(id)) return i
    }
    return -1
  },

  onDragStart(e) {
    if (this.drag) return

    const id = e.currentTarget.dataset.id
    const from = this.indexOfId(id)
    const touch = e.touches && e.touches[0]
    if (from < 0 || !touch) return

    const that = this

    wx.createSelectorQuery()
      .selectAll('.card')
      .boundingClientRect()
      .exec(function (res) {
        const rects = (res && res[0]) || []
        if (rects.length !== that.all.length) return

        if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })

        const order = []
        const index = {}

        for (let i = 0; i < that.all.length; i++) {
          const key = String(that.all[i].id)
          order.push(key)
          index[key] = i
        }

        that.drag = {
          from: from,
          pos: from,
          order: order,
          index: index,
          rects: rects,
          startX: touch.clientX,
          startY: touch.clientY
        }

        that.setData({ dragging: true, dragIndex: from })
      })
  },

  onDragMove(e) {
    const d = this.drag
    if (!d) return

    const touch = e.touches && e.touches[0]
    if (!touch) return

    const dx = touch.clientX - d.startX
    const dy = touch.clientY - d.startY
    const base = d.rects[d.from]

    const to = dragsort.nearest(
      d.rects,
      base.left + base.width / 2 + dx,
      base.top + base.height / 2 + dy
    )

    const patch = {}
    patch['list[' + d.from + '].tx'] = dx
    patch['list[' + d.from + '].ty'] = dy

    // 换位置了：其他卡片挪到各自的新格子
    if (to !== d.pos) {
      const order = dragsort.moveTo(d.order, d.pos, to)
      d.order = order
      d.pos = to

      for (let p = 0; p < order.length; p++) {
        const oi = d.index[order[p]]
        patch['list[' + oi + '].tx'] = d.rects[p].left - d.rects[oi].left
        patch['list[' + oi + '].ty'] = d.rects[p].top - d.rects[oi].top
      }

      // 被拖的那张还是跟着手指
      patch['list[' + d.from + '].tx'] = dx
      patch['list[' + d.from + '].ty'] = dy
    }

    this.setData(patch)
  },

  onDragEnd() {
    const d = this.drag
    if (!d) return

    this.drag = null
    this.justDragged = Date.now()

    const from = d.rects[d.from]
    const to = d.rects[d.pos]

    // 松手：先让卡片滑到目标格子，再真正改顺序
    this.setData({
      dragIndex: -1,
      ['list[' + d.from + '].tx']: to.left - from.left,
      ['list[' + d.from + '].ty']: to.top - from.top
    })

    const that = this
    setTimeout(function () {
      that.commitDrag(d)
    }, 180)
  },

  commitDrag(d) {
    const byId = {}
    for (let i = 0; i < this.all.length; i++) byId[String(this.all[i].id)] = this.all[i]

    const next = []
    for (let p = 0; p < d.order.length; p++) next.push(byId[d.order[p]])

    this.all = next
    this.persist()

    this.render({ dragging: false, dragIndex: -1 })
  },

  // ---------------- 表单 ----------------
  pickIcon(e) {
    this.setData({ formIcon: e.currentTarget.dataset.icon })
  },

  onName(e) {
    this.setData({ formName: e.detail.value })
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
      formIcon: ICONS[0],
      formName: '',
      formDesc: '',
      focusField: ''
    })
  },

  save() {
    const name = String(this.data.formName).trim()

    if (!name) {
      wx.showToast({ title: '先写个兴趣名', icon: 'none' })
      return
    }

    const icon = this.data.formIcon
    const desc = String(this.data.formDesc).trim()

    if (this.data.editingId) {
      for (let i = 0; i < this.all.length; i++) {
        if (String(this.all[i].id) === String(this.data.editingId)) {
          this.all[i].icon = icon
          this.all[i].name = name
          this.all[i].desc = desc
        }
      }
    } else {
      this.all.push({
        id: Date.now(),
        icon: icon,
        name: name,
        desc: desc
      })
    }

    this.persist()
    this.resetForm()
    this.render()
    this.setData({ editShow: false, kbH: 0 })

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
    wx.showToast({ title: '已保存', icon: 'none' })
  },

  edit(e) {
    // 刚拖完的那一下不算点击
    if (this.justDragged && Date.now() - this.justDragged < 400) return

    const id = e.currentTarget.dataset.id

    for (let i = 0; i < this.all.length; i++) {
      if (String(this.all[i].id) === String(id)) {
        this.setData({
          editingId: String(this.all[i].id),
          formIcon: this.all[i].icon,
          formName: this.all[i].name,
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

    this.all = this.all.filter(function (h) {
      return String(h.id) !== String(id)
    })

    this.persist()
    this.resetForm()
    this.render()
    this.setData({ editShow: false, kbH: 0,
      undoSeq: (this.data.undoSeq || 0) + 1,
      undoShow: true, undoText: '已删除这个兴趣' })
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
