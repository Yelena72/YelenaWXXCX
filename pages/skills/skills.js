// pages/skills/skills.js —— 想学的技能（一条一条的技能卡）
// 第一次打开会把 data/content.js 里的 skills 搬进本地缓存，
// 之后在小程序里加 / 改 / 删就行。

const content = require('../../data/content.js')
const dragsort = require('../../utils/dragsort.js')
const kbd = require('../../utils/kbd.js')

const KEY = 'yelena_skills'

const COLORS = ['#4FC3F7', '#6FD070', '#FF8FC7', '#FFB93C', '#B388FF', '#FF7A6B']

// 转发 / 分享到朋友圈
const share = require('../../data/share.js').build('想学的技能')

// 生成不重复的 id（同一个毫秒里连着创建也不会撞）
let idSeq = 0
function newId() {
  idSeq = (idSeq + 1) % 1000
  return Date.now() * 1000 + idSeq
}

function clampPercent(v) {
  const n = Number(v) || 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

// 中间有一版把技能改成了「大标题 + 小标题」两层，这里统一拍平回一条一条
function flatten(saved) {
  if (!saved || !saved.length) return []

  // 已经是平铺结构
  if (!saved[0].items) {
    const out = []
    for (let i = 0; i < saved.length; i++) {
      const s = saved[i]
      out.push({
        id: s.id || newId(),
        name: s.name || s.title || '',
        percent: clampPercent(s.percent),
        note: s.note !== undefined ? s.note : (s.desc || ''),
        subs: s.subs || [],
        color: s.color || ''
      })
    }
    return out
  }

  // 两层结构 → 拍平；如果有多个大标题，名字前面带上组名
  const out = []
  const many = saved.length > 1

  for (let i = 0; i < saved.length; i++) {
    const g = saved[i]
    const items = g.items || []

    for (let j = 0; j < items.length; j++) {
      const it = items[j]
      out.push({
        id: it.id || newId(),
        name: many ? g.title + ' · ' + it.title : it.title,
        percent: clampPercent(it.percent),
        note: it.desc || '',
        subs: it.subs || [],
        color: it.color || ''
      })
    }
  }

  return out
}

Page({
  onShareAppMessage: share.app,
  onShareTimeline: share.timeline,

  data: {
    list: [],
    avg: 0,

    // 拖动排序
    dragging: false,
    dragIndex: -1,
    scrollTo: '',

    editingId: '',
    formName: '',
    formPercent: 40,
    formNote: '',
    focusField: '', // 进入修改状态时把光标放进名称输入框

    // 修改弹窗
    editShow: false,
    kbH: 0,

    undoShow: false,
    undoSeq: 0,
    undoText: ''
  },

  onLoad() {
    this.all = this.load()
    this.render()
  },

  // 从详情页回来要刷新（小标题数量会变）
  onShow() {
    kbd.bind(this)

    if (!this.all) return
    this.all = wx.getStorageSync(KEY) || this.all
    this.render()
  },

  onHide() {
    kbd.unbind(this)
  },

  onUnload() {
    kbd.unbind(this)
  },

  // 弹窗上的「取消」/ 点空白处
  closeEdit() {
    this.setData({ editShow: false, kbH: 0 })
    this.resetForm()
  },

  // 点卡片 → 进详情页加小标题
  openDetail(e) {
    // 刚拖完的那一下不算点击
    if (this.justDragged && Date.now() - this.justDragged < 400) return

    const id = e.currentTarget.dataset.id

    wx.navigateTo({
      url: '/pages/skill/skill?id=' + id,
      fail() {
        wx.showToast({ title: '详情页打不开，请重新编译', icon: 'none' })
      }
    })
  },

  load() {
    const saved = wx.getStorageSync(KEY)

    if (saved && saved.length) {
      const list = flatten(saved)

      // 顺手写回平铺结构，下次就不用再转
      if (saved[0] && saved[0].items) wx.setStorageSync(KEY, list)

      return list
    }

    const src = content.skills || []
    const list = []

    for (let i = 0; i < src.length; i++) {
      list.push({
        id: newId(),
        name: src[i].name,
        percent: clampPercent(src[i].percent),
        note: src[i].note || '',
        subs: []
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
    let sum = 0
    let colored = false

    for (let i = 0; i < this.all.length; i++) {
      const s = this.all[i]
      const p = clampPercent(s.percent)
      sum += p

      // 颜色跟着技能自己走，不跟着位置走（拖动排序后不会突然换色）
      if (!s.color) {
        s.color = COLORS[i % COLORS.length]
        colored = true
      }

      list.push({
        id: s.id,
        name: s.name,
        note: s.note,
        percent: p,
        subCount: (s.subs || []).length,
        color: s.color,
        tx: 0,
        ty: 0
      })
    }

    if (colored) this.persist()

    const patch = {
      list: list,
      avg: list.length ? Math.round(sum / list.length) : 0
    }

    // 拖动结束时要和「新顺序」一起 setData，不然会闪一下
    if (extra) {
      for (const k in extra) patch[k] = extra[k]
    }

    this.setData(patch)
  },

  // ================= 长按拖动排序 =================
  // 长按卡片 → 卡片跟着手指走 → 其他卡片让位 → 松手落位

  noop() {},

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
      .selectAll('.skill')
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

    const dy = touch.clientY - d.startY
    const base = d.rects[d.from]
    const cy = base.top + base.height / 2 + dy
    const to = dragsort.nearest(d.rects, base.left + base.width / 2, cy)

    const patch = {}
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

    // 松手：先让卡片滑到目标格子（dragIndex 清掉，恢复过渡），再真正改顺序
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
  onName(e) {
    this.setData({ formName: e.detail.value })
  },

  onPercent(e) {
    this.setData({ formPercent: e.detail.value })
  },

  onNote(e) {
    this.setData({ formNote: e.detail.value })
  },

  // 输入框失焦了，下次点「修改」才能重新聚焦
  onBlur() {
    this.setData({ focusField: '' })
  },

  resetForm() {
    this.setData({
      editingId: '',
      formName: '',
      formPercent: 40,
      formNote: '',
      focusField: ''
    })
  },

  cancelEdit() {
    this.resetForm()
  },

  save() {
    const name = String(this.data.formName).trim()

    if (!name) {
      wx.showToast({ title: '先写个技能名', icon: 'none' })
      return
    }

    const percent = clampPercent(this.data.formPercent)
    const note = String(this.data.formNote).trim()

    if (this.data.editingId) {
      for (let i = 0; i < this.all.length; i++) {
        if (String(this.all[i].id) === String(this.data.editingId)) {
          this.all[i].name = name
          this.all[i].percent = percent
          this.all[i].note = note
        }
      }
    } else {
      this.all.push({
        id: newId(),
        name: name,
        percent: percent,
        note: note
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
    const id = e.currentTarget.dataset.id

    for (let i = 0; i < this.all.length; i++) {
      if (String(this.all[i].id) === String(id)) {
        this.setData({
          editingId: this.all[i].id,
          formName: this.all[i].name,
          formPercent: clampPercent(this.all[i].percent),
          formNote: this.all[i].note || '',
          focusField: '',
          editShow: true
        })
      }
    }
  },

  // 删除：删完给 5 秒撤销
  remove(e) {
    const id = e.currentTarget.dataset.id
    const list = this.all

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

    this.undoSnapshot = list.slice()

    this.all = keep
    this.persist()
    this.resetForm()
    this.render()

    this.setData({
      undoSeq: (this.data.undoSeq || 0) + 1,
      undoShow: true,
      undoText: '已删除「' + target.name + '」'
    })
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
