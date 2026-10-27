// pages/guestbook/guestbook.js —— 留言板（云端）
//
// ⚠️ 首版（1.0.x）暂时没有入口：个人主体小程序不能选「社交」类目，
//    留言板属于社区/论坛性质，挂着「工具-效率」提审有被判类目不符的风险。
//    代码、云函数、数据库都完整保留着，随时能恢复。
//
// 【以后想恢复留言板】
//   1. 打开根目录 app.json，在 tabBar.list 里加回这一项：
//        { "pagePath": "pages/guestbook/guestbook", "text": "留言",
//          "iconPath": "images/tabs/guest.png", "selectedIconPath": "images/tabs/guest-on.png" }
//      （tabBar 最多 5 项，现在的 4 项加这一项正好）
//      注：guest.png / guest-on.png 这两张图标删掉了，把 images/tabs/ 里的
//          social.png / social-on.png 各复制一份改名即可（它们本来就是同一张图）
//   2. 确认这 5 个云函数都在云端部署：
//      addMessage / getMessages / likeMessage / replyMessage / deleteMessage
//   3. 后台「用户生成内容场景声明」提交为「包含 - 文本」
//   4. 重新上传代码、提审

const COLORS = ['#4FC3F7', '#6FD070', '#FF8FC7', '#FFB93C', '#B388FF', '#FF7A6B']

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function fmtTime(ts) {
  const d = new Date(ts)
  return (
    d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  )
}

// 用昵称算一个固定的颜色，同一个人永远是同一个色
function colorOf(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) % 997
  }
  return COLORS[h % COLORS.length]
}

Page({
  data: {
    ready: false,
    nick: '',
    input: '',
    list: [],
    hasMore: false,
    loading: false,
    sending: false,

    replyTo: '',
    replyText: '',
    replyFocus: false
  },

  onLoad() {
    const app = getApp()
    this.setData({
      ready: !!app.cloudReady,
      nick: wx.getStorageSync('yelena_nick') || ''
    })
  },

  onShow() {
    if (this.data.ready && this.data.list.length === 0) {
      this.fetch(true)
    }
  },

  onNick(e) {
    this.setData({ nick: e.detail.value })
  },

  onInput(e) {
    this.setData({ input: e.detail.value })
  },

  // 拉取留言，reset = true 表示从头刷新
  fetch(reset) {
    if (this.data.loading) return

    const that = this
    const skip = reset ? 0 : this.data.list.length

    this.setData({ loading: true })

    wx.cloud.callFunction({
      name: 'getMessages',
      data: { skip: skip },
      success(res) {
        const r = res.result || {}

        if (!r.ok) {
          wx.showToast({ title: r.msg || '读取失败', icon: 'none' })
          return
        }

        const items = []
        for (let i = 0; i < r.list.length; i++) {
          const m = r.list[i]
          const nick = String(m.nick || '?')

          const replies = []
          const raw = m.replies || []
          for (let k = 0; k < raw.length; k++) {
            const rp = raw[k]
            const rn = String(rp.nick || '?')
            replies.push({
              id: rp.id,
              nick: rn,
              content: rp.content,
              time: fmtTime(rp.createdAt),
              initial: rn.slice(0, 1),
              color: colorOf(rn)
            })
          }

          items.push({
            id: m._id,
            nick: nick,
            content: m.content,
            time: fmtTime(m.createdAt),
            initial: nick.slice(0, 1),
            color: colorOf(nick),
            mine: !!m.mine,
            likeCount: m.likeCount || 0,
            liked: !!m.liked,
            replies: replies
          })
        }

        that.setData({
          list: reset ? items : that.data.list.concat(items),
          hasMore: !!r.hasMore
        })
      },
      fail(err) {
        const msg = String((err && err.errMsg) || '')
        const code = err && Number(err.errCode)

        // -501000 / FunctionName 不存在 = 云函数还没上传到云端
        if (code === -501000 || msg.indexOf('FunctionName') >= 0 || msg.indexOf('not found') >= 0) {
          wx.showToast({ title: '云函数还没上传，先去部署', icon: 'none' })
        } else {
          wx.showToast({ title: '连不上云端，检查环境 ID', icon: 'none' })
        }
      },
      complete() {
        that.setData({ loading: false })
      }
    })
  },

  loadMore() {
    this.fetch(false)
  },

  reload() {
    this.fetch(true)
  },

  // ---------------- 点赞 ----------------
  toggleLike(e) {
    const index = Number(e.currentTarget.dataset.index)
    const id = e.currentTarget.dataset.id
    const that = this

    wx.cloud.callFunction({
      name: 'likeMessage',
      data: { id: id },
      success(res) {
        const r = res.result || {}
        if (!r.ok) {
          wx.showToast({ title: r.msg || '操作失败', icon: 'none' })
          return
        }
        that.setData({
          ['list[' + index + '].liked']: r.liked,
          ['list[' + index + '].likeCount']: r.count
        })
        if (r.liked && wx.vibrateShort) {
          wx.vibrateShort({ type: 'light' })
        }
      },
      fail() {
        wx.showToast({ title: '网络不太好，再试一次', icon: 'none' })
      }
    })
  },

  // ---------------- 回复 ----------------
  openReply(e) {
    const that = this
    const id = e.currentTarget.dataset.id

    if (this.data.replyTo === id) {
      this.setData({ replyTo: '', replyText: '', replyFocus: false })
      return
    }

    this.setData({ replyTo: id, replyText: '', replyFocus: false })

    // 等输入框渲染完再置 true，不然 iOS 上键盘弹不出来
    setTimeout(function () {
      that.setData({ replyFocus: true })
    }, 120)
  },

  onReplyInput(e) {
    this.setData({ replyText: e.detail.value })
  },

  sendReply(e) {
    const index = Number(e.currentTarget.dataset.index)
    const id = e.currentTarget.dataset.id
    const nick = String(this.data.nick).trim()
    const content = String(this.data.replyText).trim()

    if (!nick) {
      wx.showToast({ title: '先在上面写个昵称', icon: 'none' })
      return
    }
    if (!content) {
      wx.showToast({ title: '回复不能是空的', icon: 'none' })
      return
    }

    const that = this
    wx.showLoading({ title: '发送中' })

    wx.cloud.callFunction({
      name: 'replyMessage',
      data: { id: id, nick: nick, content: content },
      success(res) {
        const r = res.result || {}

        if (!r.ok) {
          wx.showToast({ title: r.msg || '回复失败', icon: 'none' })
          return
        }

        const rp = r.reply
        const replies = that.data.list[index].replies.concat([
          {
            id: rp.id,
            nick: rp.nick,
            content: rp.content,
            time: fmtTime(rp.createdAt),
            initial: String(rp.nick).slice(0, 1),
            color: colorOf(String(rp.nick))
          }
        ])

        that.setData({
          ['list[' + index + '].replies']: replies,
          replyTo: '',
          replyText: '',
          replyFocus: false
        })

        wx.setStorageSync('yelena_nick', nick)
      },
      fail() {
        wx.showToast({ title: '网络不太好，再试一次', icon: 'none' })
      },
      complete() {
        wx.hideLoading()
      }
    })
  },

  // ---------------- 删除自己的留言 ----------------
  removeMsg(e) {
    const that = this
    const id = e.currentTarget.dataset.id

    wx.showModal({
      title: '删除留言',
      content: '删掉之后就找不回来了',
      success(res) {
        if (!res.confirm) return

        wx.cloud.callFunction({
          name: 'deleteMessage',
          data: { id: id },
          success(r) {
            const result = r.result || {}
            if (!result.ok) {
              wx.showToast({ title: result.msg || '删除失败', icon: 'none' })
              return
            }
            that.fetch(true)
          },
          fail() {
            wx.showToast({ title: '网络不太好，再试一次', icon: 'none' })
          }
        })
      }
    })
  },

  // ---------------- 发送留言 ----------------
  send() {
    if (this.data.sending) return

    const nick = String(this.data.nick).trim()
    const content = String(this.data.input).trim()

    if (!nick) {
      wx.showToast({ title: '先写个昵称', icon: 'none' })
      return
    }
    if (!content) {
      wx.showToast({ title: '写点什么吧', icon: 'none' })
      return
    }

    const that = this
    this.setData({ sending: true })

    wx.cloud.callFunction({
      name: 'addMessage',
      data: { nick: nick, content: content },
      success(res) {
        const r = res.result || {}

        if (!r.ok) {
          wx.showToast({ title: r.msg || '发送失败', icon: 'none' })
          return
        }

        wx.setStorageSync('yelena_nick', nick)
        that.setData({ input: '' })
        that.fetch(true)
        wx.showToast({ title: '发送成功', icon: 'none' })

        if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
      },
      fail() {
        wx.showToast({ title: '网络不太好，再试一次', icon: 'none' })
      },
      complete() {
        that.setData({ sending: false })
      }
    })
  }
})
