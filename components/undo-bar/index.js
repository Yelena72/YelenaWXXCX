// components/undo-bar/index.js —— 删除后 5 秒内可以撤销的横条
//
// 用法：
//   页面 json 里注册 "undo-bar": "/components/undo-bar/index"
//   wxml： <undo-bar show="{{undoShow}}" text="{{undoText}}" bind:undo="onUndo" bind:close="onUndoClose" />
//   删东西前把数据快照存到 this.undoSnapshot，删完 this.setData({ undoShow: true, ... })
//   用户点撤销 -> onUndo 里把快照写回去；5 秒没点 -> onUndoClose 里丢掉快照

Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    text: {
      type: String,
      value: '已删除'
    },
    // 每次删除都 +1，用来重新计时（不然连着删两条时，第二条的撤销时间会被第一条的定时器吃掉）
    seq: {
      type: Number,
      value: 0
    },
    // 多少毫秒后自动收起
    duration: {
      type: Number,
      value: 5000
    }
  },

  data: {
    visible: false
  },

  observers: {
    'show, seq': function (show) {
      if (show) {
        this.start()
      } else {
        this.stop()
      }
    }
  },

  detached: function () {
    this.stop()
  },

  methods: {
    start: function () {
      const that = this
      this.stop()
      this.setData({ visible: true })

      this.timer = setTimeout(function () {
        that.timer = null
        that.setData({ visible: false })
        that.triggerEvent('close')
      }, this.data.duration || 5000)
    },

    stop: function () {
      if (this.timer) {
        clearTimeout(this.timer)
        this.timer = null
      }
      this.setData({ visible: false })
    },

    onUndo: function () {
      this.stop()
      this.triggerEvent('undo')
    }
  }
})
