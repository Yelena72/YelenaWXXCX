// pages/todo/todo.js —— 待办事项（艾森豪威尔四象限）
// 每条待办有两个标记：重要 / 紧急，组合成四个象限；
// 另外可以设一个截止日期（DDL），过期了会变红提醒。

const KEY = 'yelena_todos'

const dragsort = require('../../utils/dragsort.js')
const kbd = require('../../utils/kbd.js')

// 四个象限，顺序就是页面上的顺序
const QUADS = [
  { key: 'q1', name: '重要又紧急', hint: '马上就做', color: '#FF7A6B', important: true, urgent: true },
  { key: 'q2', name: '重要不紧急', hint: '安排时间', color: '#4FC3F7', important: true, urgent: false },
  { key: 'q3', name: '紧急不重要', hint: '尽快处理', color: '#FFB93C', important: false, urgent: true },
  { key: 'q4', name: '都不占', hint: '有空再说', color: '#9AB0D0', important: false, urgent: false }
]

// 轻微震动反馈（真机上才有感觉，开发者工具里没反应是正常的）
function buzz() {
  if (wx.vibrateShort) {
    wx.vibrateShort({ type: 'light' })
  }
}

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function todayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

// "2026-11-10" -> Date（按本地时区，避开 new Date(str) 的 UTC 坑）
function toDate(s) {
  const p = String(s).split('-')
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]))
}

// 距离今天还有几天（正数 = 还没到，负数 = 过期）
function daysLeft(due) {
  const a = toDate(todayStr())
  const b = toDate(due)
  return Math.round((b - a) / 86400000)
}

// 把 DDL 变成一句人话
function dueLabel(due, done) {
  if (!due) return null
  if (done) return { text: due.slice(5).replace('-', '/'), warn: false }

  const d = daysLeft(due)
  if (d < 0) return { text: '已过期 ' + -d + ' 天', warn: true }
  if (d === 0) return { text: '今天到期', warn: true }
  if (d === 1) return { text: '明天到期', warn: false }
  if (d <= 3) return { text: d + ' 天后', warn: false }

  return { text: due.slice(5).replace('-', '/'), warn: false }
}

// 老数据没有 important / urgent，默认当成「重要不紧急」
function normalize(t) {
  return {
    id: t.id,
    text: t.text,
    done: !!t.done,
    important: t.important === undefined ? true : !!t.important,
    urgent: !!t.urgent,
    due: t.due || ''
  }
}

function quadOf(t) {
  if (t.important && t.urgent) return 'q1'
  if (t.important && !t.urgent) return 'q2'
  if (!t.important && t.urgent) return 'q3'
  return 'q4'
}

function quadByKey(key) {
  for (let i = 0; i < QUADS.length; i++) {
    if (QUADS[i].key === key) return QUADS[i]
  }
  return QUADS[1]
}

// 已完成的按 DDL 排（早的在前），没 DDL 的按新建时间倒序
function sortItems(a, b) {
  if (a.due && b.due) {
    if (a.due < b.due) return -1
    if (a.due > b.due) return 1
  } else if (a.due) {
    return -1
  } else if (b.due) {
    return 1
  }
  return b.id - a.id
}

// 今天到期（含已过期）的未完成条数
function countDue(pending) {
  let n = 0
  const today = todayStr()

  for (let i = 0; i < pending.length; i++) {
    if (pending[i].due && pending[i].due <= today) n++
  }

  return n
}

Page({
  data: {
    input: '',
    editingId: '',
    focusInput: false,

    // 表单里的两个标记 + DDL
    formImportant: true,
    formUrgent: false,
    formDue: '',
    formQuadName: '重要不紧急',
    formQuadColor: '#4FC3F7',

    // 页面数据
    board: [],
    done: [],
    doneCount: 0,
    total: 0,
    percent: 0,
    note: '',
    today: '',

    // 拖动排序
    dragging: false,
    dragIndex: -1,
    dragQuad: '',
    scrollTo: '',

    // 修改弹窗
    editShow: false,
    kbH: 0,

    undoShow: false,
    undoSeq: 0,
    undoText: ''
  },

  onLoad() {
    const list = wx.getStorageSync(KEY) || []
    this.render(list)
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

  // 弹窗上的「取消」/ 点空白处
  closeEdit() {
    this.setData({ editShow: false, kbH: 0 })
    this.resetForm()
  },

  // 把原始数据分到四个象限，并算好进度
  render(list, extra) {
    const all = []
    for (let i = 0; i < list.length; i++) all.push(normalize(list[i]))
    this.all = all

    const pending = []
    const done = []

    for (let i = 0; i < all.length; i++) {
      if (all[i].done) {
        done.push(all[i])
      } else {
        pending.push(all[i])
      }
    }

    const board = []

    for (let q = 0; q < QUADS.length; q++) {
      const quad = QUADS[q]
      const items = []

      for (let i = 0; i < pending.length; i++) {
        if (quadOf(pending[i]) === quad.key) items.push(pending[i])
      }

      // 顺序就按存下来的顺序（拖动排序改的就是它），不再自动按 DDL 排
      const view = []
      for (let i = 0; i < items.length; i++) {
        const t = items[i]
        const dl = dueLabel(t.due, false)
        view.push({
          id: t.id,
          text: t.text,
          due: t.due,
          dueText: dl ? dl.text : '',
          dueWarn: dl ? dl.warn : false,
          tx: 0,
          ty: 0
        })
      }

      // 每个格子带着自己的待办，不再单独列一份
      board.push({
        key: quad.key,
        name: quad.name,
        hint: quad.hint,
        color: quad.color,
        count: view.length,
        items: view
      })
    }

    // 已完成
    done.sort(sortItems)
    const doneView = []
    for (let i = 0; i < done.length; i++) {
      const t = done[i]
      const dl = dueLabel(t.due, true)
      doneView.push({
        id: t.id,
        text: t.text,
        due: t.due,
        dueText: dl ? dl.text : '',
        dueWarn: false,
        quadColor: quadByKey(quadOf(t)).color
      })
    }

    const total = all.length
    const doneCount = done.length
    const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0

    let note = '还没有待办，先加一条吧'
    if (total > 0) {
      const due = countDue(pending)
      if (doneCount === total) {
        note = '全部完成，辛苦啦！'
      } else if (due > 0) {
        note = '今天有 ' + due + ' 件到期'
      } else {
        note = '还剩 ' + (total - doneCount) + ' 件没做'
      }
    }

    const patch = {
      board: board,
      done: doneView,
      doneCount: doneCount,
      total: total,
      percent: percent,
      note: note,
      today: todayStr()
    }

    // 拖动结束时要和「新顺序」一起 setData，不然会闪一下
    if (extra) {
      for (const k in extra) patch[k] = extra[k]
    }

    this.setData(patch)
  },

  // ================= 长按拖动排序 =================
  // 每个格子内部自己排序：长按一条待办 → 上下拖着换位置

  noop() {},

  quadIndex(key) {
    for (let i = 0; i < QUADS.length; i++) {
      if (QUADS[i].key === key) return i
    }
    return -1
  },

  onDragStart(e) {
    if (this.drag) return

    const id = e.currentTarget.dataset.id
    const qid = e.currentTarget.dataset.q
    const qi = this.quadIndex(qid)
    const touch = e.touches && e.touches[0]
    if (qi < 0 || !touch) return

    const items = this.data.board[qi] ? this.data.board[qi].items : []
    let from = -1

    for (let i = 0; i < items.length; i++) {
      if (String(items[i].id) === String(id)) from = i
    }
    if (from < 0) return

    const that = this

    wx.createSelectorQuery()
      .selectAll('#cell-' + qid + ' .cell-item')
      .boundingClientRect()
      .exec(function (res) {
        const rects = (res && res[0]) || []
        if (rects.length !== items.length) return

        if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })

        const order = []
        const index = {}

        for (let i = 0; i < items.length; i++) {
          const key = String(items[i].id)
          order.push(key)
          index[key] = i
        }

        that.drag = {
          qi: qi,
          qid: qid,
          from: from,
          pos: from,
          order: order,
          index: index,
          rects: rects,
          startX: touch.clientX,
          startY: touch.clientY
        }

        that.setData({ dragging: true, dragIndex: from, dragQuad: qid })
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

    const head = 'board[' + d.qi + '].items['
    const patch = {}
    patch[head + d.from + '].ty'] = dy

    // 换位置了：同格子里的其他待办挪到各自的新位置
    if (to !== d.pos) {
      const order = dragsort.moveTo(d.order, d.pos, to)
      d.order = order
      d.pos = to

      for (let p = 0; p < order.length; p++) {
        const oi = d.index[order[p]]
        patch[head + oi + '].tx'] = d.rects[p].left - d.rects[oi].left
        patch[head + oi + '].ty'] = d.rects[p].top - d.rects[oi].top
      }

      // 被拖的那条还是跟着手指
      patch[head + d.from + '].ty'] = dy
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
    const head = 'board[' + d.qi + '].items['

    const patch = { dragIndex: -1 }
    patch[head + d.from + '].tx'] = to.left - from.left
    patch[head + d.from + '].ty'] = to.top - from.top

    // 松手：先滑到目标位置，再真正改顺序
    this.setData(patch)

    const that = this
    setTimeout(function () {
      that.commitDrag(d)
    }, 180)
  },

  commitDrag(d) {
    const byId = {}
    for (let i = 0; i < this.all.length; i++) byId[String(this.all[i].id)] = this.all[i]

    // 这个格子里的待办，按新顺序填回它们在数组里的老位置
    const slots = []
    for (let i = 0; i < this.all.length; i++) {
      if (!this.all[i].done && quadOf(this.all[i]) === d.qid) slots.push(i)
    }

    const next = this.all.slice()
    for (let k = 0; k < slots.length && k < d.order.length; k++) {
      next[slots[k]] = byId[d.order[k]]
    }

    wx.setStorageSync(KEY, next)

    this.render(next, { dragging: false, dragIndex: -1, dragQuad: '' })
  },

  // ---------------- 表单 ----------------
  onInput(e) {
    this.setData({ input: e.detail.value })
  },

  onBlur() {
    this.setData({ focusInput: false })
  },

  toggleImportant() {
    this.setData({ formImportant: !this.data.formImportant })
    this.syncQuad()
  },

  toggleUrgent() {
    this.setData({ formUrgent: !this.data.formUrgent })
    this.syncQuad()
  },

  // 实时显示「会放进哪个象限」
  syncQuad() {
    const q = quadByKey(quadOf({
      important: this.data.formImportant,
      urgent: this.data.formUrgent
    }))

    this.setData({ formQuadName: q.name, formQuadColor: q.color })
  },

  onDue(e) {
    this.setData({ formDue: e.detail.value })
  },

  clearDue() {
    this.setData({ formDue: '' })
  },

  resetForm() {
    this.setData({
      input: '',
      editingId: '',
      focusInput: false,
      formImportant: true,
      formUrgent: false,
      formDue: '',
      formQuadName: '重要不紧急',
      formQuadColor: '#4FC3F7'
    })
  },

  cancelEdit() {
    this.resetForm()
  },

  // 保存：没在修改就新增，正在修改就覆盖原来那条
  save() {
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
          list[i].important = this.data.formImportant
          list[i].urgent = this.data.formUrgent
          list[i].due = this.data.formDue || ''
        }
      }
      wx.showToast({ title: '已修改', icon: 'none' })
    } else {
      list.unshift({
        id: Date.now(),
        text: text,
        done: false,
        important: this.data.formImportant,
        urgent: this.data.formUrgent,
        due: this.data.formDue || ''
      })
    }

    wx.setStorageSync(KEY, list)

    this.resetForm()
    this.render(list)
    this.setData({ editShow: false, kbH: 0 })
    buzz()
  },

  // 点「改」：把这一条填回表单
  edit(e) {
    const id = e.currentTarget.dataset.id
    const list = wx.getStorageSync(KEY) || []
    let target = null

    for (let i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) target = list[i]
    }
    if (!target) return

    const t = normalize(target)
    const q = quadByKey(quadOf(t))

    this.setData({
      editingId: t.id,
      input: t.text,
      focusInput: false,
      formImportant: t.important,
      formUrgent: t.urgent,
      formDue: t.due,
      formQuadName: q.name,
      formQuadColor: q.color,
      editShow: true
    })
  },

  toggle(e) {
    // 刚拖完的那一下不算点击
    if (this.justDragged && Date.now() - this.justDragged < 400) return

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

  // 删除：不弹确认框，删完给 5 秒撤销
  remove(e) {
    this.removeById(e.currentTarget.dataset.id)
  },

  // 编辑表单里的「删除这条」
  removeEditing() {
    this.removeById(this.data.editingId)
  },

  removeById(id) {
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
      this.resetForm()
    }

    this.render(keep)
    this.setData({
      editShow: false,
      kbH: 0,
      undoSeq: (this.data.undoSeq || 0) + 1,
      undoShow: true,
      undoText: '已删除「' + target.text + '」'
    })
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
